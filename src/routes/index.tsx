import { useBubbleAuth, useChildAccess } from "@/hooks/useBubbleAuth";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Plus, Send, X, Mic, Square, Play, Pause, Moon, Sun } from "lucide-react";
import { useState, useRef, useEffect } from "react";
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

  // Get view parameter from URL to determine which app to show
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view');

  return (
    <div className="not-prose">
      {view === 'logs' || view === 'log-sleep' || view === 'log-detail' ? (
        <LogsApp />
      ) : (
        <MessagingApp />
      )}
    </div>
  );
}

// Minimalist loading screen component (dark mode by default to prevent white flash)
function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="not-prose min-h-screen flex items-center justify-center bg-[#15111B]">
      <div className="text-center">
        <div className="loading loading-spinner w-8 h-8 text-purple-600 mb-4"></div>
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
    return <LoadingScreen message="Loading conversation..." />;
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
                    style={{ backgroundColor: isOwn ? (user?.darkMode ? '#2d2637' : '#f0ddef') : undefined }}
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
                                : 'bg-purple-100 border-purple-300 text-purple-700'
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
                backgroundColor: user?.darkMode ? '#f0ddef' : '#503460',
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
                backgroundColor: isRecording ? undefined : (user?.darkMode ? '#f0ddef' : '#503460'),
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
                backgroundColor: user?.darkMode ? '#f0ddef' : '#503460',
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

// Logs App Component - handles all log-related views
function LogsApp() {
  const [childId, setChildId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState<string>('America/New_York');
  const [isLoadingChildData, setIsLoadingChildData] = useState(true);

  // Check if user has access to the current child
  const hasChildAccess = useChildAccess(childId);

  // Get URL parameters for logs
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const childIdParam = urlParams.get('childId');
    const timezoneParam = urlParams.get('timezone');
    
    console.log('🔍 Logs initialization:', {
      fullURL: window.location.href,
      childIdParam,
      timezoneParam,
    });
    
    if (childIdParam) {
      setChildId(childIdParam);
      if (timezoneParam) {
        setTimezone(timezoneParam);
      }
      setIsLoadingChildData(false);
    } else {
      console.log('❌ No childId parameter found for logs');
      setIsLoadingChildData(false);
    }
  }, []);

  // Show loading for any of these conditions
  if (isLoadingChildData || !childId || !hasChildAccess) {
    return <LoadingScreen message="Loading logs..." />;
  }

  // Get view parameter to determine which logs view to show
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get('view');
  const logId = urlParams.get('logId');

  // Route to appropriate logs view
  if (view === 'log-detail' && logId) {
    return <LogDetailView childId={childId} logId={logId} timezone={timezone} />;
  } else if (view === 'log-sleep') {
    return <SleepLogModal childId={childId} logId={logId} timezone={timezone} />;
  } else {
    // Default to logs list view
    return <LogsListView childId={childId} timezone={timezone} />;
  }
}

