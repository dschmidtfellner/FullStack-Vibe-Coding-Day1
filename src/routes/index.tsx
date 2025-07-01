import { useBubbleAuth, useChildAccess } from "@/hooks/useBubbleAuth";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Send, X, Mic, Square, Play, Pause, Moon, Sun, Minus, ChevronLeft, ChevronRight, MessageSquare, Search } from "lucide-react";
import { SleepLogTile } from "@/components/SleepLogTile";
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import { useState, useRef, useEffect, createContext, useContext } from "react";
import { Timestamp, collection, query, where, orderBy, onSnapshot, updateDoc, doc, arrayUnion } from "firebase/firestore";
import { FirebaseMessage } from "@/types/firebase";
import { calculateSleepStatistics } from "@/utils/sleepStatistics";
import { db } from "@/lib/firebase";
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
  view: 'messaging' | 'logs' | 'log-detail' | 'log-sleep' | 'edit-log';
  logId?: string | null;
  childId: string | null;
  timezone: string;
  logs: SleepLog[];
  logCache: Map<string, SleepLog>;
  isLoading: boolean;
  previousView?: 'messaging' | 'logs' | 'log-detail' | 'log-sleep' | 'edit-log' | null;
  defaultLogDate?: string; // For passing default date to new log modal
};

type NavigationContextType = {
  state: NavigationState;
  navigateToLogs: () => void;
  navigateToLogDetail: (logId: string) => void;
  navigateToNewLog: (defaultDate?: string) => void;
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
    previousView: null,
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

  const navigateToNewLog = (defaultDate?: string) => {
    // Try to send to Bubble parent first
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'FIREBASE_APP_MODAL',
        modalType: 'NEW_LOG_MODAL',
        data: { defaultDate, childId: initialChildId }
      }, '*');
      return;
    }
    
    // Fallback to inline modal
    setState(prev => ({ 
      ...prev, 
      view: 'log-sleep', 
      logId: null, 
      defaultLogDate: defaultDate,
      previousView: prev.view === 'log-sleep' ? prev.previousView : prev.view 
    }));
    updateURL('log-sleep');
  };

  const navigateToEditLog = (logId: string) => {
    // Try to send to Bubble parent first
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'FIREBASE_APP_MODAL',
        modalType: 'EDIT_LOG_MODAL',
        data: { logId, childId: initialChildId }
      }, '*');
      return;
    }
    
    // Fallback to inline modal
    setState(prev => ({ ...prev, view: 'edit-log', logId, previousView: prev.view === 'edit-log' ? prev.previousView : prev.view }));
    updateURL('edit-log', logId);
  };

  const navigateToMessaging = () => {
    setState(prev => ({ ...prev, view: 'messaging', logId: null }));
    updateURL('messaging');
  };

  const navigateBack = () => {
    // Send modal close message to Bubble parent if in iframe and coming from modal views
    if (window.parent !== window) {
      if (state.view === 'log-sleep' || state.view === 'edit-log') {
        window.parent.postMessage({
          type: 'FIREBASE_APP_MODAL_CLOSE',
          modalType: state.view === 'log-sleep' ? 'NEW_LOG_MODAL' : 'EDIT_LOG_MODAL'
        }, '*');
      }
    }
    
    // Different logic based on current view
    if (state.view === 'log-sleep') {
      // From modal: go to Log Detail if we have a logId, otherwise use previousView
      if (state.logId) {
        navigateToLogDetail(state.logId);
      } else if (state.previousView === 'logs') {
        navigateToLogs();
      } else if (state.previousView === 'messaging') {
        navigateToMessaging();
      } else {
        navigateToLogs();
      }
    } else if (state.view === 'log-detail') {
      // From log detail: always go back to logs list
      navigateToLogs();
    } else if (state.view === 'edit-log') {
      // From edit log: go back to log detail
      if (state.logId) {
        navigateToLogDetail(state.logId);
      } else {
        navigateToLogs();
      }
    } else {
      // Default fallback for other views
      navigateToLogs();
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
      case 'edit-log':
        return null; // Don't render background view when EditLogModal is open
      default:
        return <LogsListView />;
    }
  };

  return (
    <>
      {renderMainView()}
      {state.view === 'log-sleep' && <SleepLogModal />}
      {state.view === 'edit-log' && <EditLogModal />}
    </>
  );
}

