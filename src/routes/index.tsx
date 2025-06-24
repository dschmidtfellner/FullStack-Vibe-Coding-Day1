import { useBubbleAuth, useChildAccess } from "@/hooks/useBubbleAuth";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Plus, Send, X, Mic, Square, Play, Pause, Moon, Sun, Minus } from "lucide-react";
import { useState, useRef, useEffect, createContext, useContext } from "react";
import { Timestamp } from "firebase/firestore";
import { FirebaseMessage } from "@/types/firebase";
import {
  sendMessage,
  sendImageMessage,
  sendAudioMessage,
  listenToMessages,
  setTypingStatus,
  listenToTypingIndicators,
  toggleMessageReaction,
  getOrCreateConversation,
  // Log-related imports
  SleepLog,
  SleepEvent,
  listenToLogs,
  createSleepLog,
  updateSleepLog,
  getLog,
  sendLogComment,
  listenToLogComments,
} from "@/lib/firebase-messaging";

// Navigation Context for client-side routing
type NavigationState = {
  view: 'messaging' | 'logs' | 'log-detail' | 'log-sleep';
  logId?: string | null;
  childId: string | null;
  timezone: string;
  logs: SleepLog[];
  logCache: Map<string, SleepLog>;
  isLoading: boolean;
};

type NavigationContextType = {
  state: NavigationState;
  navigateToLogs: () => void;
  navigateToLogDetail: (logId: string) => void;
  navigateToNewLog: () => void;
  navigateToEditLog: (logId: string) => void;
  navigateToMessaging: () => void;
  navigateBack: () => void;
  updateLog: (log: SleepLog) => void;
  setLogs: (logs: SleepLog[]) => void;
};

const NavigationContext = createContext<NavigationContextType | null>(null);

function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}

function NavigationProvider({ children, initialChildId, initialTimezone }: { 
  children: React.ReactNode; 
  initialChildId: string | null;
  initialTimezone: string;
}) {
  // Parse initial view from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialView = urlParams.get('view') as NavigationState['view'] || 'logs';
  const initialLogId = urlParams.get('logId');

  const [state, setState] = useState<NavigationState>({
    view: initialView,
    logId: initialLogId,
    childId: initialChildId,
    timezone: initialTimezone,
    logs: [],
    logCache: new Map(),
    isLoading: false,
  });

  // Update URL without page reload
  const updateURL = (view: string, logId?: string | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    if (logId) {
      url.searchParams.set('logId', logId);
    } else {
      url.searchParams.delete('logId');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const navigateToLogs = () => {
    setState(prev => ({ ...prev, view: 'logs', logId: null }));
    updateURL('logs');
  };

  const navigateToLogDetail = (logId: string) => {
    setState(prev => ({ ...prev, view: 'log-detail', logId }));
    updateURL('log-detail', logId);
  };

  const navigateToNewLog = () => {
    setState(prev => ({ ...prev, view: 'log-sleep', logId: null }));
    updateURL('log-sleep');
  };

  const navigateToEditLog = (logId: string) => {
    setState(prev => ({ ...prev, view: 'log-sleep', logId }));
    updateURL('log-sleep', logId);
  };

  const navigateToMessaging = () => {
    setState(prev => ({ ...prev, view: 'messaging', logId: null }));
    updateURL('messaging');
  };

  const navigateBack = () => {
    // Smart back navigation
    if (state.view === 'log-detail' || state.view === 'log-sleep') {
      navigateToLogs();
    } else {
      navigateToLogs(); // Default fallback
    }
  };

  const updateLog = (log: SleepLog) => {
    setState(prev => ({
      ...prev,
      logCache: new Map(prev.logCache).set(log.id, log),
      logs: prev.logs.map(l => l.id === log.id ? log : l)
    }));
  };

  const setLogs = (logs: SleepLog[]) => {
    setState(prev => ({ ...prev, logs }));
    // Update cache with new logs
    const newCache = new Map(state.logCache);
    logs.forEach(log => newCache.set(log.id, log));
    setState(prev => ({ ...prev, logCache: newCache }));
  };

  const contextValue: NavigationContextType = {
    state,
    navigateToLogs,
    navigateToLogDetail,
    navigateToNewLog,
    navigateToEditLog,
    navigateToMessaging,
    navigateBack,
    updateLog,
    setLogs,
  };

  return (
    <NavigationContext.Provider value={contextValue}>
      {children}
    </NavigationContext.Provider>
  );
}

function ImageMessage({ imageUrl, onImageClick }: { imageUrl: string; onImageClick: (imageUrl: string) => void }) {
  return (
    <img 
      src={imageUrl} 
      alt="Shared image" 
      className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
      onClick={(e) => {
        e.stopPropagation(); // Prevent triggering reaction picker
        onImageClick(imageUrl);
      }}
    />
  );
}

function AudioMessage({ audioUrl }: { audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };
  
  const handleAudioEnd = () => {
    setIsPlaying(false);
  };
  
  return (
    <div className="flex items-center gap-3 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={togglePlay}
        className="btn btn-circle btn-sm text-white hover:opacity-90"
        style={{ backgroundColor: '#503460' }}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 rounded-full" style={{ backgroundColor: '#503460' }}></div>
          <div className="w-6 h-1 rounded-full" style={{ backgroundColor: '#503460' }}></div>
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#503460' }}></div>
          <div className="w-4 h-1 rounded-full" style={{ backgroundColor: '#503460' }}></div>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={handleAudioEnd}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
    </div>
  );
}


export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, isLoading, error } = useBubbleAuth();

  // Show loading animation while authenticating or if there's an auth error
  if (isLoading || error || !user) {
    return <LoadingScreen message="Connecting..." />;
  }

  // Parse URL parameters for NavigationProvider
  const urlParams = new URLSearchParams(window.location.search);
  const childId = urlParams.get('childId');
  const timezone = urlParams.get('timezone') || 'America/New_York';

  // Only show loading if we don't have required data
  if (!childId) {
    return <LoadingScreen message="Missing child ID..." />;
  }

  return (
    <div className="not-prose">
      <NavigationProvider initialChildId={childId} initialTimezone={timezone}>
        <AppRouter />
      </NavigationProvider>
    </div>
  );
}

// Main app router that switches views based on navigation state
function AppRouter() {
  const { state } = useNavigation();
  
  // Check if user has access to the current child
  const hasChildAccess = useChildAccess(state.childId);
  
  if (!hasChildAccess) {
    return <LoadingScreen message="Checking permissions..." />;
  }

  // Route to appropriate view based on navigation state
  const renderMainView = () => {
    switch (state.view) {
      case 'messaging':
        return <MessagingApp />;
      case 'logs':
        return <LogsListView />;
      case 'log-detail':
        return <LogDetailView />;
      case 'log-sleep':
        // When modal is open, we need to determine what to show behind it
        if (state.logId) {
          // If editing an existing log, show the log detail view
          return <LogDetailView />;
        } else {
          // If creating a new log, show the logs list
          return <LogsListView />;
        }
      default:
        return <LogsListView />;
    }
  };

  return (
    <>
      {renderMainView()}
      {state.view === 'log-sleep' && <SleepLogModal />}
    </>
  );
}