// Log List View Component with infinite scroll
function LogsListView({ childId, timezone }: { childId: string; timezone: string }) {
  const { user } = useBubbleAuth();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to logs with real-time updates
  useEffect(() => {
    if (!childId) return;

    console.log('Setting up logs listener for child:', childId);
    const unsubscribe = listenToLogs(childId, (newLogs) => {
      console.log('Received logs update:', newLogs.length, 'logs');
      setLogs(newLogs);
      setIsLoading(false);
    });

    return unsubscribe;
  }, [childId]);

  // Format time in the baby's timezone
  const formatTimeInTimezone = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
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
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    }).format(date);
  };

  // Get sleep type icon
  const getSleepTypeIcon = (sleepType?: string) => {
    return sleepType === 'bedtime' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />;
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

  // Group logs by date
  const groupedLogs = logs.reduce((groups: { [key: string]: SleepLog[] }, log) => {
    const dateKey = log.localDate || formatDateInTimezone(log.timestamp);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(log);
    return groups;
  }, {});

  // Handle log click to open detail view
  const handleLogClick = (logId: string) => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', 'log-detail');
    newUrl.searchParams.set('logId', logId);
    window.location.href = newUrl.toString();
  };

  // Handle new log button click
  const handleNewLogClick = () => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', 'log-sleep');
    newUrl.searchParams.delete('logId'); // Make sure we're creating, not editing
    window.location.href = newUrl.toString();
  };

  if (isLoading) {
    return <LoadingScreen message="Loading logs..." />;
  }

  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing - minimal for iframe embedding */}
      <div className="h-[20px]"></div>
      
      {/* Header */}
      <div className={`px-4 py-4 border-b ${
        user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-white'
      }`}>
        <h1 className={`text-xl font-bold ${
          user?.darkMode ? 'text-white' : 'text-gray-800'
        }`}>Sleep Logs</h1>
        <p className={`text-sm ${
          user?.darkMode ? 'text-gray-400' : 'text-gray-600'
        }`}>Times shown in baby's timezone</p>
      </div>

      {/* Logs Container */}
      <div className="overflow-y-auto pb-32 h-[calc(100%-120px)]">
        {Object.keys(groupedLogs).length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              user?.darkMode ? 'bg-[#3a2f4a]' : 'bg-purple-100'
            }`}>
              <Moon className={`w-8 h-8 ${
                user?.darkMode ? 'text-purple-400' : 'text-purple-600'
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
                {dateLogs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => handleLogClick(log.id)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all hover:opacity-90 relative ${
                      user?.darkMode 
                        ? 'bg-[#4a3f5a]' 
                        : log.logType === 'sleep' 
                          ? 'bg-[#E8D5F2]'  // Purple background for sleep logs
                          : 'bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Time range in smaller purple text */}
                        <div className={`text-sm mb-1 ${
                          user?.darkMode ? 'text-purple-300' : 'text-purple-600'
                        }`}>
                          {getTimeRange(log)}
                        </div>
                        
                        {/* Log type in larger text */}
                        <div className={`text-lg font-medium ${
                          user?.darkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                          {log.sleepType === 'bedtime' ? 'Bedtime' : 
                           log.sleepType === 'nap' ? 'Nap' : 'Sleep'}
                        </div>
                      </div>
                      
                      {/* Comment indicator */}
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
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-6 z-20">
        <button
          onClick={handleNewLogClick}
          className={`btn btn-circle btn-lg shadow-lg border-none ${
            user?.darkMode 
              ? 'text-white hover:opacity-90' 
              : 'text-white hover:opacity-90'
          }`}
          style={{ 
            backgroundColor: user?.darkMode ? '#9B7EBD' : '#503460'
          }}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Minimal bottom spacing for iframe */}
      <div className={`h-[20px] ${
        user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
      }`}></div>
    </div>
  );
}

function LogDetailView({ childId, logId, timezone }: { childId: string; logId: string; timezone: string }) {
  const { user } = useBubbleAuth();
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState<FirebaseMessage[]>([]);
  const [newComment, setNewComment] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Load the log
  useEffect(() => {
    if (!logId) return;

    setIsLoading(true);
    getLog(logId)
      .then((logData) => {
        setLog(logData);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error loading log:', error);
        setIsLoading(false);
      });
  }, [logId]);

  // Get conversation ID for this child
  useEffect(() => {
    if (!childId) return;

    getOrCreateConversation(childId)
      .then((convId) => {
        setConversationId(convId);
      })
      .catch((error) => {
        console.error('Error getting conversation:', error);
      });
  }, [childId]);

  // Listen to comments for this log
  useEffect(() => {
    if (!logId) return;

    const unsubscribe = listenToLogComments(logId, (newComments) => {
      setComments(newComments);
    });

    return unsubscribe;
  }, [logId]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Format time in the baby's timezone
  const formatTimeInTimezone = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
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
      timeZone: timezone,
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
    if (!newComment.trim() || !user || !conversationId || !logId) return;

    try {
      await sendLogComment(
        user.id,
        user.name,
        newComment.trim(),
        conversationId,
        childId,
        logId
      );
      setNewComment("");
    } catch (error) {
      console.error("Failed to send comment:", error);
      alert(`Failed to send comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle back navigation
  const handleBack = () => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', 'logs');
    newUrl.searchParams.delete('logId');
    window.location.href = newUrl.toString();
  };

  // Handle edit navigation
  const handleEdit = () => {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', 'log-sleep');
    newUrl.searchParams.set('logId', logId);
    window.location.href = newUrl.toString();
  };

  if (isLoading || !log) {
    return <LoadingScreen message="Loading log details..." />;
  }

  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing - minimal for iframe embedding */}
      <div className="h-[20px]"></div>
      
      {/* Header */}
      <div className={`px-4 py-4 border-b ${
        user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className={`btn btn-circle btn-sm ${
                user?.darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
            <div>
              <h1 className={`text-xl font-bold ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                {log.sleepType === 'bedtime' ? 'Bedtime' : 'Nap'} Log
              </h1>
              <p className={`text-sm ${
                user?.darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {formatDateInTimezone(log.timestamp)} • by {log.userName}
              </p>
            </div>
          </div>
          <button
            onClick={handleEdit}
            className={`btn btn-sm ${
              user?.darkMode 
                ? 'btn-outline border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white' 
                : 'btn-outline border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white'
            }`}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex flex-col h-full h-[calc(100%-100px)]">
        
        {/* Log Details - Fixed at top */}
        <div className={`px-4 py-4 border-b ${
          user?.darkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          {/* Sleep Summary */}
          <div className={`p-4 rounded-lg mb-4 ${
            user?.darkMode ? 'bg-[#3a2f4a]' : 'bg-purple-50'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {log.sleepType === 'bedtime' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                <span className={`font-semibold ${
                  user?.darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  {getDurationText(log)}
                </span>
              </div>
              <div className={`text-sm ${
                user?.darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {log.events?.length || 0} events
              </div>
            </div>
            
            {/* Status indicator */}
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              log.isComplete
                ? user?.darkMode
                  ? 'bg-green-900 text-green-300 border border-green-700'
                  : 'bg-green-100 text-green-700 border border-green-200'
                : user?.darkMode
                  ? 'bg-yellow-900 text-yellow-300 border border-yellow-700'
                  : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                log.isComplete ? 'bg-green-500' : 'bg-yellow-500'
              }`}></div>
              {log.isComplete ? 'Complete' : 'In progress'}
            </div>
          </div>

          {/* Events Timeline */}
          {log.events && log.events.length > 0 && (
            <div>
              <h3 className={`text-sm font-medium mb-3 ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Timeline
              </h3>
              <div className="space-y-3">
                {log.events
                  .sort((a, b) => a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime())
                  .map((event, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        user?.darkMode ? 'bg-purple-400' : 'bg-purple-600'
                      }`}></div>
                      <div className="flex-1 flex justify-between items-center">
                        <span className={`text-sm ${
                          user?.darkMode ? 'text-white' : 'text-gray-800'
                        }`}>
                          {getEventTypeText(event.type)}
                        </span>
                        <span className={`text-sm ${
                          user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {event.localTime}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Comments Section - Scrollable */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`px-4 py-3 border-b ${
            user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-gray-50'
          }`}>
            <h3 className={`text-sm font-medium ${
              user?.darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Comments ({comments.length})
            </h3>
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <MessageCircle className={`w-12 h-12 mb-3 ${
                  user?.darkMode ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <p className={`text-sm text-center ${
                  user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  No comments yet. Start a conversation about this log.
                </p>
              </div>
            ) : (
              comments.map((comment) => {
                const isOwn = user?.id === comment.senderId;
                return (
                  <div key={comment.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    <div className="max-w-[75%] flex flex-col">
                      {/* Sender name and timestamp */}
                      <div className={`text-xs mb-1 flex justify-between items-center ${
                        user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        <span>{comment.senderName}</span>
                        <span>{formatTimeInTimezone(comment.timestamp)}</span>
                      </div>
                      
                      {/* Comment bubble */}
                      <div 
                        className={`min-w-[100px] rounded-2xl px-4 py-3 ${
                          isOwn 
                            ? `${user?.darkMode ? 'text-white' : 'text-gray-800'} rounded-br-md` 
                            : `${user?.darkMode ? 'bg-[#3a3a3a] text-gray-200' : 'bg-gray-200 text-gray-800'} rounded-bl-md`
                        }`} 
                        style={{ backgroundColor: isOwn ? (user?.darkMode ? '#2d2637' : '#f0ddef') : undefined }}
                      >
                        <p className="text-sm leading-relaxed">{comment.text}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Comment Input - Fixed at bottom */}
          <div className={`border-t px-4 py-3 ${
            user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-white'
          }`}>
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
                    backgroundColor: user?.darkMode ? '#f0ddef' : '#503460',
                    color: user?.darkMode ? '#503460' : 'white'
                  }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
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

function SleepLogModal({ childId, logId, timezone }: { childId: string; logId?: string | null; timezone: string }) {
  const { user } = useBubbleAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [sleepType, setSleepType] = useState<'nap' | 'bedtime'>('nap');
  const [events, setEvents] = useState<Array<{ type: SleepEvent['type']; timestamp: Date }>>([]);
  const [currentEventType, setCurrentEventType] = useState<SleepEvent['type']>('put_in_bed');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isComplete, setIsComplete] = useState(false);
  const [existingLog, setExistingLog] = useState<SleepLog | null>(null);

  // Load existing log if editing
  useEffect(() => {
    if (logId) {
      setIsLoading(true);
      getLog(logId)
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
          }
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('Error loading log:', error);
          setIsLoading(false);
        });
    }
  }, [logId]);

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

  // Format time for input
  const formatTimeForInput = (date: Date): string => {
    return date.toLocaleTimeString('en-US', { 
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format time for display
  const formatTimeForDisplay = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
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
    if (!user || events.length === 0) return;

    setIsLoading(true);
    try {
      if (logId && existingLog) {
        // Update existing log
        await updateSleepLog(logId, events, timezone, isComplete);
      } else {
        // Create new log with first event
        const newLogId = await createSleepLog(
          childId,
          user.id,
          user.name,
          sleepType,
          events[0],
          timezone
        );

        // If there are multiple events, update the log with all events
        if (events.length > 1) {
          await updateSleepLog(newLogId, events, timezone, isComplete);
        }
      }

      // Navigate back to logs list
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('view', 'logs');
      newUrl.searchParams.delete('logId');
      window.location.href = newUrl.toString();
    } catch (error) {
      console.error('Error saving log:', error);
      alert('Failed to save log. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel and go back
  const handleCancel = async () => {
    // If there are events, auto-save before leaving
    if (events.length > 0 && user) {
      const shouldSave = confirm('You have unsaved changes. Save this log before leaving?');
      if (shouldSave) {
        await handleSave();
        return; // handleSave will navigate away
      }
    }
    
    // Navigate back without saving
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('view', 'logs');
    newUrl.searchParams.delete('logId');
    window.location.href = newUrl.toString();
  };

  const validNextEvents = getValidNextEventTypes();
  const canAddEvent = validNextEvents.includes(currentEventType);
  const canSave = events.length > 0;

  if (isLoading) {
    return <LoadingScreen message={logId ? "Loading log..." : "Creating log..."} />;
  }

  return (
    <div className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
      user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
    }`}>
      {/* Top spacing - minimal for iframe embedding */}
      <div className="h-[20px]"></div>
      
      {/* Header */}
      <div className={`px-4 py-4 border-b ${
        user?.darkMode ? 'border-gray-700 bg-[#2d2637]' : 'border-gray-200 bg-white'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-xl font-bold ${
              user?.darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              {logId ? 'Edit Sleep Log' : 'New Sleep Log'}
            </h1>
            <p className={`text-sm ${
              user?.darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>Times in baby's timezone</p>
          </div>
          <button
            onClick={handleCancel}
            className={`btn btn-circle btn-sm ${
              user?.darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content - Ensure space for fixed buttons */}
      <div className="overflow-y-auto px-4 py-6" style={{ paddingBottom: '120px', height: 'calc(100vh - 180px)' }}>
        
        {/* Sleep Type Selection */}
        <div className="mb-6">
          <label className={`block text-sm font-medium mb-3 ${
            user?.darkMode ? 'text-white' : 'text-gray-800'
          }`}>
            Sleep Type
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setSleepType('nap')}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                sleepType === 'nap'
                  ? user?.darkMode
                    ? 'border-purple-400 bg-[#3a2f4a] text-white'
                    : 'border-purple-500 bg-purple-50 text-purple-700'
                  : user?.darkMode
                    ? 'border-gray-600 bg-[#2a223a] text-gray-300 hover:border-gray-500'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <Sun className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium">Nap</div>
            </button>
            <button
              onClick={() => setSleepType('bedtime')}
              className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                sleepType === 'bedtime'
                  ? user?.darkMode
                    ? 'border-purple-400 bg-[#3a2f4a] text-white'
                    : 'border-purple-500 bg-purple-50 text-purple-700'
                  : user?.darkMode
                    ? 'border-gray-600 bg-[#2a223a] text-gray-300 hover:border-gray-500'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              <Moon className="w-5 h-5 mx-auto mb-1" />
              <div className="text-sm font-medium">Bedtime</div>
            </button>
          </div>
        </div>

        {/* Events List */}
        {events.length > 0 && (
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-3 ${
              user?.darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Events ({events.length})
            </label>
            <div className="space-y-2">
              {events.map((event, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    user?.darkMode
                      ? 'border-gray-600 bg-[#2a223a]'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className={`font-medium ${
                        user?.darkMode ? 'text-white' : 'text-gray-800'
                      }`}>
                        {getEventTypeText(event.type)}
                      </span>
                    </div>
                    <span className={`text-sm ${
                      user?.darkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {formatTimeForDisplay(event.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Remove last event button */}
            <button
              onClick={handleRemoveLastEvent}
              className={`mt-3 text-sm underline ${
                user?.darkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-500'
              }`}
            >
              Remove last event
            </button>
          </div>
        )}

        {/* Add New Event */}
        {!isComplete && validNextEvents.length > 0 && (
          <div className="mb-6">
            <label className={`block text-sm font-medium mb-3 ${
              user?.darkMode ? 'text-white' : 'text-gray-800'
            }`}>
              Add Event
            </label>
            
            {/* Event type selection */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {validNextEvents.map((eventType) => (
                <button
                  key={eventType}
                  onClick={() => setCurrentEventType(eventType)}
                  className={`p-3 rounded-lg border-2 text-sm transition-all ${
                    currentEventType === eventType
                      ? user?.darkMode
                        ? 'border-purple-400 bg-[#3a2f4a] text-white'
                        : 'border-purple-500 bg-purple-50 text-purple-700'
                      : user?.darkMode
                        ? 'border-gray-600 bg-[#2a223a] text-gray-300 hover:border-gray-500'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {getEventTypeText(eventType)}
                </button>
              ))}
            </div>

            {/* Time input */}
            <div className="mb-4">
              <label className={`block text-xs font-medium mb-2 ${
                user?.darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Time
              </label>
              <input
                type="time"
                value={formatTimeForInput(currentTime)}
                onChange={(e) => handleTimeChange(e.target.value)}
                className={`input input-bordered w-full ${
                  user?.darkMode 
                    ? 'bg-[#3a3a3a] border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-800'
                }`}
              />
              <p className={`text-xs mt-1 ${
                user?.darkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {formatTimeForDisplay(currentTime)}
              </p>
            </div>

            {/* Add event button */}
            <button
              onClick={handleAddEvent}
              disabled={!canAddEvent}
              className={`btn w-full ${
                user?.darkMode 
                  ? 'btn-outline border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white' 
                  : 'btn-outline border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white'
              }`}
            >
              Add {getEventTypeText(currentEventType)}
            </button>
          </div>
        )}

        {/* Complete session toggle */}
        {events.length > 0 && (
          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isComplete}
                onChange={(e) => setIsComplete(e.target.checked)}
                className="checkbox checkbox-primary"
              />
              <span className={`text-sm ${
                user?.darkMode ? 'text-white' : 'text-gray-800'
              }`}>
                Mark session as complete
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Fixed bottom actions */}
      <div className={`fixed left-0 right-0 border-t z-50 ${
        user?.darkMode 
          ? 'border-gray-700 bg-[#2d2637]' 
          : 'border-gray-200 bg-white'
      }`} style={{ bottom: '20px' }}>
        <div className="max-w-[800px] mx-auto p-4 flex gap-3">
          <button
            onClick={handleCancel}
            className={`btn flex-1 ${
              user?.darkMode 
                ? 'btn-outline border-gray-600 text-gray-300 hover:bg-gray-600 hover:border-gray-600' 
                : 'btn-outline border-gray-400 text-gray-600 hover:bg-gray-100'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || isLoading}
            className={`btn flex-1 text-white ${
              user?.darkMode ? 'hover:opacity-90' : 'hover:opacity-90'
            }`}
            style={{ 
              backgroundColor: user?.darkMode ? '#9B7EBD' : '#503460'
            }}
          >
            {isLoading ? (
              <div className="loading loading-spinner w-4 h-4"></div>
            ) : (
              logId ? 'Update Log' : 'Save Log'
            )}
          </button>
        </div>
      </div>

      {/* Minimal bottom spacing for iframe */}
      <div className={`h-[20px] ${
        user?.darkMode ? 'bg-[#15111B]' : 'bg-white'
      }`}></div>
    </div>
  );
}