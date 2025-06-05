import { useBubbleAuth, useChildAccess } from "@/hooks/useBubbleAuth";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Plus, Send, X, Mic, Square, Play, Pause } from "lucide-react";
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
} from "@/lib/firebase-messaging";

function ImageMessage({ imageUrl, onImageClick }: { imageUrl: string; onImageClick: (imageUrl: string) => void }) {
  return (
    <img 
      src={imageUrl} 
      alt="Shared image" 
      className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
      onClick={() => onImageClick(imageUrl)}
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
    <div className="flex items-center gap-3 min-w-[200px]">
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

  // Show loading animation while authenticating
  if (isLoading) {
    return <LoadingScreen message="Connecting..." />;
  }

  // Only show error after we've finished loading and confirmed there's an issue
  if (error || !user) {
    return (
      <div className="not-prose min-h-screen flex flex-col items-center justify-center px-4">
        <MessageCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-semibold mb-2 text-gray-900">Authentication Required</h1>
        <p className="text-gray-600 mb-6 text-center max-w-md">
          {error || 'Please provide a valid authentication token to access the chat.'}
        </p>
        <div className="bg-gray-100 p-4 rounded-lg text-sm text-gray-700 max-w-lg">
          <p className="font-medium mb-2">Expected URL format:</p>
          <code className="text-xs bg-white p-2 rounded block">
            ?childId=123&amp;token=eyJ...
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="not-prose">
      <MessagingApp />
    </div>
  );
}

// Enhanced loading screen component
function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="not-prose min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="text-center">
        {/* Animated logo/icon */}
        <div className="relative mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          {/* Floating dots animation */}
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
        
        {/* Loading text */}
        <p className="text-lg font-medium text-gray-700 mb-2">{message}</p>
        <p className="text-sm text-gray-500">Setting up your secure chat...</p>
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


  if (isLoadingConversation) {
    return <LoadingScreen message="Loading conversation..." />;
  }

  if (!conversationId || !childId) {
    return (
      <div className="relative h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-gray-400 mb-4 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Conversation</h2>
          <p className="text-gray-500">Please provide a valid childId parameter.</p>
          <p className="text-sm text-gray-400 mt-2">URL format: ?childId=123&childName=John&token=...</p>
        </div>
      </div>
    );
  }

  // Check if user has permission to access this child's conversation
  console.log('🔍 Access Check Debug:', {
    hasChildAccess,
    childId,
    userChildIds: user?.childIds,
    userType: user?.userType,
    userName: user?.name
  });
  
  if (!hasChildAccess) {
    return (
      <div className="relative h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 text-red-400 mb-4 mx-auto" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view this conversation.</p>
          <div className="mt-4 p-4 bg-gray-100 rounded-lg text-sm text-left">
            <p className="font-medium text-gray-700 mb-2">Your access:</p>
            <p className="text-gray-600">Type: <span className="font-medium">{user?.userType}</span></p>
            <p className="text-gray-600">Child IDs: <span className="font-medium">{user?.childIds.join(', ')}</span></p>
            <p className="text-gray-600">Requested: <span className="font-medium">{childId}</span></p>
          </div>
        </div>
      </div>
    );
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
                
                {/* Message bubble */}
                <div className="relative group">
                  <div className={`min-w-[200px] rounded-2xl ${
                    isOwn 
                      ? `${user?.darkMode ? 'text-white' : 'text-gray-800'} rounded-br-md` 
                      : `${user?.darkMode ? 'bg-[#3a3a3a] text-gray-200' : 'bg-gray-200 text-gray-800'} rounded-bl-md`
                  } ${message.type === 'image' ? 'p-2' : 'px-4 py-3'}`} style={{ backgroundColor: isOwn ? (user?.darkMode ? '#2d2637' : '#f0ddef') : undefined }}>
                  {message.type === 'image' && message.imageId ? (
                    <ImageMessage imageUrl={message.imageId} onImageClick={handleImageClick} />
                  ) : message.type === 'audio' && message.audioId ? (
                    <AudioMessage audioUrl={message.audioId} />
                  ) : (
                    <p className="text-base leading-relaxed">{message.text}</p>
                  )}
                  </div>
                  
                  {/* Reaction button (shows on hover on desktop, always visible on mobile) */}
                  <button
                    onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                    className={`reaction-button absolute -top-2 -right-2 btn btn-circle btn-xs opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 sm:opacity-100 transition-opacity ${
                      user?.darkMode 
                        ? 'bg-[#3a3a3a] text-gray-300 hover:bg-[#4a4a4a]' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  
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
                              ? 'bg-purple-100 border-purple-300 text-purple-700'
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

      {/* Space for Bubble nav bar - 81px */}
      <div className={`h-[81px] ${
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