// Skeleton loading components that match content shape
function LogsListSkeleton({ user }: { user: any }) {
  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing */}
      <div className="h-[20px]"></div>
      
      {/* Header skeleton */}
      <div className={`px-4 py-4 border-b ${
        user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-white'
      }`}>
        <div className={`h-6 w-24 rounded animate-pulse mb-2 ${
          user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
        }`}></div>
        <div className={`h-4 w-48 rounded animate-pulse ${
          user?.darkMode ? 'bg-gray-700' : 'bg-gray-100'
        }`}></div>
      </div>

      {/* Log tiles skeleton */}
      <div className="overflow-y-auto pb-32 h-[calc(100%-120px)]">
        <div className="mb-6">
          {/* Date header skeleton */}
          <div className={`sticky top-0 px-4 py-2 ${
            user?.darkMode ? 'bg-[#2a223a] border-b border-gray-700' : 'bg-gray-50 border-b border-gray-200'
          }`}>
            <div className={`h-4 w-20 rounded animate-pulse ${
              user?.darkMode ? 'bg-gray-600' : 'bg-gray-300'
            }`}></div>
          </div>
          
          {/* Log tile skeletons */}
          <div className="space-y-3 px-4 pt-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`p-4 rounded-2xl ${
                user?.darkMode ? 'bg-[#4a3f5a]' : 'bg-[#F0DDEF]'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    {/* Time skeleton */}
                    <div className="h-4 w-32 rounded animate-pulse mb-2" style={{ backgroundColor: '#745288' }}></div>
                    {/* Title skeleton */}
                    <div className={`h-6 w-16 rounded animate-pulse ${
                      user?.darkMode ? 'bg-gray-300' : 'bg-gray-700'
                    }`}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogDetailSkeleton({ user }: { user: any }) {
  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing */}
      <div className="h-[20px]"></div>
      
      {/* Header skeleton */}
      <div className={`px-4 py-4 border-b ${
        user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full animate-pulse ${
              user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`}></div>
            <div>
              <div className={`h-6 w-24 rounded animate-pulse mb-2 ${
                user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
              }`}></div>
              <div className={`h-4 w-36 rounded animate-pulse ${
                user?.darkMode ? 'bg-gray-700' : 'bg-gray-100'
              }`}></div>
            </div>
          </div>
          <div className={`h-8 w-16 rounded animate-pulse ${
            user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`}></div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="px-4 py-4">
        <div className={`p-4 rounded-lg mb-4 ${
          user?.darkMode ? 'bg-[#3a2f4a]' : 'bg-gray-50'
        }`}>
          <div className={`h-6 w-20 rounded animate-pulse mb-3 ${
            user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`}></div>
          <div className={`h-4 w-16 rounded animate-pulse ${
            user?.darkMode ? 'bg-gray-700' : 'bg-gray-100'
          }`}></div>
        </div>
      </div>
    </div>
  );
}

