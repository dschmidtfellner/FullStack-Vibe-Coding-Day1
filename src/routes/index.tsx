import { SignInButton, useUser, SignedIn, SignedOut } from "@clerk/clerk-react";
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
        className="btn btn-circle btn-sm bg-purple-100 text-purple-600 hover:bg-purple-200"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 bg-purple-300 rounded-full"></div>
          <div className="w-6 h-1 bg-purple-300 rounded-full"></div>
          <div className="w-10 h-1 bg-purple-300 rounded-full"></div>
          <div className="w-4 h-1 bg-purple-300 rounded-full"></div>
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
  return (
    <div className="not-prose">
      <SignedOut>
        <div className="text-center min-h-screen flex flex-col items-center justify-center px-4">
          <MessageCircle className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Welcome to Chat</h1>
          <p className="text-base-content/70 mb-6">Sign in to start messaging</p>
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-lg">Get Started</button>
          </SignInButton>
        </div>
      </SignedOut>

      <SignedIn>
        <MessagingApp />
      </SignedIn>
    </div>
  );
}

function MessagingApp() {
  const { user } = useUser();
  const [messages, setMessages] = useState<FirebaseMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{ userId: string; userName: string }[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null); // messageId or null
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Listen to messages
  useEffect(() => {
    const unsubscribe = listenToMessages((newMessages) => {
      setMessages(newMessages);
    });

    return unsubscribe;
  }, []);

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
    if (!newMessage.trim() || !user) {
      console.log('Cannot send: missing message or user', { newMessage, user });
      return;
    }
    
    console.log('Attempting to send message:', {
      userId: user.id,
      userName: user.fullName || user.firstName || 'Anonymous',
      text: newMessage.trim()
    });
    
    try {
      const messageId = await sendMessage(
        user.id,
        user.fullName || user.firstName || 'Anonymous',
        newMessage.trim()
      );
      console.log('Message sent successfully:', messageId);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(`Failed to send message: ${error.message}`);
    }
  };

  const handlePhotoSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) {
      console.log('No file or user:', { file, user });
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
      userName: user.fullName || user.firstName || 'Anonymous'
    });

    setIsUploading(true);

    try {
      const messageId = await sendImageMessage(
        user.id,
        user.fullName || user.firstName || 'Anonymous',
        file
      );
      console.log('Image message sent successfully:', messageId);
    } catch (error) {
      console.error("Failed to upload image:", error);
      console.error("Error details:", error.message);
      alert(`Failed to upload image: ${error.message}`);
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
        if (user) {
          setIsUploading(true);
          try {
            await sendAudioMessage(
              user.id,
              user.fullName || user.firstName || 'Anonymous',
              audioBlob
            );
          } catch (error) {
            console.error("Failed to upload audio:", error);
            alert("Failed to upload audio");
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
      setTypingStatus(user.id, user.fullName || user.firstName || 'Anonymous', true);
      
      // Clear any existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set a timeout to stop typing indicator after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setTypingStatus(user.id, user.fullName || user.firstName || 'Anonymous', false);
      }, 2000);
    } else {
      // If input is empty, immediately stop typing indicator
      setTypingStatus(user.id, user.fullName || user.firstName || 'Anonymous', false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleSendWithTypingCleanup = async () => {
    // Stop typing indicator when sending message
    if (user) {
      setTypingStatus(user.id, user.fullName || user.firstName || 'Anonymous', false);
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
        user.fullName || user.firstName || 'Anonymous'
      );
      setShowReactionPicker(null);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];


  return (
    <div className="relative h-full bg-white">
      {/* Messages Container */}
      <div className="overflow-y-auto px-4 py-6 pb-24 space-y-4 h-full">
        {messages.map((message) => {
          const isOwn = isOwnMessage(message.senderId);
          return (
            <div key={message.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              <div className="max-w-[75%] flex flex-col">
                {/* Sender name and timestamp */}
                <div className={`text-xs text-gray-600 mb-1 flex justify-between items-center`}>
                  <span className="font-medium">{message.senderName}</span>
                  <span>{formatTime(message.timestamp)}</span>
                </div>
                
                {/* Message bubble */}
                <div className="relative group">
                  <div className={`min-w-[200px] rounded-2xl ${
                    isOwn 
                      ? 'bg-purple-200 text-gray-800 rounded-br-md' 
                      : 'bg-gray-200 text-gray-800 rounded-bl-md'
                  } ${message.type === 'image' ? 'p-2' : 'px-4 py-3'}`}>
                  {message.type === 'image' && message.imageId ? (
                    <ImageMessage imageUrl={message.imageId} onImageClick={handleImageClick} />
                  ) : message.type === 'audio' && message.audioId ? (
                    <AudioMessage audioUrl={message.audioId} />
                  ) : (
                    <p className="text-base leading-relaxed">{message.text}</p>
                  )}
                  </div>
                  
                  {/* Reaction button (shows on hover) */}
                  <button
                    onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                    className="reaction-button absolute -top-2 -right-2 btn btn-circle btn-xs bg-gray-100 text-gray-600 hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    😊
                  </button>
                  
                  {/* Reaction picker */}
                  {showReactionPicker === message.id && (
                    <div className="reaction-picker absolute top-8 right-0 bg-white rounded-lg shadow-lg border p-2 flex gap-1 z-20">
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReaction(message.id, emoji)}
                          className="hover:bg-gray-100 rounded p-1 text-lg transition-colors"
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
      </div>

      {/* Message Input - Floating at bottom */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 p-4 bg-white shadow-lg z-10">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div className="mb-3 px-4 py-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
            className="btn btn-circle btn-sm bg-purple-100 border-none text-purple-600 hover:bg-purple-200 flex-shrink-0 disabled:opacity-50"
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
                : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
            }`}
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
              className="input input-bordered w-full pr-12 rounded-full bg-gray-100 border-gray-300 focus:border-purple-400 focus:outline-none text-gray-700 placeholder-gray-500 h-12 box-border"
            />
            <button 
              onClick={handleSendWithTypingCleanup}
              disabled={isUploading || !newMessage.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm flex-shrink-0 z-10 bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

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