// Skeleton loading components that match content shape
function LogsListSkeleton({ user }: { user: any }) {
  return (
    <div className={`relative h-[100vh] font-['Poppins'] max-w-[800px] mx-auto ${
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
                <div className="flex justify-between items-center">
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
    <div className={`relative h-full font-['Poppins'] max-w-[600px] mx-auto ${
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
      <div className={`absolute left-0 right-0 border-t z-10 ${
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
      <div className={`absolute left-0 right-0 border-t z-10 ${
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
          className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-8"
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
  const [viewMode, setViewMode] = useState<'events' | 'windows'>('events');
  
  // Selected date state - default to today in baby's timezone
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: state.timezone
    }).format(today); // YYYY-MM-DD format
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // Helper function to close comments modal with Bubble notification
  const closeCommentsModal = () => {
    // Send modal close message to Bubble parent if in iframe
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'FIREBASE_APP_MODAL_CLOSE',
        modalType: 'COMMENTS_MODAL'
      }, '*');
    }
    
    setShowCommentsModal(false);
  };

  // Expose function to open comments modal from outside (e.g., Bubble app)
  useEffect(() => {
    (window as any).openCommentsModal = () => {
      // Try to send to Bubble parent first
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'FIREBASE_APP_MODAL',
          modalType: 'COMMENTS_MODAL',
          data: { childId: state.childId }
        }, '*');
        return;
      }
      
      // Fallback to inline modal
      setShowCommentsModal(true);
    };
    
    return () => {
      delete (window as any).openCommentsModal;
    };
  }, [state.childId]);

  // Listen to logs with real-time updates
  useEffect(() => {
    if (!state.childId) return;

    // Only show loading if we haven't loaded data before AND no cached data
    if (!hasLoadedOnce && state.logs.length === 0) {
      setIsLoading(true);
    }

    const unsubscribe = listenToLogs(state.childId, (newLogs) => {
      setLogs(newLogs); // Update navigation state
      setIsLoading(false);
      setHasLoadedOnce(true);
    });

    return unsubscribe;
  }, [state.childId]);

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

  // Format date in the baby's timezone (commented out as unused)
  // const formatDateInTimezone = (timestamp: any) => {
  //   if (!timestamp) return '';
  //   
  //   const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  //   return new Intl.DateTimeFormat('en-US', {
  //     timeZone: state.timezone,
  //     month: 'short',
  //     day: 'numeric',
  //     weekday: 'short'
  //   }).format(date);
  // };

  // Get date in YYYY-MM-DD format for comparison
  const getLocalDateKey = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: state.timezone
    }).format(date);
  };

  // Date navigation functions
  const goToPreviousDay = () => {
    const currentDate = new Date(selectedDate + 'T12:00:00'); // Add time to avoid timezone issues
    currentDate.setDate(currentDate.getDate() - 1);
    setSelectedDate(new Intl.DateTimeFormat('en-CA').format(currentDate));
  };

  const goToNextDay = () => {
    const currentDate = new Date(selectedDate + 'T12:00:00'); // Add time to avoid timezone issues
    currentDate.setDate(currentDate.getDate() + 1);
    setSelectedDate(new Intl.DateTimeFormat('en-CA').format(currentDate));
  };

  // Format selected date for display
  const formatSelectedDate = () => {
    const date = new Date(selectedDate + 'T12:00:00');
    return new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  // Check if selected date is today
  const isToday = () => {
    const today = new Date();
    const todayString = new Intl.DateTimeFormat('en-CA', {
      timeZone: state.timezone
    }).format(today);
    return selectedDate === todayString;
  };

  // Get relative date text for display under the date
  const getRelativeDateText = () => {
    const today = new Date();
    const todayString = new Intl.DateTimeFormat('en-CA', {
      timeZone: state.timezone
    }).format(today);
    
    if (selectedDate === todayString) {
      return 'Today';
    }
    
    const selectedDateObj = new Date(selectedDate + 'T12:00:00');
    const todayObj = new Date(todayString + 'T12:00:00');
    const diffTime = selectedDateObj.getTime() - todayObj.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === -1) {
      return 'Yesterday';
    } else if (diffDays < -1) {
      return `${Math.abs(diffDays)} days ago`;
    } else if (diffDays === 1) {
      return '1 day from now';
    } else if (diffDays > 1) {
      return `${diffDays} days from now`;
    }
    
    return null;
  };


  // Filter logs for selected date and get previous day's bedtime
  const getLogsForSelectedDate = () => {
    const selectedDateLogs = state.logs.filter(log => {
      const logDateKey = log.localDate || getLocalDateKey(log.timestamp);
      return logDateKey === selectedDate;
    });

    // Get previous day's bedtime (if any)
    const previousDate = new Date(selectedDate + 'T12:00:00');
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateKey = new Intl.DateTimeFormat('en-CA').format(previousDate);
    
    const previousDayBedtime = state.logs.find(log => {
      const logDateKey = log.localDate || getLocalDateKey(log.timestamp);
      return logDateKey === previousDateKey && log.sleepType === 'bedtime';
    });

    return { selectedDateLogs, previousDayBedtime };
  };

  const { selectedDateLogs, previousDayBedtime } = getLogsForSelectedDate();

  // Process all events for Windows view
  const getWindowsViewData = () => {
    // Collect events from logs that started on selected day + previous day bedtime's out of bed
    const allEvents: Array<{
      event: SleepEvent;
      logId: string;
      logType: 'bedtime' | 'nap';
      timestamp: Date;
    }> = [];

    // Add ONLY the "out of bed" event from previous day bedtime if exists
    if (previousDayBedtime && previousDayBedtime.events) {
      const outOfBedEvent = previousDayBedtime.events.find(event => event.type === 'out_of_bed');
      if (outOfBedEvent) {
        allEvents.push({
          event: outOfBedEvent,
          logId: previousDayBedtime.id,
          logType: previousDayBedtime.sleepType || 'nap',
          timestamp: outOfBedEvent.timestamp.toDate()
        });
      }
    }

    // Add ALL events from current day logs (logs that started on selected day)
    selectedDateLogs.forEach(log => {
      if (log.events) {
        log.events.forEach(event => {
          allEvents.push({
            event,
            logId: log.id,
            logType: log.sleepType || 'nap',
            timestamp: event.timestamp.toDate()
          });
        });
      }
    });

    // Sort chronologically
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate durations between events
    const windowsData = allEvents.map((item, index) => {
      let duration = 0;
      if (index < allEvents.length - 1) {
        const nextTimestamp = allEvents[index + 1].timestamp;
        duration = nextTimestamp.getTime() - item.timestamp.getTime();
      }

      return {
        ...item,
        duration,
        durationString: formatDuration(duration)
      };
    });

    return windowsData;
  };

  // Format duration in "Xh Ym" format
  const formatDuration = (milliseconds: number) => {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Only show skeleton if we're loading AND have no data to show
  if (isLoading && state.logs.length === 0) {
    return <LogsListSkeleton user={user} />;
  }

  return (
    <div className={`relative h-[100vh] font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing - minimal for iframe embedding */}
      <div className="h-[20px]"></div>

      {/* Date Navigation Header */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          {/* Left: Date Navigation Controls */}
          <div className="flex items-center">
            {/* Previous Day Button */}
            <button
              onClick={goToPreviousDay}
              className={`p-2 rounded-full transition-colors ${
                user?.darkMode 
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
              }`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Date Display - Clickable */}
            <div className="flex flex-col items-start mx-3">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`font-domine text-2xl font-medium transition-colors ${
                  user?.darkMode 
                    ? 'text-white hover:text-gray-200' 
                    : 'text-gray-800 hover:text-gray-600'
                }`}
              >
                {isToday() ? 'Today' : formatSelectedDate()}
              </button>
              {/* Relative date text */}
              {getRelativeDateText() && getRelativeDateText() !== 'Today' && (
                <div className={`text-sm mt-1 ${
                  user?.darkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {getRelativeDateText()}
                </div>
              )}
            </div>

            {/* Next Day Button */}
            <button
              onClick={goToNextDay}
              className={`p-2 rounded-full transition-colors ${
                user?.darkMode 
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
              }`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* Windows/Events Toggle */}
            <button
              onClick={() => setViewMode(viewMode === 'events' ? 'windows' : 'events')}
              className={`px-4 py-2 rounded-full border transition-colors ${
                user?.darkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
              style={{
                fontSize: '14px',
                fontWeight: '400'
              }}
            >
              {viewMode === 'events' ? 'Windows' : 'Events'}
            </button>

            {/* Comments Icon */}
            <button
              onClick={() => {
                // Try to send to Bubble parent first
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: 'FIREBASE_APP_MODAL',
                    modalType: 'COMMENTS_MODAL',
                    data: { childId: state.childId }
                  }, '*');
                  return;
                }
                
                // Fallback to inline modal
                setShowCommentsModal(true);
              }}
              className={`p-2 rounded-full transition-colors ${
                user?.darkMode 
                  ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                  : 'hover:bg-gray-100 text-gray-600 hover:text-gray-800'
              }`}
            >
              <MessageSquare className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Date Picker */}
        {showDatePicker && (
          <div className="mt-4 flex justify-start">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setShowDatePicker(false);
              }}
              className={`input input-bordered ${
                user?.darkMode 
                  ? 'bg-[#3a3a3a] border-gray-600 text-white' 
                  : 'bg-white border-gray-300 text-gray-800'
              }`}
            />
          </div>
        )}
      </div>

      {/* Logs Container */}
      <div className="relative overflow-y-auto pb-32 h-[calc(100%-120px)]">
        {selectedDateLogs.length === 0 && !previousDayBedtime ? (
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
            }`}>No sleep logs for this day</h3>
            <p className={`text-center mb-6 ${
              user?.darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>Tap the plus button to start tracking sleep</p>
          </div>
        ) : viewMode === 'events' ? (
          // Events view (original tile view)
          <div className="space-y-3 px-4">
            {/* Previous Day's Bedtime (if exists) */}
            {previousDayBedtime && (
              <div style={{ opacity: 0.5 }}>
                <SleepLogTile
                  key={`prev-${previousDayBedtime.id}`}
                  log={previousDayBedtime}
                  user={user}
                  napNumber={0}
                  onClick={() => navigateToLogDetail(previousDayBedtime.id)}
                  onContinueLogging={() => navigateToEditLog(previousDayBedtime.id)}
                  formatTimeInTimezone={formatTimeInTimezone}
                  showClickable={true}
                  isNightBefore={true}
                  nightBeforeEndTime={
                    previousDayBedtime.events && previousDayBedtime.events.length > 0
                      ? formatTimeInTimezone(previousDayBedtime.events[previousDayBedtime.events.length - 1].timestamp)
                      : ''
                  }
                />
              </div>
            )}

            {/* Current Day's Logs */}
            {(() => {
              const sortedLogs = selectedDateLogs.sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime());
              return sortedLogs.map((log, index) => {
                // Count naps for numbering
                const napNumber = sortedLogs
                  .slice(0, index + 1)
                  .filter(l => l.sleepType === 'nap').length;
              
                return (
                  <SleepLogTile
                    key={log.id}
                    log={log}
                    user={user}
                    napNumber={napNumber}
                    onClick={() => navigateToLogDetail(log.id)}
                    onContinueLogging={() => navigateToEditLog(log.id)}
                    formatTimeInTimezone={formatTimeInTimezone}
                    showClickable={true}
                  />
                );
              });
            })()}
          </div>
        ) : (
          // Windows view
          <div className="px-4">
            {(() => {
              const windowsData = getWindowsViewData();
              
              return windowsData.map((window, index) => {
                const { event, logId, durationString } = window;
                
                // Don't show duration for the last event
                if (index === windowsData.length - 1) return null;
                
                // Determine tile type and styling
                let tileColor = '';
                let textColor = '';
                let tileText = '';
                let showSeparator = false;
                
                if (event.type === 'out_of_bed') {
                  tileColor = user?.darkMode ? 'bg-gray-700' : 'bg-gray-200';
                  textColor = user?.darkMode ? 'text-white' : 'text-gray-800';
                  tileText = `${durationString} out of bed`;
                  showSeparator = true;
                } else if (event.type === 'fell_asleep') {
                  tileColor = 'bg-[#745288]';
                  textColor = 'text-white';
                  tileText = `${durationString} asleep`;
                } else if (event.type === 'put_in_bed' || event.type === 'woke_up') {
                  tileColor = 'bg-[#F0DDEF]';
                  textColor = user?.darkMode ? 'text-gray-800' : 'text-gray-800';
                  tileText = `${durationString} awake in bed`;
                }
                
                return (
                  <div key={`${logId}-${index}`}>
                    {/* Gray separator before out of bed tiles */}
                    {showSeparator && (
                      <div className={`h-px my-2 ${
                        user?.darkMode ? 'bg-gray-600' : 'bg-gray-300'
                      }`} />
                    )}
                    
                    {/* Tile */}
                    <div className="flex items-start mb-2">
                      {/* Time label - top aligned */}
                      <div className="text-sm mr-4" style={{ minWidth: '70px', color: '#745288' }}>
                        {event.localTime}
                      </div>
                      
                      {/* Duration tile */}
                      <div
                        onClick={() => navigateToLogDetail(logId)}
                        className={`flex-1 px-4 py-3 rounded-2xl cursor-pointer transition-opacity hover:opacity-90 ${tileColor} ${textColor}`}
                      >
                        <span className="text-base">{tileText}</span>
                      </div>
                    </div>
                    
                    {/* Gray separator after out of bed tiles */}
                    {showSeparator && index < windowsData.length - 2 && (
                      <div className={`h-px my-2 ${
                        user?.darkMode ? 'bg-gray-600' : 'bg-gray-300'
                      }`} />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Floating Action Button - Centered and positioned within scrollable area */}
        <div className="fixed bottom-[100px] left-1/2 transform -translate-x-1/2 z-20">
        <button
          onClick={() => navigateToNewLog(selectedDate)}
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
      </div>

      {/* Minimal bottom spacing for iframe */}
      <div className={`h-[20px] ${
        user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
      }`}></div>

      {/* Comments Modal */}
      <CommentsModal 
        isOpen={showCommentsModal}
        onClose={closeCommentsModal}
        user={user}
        childId={state.childId}
      />
    </div>
  );
}

function LogDetailView() {
  const { user } = useBubbleAuth();
  const { state, navigateToEditLog, navigateBack, updateLog } = useNavigation();
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [comments, setComments] = useState<FirebaseMessage[]>([]);
  const [newComment, setNewComment] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const logEventsRef = useRef<HTMLDivElement>(null);
  
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

  // Scroll to log events to show recent timestamps behind modal
  useEffect(() => {
    // Check if we're in the log detail view and expand log section by default
    if (log && log.events && log.events.length > 0) {
      setLogExpanded(true);
      
      // Scroll to show the most recent events after a short delay
      const timer = setTimeout(() => {
        if (logEventsRef.current) {
          const lastEvent = logEventsRef.current.lastElementChild;
          if (lastEvent) {
            lastEvent.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [log, state.view]); // Run when log data changes or view changes

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

  // Get event type text
  const getEventTypeText = (type: SleepEvent['type']): string => {
    switch (type) {
      case 'put_in_bed': return 'Put in bed';
      case 'fell_asleep': return 'Asleep';
      case 'woke_up': return 'Awake';
      case 'out_of_bed': return 'Out of bed';
    }
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

  // Temporary delete function for testing
  const handleDeleteLog = async () => {
    if (!log || !state.logId) return;
    
    const confirmDelete = confirm('Are you sure you want to delete this log? This action cannot be undone.');
    if (!confirmDelete) return;
    
    try {
      // Simple Firebase delete
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      await deleteDoc(doc(db, 'logs', state.logId));
      
      // Navigate back to logs list
      navigateBack();
    } catch (error) {
      console.error('Error deleting log:', error);
      alert('Failed to delete log. Please try again.');
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

      {/* Back Button and Delete Button */}
      <div className="px-4 py-2 flex items-center justify-between">
        <button
          onClick={navigateBack}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            user?.darkMode 
              ? 'text-gray-300 hover:bg-gray-800' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
        
        <div className="flex items-center gap-2">
          {/* Edit Button */}
          <button
            onClick={() => navigateToEditLog(state.logId!)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              user?.darkMode 
                ? 'text-purple-400 hover:bg-purple-900/20' 
                : 'text-purple-600 hover:bg-purple-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-sm font-medium">Edit</span>
          </button>
          
          {/* Delete Button */}
          <button
            onClick={handleDeleteLog}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-sm font-medium">Delete</span>
          </button>
        </div>
      </div>

      {/* Log Tile - Visual Continuity from List View */}
      <div className="px-4 py-4">
        <SleepLogTile
          log={log}
          user={user}
          napNumber={1} // Simplified for detail view - could be made dynamic
          onContinueLogging={() => navigateToEditLog(state.logId!)}
          formatTimeInTimezone={formatTimeInTimezone}
          showClickable={false}
        />
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
          
          {headlinesExpanded && log && (
            <div className="px-4 pb-4">
              <div className="border-l-4 pl-2 space-y-3" style={{ borderColor: '#F0DDEF' }}>
                {(() => {
                  const stats = calculateSleepStatistics(log);
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className={`text-base ${
                          user?.darkMode ? 'text-white' : 'text-gray-800'
                        }`}>
                          {stats.timeRange}, {stats.totalDuration}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-base ${
                          user?.darkMode ? 'text-white' : 'text-gray-800'
                        }`}>
                          {stats.totalTimeAsleep} asleep
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-base ${
                          user?.darkMode ? 'text-white' : 'text-gray-800'
                        }`}>
                          {stats.totalTimeAwakeInBed} awake in bed
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-base ${
                          user?.darkMode ? 'text-white' : 'text-gray-800'
                        }`}>
                          {stats.numberOfWakeUps} wake-ups
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-base ${
                          user?.darkMode ? 'text-white' : 'text-gray-800'
                        }`}>
                          {stats.averageWakeUpDuration} avg wake-up
                        </span>
                      </div>
                    </>
                  );
                })()}
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
              <div ref={logEventsRef} className="border-l-4 pl-2 space-y-3" style={{ borderColor: '#F0DDEF' }}>
                {log.events
                  .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime())
                  .map((event, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className={`text-base ${
                        user?.darkMode ? 'text-white' : 'text-gray-800'
                      }`}>
                        {getEventTypeText(event.type)}
                      </span>
                      <span className={`text-base ${
                        user?.darkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
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
                <div className="border-l-4 pl-2 space-y-3" style={{ borderColor: '#F0DDEF' }}>
                  <div className="flex justify-between items-center">
                    <span className={`text-base italic ${
                      user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      No comments yet
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-l-4 pl-2 space-y-4" style={{ borderColor: '#F0DDEF' }}>
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
                            <span className={user?.darkMode ? 'text-gray-300' : 'text-gray-600'}>
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
      <div className={`absolute left-0 right-0 bottom-0 border-t z-10 ${
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

function EditLogModal() {
  const { user } = useBubbleAuth();
  const { state, navigateBack, updateLog } = useNavigation();
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<{ type: SleepEvent['type']; timestamp: Date }[]>([]);
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(null);
  const [editingTime, setEditingTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  
  // Interjection modal state
  const [showInterjectionModal, setShowInterjectionModal] = useState(false);
  const [interjectionIndex, setInterjectionIndex] = useState<number | null>(null);
  const [interjectionType, setInterjectionType] = useState<SleepEvent['type']>('woke_up');
  const [interjectionTime, setInterjectionTime] = useState<Date>(new Date());
  const [interjectionValidationWarning, setInterjectionValidationWarning] = useState<any>(null);
  
  // Validation dialog state
  const [showValidationDialog, setShowValidationDialog] = useState(false);

  // Get current log from cache or fetch it
  useEffect(() => {
    if (!state.logId) return;

    // First check cache
    const cachedLog = state.logCache.get(state.logId);
    if (cachedLog) {
      setLog(cachedLog);
      // Convert events from Firestore to local format
      if (cachedLog.events) {
        const localEvents = cachedLog.events.map(e => ({
          type: e.type,
          timestamp: e.timestamp.toDate()
        }));
        setEvents(localEvents);
        // Set initial date from first event
        if (localEvents.length > 0) {
          setCurrentDate(localEvents[0].timestamp);
        }
      }
      return;
    }

    // If not in cache, fetch it
    setIsLoading(true);
    getLog(state.logId)
      .then((logData) => {
        if (logData) {
          setLog(logData);
          updateLog(logData); // Add to cache
          // Convert events from Firestore to local format
          if (logData.events) {
            const localEvents = logData.events.map(e => ({
              type: e.type,
              timestamp: e.timestamp.toDate()
            }));
            setEvents(localEvents);
            // Set initial date from first event
            if (localEvents.length > 0) {
              setCurrentDate(localEvents[0].timestamp);
            }
          }
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading log:', error);
        setIsLoading(false);
      });
  }, [state.logId, state.logCache, updateLog]);

  // Format time for display
  const formatTimeForDisplay = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  // Format date for the date selector
  const formatDateForSelector = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  // Handle date change - move all events by the same offset
  const handleDateChange = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    
    // Calculate the offset in milliseconds
    const offset = newDate.getTime() - currentDate.getTime();
    
    // Update all events with the offset
    const updatedEvents = events.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp.getTime() + offset)
    }));
    
    setEvents(updatedEvents);
    setCurrentDate(newDate);
  };

  // Start editing an event
  const handleEditEvent = (index: number) => {
    setEditingEventIndex(index);
    const event = events[index];
    // Format time as HH:MM for the time picker
    const hours = event.timestamp.getHours().toString().padStart(2, '0');
    const minutes = event.timestamp.getMinutes().toString().padStart(2, '0');
    setEditingTime(`${hours}:${minutes}`);
  };

  // Save edited time
  const handleSaveEventTime = (index: number) => {
    if (!editingTime) return;
    
    const [hours, minutes] = editingTime.split(':').map(Number);
    const updatedEvents = [...events];
    const newTimestamp = new Date(updatedEvents[index].timestamp);
    newTimestamp.setHours(hours, minutes, 0, 0);
    
    updatedEvents[index] = {
      ...updatedEvents[index],
      timestamp: newTimestamp
    };
    
    setEvents(updatedEvents);
    setEditingEventIndex(null);
    setEditingTime('');
  };

  // Cancel editing (unused but kept for future functionality)
  // const handleCancelEdit = () => {
  //   setEditingEventIndex(null);
  //   setEditingTime('');
  // };

  // Delete an event
  const handleDeleteEvent = (index: number) => {
    const updatedEvents = events.filter((_, i) => i !== index);
    setEvents(updatedEvents);
  };

  // Add an interjection event (unused but kept for future functionality)
  // const handleAddInterjection = (afterIndex: number, type: SleepEvent['type']) => {
  //   const updatedEvents = [...events];
  //   
  //   // Calculate timestamp between current and next event
  //   const currentEvent = events[afterIndex];
  //   const nextEvent = events[afterIndex + 1];
  //   
  //   let newTimestamp: Date;
  //   if (nextEvent) {
  //     // Place new event halfway between current and next
  //     const timeDiff = nextEvent.timestamp.getTime() - currentEvent.timestamp.getTime();
  //     newTimestamp = new Date(currentEvent.timestamp.getTime() + timeDiff / 2);
  //   } else {
  //     // If no next event, add 30 minutes after current
  //     newTimestamp = new Date(currentEvent.timestamp.getTime() + 30 * 60 * 1000);
  //   }
  //   
  //   const newEvent = {
  //     type,
  //     timestamp: newTimestamp
  //   };
  //   
  //   updatedEvents.splice(afterIndex + 1, 0, newEvent);
  //   setEvents(updatedEvents);
  // };

  // Get event type text
  const getEventTypeText = (type: SleepEvent['type']) => {
    switch (type) {
      case 'put_in_bed': return 'Put in bed';
      case 'fell_asleep': return 'Asleep';
      case 'woke_up': return 'Awake';
      case 'out_of_bed': return 'Out of bed';
      default: return type;
    }
  };

  // Check if event has consecutive same type (for red formatting)
  const hasConsecutiveSameType = (index: number): boolean => {
    if (index === 0) return false;
    
    const currentEvent = events[index];
    const previousEvent = events[index - 1];
    
    // Only check for consecutive awake/asleep events
    const sleepWakeTypes = ['fell_asleep', 'woke_up'];
    if (!sleepWakeTypes.includes(currentEvent.type) || !sleepWakeTypes.includes(previousEvent.type)) {
      return false;
    }
    
    return currentEvent.type === previousEvent.type;
  };

  // Check if there are any consecutive same types in the events array
  const hasAnyConsecutiveSameTypes = (): boolean => {
    for (let i = 1; i < events.length; i++) {
      if (hasConsecutiveSameType(i)) {
        return true;
      }
    }
    return false;
  };

  // Validate interjection time
  const validateInterjectionTime = (time: Date, beforeEvent: Date, afterEvent: Date) => {
    if (time < beforeEvent) {
      return {
        isValid: false,
        warning: {
          type: 'before-range',
          message: `Time must be after ${formatTimeForDisplay(beforeEvent)}`
        }
      };
    }
    
    if (time > afterEvent) {
      return {
        isValid: false,
        warning: {
          type: 'after-range',
          message: `Time must be before ${formatTimeForDisplay(afterEvent)}`
        }
      };
    }
    
    return { isValid: true, warning: null };
  };

  // Handle interjection modal save
  const handleSaveInterjection = () => {
    if (interjectionIndex === null) return;
    
    const beforeEvent = events[interjectionIndex];
    const afterEvent = events[interjectionIndex + 1];
    
    // Validate the time
    const validation = validateInterjectionTime(interjectionTime, beforeEvent.timestamp, afterEvent.timestamp);
    if (!validation.isValid) {
      setInterjectionValidationWarning(validation.warning);
      return;
    }
    
    // Add the interjection
    const updatedEvents = [...events];
    const newEvent = {
      type: interjectionType,
      timestamp: interjectionTime
    };
    
    updatedEvents.splice(interjectionIndex + 1, 0, newEvent);
    setEvents(updatedEvents);
    
    // Close modal
    setShowInterjectionModal(false);
    setInterjectionIndex(null);
    setInterjectionValidationWarning(null);
  };

  // Save all changes
  const handleSaveChanges = async () => {
    if (!state.logId || !log || !user) return;
    
    // Check for consecutive same types before saving
    if (hasAnyConsecutiveSameTypes()) {
      setShowValidationDialog(true);
      return;
    }
    
    setIsSaving(true);
    try {
      // Update the log with new events
      const isComplete = events.some(e => e.type === 'out_of_bed');
      await updateSleepLog(state.logId, events, state.timezone, isComplete);
      
      // Update the cache
      const eventsWithLocalTime = events.map(e => ({
        type: e.type,
        timestamp: Timestamp.fromDate(e.timestamp),
        localTime: formatTimeForDisplay(e.timestamp)
      }));
      const updatedLog = { 
        ...log, 
        events: eventsWithLocalTime, 
        isComplete,
        updatedAt: Timestamp.fromDate(new Date())
      };
      updateLog(updatedLog);
      
      // Navigate back to log detail
      navigateBack();
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !log) {
    return <LoadingScreen message="Loading log..." />;
  }

  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing */}
      <div className="h-[20px]"></div>

      {/* Header with Back and Save buttons */}
      <div className="px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => {
            // Check for consecutive same types before navigating back
            if (hasAnyConsecutiveSameTypes()) {
              setShowValidationDialog(true);
              return;
            }
            navigateBack();
          }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            user?.darkMode 
              ? 'text-gray-300 hover:bg-gray-800' 
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Cancel</span>
        </button>
        
        <button
          onClick={() => { void handleSaveChanges(); }}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            user?.darkMode 
              ? 'bg-purple-800 text-white hover:bg-purple-900' 
              : 'bg-purple-800 text-white hover:bg-purple-900'
          }`}
        >
          {isSaving ? (
            <div className="loading loading-spinner w-4 h-4"></div>
          ) : (
            <span className="text-sm font-medium">Save</span>
          )}
        </button>
      </div>

      {/* Log Tile - Preserved from detail view with delete icon */}
      <div className="px-4 py-4">
        <div className="relative">
          <SleepLogTile
            log={log}
            user={user}
            napNumber={1}
            formatTimeInTimezone={formatTimeForDisplay}
            showClickable={false}
          />
          {/* Delete icon in top right of tile */}
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to delete this log? This action cannot be undone.')) {
                try {
                  const { deleteDoc, doc } = await import('firebase/firestore');
                  const { db } = await import('@/lib/firebase');
                  
                  if (state.logId) {
                    await deleteDoc(doc(db, 'logs', state.logId));
                    navigateBack();
                  }
                } catch (error) {
                  console.error('Error deleting log:', error);
                  alert('Failed to delete log. Please try again.');
                }
              }
            }}
            className="absolute top-4 right-4 p-2 transition-colors"
            style={{
              color: '#DC2626'
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Date Selector */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleDateChange('prev')}
            className={`p-2 rounded-lg transition-colors ${
              user?.darkMode 
                ? 'text-gray-300 hover:bg-gray-800' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className={`text-lg font-medium ${
            user?.darkMode ? 'text-white' : 'text-gray-800'
          }`}>
            {formatDateForSelector(currentDate)}
          </div>
          
          <button
            onClick={() => handleDateChange('next')}
            className={`p-2 rounded-lg transition-colors ${
              user?.darkMode 
                ? 'text-gray-300 hover:bg-gray-800' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Events List */}
      <div className="px-4 pb-20 overflow-y-auto">
        <div>
          {events.map((event, index) => (
            <div key={index}>
              {/* Event Row */}
              <div className="py-4">
                {editingEventIndex === index ? (
                  // Editing mode
                  <div className="flex items-center justify-between gap-4">
                    <span className={`text-base flex-1 ${
                      user?.darkMode ? 'text-white' : 'text-gray-800'
                    }`}>
                      {getEventTypeText(event.type)}
                    </span>
                    
                    <div className="flex items-center gap-2">
                      <TimePicker
                        value={editingTime}
                        onChange={(value) => setEditingTime(value || '')}
                        disableClock={true}
                        clearIcon={null}
                        format="h:mm a"
                        className={`w-32 ${user?.darkMode ? 'dark-time-picker' : ''}`}
                      />
                      
                      <button
                        onClick={() => handleSaveEventTime(index)}
                        className="px-4 py-1.5 rounded-full text-sm transition-colors"
                        style={{
                          backgroundColor: '#E8B4E3',
                          color: 'white'
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-base ${
                        hasConsecutiveSameType(index) 
                          ? 'text-red-500' 
                          : (user?.darkMode ? 'text-white' : 'text-gray-800')
                      }`}>
                        {getEventTypeText(event.type)}
                      </span>
                      {hasConsecutiveSameType(index) && (
                        <div className="w-6 h-6 rounded-full border-2 border-red-500 flex items-center justify-center">
                          <span className="text-red-500 text-sm font-bold">!</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`text-base ${
                        user?.darkMode ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {formatTimeForDisplay(event.timestamp)}
                      </span>
                      
                      <button
                        onClick={() => handleEditEvent(index)}
                        className="px-4 py-1.5 rounded-full text-sm transition-colors border"
                        style={{
                          borderColor: '#9B7EBD',
                          color: '#9B7EBD',
                          backgroundColor: 'transparent'
                        }}
                      >
                        Edit
                      </button>
                      
                      {events.length > 1 && (
                        <button
                          onClick={() => handleDeleteEvent(index)}
                          className="p-2 transition-colors text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Separator line with overlaid plus button - Only show between events */}
              {index < events.length - 1 && (
                <div className="relative flex items-center justify-center h-8">
                  {/* Pink separator line */}
                  <div 
                    className="absolute inset-x-0 top-1/2 h-px"
                    style={{ backgroundColor: '#F0DDEF' }}
                  ></div>
                  
                  {/* Plus button overlaid on top */}
                  <button
                    onClick={() => {
                      // Determine default type based on current and next event
                      const currentType = event.type;
                      const nextType = events[index + 1].type;
                      let defaultType: SleepEvent['type'] = 'woke_up';
                      
                      if (currentType === 'fell_asleep' && nextType === 'out_of_bed') {
                        defaultType = 'woke_up';
                      } else if (currentType === 'woke_up' && nextType === 'out_of_bed') {
                        defaultType = 'fell_asleep';
                      }
                      
                      // Calculate default time (halfway between events)
                      const currentEvent = events[index];
                      const nextEvent = events[index + 1];
                      const timeDiff = nextEvent.timestamp.getTime() - currentEvent.timestamp.getTime();
                      const defaultTime = new Date(currentEvent.timestamp.getTime() + timeDiff / 2);
                      
                      // Open modal
                      setInterjectionIndex(index);
                      setInterjectionType(defaultType);
                      setInterjectionTime(defaultTime);
                      setInterjectionValidationWarning(null);
                      setShowInterjectionModal(true);
                    }}
                    className="p-1.5 rounded-full transition-colors relative z-10"
                    style={{
                      backgroundColor: '#E8B4E3',
                      color: 'white'
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom spacing */}
      <div className={`h-[20px] ${
        user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
      }`}></div>

      {/* Interjection Modal */}
      {showInterjectionModal && interjectionIndex !== null && (
        <div className="absolute inset-0 bg-black bg-opacity-30 flex items-end z-[120]">
          <div className={`w-full max-w-[800px] mx-auto rounded-t-2xl shadow-xl transform transition-transform duration-300 ease-out ${
            user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
          }`}>
            {/* Modal Header */}
            <div className="px-6 py-6 text-center">
              <h2 className={`text-2xl font-medium mb-2 ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Add a Log
              </h2>
              <p className={`text-base ${
                user?.darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                between {formatTimeForDisplay(events[interjectionIndex].timestamp)} and {formatTimeForDisplay(events[interjectionIndex + 1].timestamp)}
              </p>
            </div>

            {/* Context Events */}
            <div className="px-6 mb-8">
              <div className="space-y-4">
                {/* Before Event */}
                <div className="flex justify-between items-center">
                  <span className={`text-base ${
                    user?.darkMode ? 'text-white' : 'text-gray-800'
                  }`}>
                    {getEventTypeText(events[interjectionIndex].type)}
                  </span>
                  <span className={`text-base ${
                    user?.darkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {formatTimeForDisplay(events[interjectionIndex].timestamp)}
                  </span>
                </div>

                {/* Input Row */}
                <div className="flex justify-between items-center gap-4">
                  {/* Event Type Dropdown */}
                  <div style={{ width: '120px' }}>
                    <select
                      value={interjectionType}
                      onChange={(e) => setInterjectionType(e.target.value as SleepEvent['type'])}
                      className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-colors ${
                        user?.darkMode
                          ? 'bg-[#2a223a] border-gray-600 text-white'
                          : 'bg-white border-gray-300 text-gray-800'
                      }`}
                    >
                      <option value="fell_asleep">Asleep</option>
                      <option value="woke_up">Awake</option>
                    </select>
                  </div>

                  {/* Time Picker */}
                  <div style={{ width: '120px' }}>
                    <TimePicker
                      value={`${interjectionTime.getHours().toString().padStart(2, '0')}:${interjectionTime.getMinutes().toString().padStart(2, '0')}`}
                      onChange={(value) => {
                        if (value) {
                          const [hours, minutes] = value.split(':').map(Number);
                          const newTime = new Date(interjectionTime);
                          newTime.setHours(hours, minutes, 0, 0);
                          setInterjectionTime(newTime);
                          
                          // Clear validation warning when time changes
                          setInterjectionValidationWarning(null);
                        }
                      }}
                      disableClock={true}
                      clearIcon={null}
                      format="h:mm a"
                      className={`w-32 ${user?.darkMode ? 'dark-time-picker' : ''}`}
                    />
                  </div>
                </div>

                {/* After Event */}
                <div className="flex justify-between items-center">
                  <span className={`text-base ${
                    user?.darkMode ? 'text-white' : 'text-gray-800'
                  }`}>
                    {getEventTypeText(events[interjectionIndex + 1].type)}
                  </span>
                  <span className={`text-base ${
                    user?.darkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {formatTimeForDisplay(events[interjectionIndex + 1].timestamp)}
                  </span>
                </div>
              </div>
            </div>

            {/* Validation Warning */}
            {interjectionValidationWarning && (
              <div className="px-6 mb-6">
                <div className={`p-4 rounded-lg border-2 ${
                  user?.darkMode 
                    ? 'bg-red-900/20 border-red-600 text-red-400' 
                    : 'bg-red-50 border-red-300 text-red-700'
                }`}>
                  <p className="text-base font-medium">{interjectionValidationWarning.message}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="px-6 pb-8 flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowInterjectionModal(false);
                  setInterjectionIndex(null);
                  setInterjectionValidationWarning(null);
                }}
                className={`px-6 py-3 rounded-full text-base transition-colors ${
                  user?.darkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>

              <button
                onClick={handleSaveInterjection}
                disabled={!!interjectionValidationWarning}
                className={`px-8 py-3 rounded-full text-base text-white transition-colors ${
                  interjectionValidationWarning 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:opacity-90'
                }`}
                style={{ 
                  backgroundColor: user?.darkMode ? '#9B7EBD' : '#503460'
                }}
              >
                Add Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Dialog */}
      {showValidationDialog && (
        <div className="absolute inset-0 z-[130] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50" 
            onClick={() => setShowValidationDialog(false)}
          ></div>
          <div className={`relative w-full max-w-md mx-auto rounded-2xl p-8 shadow-xl ${
            user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
          }`} style={{ backgroundColor: '#F4E6F3' }}>
            <div className="text-center">
              <h2 className="text-2xl font-medium mb-4" style={{ color: '#503460' }}>
                Missing an awake or asleep
              </h2>
              
              <p className="text-base mb-6" style={{ color: '#503460' }}>
                You've tracked two 'Awakes' or two 'Asleeps' in a row. To save this log, 
                add an 'Asleep' or 'Awake' in between them.
              </p>
              
              <p className="text-base mb-8" style={{ color: '#503460' }}>
                If you don't know exactly, just put your best guess.
              </p>
              
              <button
                onClick={() => setShowValidationDialog(false)}
                className="w-full py-4 rounded-full text-white font-medium text-lg"
                style={{ backgroundColor: '#503460' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentsModal({ isOpen, onClose, user, childId }: { 
  isOpen: boolean; 
  onClose: () => void; 
  user: any; 
  childId: string | null;
}) {
  const [viewMode, setViewMode] = useState<'unread' | 'all'>('unread');
  const [searchQuery, setSearchQuery] = useState('');
  const [comments, setComments] = useState<FirebaseMessage[]>([]);
  const [unreadComments, setUnreadComments] = useState<FirebaseMessage[]>([]);
  // const [isLoading, setIsLoading] = useState(false); // Removed - not used in UI
  const { state, navigateToLogDetail } = useNavigation();

  // Fetch all log comments for this child
  useEffect(() => {
    if (!isOpen || !childId) return;
    
    // Listen to all messages in the child's conversation that have a logId
    const conversationId = `child_${childId}`;
    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      where('logId', '!=', null),
      orderBy('logId'),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages: FirebaseMessage[] = [];
      const unreadMessages: FirebaseMessage[] = [];
      
      snapshot.forEach((doc) => {
        const message = { id: doc.id, ...doc.data() } as FirebaseMessage;
        allMessages.push(message);
        
        // Check if message is unread for current user
        if (!message.readBy || !message.readBy.includes(user?.user?.id)) {
          unreadMessages.push(message);
        }
      });
      
      setComments(allMessages);
      setUnreadComments(unreadMessages);
    });
    
    return () => unsubscribe();
  }, [isOpen, childId, user?.user?.id]);

  // Filter comments based on search query
  const filteredComments = viewMode === 'all' 
    ? comments.filter(comment => 
        comment.text?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : unreadComments;

  const handleMarkAllAsRead = async () => {
    if (!user?.user?.id) return;
    
    // Mark all unread comments as read
    const updatePromises = unreadComments.map(comment => 
      updateDoc(doc(db, 'messages', comment.id), {
        readBy: arrayUnion(user.user.id)
      })
    );
    
    try {
      await Promise.all(updatePromises);
      setUnreadComments([]);
    } catch (error) {
      console.error('Error marking comments as read:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop - subtle overlay for click handling */}
      <div 
        className="absolute inset-0 z-40" 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }}
        onClick={onClose}
      ></div>
      
      {/* Modal Container */}
      <div className="absolute inset-0 z-50 flex items-end justify-center px-4 pt-16">
        <div className={`w-full max-w-[600px] h-[85vh] font-['Poppins'] rounded-t-3xl transition-transform duration-300 ease-out shadow-2xl relative flex flex-col ${
          user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
        }`}>
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="font-domine text-2xl font-medium" style={{ color: '#745288' }}>
                {viewMode === 'unread' ? 'Unread comments on log' : 'All comments on log'}
              </h2>
              
              {/* Toggle Button */}
              <button
                onClick={() => setViewMode(viewMode === 'unread' ? 'all' : 'unread')}
                className={`px-4 py-2 rounded-full border transition-colors ${
                  user?.darkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
                style={{
                  fontSize: '14px',
                  fontWeight: '400'
                }}
              >
                {viewMode === 'unread' ? 'View All' : 'View Unread'}
              </button>
            </div>
            
            {/* Mark all as read button for unread view */}
            {viewMode === 'unread' && unreadComments.length > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="mt-4 px-6 py-2 rounded-full transition-colors"
                style={{
                  backgroundColor: '#F0DDEF',
                  color: '#745288',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Mark all as read
              </button>
            )}
            
            {/* Search bar for all view */}
            {viewMode === 'all' && (
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                    user?.darkMode
                      ? 'bg-[#3a3a3a] border-gray-600 text-white placeholder-gray-400'
                      : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-500'
                  }`}
                />
              </div>
            )}
          </div>
          
          {/* Comments List */}
          <div className="flex-1 overflow-y-auto px-6">
            {filteredComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MessageSquare className={`w-12 h-12 mb-4 ${
                  user?.darkMode ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <p className={`text-center ${
                  user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {viewMode === 'unread' 
                    ? 'No unread comments' 
                    : searchQuery 
                      ? 'No comments match your search' 
                      : 'No comments yet'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                {filteredComments.map((comment) => {
                  // Find the log type from the logs in state
                  const log = state.logs.find(l => l.id === comment.logId);
                  const logType = log?.sleepType || 'sleep';
                  const logTypeDisplay = logType.charAt(0).toUpperCase() + logType.slice(1);
                  
                  // Format timestamp
                  const messageDate = comment.timestamp.toDate();
                  const timeStr = messageDate.toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  });
                  const dateStr = messageDate.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: messageDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                  });
                  
                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        user?.darkMode 
                          ? 'bg-gray-800 hover:bg-gray-700' 
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                      onClick={() => {
                        if (comment.logId) {
                          onClose();
                          navigateToLogDetail(comment.logId);
                        }
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p style={{ color: '#745288', fontWeight: '500' }}>
                          {comment.senderName} commented on {logTypeDisplay}
                        </p>
                        <div className="text-right">
                          <p className={`text-sm ${
                            user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {timeStr}
                          </p>
                          <p className={`text-xs ${
                            user?.darkMode ? 'text-gray-500' : 'text-gray-500'
                          }`}>
                            {dateStr}
                          </p>
                        </div>
                      </div>
                      <p className={`${
                        user?.darkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {comment.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function SleepLogModal() {
  const { user } = useBubbleAuth();
  const { state, navigateBack, updateLog } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [sleepType, setSleepType] = useState<'nap' | 'bedtime'>('nap');
  const [events, setEvents] = useState<Array<{ type: SleepEvent['type']; timestamp: Date }>>([]);
  // Removed unused currentEventType state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(() => {
    // Use default date from navigation state if available, otherwise today
    if (state.defaultLogDate) {
      return new Date(state.defaultLogDate + 'T12:00:00');
    }
    return new Date();
  });
  const [isComplete, setIsComplete] = useState(false);
  const [existingLog, setExistingLog] = useState<SleepLog | null>(null);
  const [showEndOfSleep, setShowEndOfSleep] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<SleepEvent['type'] | null>(null);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  
  // Validation states
  const [validationWarning, setValidationWarning] = useState<{
    type: 'future' | 'long-gap' | 'too-long-gap';
    message: string;
    subtext?: string;
  } | null>(null);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [lastButtonPressTime, setLastButtonPressTime] = useState(0);
  
  // Determine client type from URL (default to sleep consulting)
  const urlParams = new URLSearchParams(window.location.search);
  const clientType = urlParams.get('clientType') || 'sleep-consulting';
  
  // Set default sleep type based on time (only on initial load)
  useEffect(() => {
    const hour = new Date().getHours();
    // If between 4:00am and 6:00pm, default to nap, otherwise bedtime
    if (hour >= 4 && hour < 18) {
      setSleepType('nap');
    } else {
      setSleepType('bedtime');
    }
  }, []); // Empty dependency array - only run once on mount

  // Reset selected event type when events change (to default to primary option)
  useEffect(() => {
    setSelectedEventType(null);
  }, [events.length]);

  // Track initial mount for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialMount(false);
    }, 350); // Slightly longer than animation duration
    
    // Also set initial loading to false after a short delay
    const loadingTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(loadingTimer);
    };
  }, []);

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
          
          // Set currentTime to a reasonable time on the original log date (not today's date)
          const originalDate = eventsWithDates[0].timestamp;
          const timeOnOriginalDate = new Date(originalDate);
          timeOnOriginalDate.setHours(new Date().getHours(), new Date().getMinutes()); // Use current time of day but original date
          setCurrentTime(timeOnOriginalDate);
          setCurrentDate(new Date(originalDate));
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
              
              // Set currentTime to a reasonable time on the original log date (not today's date)
              const originalDate = eventsWithDates[0].timestamp;
              const timeOnOriginalDate = new Date(originalDate);
              timeOnOriginalDate.setHours(new Date().getHours(), new Date().getMinutes()); // Use current time of day but original date
              setCurrentTime(timeOnOriginalDate);
              setCurrentDate(new Date(originalDate));
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

  // TODO: getValidNextEventTypes function was removed as it appeared unused


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
    return getCurrentEventType();
  };

  // Get human-readable text for event types
  const getEventTypeText = (type: SleepEvent['type']): string => {
    switch (type) {
      case 'put_in_bed': return 'Put in bed';
      case 'fell_asleep': return 'Asleep';
      case 'woke_up': return 'Awake';
      case 'out_of_bed': return 'Out of bed';
    }
  };

  // Get event type options based on last subevent
  const getEventTypeOptions = (): { primary: SleepEvent['type'], secondary: SleepEvent['type'] } => {
    if (events.length === 0) {
      return { primary: 'put_in_bed', secondary: 'fell_asleep' };
    }
    
    const lastEvent = events[events.length - 1];
    switch (lastEvent.type) {
      case 'put_in_bed':
        return { primary: 'fell_asleep', secondary: 'out_of_bed' };
      case 'fell_asleep':
        return { primary: 'woke_up', secondary: 'out_of_bed' };
      case 'woke_up':
        return { primary: 'fell_asleep', secondary: 'out_of_bed' };
      default:
        return { primary: 'fell_asleep', secondary: 'out_of_bed' };
    }
  };

  // Get currently selected event type (use selectedEventType or default to primary option)
  const getCurrentEventType = (): SleepEvent['type'] => {
    if (selectedEventType) {
      return selectedEventType;
    }
    const options = getEventTypeOptions();
    return options.primary;
  };

  // Get relative date text for modal date input
  const getModalRelativeDateText = () => {
    const today = new Date();
    const todayString = new Intl.DateTimeFormat('en-CA', {
      timeZone: state.timezone
    }).format(today);
    const selectedDateString = currentDate.toISOString().split('T')[0];
    
    if (selectedDateString === todayString) {
      return 'Today';
    }
    
    const selectedDateObj = new Date(selectedDateString + 'T12:00:00');
    const todayObj = new Date(todayString + 'T12:00:00');
    const diffTime = selectedDateObj.getTime() - todayObj.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === -1) {
      return 'Yesterday';
    } else if (diffDays < -1) {
      return `${Math.abs(diffDays)} days ago`;
    } else if (diffDays === 1) {
      return '1 day from now';
    } else if (diffDays > 1) {
      return `${diffDays} days from now`;
    }
    
    return null;
  };

  // Format time for time picker (24-hour HH:MM format for react-time-picker)
  const formatTimeForPicker = (date: Date): string => {
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

  // Create event timestamp with overnight detection
  const createEventTimestamp = (originalDate: Date, selectedTime: Date, lastEventTimestamp: Date): Date => {
    // Create a timestamp using the selected time but on the original date
    const eventTimestamp = new Date(originalDate);
    eventTimestamp.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    
    // If the new timestamp is before the last event, assume it's the next day
    if (eventTimestamp < lastEventTimestamp) {
      eventTimestamp.setDate(eventTimestamp.getDate() + 1);
    }
    
    return eventTimestamp;
  };

  // Validate time input
  const validateTimeInput = (timestamp: Date, isFirstEvent: boolean = false): {
    isValid: boolean;
    warning: typeof validationWarning;
  } => {
    const now = new Date();
    
    // For first event, we need to use the combined date/time
    let timeToCheck = timestamp;
    if (isFirstEvent || events.length === 0) {
      // Create combined datetime for first event
      timeToCheck = new Date(currentDate);
      timeToCheck.setHours(timestamp.getHours(), timestamp.getMinutes(), 0, 0);
    }
    
    // Check if time is more than 5 minutes in the future (only for current date)
    const selectedDateString = currentDate.toISOString().split('T')[0];
    const todayString = new Intl.DateTimeFormat('en-CA', {
      timeZone: state.timezone
    }).format(now);
    
    if (selectedDateString === todayString) {
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      if (timeToCheck > fiveMinutesFromNow) {
        return {
          isValid: true, // Allow with confirmation
          warning: {
            type: 'future',
            message: 'This time is in the future - are you sure you want to save it?'
          }
        };
      }
    }
    
    // If first event, no other validations needed
    if (isFirstEvent || events.length === 0) {
      return { isValid: true, warning: null };
    }
    
    // Get the last event timestamp
    const lastEventTimestamp = events[events.length - 1].timestamp;
    
    // Calculate the prepped time (with overnight logic applied)
    const preppedTime = createEventTimestamp(
      events[0].timestamp, // original date from first event
      timestamp,
      lastEventTimestamp
    );
    
    // Calculate hours difference
    const hoursDiff = (preppedTime.getTime() - lastEventTimestamp.getTime()) / (1000 * 60 * 60);
    
    // Valid: 0-12 hours after last event
    if (hoursDiff >= 0 && hoursDiff <= 12) {
      return { isValid: true, warning: null };
    }
    
    // Warning: 12-16 hours after last event
    if (hoursDiff > 12 && hoursDiff < 16) {
      return {
        isValid: true, // Allow with confirmation
        warning: {
          type: 'long-gap',
          message: `That time is more than 12 hours after the last logged time - are you sure you want to save it?`,
          subtext: `Did you instead want to end this ${sleepType} and start another?`
        }
      };
    }
    
    // Error: 16+ hours after last event
    if (hoursDiff >= 16) {
      return {
        isValid: false,
        warning: {
          type: 'too-long-gap',
          message: `Unable to save a time before your last log in this ${sleepType} - to interject another time, use Edit`
        }
      };
    }
    
    return { isValid: true, warning: null };
  };

  // Handle time picker change
  const handleTimeChange = (value: string | null) => {
    if (!value) return;
    
    // Parse 24-hour format (HH:MM)
    const [hours, minutes] = value.split(':').map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const newTime = new Date(currentTime);
      newTime.setHours(hours, minutes, 0, 0);
      setCurrentTime(newTime);
      
      // Validate the new time
      const validation = validateTimeInput(newTime, events.length === 0);
      setValidationWarning(validation.warning);
    }
  };

  // TODO: handleAddEvent function was removed as it appeared unused
  // If needed, this function would add an event to the sequence

  // TODO: handleRemoveLastEvent function was removed as it appeared unused
  // If needed, this function would remove the last event from the sequence

  // Save the log
  const handleSave = async (skipValidation: boolean = false) => {
    if (!user || !state.childId) return;

    // Implement button rate limiting (1.5 seconds)
    const now = Date.now();
    if (now - lastButtonPressTime < 1500) {
      return;
    }
    setLastButtonPressTime(now);
    setIsButtonDisabled(true);
    setTimeout(() => setIsButtonDisabled(false), 1500);

    // Perform validation unless skipped (for confirmations)
    if (!skipValidation) {
      const validation = validateTimeInput(currentTime, events.length === 0);
      if (validation.warning) {
        setValidationWarning(validation.warning);
        // If it's a hard block (too-long-gap), don't proceed
        if (!validation.isValid) {
          return;
        }
        // For warnings that need confirmation, wait for user action
        if (validation.warning.type !== 'future' && validation.warning.type !== 'long-gap') {
          return;
        }
        // Show the warning and return - user needs to confirm
        return;
      }
    }

    // Clear any warnings when proceeding
    setValidationWarning(null);

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
        
        // Create timestamp with next-day detection
        const originalDate = events[0].timestamp; // Get date from first event
        const lastEvent = events[events.length - 1];
        const eventTimestamp = createEventTimestamp(originalDate, currentTime, lastEvent.timestamp);
        
        const newEvent = {
          type: nextEventType,
          timestamp: eventTimestamp
        };

        const updatedEvents = [...events, newEvent];
        
        // Update the existing log
        const logIdToUse = state.logId || currentLogId;
        
        if (!logIdToUse) {
          throw new Error('No log ID available for update');
        }
        
        await updateSleepLog(logIdToUse, updatedEvents, state.timezone, nextEventType === 'out_of_bed');
        
        // Immediately update the cache so changes appear in log view behind modal
        const currentLog = state.logCache.get(logIdToUse);
        if (currentLog) {
          const eventsWithLocalTime = updatedEvents.map(e => ({
            type: e.type,
            timestamp: Timestamp.fromDate(e.timestamp),
            localTime: new Intl.DateTimeFormat('en-US', {
              timeZone: state.timezone,
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            }).format(e.timestamp)
          }));
          const updatedLog = { 
            ...currentLog, 
            events: eventsWithLocalTime, 
            isComplete: nextEventType === 'out_of_bed',
            updatedAt: Timestamp.fromDate(new Date())
          };
          updateLog(updatedLog);
        }
        
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

  // Note: createEventTimestamp is already defined above at line 1987

  // Cancel and go back with exit animation
  const handleCancel = () => {
    // Start exit animation
    setIsExiting(true);
    
    // Navigate back after animation completes
    setTimeout(() => {
      navigateBack();
    }, 300); // Match animation duration
  };

  // TODO: validNextEvents and canAddEvent variables were removed as they appeared unused
  const canSave = events.length > 0 || (clientType === 'sleep-consulting' && events.length === 0);

  if (isLoading && isInitialLoading) {
    return <SleepLogModalSkeleton user={user} />;
  }

  return (
    <>
      {/* Modal Backdrop - subtle overlay for click handling */}
      <div className="absolute inset-0 z-40" style={{ backgroundColor: 'rgba(0, 0, 0, 0.15)' }} onClick={handleCancel}></div>
      
      {/* Modal Container */}
      <div className="absolute inset-0 z-50 flex items-end justify-center px-4 pt-16">
        <div 
          className={`w-full max-w-[600px] h-[85vh] font-['Poppins'] rounded-t-3xl transition-transform duration-300 ease-out shadow-2xl relative flex flex-col ${
            user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
          }`}
          style={{
            animation: isExiting 
              ? 'slideDown 0.3s ease-in' 
              : isInitialMount 
                ? 'slideUp 0.3s ease-out' 
                : 'none'
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
      <div className="overflow-y-auto px-8 py-8 flex-1">
        
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

            {/* Date Input - Inline Label */}
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <label className={`text-lg font-medium mt-3 ${
                  user?.darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  Date
                </label>
                <div className="flex flex-col items-end" style={{ width: '25%' }}>
                  <div className="flex items-center gap-2">
                    {/* Show relative date text (Today, Yesterday, etc.) */}
                    <span className={`text-xs ${
                      user?.darkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      {getModalRelativeDateText()}
                    </span>
                    <input
                      type="date"
                      value={currentDate.toISOString().split('T')[0]}
                      onChange={(e) => {
                        const newDate = new Date(e.target.value);
                        setCurrentDate(newDate);
                        // Revalidate when date changes
                        const combinedDateTime = new Date(newDate);
                        combinedDateTime.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0);
                        const validation = validateTimeInput(combinedDateTime, events.length === 0);
                        setValidationWarning(validation.warning);
                      }}
                      className={`input input-bordered text-xl text-right w-44 ${
                        user?.darkMode 
                          ? 'bg-[#3a3a3a] border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-800'
                      }`}
                      style={{ height: '48px', padding: '0 12px', colorScheme: user?.darkMode ? 'dark' : 'light' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Time Input - Inline Label */}
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <label className={`text-lg font-medium mt-3 ${
                  user?.darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  Time
                </label>
                <div className="flex flex-col items-end" style={{ width: '25%' }}>
                  <div className="flex items-center gap-2">
                    {/* Show "Now" indicator when current time is selected */}
                    {(() => {
                      const now = new Date();
                      const timeDiff = Math.abs(currentTime.getTime() - now.getTime());
                      const isCurrentTime = timeDiff < 60000; // Within 1 minute
                      
                      return isCurrentTime && (
                        <span className={`text-xs ${user?.darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          Now
                        </span>
                      );
                    })()}
                    <TimePicker
                      value={formatTimeForPicker(currentTime)}
                      onChange={handleTimeChange}
                      clockIcon={null}
                      clearIcon={null}
                      disableClock={true}
                      format="h:mm a"
                      className={`react-time-picker compact right-align w-32 ${
                        user?.darkMode ? 'dark-theme' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Type Selection - Inline Layout */}
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <label className={`text-lg font-medium mt-3 ${
                  user?.darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  Type
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSleepType('nap')}
                    className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
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
                    <Sun className="w-5 h-5" />
                    <span className="text-base font-medium">Nap</span>
                  </button>
                  <button
                    onClick={() => setSleepType('bedtime')}
                    className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
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
                    <Moon className="w-5 h-5" />
                    <span className="text-base font-medium">Bedtime</span>
                  </button>
                </div>
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

            {/* Subevent Context with Inline Time Input */}
            <div className="mb-8">
              <div className="border-l-4 pl-2" style={{ borderColor: '#F0DDEF' }}>
                {(() => {
                  // Get last 3 events for context
                  const recentEvents = events.slice(-3);
                  const hasMoreEvents = events.length > 3;
                  
                  return (
                    <div className="space-y-4">
                      {/* Show recent events */}
                      {recentEvents.map((event, index) => {
                        const isTopEvent = index === 0 && hasMoreEvents;
                        return (
                          <div 
                            key={index} 
                            className={`flex justify-between items-center ${
                              isTopEvent ? 'opacity-40 blur-[1px]' : ''
                            }`}
                          >
                            <span className={`text-base ${
                              user?.darkMode ? 'text-white' : 'text-gray-800'
                            }`}>
                              {getEventTypeText(event.type)}
                            </span>
                            <span className={`text-base ${
                              user?.darkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              {formatTimeForDisplay(event.timestamp)}
                            </span>
                          </div>
                        );
                      })}
                      
                      {/* Time input row with tile selector replacing text */}
                      <div className="flex justify-between items-center">
                        {/* Event type tile selector - replaces the text */}
                        {(() => {
                          const options = getEventTypeOptions();
                          const currentType = getCurrentEventType();
                          
                          return (
                            <div className="flex gap-2" style={{ width: 'calc(50% + 12px)' }}>
                              <button
                                onClick={() => setSelectedEventType(options.primary)}
                                className={`flex-1 px-4 rounded-lg border-2 transition-all text-base ${
                                  currentType === options.primary
                                    ? user?.darkMode
                                      ? 'text-white border-[#503460]'
                                      : 'text-gray-800 border-[#503460]'
                                    : user?.darkMode
                                      ? 'border-gray-600 bg-[#2a223a] text-gray-400 hover:border-gray-500'
                                      : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                                }`}
                                style={{
                                  height: '60px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: currentType === options.primary ? '#F0DDEF' : undefined
                                }}
                              >
                                {getEventTypeText(options.primary)}
                              </button>
                              <button
                                onClick={() => setSelectedEventType(options.secondary)}
                                className={`flex-1 px-4 rounded-lg border-2 transition-all text-base ${
                                  currentType === options.secondary
                                    ? user?.darkMode
                                      ? 'text-white border-[#503460]'
                                      : 'text-gray-800 border-[#503460]'
                                    : user?.darkMode
                                      ? 'border-gray-600 bg-[#2a223a] text-gray-400 hover:border-gray-500'
                                      : 'border-gray-300 bg-white text-gray-500 hover:border-gray-400'
                                }`}
                                style={{ 
                                  height: '60px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexDirection: 'column',
                                  backgroundColor: currentType === options.secondary ? '#F0DDEF' : undefined,
                                  width: 'calc(50% + 8px)'
                                }}
                              >
                                <div style={{ lineHeight: '1.1' }}>{getEventTypeText(options.secondary)}</div>
                                {getEventTypeText(options.secondary) === 'Out of bed' && (
                                  <div className={`text-xs ${
                                    currentType === options.secondary
                                      ? user?.darkMode ? 'text-gray-300' : 'text-gray-600'
                                      : user?.darkMode ? 'text-gray-500' : 'text-gray-400'
                                  }`} style={{ lineHeight: '1.1', marginTop: '1px' }}>
                                    i.e. End of Sleep
                                  </div>
                                )}
                              </button>
                            </div>
                          );
                        })()}
                        
                        <div className="flex items-center gap-2">
                          {/* Show "Now" if current time is selected */}
                          {(() => {
                            const now = new Date();
                            const timeDiff = Math.abs(currentTime.getTime() - now.getTime());
                            const isCurrentTime = timeDiff < 60000; // Within 1 minute
                            
                            return isCurrentTime && (
                              <span className="text-sm" style={{ color: '#745288' }}>
                                Now
                              </span>
                            );
                          })()}
                          <div className="relative" style={{ width: '25%' }}>
                            <TimePicker
                              value={formatTimeForPicker(currentTime)}
                              onChange={handleTimeChange}
                              clockIcon={null}
                              clearIcon={null}
                              disableClock={true}
                              format="h:mm a"
                              className={`react-time-picker compact w-32 ${
                                user?.darkMode ? 'dark-theme' : ''
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

          </div>
        )}
        
      </div>

      {/* Bottom actions - now inside modal */}
      <div className={`border-t p-4 mt-auto ${
        user?.darkMode 
          ? 'border-gray-700 bg-[#2d2637]' 
          : 'border-gray-200 bg-white'
      }`}>
        {/* Validation warning display */}
        {validationWarning && (
          <div className="mb-4">
            <p className={`text-sm ${
              validationWarning.type === 'too-long-gap'
                ? 'text-red-600'
                : user?.darkMode ? 'text-[#9B7EBD]' : 'text-[#745288]'
            }`}>
              {validationWarning.message}
            </p>
            {validationWarning.subtext && (
              <p className={`text-sm mt-1 ${
                validationWarning.type === 'too-long-gap'
                  ? 'text-red-600'
                  : user?.darkMode ? 'text-[#9B7EBD]' : 'text-[#745288]'
              }`}>
                {validationWarning.subtext}
              </p>
            )}
          </div>
        )}
        
        <div className="flex justify-center gap-3">
          {/* Show confirm button for warnings that allow proceeding */}
          {validationWarning && validationWarning.type !== 'too-long-gap' && (
            <button
              onClick={() => { void handleSave(true); }}
              disabled={isLoading || isButtonDisabled}
              className={`btn text-lg py-4 h-14 rounded-2xl px-6 ${
                user?.darkMode ? 'hover:opacity-90' : 'hover:opacity-90'
              }`}
              style={{ 
                backgroundColor: user?.darkMode ? '#F0DDEF' : '#F0DDEF',
                color: user?.darkMode ? '#503460' : '#503460'
              }}
            >
              Confirm
            </button>
          )}
          
          <button
            onClick={() => validationWarning ? setValidationWarning(null) : void handleSave()}
            disabled={!canSave || isLoading || isButtonDisabled || (validationWarning?.type === 'too-long-gap')}
            className={`btn text-white text-lg py-4 h-14 rounded-2xl px-8 ${
              user?.darkMode ? 'hover:opacity-90' : 'hover:opacity-90'
            } ${validationWarning?.type === 'too-long-gap' ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ 
              backgroundColor: user?.darkMode ? '#9B7EBD' : '#503460'
            }}
          >
            {isLoading ? (
              <div className="loading loading-spinner w-5 h-5"></div>
            ) : validationWarning ? (
              'Change Time'
            ) : (
              'Add'
            )}
          </button>
        </div>
      </div>
        </div>
      </div>
    </>
  );
}