function SleepLogModalSkeleton({ user }: { user: any }) {
  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing */}
      <div className="h-[20px]"></div>
      
      {/* Header skeleton */}
      <div className={`px-4 py-4 border-b ${
        user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`h-6 w-32 rounded animate-pulse mb-2 ${
              user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`}></div>
            <div className={`h-4 w-40 rounded animate-pulse ${
              user?.darkMode ? 'bg-gray-700' : 'bg-gray-100'
            }`}></div>
          </div>
          <div className={`w-8 h-8 rounded-full animate-pulse ${
            user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`}></div>
        </div>
      </div>

      {/* Form skeleton */}
      <div className="px-4 py-6">
        <div className="mb-6">
          <div className={`h-4 w-20 rounded animate-pulse mb-3 ${
            user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
          }`}></div>
          <div className="flex gap-2">
            {[1, 2].map((i) => (
              <div key={i} className={`flex-1 p-3 rounded-lg border-2 ${
                user?.darkMode ? 'border-gray-600 bg-[#2a223a]' : 'border-gray-300 bg-white'
              }`}>
                <div className={`w-5 h-5 rounded animate-pulse mx-auto mb-1 ${
                  user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
                }`}></div>
                <div className={`h-4 w-12 rounded animate-pulse mx-auto ${
                  user?.darkMode ? 'bg-gray-700' : 'bg-gray-100'
                }`}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessagingSkeleton({ user }: { user: any }) {
  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing */}
      <div className={`${user?.needsSpacer ? 'h-[100px]' : 'h-[64px]'}`}></div>
      
      {/* Messages Container */}
      <div className={`overflow-y-auto px-4 py-6 pb-24 space-y-4 ${
        user?.needsSpacer ? 'h-[calc(100%-100px)]' : 'h-[calc(100%-64px)]'
      }`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`flex flex-col ${i % 2 === 0 ? 'items-end' : 'items-start'}`}>
            <div className="max-w-[75%] flex flex-col">
              {/* Sender name skeleton */}
              <div className={`h-3 w-20 rounded animate-pulse mb-1 ${
                user?.darkMode ? 'bg-gray-600' : 'bg-gray-300'
              }`}></div>
              
              {/* Message bubble skeleton */}
              <div 
                className={`min-w-[200px] rounded-2xl px-4 py-3 ${
                  i % 2 === 0 
                    ? `rounded-br-md` 
                    : `${user?.darkMode ? 'bg-[#3a3a3a]' : 'bg-gray-200'} rounded-bl-md`
                }`} 
                style={{ backgroundColor: i % 2 === 0 ? (user?.darkMode ? '#2d2637' : '#F0DDEF') : undefined }}
              >
                <div className={`h-4 w-32 rounded animate-pulse ${
                  user?.darkMode ? 'bg-gray-600' : 'bg-gray-400'
                }`}></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Message Input skeleton */}
      <div className={`fixed left-0 right-0 border-t z-10 ${
        user?.darkMode 
          ? 'border-gray-700 bg-[#2d2637]' 
          : 'border-gray-200 bg-white'
      }`} style={{ bottom: '81px' }}>
        <div className="max-w-[800px] mx-auto p-4">
          <div className="flex items-center gap-3 max-w-full">
            <div className={`w-10 h-10 rounded-full animate-pulse ${
              user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`}></div>
            <div className={`w-10 h-10 rounded-full animate-pulse ${
              user?.darkMode ? 'bg-gray-600' : 'bg-gray-200'
            }`}></div>
            <div className={`flex-1 h-12 rounded-full animate-pulse ${
              user?.darkMode ? 'bg-[#3a3a3a]' : 'bg-gray-100'
            }`}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fallback loading screen for initial auth
function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="not-prose min-h-screen flex items-center justify-center bg-[#15111B]">
      <div className="text-center">
        <div className="loading loading-spinner w-8 h-8 mb-4" style={{ color: '#745288' }}></div>
        <p className="text-gray-300">{message}</p>
      </div>
    </div>
  );
}

function MessagingApp() {
  const { user } = useBubbleAuth();
  const [messages, setMessages] = useState<FirebaseMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName: string }[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null); // messageId or null
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  
  // Check if user has access to the current child
  const hasChildAccess = useChildAccess(childId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const childIdParam = urlParams.get('childId');
    const childNameParam = urlParams.get('childName');
    
    console.log('🔍 Conversation initialization:', {
      fullURL: window.location.href,
      childIdParam,
      childNameParam,
    });
    
    if (childIdParam) {
      console.log('✅ Found childId, creating conversation...');
      // Create or get conversation for this child
      getOrCreateConversation(childIdParam, childNameParam || undefined)
        .then((convId) => {
          console.log('🎉 Conversation created successfully:', convId);
          setConversationId(convId);
          setChildId(childIdParam);
          setIsLoadingConversation(false);
        })
        .catch((error) => {
          console.error('❌ Error initializing conversation:', error);
          setIsLoadingConversation(false);
        });
    } else {
      console.log('❌ No childId parameter found');
      // Development mode - require childId parameter
      setIsLoadingConversation(false);
    }
  }, []);

  // Listen to messages for the current conversation
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = listenToMessages(conversationId, (newMessages) => {
      setMessages(newMessages);
    });

    return unsubscribe;
  }, [conversationId]);

  // Listen to typing indicators
  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = listenToTypingIndicators(user.id, (typingUsers) => {
      setTypingUsers(typingUsers);
    });

    return unsubscribe;
  }, [user?.id]);

  // Close reaction picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.reaction-picker') && !target.closest('.reaction-button')) {
        setShowReactionPicker(null);
      }
    };

    if (showReactionPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showReactionPicker]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || !conversationId || !childId) {
      console.log('Cannot send: missing required data', { 
        newMessage: newMessage.trim(), 
        user: !!user, 
        conversationId, 
        childId 
      });
      return;
    }
    
    console.log('Attempting to send message:', {
      userId: user.id,
      userName: user.name,
      text: newMessage.trim(),
      conversationId,
      childId
    });
    
    try {
      const messageId = await sendMessage(
        user.id,
        user.name,
        newMessage.trim(),
        conversationId,
        childId
      );
      console.log('Message sent successfully:', messageId);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePhotoSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !conversationId || !childId) {
      console.log('Missing required data for file upload:', { 
        file: !!file, 
        user: !!user, 
        conversationId, 
        childId 
      });
      return;
    }

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    console.log('Starting image upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      userId: user.id,
      userName: user.name,
      conversationId,
      childId
    });

    setIsUploading(true);

    try {
      const messageId = await sendImageMessage(
        user.id,
        user.name,
        file,
        conversationId,
        childId
      );
      console.log('Image message sent successfully:', messageId);
    } catch (error) {
      console.error("Failed to upload image:", error);
      console.error("Error details:", error instanceof Error ? error.message : 'Unknown error');
      alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    
    // Handle Firebase Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", { 
      month: "numeric", 
      day: "numeric" 
    }) + ", " + date.toLocaleTimeString("en-US", { 
      hour: "numeric", 
      minute: "2-digit" 
    }).toLowerCase();
  };

  const isOwnMessage = (senderId: string) => {
    return user?.id === senderId;
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Automatically send the audio
        if (user && conversationId && childId) {
          setIsUploading(true);
          try {
            await sendAudioMessage(
              user.id,
              user.name,
              audioBlob,
              conversationId,
              childId
            );
          } catch (error) {
            console.error("Failed to upload audio:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to upload audio: ${errorMessage}`);
          } finally {
            setIsUploading(false);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!user) return;

    // If user is typing, set typing status to true
    if (value.trim()) {
      setTypingStatus(user.id, user.name, true);
      
      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set a timeout to stop typing indicator after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(user.id, user.name, false);
      }, 2000);
    } else {
      // If input is empty, immediately stop typing indicator
      setTypingStatus(user.id, user.name, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleSendWithTypingCleanup = async () => {
    // Stop typing indicator when sending message
    if (user) {
      setTypingStatus(user.id, user.name, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
    await handleSend();
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      await toggleMessageReaction(
        messageId,
        emoji,
        user.id,
        user.name
      );
      setShowReactionPicker(null);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];


  // Show loading for any of these conditions
  if (isLoadingConversation || !conversationId || !childId || !hasChildAccess) {
    return <MessagingSkeleton user={user || { darkMode: false }} />;
  }

  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Default top spacing (64px) + extra spacer for free trial header (36px) */}
      <div className={`${
        user?.needsSpacer ? 'h-[100px]' : 'h-[64px]'
      }`}></div>
      
      {/* Messages Container */}
      <div className={`overflow-y-auto px-4 py-6 pb-24 space-y-4 ${
        user?.needsSpacer ? 'h-[calc(100%-100px)]' : 'h-[calc(100%-64px)]'
      }`}>
        {messages.map((message) => {
          const isOwn = isOwnMessage(message.senderId);
          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              <div className="max-w-[75%] flex flex-col">
                {/* Sender name and timestamp */}
                <div className={`text-xs mb-1 flex justify-between items-center ${
                  user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  <span>{message.senderName}</span>
                  <span>{formatTime(message.timestamp)}</span>
                </div>
                
                {/* Message bubble - clickable to show reactions */}
                <div className="relative group">
                  <div 
                    className={`min-w-[200px] rounded-2xl cursor-pointer transition-opacity hover:opacity-90 ${
                      isOwn 
                        ? `${user?.darkMode ? 'text-white' : 'text-gray-800'} rounded-br-md` 
                        : `${user?.darkMode ? 'bg-[#3a3a3a] text-gray-200' : 'bg-gray-200 text-gray-800'} rounded-bl-md`
                    } ${message.type === 'image' ? 'p-2' : 'px-4 py-3'}`} 
                    style={{ backgroundColor: isOwn ? (user?.darkMode ? '#2d2637' : '#F0DDEF') : undefined }}
                    onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                  >
                    {message.type === 'image' && message.imageId ? (
                      <ImageMessage imageUrl={message.imageId} onImageClick={handleImageClick} />
                    ) : message.type === 'audio' && message.audioId ? (
                      <AudioMessage audioUrl={message.audioId} />
                    ) : (
                      <p className="text-base leading-relaxed">{message.text}</p>
                    )}
                  </div>
                  
                  {/* Reaction picker */}
                  {showReactionPicker === message.id && (
                    <div className={`reaction-picker absolute top-8 right-0 rounded-lg shadow-lg border p-2 flex gap-1 z-20 ${
                      user?.darkMode 
                        ? 'bg-[#2a2a2a] border-gray-600' 
                        : 'bg-white border-gray-200'
                    }`}>
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(message.id, emoji)}
                          className={`rounded p-1 text-lg transition-colors ${
                            user?.darkMode 
                              ? 'hover:bg-[#3a3a3a]' 
                              : 'hover:bg-gray-100'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {/* Display existing reactions */}
                  {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.values(message.reactions).map((reaction) => (
                        <button
                          key={reaction.emoji}
                          onClick={() => handleReaction(message.id, reaction.emoji)}
                          title={`${reaction.userNames?.length === 1 ? reaction.userNames[0] : reaction.userNames?.slice(0, -1).join(', ') + ' and ' + reaction.userNames?.[reaction.userNames.length - 1]} reacted with ${reaction.emoji}`}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                            reaction.users.includes(user?.id || '')
                              ? user?.darkMode
                                ? 'bg-[#2d2637] border-gray-600 text-white'
                                : 'bg-gray-100 border-gray-300 text-gray-700'
                              : user?.darkMode
                                ? 'bg-[#3a3a3a] border-gray-600 text-white hover:bg-[#4a4a4a]'
                                : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.users.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {/* Invisible div to scroll to */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input - Floating at bottom with space for Bubble nav */}
      <div className={`fixed left-0 right-0 border-t z-10 ${
        user?.darkMode 
          ? 'border-gray-700 bg-[#2d2637]' 
          : 'border-gray-200 bg-white'
      }`} style={{ bottom: '81px' }}>
        <div className="max-w-[800px] mx-auto p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {/* Typing Indicators */}
          {typingUsers.length > 0 && (
            <div className={`mb-3 px-4 py-2 text-sm ${
              user?.darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className={`w-2 h-2 rounded-full animate-bounce ${
                    user?.darkMode ? 'bg-gray-400' : 'bg-gray-400'
                  }`}></div>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${
                    user?.darkMode ? 'bg-gray-400' : 'bg-gray-400'
                  }`} style={{ animationDelay: '0.1s' }}></div>
                  <div className={`w-2 h-2 rounded-full animate-bounce ${
                    user?.darkMode ? 'bg-gray-400' : 'bg-gray-400'
                  }`} style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span>
                  {typingUsers.length === 1 
                    ? `${typingUsers[0].userName} is typing...`
                    : typingUsers.length === 2
                    ? `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`
                    : `${typingUsers[0].userName} and ${typingUsers.length - 1} others are typing...`
                  }
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 max-w-full">
            <button 
              onClick={handlePhotoSelect}
              disabled={isUploading}
              className={`btn btn-circle btn-sm border-none flex-shrink-0 disabled:opacity-50 ${
                user?.darkMode 
                  ? 'hover:opacity-90' 
                  : 'text-white hover:opacity-90'
              }`}
              style={{ 
                backgroundColor: user?.darkMode ? '#F0DDEF' : '#503460',
                color: user?.darkMode ? '#503460' : 'white'
              }}
            >
            {isUploading ? (
              <div className="loading loading-spinner w-4 h-4"></div>
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>

            <button 
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isUploading}
              className={`btn btn-circle btn-sm border-none flex-shrink-0 disabled:opacity-50 ${
                isRecording 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : user?.darkMode
                  ? 'hover:opacity-90'
                  : 'text-white hover:opacity-90'
              }`}
              style={{ 
                backgroundColor: isRecording ? undefined : (user?.darkMode ? '#F0DDEF' : '#503460'),
                color: isRecording ? undefined : (user?.darkMode ? '#503460' : 'white')
              }}
            >
            {isRecording ? (
              <Square className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && handleSendWithTypingCleanup()}
              placeholder="Start typing here"
              className={`input input-bordered w-full pr-12 rounded-full focus:outline-none h-12 box-border ${
                user?.darkMode 
                  ? 'bg-[#3a3a3a] border-gray-600 text-gray-200 placeholder-gray-500 focus:border-gray-500' 
                  : 'bg-gray-100 border-gray-300 text-gray-700 placeholder-gray-500 focus:border-gray-300'
              }`}
            />
            <button 
              onClick={handleSendWithTypingCleanup}
              disabled={isUploading || !newMessage.trim()}
              className={`absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm flex-shrink-0 z-10 hover:opacity-90 disabled:opacity-50 ${
                user?.darkMode ? '' : 'text-white'
              }`}
              style={{ 
                backgroundColor: user?.darkMode ? '#F0DDEF' : '#503460',
                color: user?.darkMode ? '#503460' : 'white'
              }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Minimal bottom spacing for iframe */}
      <div className={`h-[20px] ${
        user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
      }`}></div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8"
          onClick={closeImageModal}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
            >
              <X className="w-6 h-6 text-gray-600" />
            </button>
            <img
              src={selectedImage}
              alt="Full size image"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: 'calc(100vh - 8rem)', maxWidth: 'calc(100vw - 4rem)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}


// Log List View Component - now uses navigation context
function LogsListView() {
  const { user } = useBubbleAuth();
  const { state, navigateToLogDetail, navigateToNewLog, navigateToEditLog, setLogs } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Listen to logs with real-time updates
  useEffect(() => {
    if (!state.childId) return;

    // Only show loading if we haven't loaded data before AND no cached data
    if (!hasLoadedOnce && state.logs.length === 0) {
      setIsLoading(true);
    }

    console.log('Setting up logs listener for child:', state.childId);
    const unsubscribe = listenToLogs(state.childId, (newLogs) => {
      console.log('Received logs update:', newLogs.length, 'logs');
      setLogs(newLogs); // Update navigation state
      setIsLoading(false);
      setHasLoadedOnce(true);
    });

    return unsubscribe;
  }, [state.childId, setLogs]);

  // Format time in the baby's timezone
  const formatTimeInTimezone = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  // Format date in the baby's timezone
  const formatDateInTimezone = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    }).format(date);
  };

  // Get time range for log display (e.g., "11:45 am—1:50 pm")
  const getTimeRange = (log: SleepLog) => {
    if (!log.events || log.events.length === 0) {
      return formatTimeInTimezone(log.timestamp);
    }

    const firstEvent = log.events[0];
    const lastEvent = log.events[log.events.length - 1];
    
    if (log.events.length === 1 || !log.isComplete) {
      return firstEvent.localTime;
    }

    return `${firstEvent.localTime}—${lastEvent.localTime}`;
  };

  // Group logs by date - use state.logs from navigation context
  const groupedLogs = state.logs.reduce((groups: { [key: string]: SleepLog[] }, log) => {
    const dateKey = log.localDate || formatDateInTimezone(log.timestamp);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(log);
    return groups;
  }, {});

  // Only show skeleton if we're loading AND have no data to show
  if (isLoading && state.logs.length === 0) {
    return <LogsListSkeleton user={user} />;
  }

  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing - minimal for iframe embedding */}
      <div className="h-[20px]"></div>

      {/* Logs Container */}
      <div className="overflow-y-auto pb-32 h-[calc(100%-40px)]">
        {Object.keys(groupedLogs).length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              user?.darkMode ? 'bg-[#3a2f4a]' : 'bg-gray-100'
            }`}>
              <Moon className={`w-8 h-8 ${
                user?.darkMode ? 'text-gray-400' : 'text-gray-600'
              }`} />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${
              user?.darkMode ? 'text-white' : 'text-gray-800'
            }`}>No sleep logs yet</h3>
            <p className={`text-center mb-6 ${
              user?.darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>Tap the plus button to start tracking sleep</p>
          </div>
        ) : (
          // Logs list grouped by date
          Object.entries(groupedLogs).map(([dateKey, dateLogs]) => (
            <div key={dateKey} className="mb-6">
              {/* Date separator */}
              <div className={`sticky top-0 px-4 py-2 text-sm font-medium ${
                user?.darkMode 
                  ? 'bg-[#2a223a] text-gray-300 border-b border-gray-700' 
                  : 'bg-gray-50 text-gray-700 border-b border-gray-200'
              }`}>
                {dateKey}
              </div>
              
              {/* Logs for this date */}
              <div className="space-y-3 px-4 pt-3">
                {dateLogs.map((log, index) => {
                  // Count naps for numbering (only count naps before this one in the same day)
                  const napNumber = dateLogs
                    .slice(0, index + 1)
                    .filter(l => l.sleepType === 'nap').length;
                  
                  return (
                    <div
                      key={log.id}
                      className={`p-4 rounded-2xl relative ${
                        user?.darkMode 
                          ? 'bg-[#4a3f5a]' 
                          : 'bg-[#F0DDEF]'  // Purple background for all logs
                      }`}
                    >
                      <div 
                        onClick={() => navigateToLogDetail(log.id)}
                        className="cursor-pointer transition-all hover:opacity-90"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            {/* Time range - smaller purple text */}
                            <div className={`text-sm mb-1`} style={{
                              color: '#745288'
                            }}>
                              {getTimeRange(log)}
                            </div>
                            
                            {/* Log type with number - Domine font, size 22, weight 400 */}
                            <div 
                              className={`font-domine ${user?.darkMode ? 'text-white' : 'text-gray-900'}`}
                              style={{ 
                                fontSize: '22px',
                                fontWeight: '400',
                                lineHeight: '1.2'
                              }}
                            >
                              {log.sleepType === 'bedtime' ? 'Bedtime' : 
                               log.sleepType === 'nap' ? `Nap ${napNumber}` : 'Sleep'}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 ml-4">
                            {/* Continue Logging button - only show if log is not complete */}
                            {!log.isComplete && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent tile click
                                  navigateToEditLog(log.id);
                                }}
                                className="px-4 py-2 rounded-full font-karla transition-colors bg-[#503460] text-white hover:bg-[#5d3e70]"
                                style={{
                                  fontSize: '14px',
                                  fontWeight: '400'
                                }}
                              >
                                Continue Logging
                              </button>
                            )}
                            
                            {/* Comment indicator - far right */}
                            {log.commentCount > 0 && (
                              <div className={`flex items-center gap-1 ${
                                user?.darkMode ? 'text-white' : 'text-gray-700'
                              }`}>
                                <MessageCircle className="w-4 h-4" />
                                <span className="text-sm">{log.commentCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button - Centered and Bigger */}
      <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={navigateToNewLog}
          className={`btn btn-circle shadow-lg border-none ${
            user?.darkMode 
              ? 'text-white hover:opacity-90' 
              : 'text-white hover:opacity-90'
          }`}
          style={{ 
            backgroundColor: user?.darkMode ? '#9B7EBD' : '#503460',
            width: '64px',
            height: '64px'
          }}
        >
          <Plus className="w-8 h-8" />
        </button>
      </div>

      {/* Minimal bottom spacing for iframe */}
      <div className={`h-[20px] ${
        user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
      }`}></div>
    </div>
  );
}

function LogDetailView() {
  const { user } = useBubbleAuth();
  const { state, navigateBack, navigateToEditLog, updateLog } = useNavigation();
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [comments, setComments] = useState<FirebaseMessage[]>([]);
  const [newComment, setNewComment] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  
  // Section collapse states - Headlines collapsed by default, Log and Comments expanded
  const [headlinesExpanded, setHeadlinesExpanded] = useState(false);
  const [logExpanded, setLogExpanded] = useState(true);
  const [commentsExpanded, setCommentsExpanded] = useState(true);

  // Get current log from cache or fetch it
  useEffect(() => {
    if (!state.logId) return;

    // First check cache
    const cachedLog = state.logCache.get(state.logId);
    if (cachedLog) {
      setLog(cachedLog);
      return;
    }

    // If not in cache, fetch it
    setIsLoading(true);
    getLog(state.logId)
      .then((logData) => {
        if (logData) {
          setLog(logData);
          updateLog(logData); // Add to cache
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading log:', error);
        setIsLoading(false);
      });
  }, [state.logId, state.logCache, updateLog]);

  // Get conversation ID for this child
  useEffect(() => {
    if (!state.childId) return;

    getOrCreateConversation(state.childId)
      .then((convId) => {
        setConversationId(convId);
      })
      .catch((error) => {
        console.error('Error getting conversation:', error);
      });
  }, [state.childId]);

  // Listen to comments for this log
  useEffect(() => {
    if (!state.logId) return;

    const unsubscribe = listenToLogComments(state.logId, (newComments) => {
      setComments(newComments);
    });

    return unsubscribe;
  }, [state.logId]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Format time in the baby's timezone
  const formatTimeInTimezone = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  // Format date in the baby's timezone
  const formatDateInTimezone = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    }).format(date);
  };

  // Get event type text
  const getEventTypeText = (type: SleepEvent['type']): string => {
    switch (type) {
      case 'put_in_bed': return 'Put in bed';
      case 'fell_asleep': return 'Fell asleep';
      case 'woke_up': return 'Woke up';
      case 'out_of_bed': return 'Out of bed';
    }
  };

  // Get sleep duration text
  const getDurationText = (log: SleepLog) => {
    if (log.duration && log.duration > 0) {
      const hours = Math.floor(log.duration / 60);
      const minutes = log.duration % 60;
      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${minutes}m`;
    }
    return log.isComplete ? 'Complete' : 'In progress';
  };

  // Handle comment send
  const handleSendComment = async () => {
    if (!newComment.trim() || !user || !conversationId || !state.logId) return;

    try {
      await sendLogComment(
        user.id,
        user.name,
        newComment.trim(),
        conversationId,
        state.childId!,
        state.logId
      );
      setNewComment("");
    } catch (error) {
      console.error("Failed to send comment:", error);
      alert(`Failed to send comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle back navigation - use navigation context
  const handleBack = () => {
    navigateBack();
  };

  // Handle edit navigation - use navigation context
  const handleEdit = () => {
    if (state.logId) {
      navigateToEditLog(state.logId);
    }
  };

  // Only show skeleton if we're loading AND have no log data
  if (isLoading && !log) {
    return <LogDetailSkeleton user={user} />;
  }
  
  // If we don't have log data but aren't loading, show error state
  if (!log) {
    return (
      <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto flex items-center justify-center ${
        user?.darkMode ? 'bg-[#15111B] text-white' : 'bg-white text-gray-800'
      }`}>
        <div className="text-center">
          <p>Log not found</p>
          <button 
            onClick={() => {
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set('view', 'logs');
              newUrl.searchParams.delete('logId');
              window.location.href = newUrl.toString();
            }}
            className="btn btn-primary mt-4"
          >
            Back to Logs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing - minimal for iframe embedding */}
      <div className="h-[20px]"></div>

      {/* Log Tile - Visual Continuity from List View */}
      <div className="px-4 py-4">
        <div className={`p-4 rounded-2xl ${
          user?.darkMode 
            ? 'bg-[#4a3f5a]' 
            : 'bg-[#F0DDEF]'  // Purple background to match list
        }`}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {/* Time range - smaller purple text */}
              <div className="text-sm mb-1" style={{
                color: '#745288'
              }}>
                {(() => {
                  if (!log.events || log.events.length === 0) {
                    return formatTimeInTimezone(log.timestamp);
                  }
                  const firstEvent = log.events[0];
                  const lastEvent = log.events[log.events.length - 1];
                  if (log.events.length === 1 || !log.isComplete) {
                    return firstEvent.localTime;
                  }
                  return `${firstEvent.localTime}—${lastEvent.localTime}`;
                })()}
              </div>
              
              {/* Log type with number - Domine font, size 22, weight 400 */}
              <div 
                className={`font-domine ${user?.darkMode ? 'text-white' : 'text-gray-900'}`}
                style={{ 
                  fontSize: '22px',
                  fontWeight: '400',
                  lineHeight: '1.2'
                }}
              >
                {(() => {
                  if (log.sleepType === 'bedtime') return 'Bedtime';
                  if (log.sleepType === 'nap') {
                    // Calculate nap number - this is a simplified version
                    // In a real app, you'd want to pass this from the list or calculate based on date
                    return 'Nap 1'; // You could make this dynamic if needed
                  }
                  return 'Sleep';
                })()}
              </div>
            </div>
            
            <div className="flex items-center gap-3 ml-4">
              {/* Continue Logging button - only show if log is not complete */}
              {!log.isComplete && (
                <button
                  onClick={() => navigateToEditLog(state.logId!)}
                  className="px-4 py-2 rounded-full font-karla transition-colors bg-[#503460] text-white hover:bg-[#5d3e70]"
                  style={{
                    fontSize: '14px',
                    fontWeight: '400'
                  }}
                >
                  Continue Logging
                </button>
              )}
              
              {/* Comment indicator - far right */}
              {log.commentCount > 0 && (
                <div className={`flex items-center gap-1 ${
                  user?.darkMode ? 'text-white' : 'text-gray-700'
                }`}>
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-sm">{log.commentCount}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Container with Collapsible Sections */}
      <div className="flex flex-col h-full h-[calc(100%-180px)]">
        
        {/* Headlines Section */}
        <div>
          <button
            onClick={() => setHeadlinesExpanded(!headlinesExpanded)}
            className={`w-full px-4 py-2 flex items-center justify-between text-left ${
              user?.darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
            }`}
          >
            <h2 className={`font-domine text-2xl ${
              user?.darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Headlines
            </h2>
            <div className="w-6 h-6" style={{ 
              color: user?.darkMode ? '#c084fc' : '#745288' 
            }}>
              {headlinesExpanded ? <Minus className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
          </button>
          
          {headlinesExpanded && (
            <div className="px-4 pb-4">
              <div className="border-l-4 pl-4 space-y-3" style={{ borderColor: '#F0DDEF' }}>
                <div className="flex justify-between items-center">
                  <span className={`text-base ${
                    user?.darkMode ? 'text-white' : 'text-gray-800'
                  }`}>
                    Sleep Quality: Good
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-base ${
                    user?.darkMode ? 'text-white' : 'text-gray-800'
                  }`}>
                    Total Sleep Time: 2h 15m
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-base ${
                    user?.darkMode ? 'text-white' : 'text-gray-800'
                  }`}>
                    Time to Fall Asleep: 12 minutes
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Log Section */}
        <div>
          <button
            onClick={() => setLogExpanded(!logExpanded)}
            className={`w-full px-4 py-2 flex items-center justify-between text-left ${
              user?.darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
            }`}
          >
            <h2 className={`font-domine text-2xl ${
              user?.darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Log
            </h2>
            <div className="w-6 h-6" style={{ 
              color: user?.darkMode ? '#c084fc' : '#745288' 
            }}>
              {logExpanded ? <Minus className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
          </button>
          
          {logExpanded && log.events && log.events.length > 0 && (
            <div className="px-4 pb-4">
              <div className="border-l-4 pl-4 space-y-3" style={{ borderColor: '#F0DDEF' }}>
                {log.events
                  .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime())
                  .map((event, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className={`text-base ${
                        user?.darkMode ? 'text-white' : 'text-gray-800'
                      }`}>
                        {getEventTypeText(event.type)}
                      </span>
                      <span className="text-base" style={{ color: '#745288' }}>
                        {event.localTime}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="flex-1 flex flex-col min-h-0 pb-20">
          <button
            onClick={() => setCommentsExpanded(!commentsExpanded)}
            className={`w-full px-4 py-2 flex items-center justify-between text-left ${
              user?.darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
            }`}
          >
            <h2 className={`font-domine text-2xl ${
              user?.darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Comments
            </h2>
            <div className="w-6 h-6" style={{ 
              color: user?.darkMode ? '#c084fc' : '#745288' 
            }}>
              {commentsExpanded ? <Minus className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </div>
          </button>

          {commentsExpanded && (
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {comments.length === 0 ? (
                <div className="border-l-4 pl-4 space-y-3" style={{ borderColor: '#F0DDEF' }}>
                  <div className="flex justify-between items-center">
                    <span className={`text-base italic ${
                      user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      No comments yet
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-l-4 pl-4 space-y-4" style={{ borderColor: '#F0DDEF' }}>
                  {comments.map((comment) => {
                    const isOwn = user?.id === comment.senderId;
                    return (
                      <div key={comment.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                        <div className="max-w-[75%] flex flex-col">
                          {/* Sender name and timestamp */}
                          <div className="text-xs mb-1 flex justify-between items-center">
                            <span className={user?.darkMode ? 'text-gray-400' : 'text-gray-600'}>
                              {comment.senderName}
                            </span>
                            <span style={{ color: '#745288' }}>
                              {formatTimeInTimezone(comment.timestamp)}
                            </span>
                          </div>
                          
                          {/* Comment bubble */}
                          <div 
                            className={`min-w-[100px] rounded-2xl px-4 py-3 ${
                              isOwn 
                                ? `${user?.darkMode ? 'text-white' : 'text-gray-800'} rounded-br-md` 
                                : `${user?.darkMode ? 'bg-[#3a3a3a] text-gray-200' : 'bg-gray-200 text-gray-800'} rounded-bl-md`
                            }`} 
                            style={{ backgroundColor: isOwn ? (user?.darkMode ? '#2d2637' : '#F0DDEF') : undefined }}
                          >
                            <p className="text-sm leading-relaxed">{comment.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Comment Input - Pinned to bottom */}
      <div className={`fixed left-0 right-0 bottom-0 border-t z-10 ${
        user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-white'
      }`}>
        <div className="max-w-[800px] mx-auto p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
                placeholder="Add a comment..."
                className={`input input-bordered w-full pr-12 rounded-full focus:outline-none ${
                  user?.darkMode 
                    ? 'bg-[#3a3a3a] border-gray-600 text-gray-200 placeholder-gray-500 focus:border-gray-500' 
                    : 'bg-gray-100 border-gray-300 text-gray-700 placeholder-gray-500 focus:border-gray-300'
                }`}
              />
              <button 
                onClick={handleSendComment}
                disabled={!newComment.trim()}
                className={`absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm flex-shrink-0 z-10 hover:opacity-90 disabled:opacity-50 ${
                  user?.darkMode ? '' : 'text-white'
                }`}
                style={{ 
                  backgroundColor: user?.darkMode ? '#F0DDEF' : '#503460',
                  color: user?.darkMode ? '#503460' : 'white'
                }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Minimal bottom spacing for iframe */}
      <div className={`h-[20px] ${
        user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
      }`}></div>
    </div>
  );
}

function SleepLogModal() {
  const { user } = useBubbleAuth();
  const { state, navigateBack, updateLog } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [sleepType, setSleepType] = useState<'nap' | 'bedtime'>('nap');
  const [events, setEvents] = useState<Array<{ type: SleepEvent['type']; timestamp: Date }>>([]);
  const [currentEventType, setCurrentEventType] = useState<SleepEvent['type']>('put_in_bed');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isComplete, setIsComplete] = useState(false);
  const [existingLog, setExistingLog] = useState<SleepLog | null>(null);
  const [showEndOfSleep, setShowEndOfSleep] = useState(false);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  
  // Determine client type from URL (default to sleep consulting)
  const urlParams = new URLSearchParams(window.location.search);
  const clientType = urlParams.get('clientType') || 'sleep-consulting';
  
  // Set default sleep type based on time
  useEffect(() => {
    const hour = currentTime.getHours();
    // If between 4:00am and 6:00pm, default to nap, otherwise bedtime
    if (hour >= 4 && hour < 18) {
      setSleepType('nap');
    } else {
      setSleepType('bedtime');
    }
  }, [currentTime]);

  // Load existing log if editing
  useEffect(() => {
    if (state.logId) {
      // First check cache
      const cachedLog = state.logCache.get(state.logId);
      if (cachedLog) {
        setExistingLog(cachedLog);
        setSleepType(cachedLog.sleepType || 'nap');
        setIsComplete(cachedLog.isComplete || false);
        if (cachedLog.events) {
          const eventsWithDates = cachedLog.events.map(event => ({
            type: event.type,
            timestamp: event.timestamp.toDate()
          }));
          setEvents(eventsWithDates);
        }
        return;
      }

      // If not in cache, fetch it
      setIsLoading(true);
      getLog(state.logId)
        .then((log) => {
          if (log) {
            setExistingLog(log);
            setSleepType(log.sleepType || 'nap');
            setIsComplete(log.isComplete || false);
            if (log.events) {
              const eventsWithDates = log.events.map(event => ({
                type: event.type,
                timestamp: event.timestamp.toDate()
              }));
              setEvents(eventsWithDates);
            }
            updateLog(log); // Add to cache
          }
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Error loading log:', error);
          setIsLoading(false);
        });
    }
  }, [state.logId, state.logCache, updateLog]);

  // Get valid next event types based on current sequence
  const getValidNextEventTypes = (): SleepEvent['type'][] => {
    if (events.length === 0) {
      return ['put_in_bed', 'fell_asleep']; // Any valid first event
    }

    const lastEvent = events[events.length - 1];
    switch (lastEvent.type) {
      case 'put_in_bed':
        return ['fell_asleep', 'out_of_bed'];
      case 'fell_asleep':
        return ['woke_up', 'out_of_bed'];
      case 'woke_up':
        return ['fell_asleep', 'out_of_bed'];
      case 'out_of_bed':
        return []; // Session complete
      default:
        return [];
    }
  };

  // Get display text for event types
  const getEventTypeText = (type: SleepEvent['type']): string => {
    switch (type) {
      case 'put_in_bed': return 'Put in bed';
      case 'fell_asleep': return 'Fell asleep';
      case 'woke_up': return 'Woke up';
      case 'out_of_bed': return 'Out of bed';
    }
  };

  // Get question text for sleep consulting flow
  const getQuestionText = (): string => {
    if (showEndOfSleep) {
      return `What time did the ${sleepType} end?`;
    }
    
    if (events.length === 0) {
      return "When were they put in bed?";
    }
    
    const lastEvent = events[events.length - 1];
    switch (lastEvent.type) {
      case 'put_in_bed':
        return "When did they fall asleep?";
      case 'fell_asleep':
        return "When did they wake up?";
      case 'woke_up':
        return "When did they fall asleep?";
      default:
        return "When did they fall asleep?";
    }
  };

  // Get supporting text for end of sleep
  const getSupportingText = (): string | null => {
    if (showEndOfSleep) {
      return "(i.e. when were they taken out of bed)";
    }
    return null;
  };

  // Get next event type for sleep consulting flow
  const getNextEventType = (): SleepEvent['type'] => {
    if (showEndOfSleep) {
      return 'out_of_bed';
    }
    
    if (events.length === 0) {
      return 'put_in_bed';
    }
    
    const lastEvent = events[events.length - 1];
    switch (lastEvent.type) {
      case 'put_in_bed':
        return 'fell_asleep';
      case 'fell_asleep':
        return 'woke_up';
      case 'woke_up':
        return 'fell_asleep';
      default:
        return 'fell_asleep';
    }
  };

  // Format time for input
  const formatTimeForInput = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      timeZone: state.timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format time for display
  const formatTimeForDisplay = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  // Handle time input change
  const handleTimeChange = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const newTime = new Date(currentTime);
    newTime.setHours(hours, minutes, 0, 0);
    
    // Smart overnight handling - if time seems to go backwards significantly, assume next day
    if (events.length > 0) {
      const lastEventTime = events[events.length - 1].timestamp;
      const timeDiff = newTime.getTime() - lastEventTime.getTime();
      
      // If new time is more than 12 hours earlier, assume it's the next day
      if (timeDiff < -12 * 60 * 60 * 1000) {
        newTime.setDate(newTime.getDate() + 1);
      }
    }
    
    setCurrentTime(newTime);
  };

  // Add event to the sequence
  const handleAddEvent = () => {
    if (!user) return;

    const newEvent = {
      type: currentEventType,
      timestamp: new Date(currentTime)
    };

    const updatedEvents = [...events, newEvent];
    setEvents(updatedEvents);

    // Auto-advance time by 5 minutes for next event
    const nextTime = new Date(currentTime.getTime() + 5 * 60 * 1000);
    setCurrentTime(nextTime);

    // Check if session should be marked complete
    if (currentEventType === 'out_of_bed') {
      setIsComplete(true);
    } else {
      // Set default next event type
      const validNext = getValidNextEventTypes();
      if (validNext.length > 0) {
        setCurrentEventType(validNext[0]);
      }
    }
  };

  // Remove last event
  const handleRemoveLastEvent = () => {
    if (events.length > 0) {
      const updatedEvents = events.slice(0, -1);
      setEvents(updatedEvents);
      setIsComplete(false);

      // Update validNextEvents based on new events state
      // We need to manually calculate since getValidNextEventTypes uses current events state
      let validNext: SleepEvent['type'][] = [];
      if (updatedEvents.length === 0) {
        validNext = ['put_in_bed', 'fell_asleep'];
      } else {
        const lastEvent = updatedEvents[updatedEvents.length - 1];
        switch (lastEvent.type) {
          case 'put_in_bed':
            validNext = ['fell_asleep', 'out_of_bed'];
            break;
          case 'fell_asleep':
            validNext = ['woke_up', 'out_of_bed'];
            break;
          case 'woke_up':
            validNext = ['fell_asleep', 'out_of_bed'];
            break;
          case 'out_of_bed':
            validNext = [];
            break;
        }
      }

      // Reset current event type to a valid option
      if (validNext.length > 0) {
        setCurrentEventType(validNext[0]);
      } else if (updatedEvents.length === 0) {
        setCurrentEventType('put_in_bed');
      }
    }
  };

  // Save the log
  const handleSave = async () => {
    if (!user || !state.childId) return;

    setIsLoading(true);
    try {
      if (clientType === 'sleep-consulting' && events.length === 0) {
        // For sleep consulting first screen - create "Put In Bed" event
        const combinedDateTime = new Date(currentDate);
        combinedDateTime.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0);
        
        const putInBedEvent = {
          type: 'put_in_bed' as SleepEvent['type'],
          timestamp: combinedDateTime
        };

        // Create new log with put in bed event
        const newLogId = await createSleepLog(
          state.childId,
          user.id,
          user.name,
          sleepType,
          putInBedEvent,
          state.timezone
        );
        
        // Store the log ID for subsequent events
        setCurrentLogId(newLogId);
        
        // Add event to state for next screen
        setEvents([putInBedEvent]);
        
        // Reset time to current time for next event and don't navigate back
        setCurrentTime(new Date());
        setIsLoading(false);
        return;
      } else if (clientType === 'sleep-consulting' && events.length > 0) {
        // For sleep consulting subsequent events - add event to existing log
        const nextEventType = getNextEventType();
        const newEvent = {
          type: nextEventType,
          timestamp: new Date(currentTime)
        };

        const updatedEvents = [...events, newEvent];
        
        // Update the existing log
        const logIdToUse = state.logId || currentLogId;
        await updateSleepLog(logIdToUse!, updatedEvents, state.timezone, nextEventType === 'out_of_bed');
        
        if (nextEventType === 'out_of_bed') {
          // If this was the final event, navigate back
          navigateBack();
          return;
        } else {
          // Add event to state and continue to next screen
          setEvents(updatedEvents);
          setCurrentTime(new Date());
          setShowEndOfSleep(false); // Reset end of sleep toggle
          setIsLoading(false);
          return;
        }
      } else if (state.logId && existingLog) {
        // Update existing log
        await updateSleepLog(state.logId, events, state.timezone, isComplete);
        
        // Update the cache with new data - need to convert Date to Timestamp and include localTime
        const eventsWithLocalTime = events.map(e => ({
          type: e.type,
          timestamp: Timestamp.fromDate(e.timestamp),
          localTime: formatTimeForDisplay(e.timestamp)
        }));
        const updatedLog = { ...existingLog, events: eventsWithLocalTime, isComplete };
        updateLog(updatedLog);
      } else if (events.length > 0) {
        // Create new log with existing events
        const newLogId = await createSleepLog(
          state.childId,
          user.id,
          user.name,
          sleepType,
          events[0],
          state.timezone
        );

        // If there are multiple events, update the log with all events
        if (events.length > 1) {
          await updateSleepLog(newLogId, events, state.timezone, isComplete);
        }
      }

      // Navigate back to logs list using navigation context
      navigateBack();
    } catch (error) {
      console.error('Error saving log:', error);
      alert('Failed to save log. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel and go back
  const handleCancel = () => {
    // If there are events, ask user what to do with simpler options
    if (events.length > 0 && user) {
      const leave = confirm('You have unsaved changes. Are you sure you want to leave without saving?');
      if (!leave) {
        return; // Stay on page
      }
    }
    
    // Navigate back without saving using navigation context
    navigateBack();
  };

  const validNextEvents = getValidNextEventTypes();
  const canAddEvent = validNextEvents.includes(currentEventType);
  const canSave = events.length > 0 || (clientType === 'sleep-consulting' && events.length === 0);

  if (isLoading) {
    return <SleepLogModalSkeleton user={user} />;
  }

  return (
    <>
      {/* Modal Backdrop - subtle overlay for click handling */}
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }} onClick={handleCancel}></div>
      
      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-16">
        <div 
          className={`w-full max-w-[800px] h-[75vh] font-['Poppins'] rounded-t-3xl transition-transform duration-300 ease-out shadow-2xl relative ${
            user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
          }`}
          style={{
            animation: 'slideUp 0.3s ease-out'
          }}
        >
          {/* Close button - X in upper right */}
          <button
            onClick={handleCancel}
            className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-60 transition-colors ${
              user?.darkMode 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
          
          {/* Top spacing for modal */}
          <div className="h-[20px]"></div>

      {/* Content - Ensure space for fixed buttons */}
      <div className="overflow-y-auto px-4 py-6" style={{ paddingBottom: '120px', height: 'calc(75vh - 100px)' }}>
        
        {/* Sleep Consulting Client Flow - First Screen */}
        {clientType === 'sleep-consulting' && events.length === 0 && (
          <div className="space-y-8">
            {/* Title */}
            <div className="text-center">
              <h2 className={`text-2xl font-medium mb-2 ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                When were they put in bed?
              </h2>
            </div>

            {/* Date Input - Bigger and Friendlier */}
            <div className="mb-8">
              <label className={`block text-lg font-medium mb-4 ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={currentDate.toISOString().split('T')[0]}
                  onChange={(e) => setCurrentDate(new Date(e.target.value))}
                  className={`input input-bordered w-full text-lg py-4 h-16 ${
                    user?.darkMode 
                      ? 'bg-[#3a3a3a] border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-800'
                  }`}
                />
                {/* Show "Today" if current date is selected */}
                {currentDate.toISOString().split('T')[0] === new Date().toISOString().split('T')[0] && (
                  <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-sm pointer-events-none ${
                    user?.darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Today
                  </div>
                )}
              </div>
            </div>

            {/* Time Input - Bigger and Friendlier */}
            <div className="mb-8">
              <label className={`block text-lg font-medium mb-4 ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Time
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={formatTimeForInput(currentTime)}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className={`input input-bordered w-full text-lg py-4 h-16 ${
                    user?.darkMode 
                      ? 'bg-[#3a3a3a] border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-800'
                  }`}
                />
                {/* Show "Now" if current time is selected (within 1 minute) */}
                {(() => {
                  const now = new Date();
                  const timeDiff = Math.abs(currentTime.getTime() - now.getTime());
                  const isCurrentTime = timeDiff < 60000; // Within 1 minute
                  
                  return isCurrentTime && (
                    <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-sm pointer-events-none ${
                      user?.darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Now
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Sleep Type Selection - Moved Below Date/Time */}
            <div className="mb-6">
              <label className={`block text-lg font-medium mb-4 ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Sleep Type
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setSleepType('nap')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    sleepType === 'nap'
                      ? user?.darkMode
                        ? 'bg-[#3a2f4a] text-white'
                        : 'bg-white text-gray-800'
                      : user?.darkMode
                        ? 'border-gray-600 bg-[#2a223a] text-gray-300 hover:border-gray-500'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                  style={{
                    borderColor: sleepType === 'nap' ? '#745288' : undefined,
                    backgroundColor: sleepType === 'nap' && !user?.darkMode ? '#F0DDEF' : undefined
                  }}
                >
                  <Sun className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-base font-medium">Nap</div>
                </button>
                <button
                  onClick={() => setSleepType('bedtime')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    sleepType === 'bedtime'
                      ? user?.darkMode
                        ? 'bg-[#3a2f4a] text-white'
                        : 'bg-white text-gray-800'
                      : user?.darkMode
                        ? 'border-gray-600 bg-[#2a223a] text-gray-300 hover:border-gray-500'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                  style={{
                    borderColor: sleepType === 'bedtime' ? '#745288' : undefined,
                    backgroundColor: sleepType === 'bedtime' && !user?.darkMode ? '#F0DDEF' : undefined
                  }}
                >
                  <Moon className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-base font-medium">Bedtime</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sleep Consulting Client Flow - Subsequent Screens */}
        {clientType === 'sleep-consulting' && events.length > 0 && (
          <div className="space-y-8">
            {/* Title */}
            <div className="text-center">
              <h2 className={`text-2xl font-medium mb-2 ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                {getQuestionText()}
              </h2>
              {getSupportingText() && (
                <p className={`text-sm ${
                  user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {getSupportingText()}
                </p>
              )}
            </div>

            {/* Time Input Only - No Date */}
            <div className="mb-8">
              <label className={`block text-lg font-medium mb-4 ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Time
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={formatTimeForInput(currentTime)}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className={`input input-bordered w-full text-lg py-4 h-16 ${
                    user?.darkMode 
                      ? 'bg-[#3a3a3a] border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-800'
                  }`}
                />
                {/* Show "Now" if current time is selected (within 1 minute) */}
                {(() => {
                  const now = new Date();
                  const timeDiff = Math.abs(currentTime.getTime() - now.getTime());
                  const isCurrentTime = timeDiff < 60000; // Within 1 minute
                  
                  return isCurrentTime && (
                    <div className={`absolute right-4 top-1/2 transform -translate-y-1/2 text-sm pointer-events-none ${
                      user?.darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Now
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Add end of sleep option - only show if not already showing end */}
            {!showEndOfSleep && (
              <div className="text-center">
                <button
                  onClick={() => setShowEndOfSleep(true)}
                  className={`text-sm underline ${
                    user?.darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-500'
                  }`}
                >
                  or Add end of sleep
                </button>
              </div>
            )}
          </div>
        )}
        
      </div>

      {/* Fixed bottom actions */}
      <div className={`fixed left-0 right-0 border-t z-50 ${
        user?.darkMode 
          ? 'border-gray-700 bg-[#2d2637]' 
          : 'border-gray-200 bg-white'
      }`} style={{ bottom: '20px' }}>
        <div className="max-w-[800px] mx-auto p-4">
          <button
            onClick={handleSave}
            disabled={!canSave || isLoading}
            className={`btn w-full text-white text-lg py-4 h-14 ${
              user?.darkMode ? 'hover:opacity-90' : 'hover:opacity-90'
            }`}
            style={{ 
              backgroundColor: user?.darkMode ? '#9B7EBD' : '#503460'
            }}
          >
            {isLoading ? (
              <div className="loading loading-spinner w-5 h-5"></div>
            ) : (
              'Save Log'
            )}
          </button>
        </div>
      </div>
        </div>
      </div>
    </>
  );
}