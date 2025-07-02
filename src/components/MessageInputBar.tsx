import React, { useState, useRef } from 'react';
import { Send, Plus, Mic, Square } from 'lucide-react';
import { sendMessage, sendImageMessage, sendAudioMessage, setTypingStatus, sendLogComment, sendLogImageComment, sendLogAudioComment } from '@/lib/firebase-messaging';
import { BubbleUser } from '@/lib/jwt-auth';

interface MessageInputBarProps {
  user: BubbleUser;
  conversationId: string;
  childId: string;
  
  // Message input props
  newMessage: string;
  setNewMessage: (message: string) => void;
  placeholder?: string;
  
  // Log comment specific props (optional)
  logId?: string;
  
  // Typing indicators (optional - only for chat)
  typingUsers?: { userId: string; userName: string }[];
  
  // Callbacks
  onMessageSent?: () => void;
}

export function MessageInputBar({
  user,
  conversationId,
  childId,
  newMessage,
  setNewMessage,
  placeholder = "Start typing here",
  logId,
  typingUsers = [],
  onMessageSent,
}: MessageInputBarProps) {
  // State management
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Photo upload functions
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
      let messageId;
      if (logId) {
        // Send as log comment
        messageId = await sendLogImageComment(
          user.id,
          user.name,
          file,
          conversationId,
          childId,
          logId
        );
        console.log('Log image comment sent successfully:', messageId);
      } else {
        // Send as regular message
        messageId = await sendImageMessage(
          user.id,
          user.name,
          file,
          conversationId,
          childId
        );
        console.log('Image message sent successfully:', messageId);
      }
      onMessageSent?.();
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

  // Voice recording functions
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
            if (logId) {
              // Send as log comment
              await sendLogAudioComment(
                user.id,
                user.name,
                audioBlob,
                conversationId,
                childId,
                logId
              );
              console.log('Log audio comment sent successfully');
            } else {
              // Send as regular message
              await sendAudioMessage(
                user.id,
                user.name,
                audioBlob,
                conversationId,
                childId
              );
              console.log('Audio message sent successfully');
            }
            onMessageSent?.();
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

  // Typing indicator functions (only for chat, not log comments)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    // Only handle typing indicators for chat (not log comments)
    if (!user || logId) return;

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

  // Send message function
  const handleSend = async () => {
    if (!newMessage.trim() || !user || !conversationId || !childId) return;

    try {
      if (logId) {
        // Send log comment
        await sendLogComment(
          user.id,
          user.name,
          newMessage.trim(),
          conversationId,
          childId,
          logId
        );
      } else {
        // Send regular message
        await sendMessage(
          user.id,
          user.name,
          newMessage.trim(),
          conversationId,
          childId
        );
      }
      setNewMessage("");
      onMessageSent?.();
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSendWithTypingCleanup = async () => {
    // Stop typing indicator when sending message (only for chat)
    if (user && !logId) {
      setTypingStatus(user.id, user.name, false);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
    await handleSend();
  };

  return (
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
        
        {/* Typing Indicators (only for chat) */}
        {!logId && typingUsers.length > 0 && (
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

        <div className={`flex items-center gap-3 ${logId ? 'max-w-full' : ''}`}>
          {/* Photo upload button */}
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

          {/* Voice recording button */}
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
          
          {/* Text input and send button */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && handleSendWithTypingCleanup()}
              placeholder={placeholder}
              className={`input input-bordered w-full pr-12 rounded-full focus:outline-none ${
                logId ? '' : 'h-12 box-border'
              } ${
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
  );
}