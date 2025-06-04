import { SignInButton, useUser, SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Plus, Mic, Send, X, Square, Play, Pause } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { FirebaseMessage } from "@/types/firebase";
import {
  sendMessage,
  sendImageMessage,
  sendAudioMessage,
  listenToMessages,
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
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Listen to messages
  useEffect(() => {
    const unsubscribe = listenToMessages((newMessages) => {
      setMessages(newMessages);
    });

    return unsubscribe;
  }, []);

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
    console.log('startRecording called', { isRequestingMic, isRecording, isUploading });
    
    if (isRequestingMic || isRecording) {
      console.log('Preventing recording - already in progress');
      return;
    }
    
    try {
      console.log('Starting recording process...');
      setIsRequestingMic(true);
      
      // Request microphone permission - this may show a browser dialog
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted, setting up recorder...');
      
      setIsRequestingMic(false);
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        console.log('Recording stopped, creating audio blob...');
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        // Stop all tracks to turn off microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      // Clear any existing message when starting recording
      setNewMessage("");
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error in startRecording:', error);
      
      // Reset states if there was an error
      setIsRequestingMic(false);
      setIsRecording(false);
      
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      } else if (error.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert(`Unable to access microphone: ${error.message}`);
      }
    }
  };

  const stopRecording = () => {
    console.log('stopRecording called', { 
      hasMediaRecorder: !!mediaRecorderRef.current, 
      isRecording,
      mediaRecorderState: mediaRecorderRef.current?.state 
    });
    
    if (mediaRecorderRef.current && isRecording) {
      console.log('Stopping media recorder...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('Recording stopped, state updated');
    } else {
      console.log('Cannot stop recording - missing mediaRecorder or not recording');
    }
  };

  const handleSendAudio = async () => {
    if (!audioBlob || !user) return;

    setIsUploading(true);

    try {
      await sendAudioMessage(
        user.id,
        user.fullName || user.firstName || 'Anonymous',
        audioBlob
      );
      setAudioBlob(null);
    } catch (error) {
      console.error("Failed to upload audio:", error);
      alert("Failed to upload audio");
    } finally {
      setIsUploading(false);
    }
  };

  const cancelAudio = () => {
    setAudioBlob(null);
  };

  return (
    <div className="relative h-full bg-white">
      {/* Messages Container */}
      <div className="overflow-y-auto px-4 py-6 pb-32 space-y-4 h-full">
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
        
        {/* Audio Recording Preview */}
        {audioBlob && (
          <div className="mb-3 p-3 bg-purple-50 rounded-lg flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Mic className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-purple-700">Audio recorded</span>
              <div className="flex items-center gap-1">
                <div className="w-6 h-1 bg-purple-300 rounded-full"></div>
                <div className="w-4 h-1 bg-purple-300 rounded-full"></div>
                <div className="w-8 h-1 bg-purple-300 rounded-full"></div>
              </div>
            </div>
            <button
              onClick={cancelAudio}
              className="btn btn-sm btn-ghost text-purple-600"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleSendAudio}
              disabled={isUploading}
              className="btn btn-sm bg-purple-600 text-white hover:bg-purple-700"
            >
              {isUploading ? (
                <div className="loading loading-spinner w-4 h-4"></div>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 max-w-full">
          <button 
            onClick={handlePhotoSelect}
            disabled={isUploading || isRecording}
            className="btn btn-circle btn-sm bg-purple-100 border-none text-purple-600 hover:bg-purple-200 flex-shrink-0 disabled:opacity-50"
          >
            {isUploading ? (
              <div className="loading loading-spinner w-4 h-4"></div>
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
          
          <div className="flex-1 relative">
            {isRecording ? (
              <div className="input input-bordered w-full pr-12 rounded-full bg-red-100 border-red-300 flex items-center gap-3 h-12 box-border">
                <div className="flex items-center gap-2 text-red-600">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Recording...</span>
                </div>
              </div>
            ) : (
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isRecording && handleSend()}
                placeholder="Start typing here"
                className="input input-bordered w-full pr-12 rounded-full bg-gray-100 border-gray-300 focus:border-purple-400 focus:outline-none text-gray-700 placeholder-gray-500 h-12 box-border"
                disabled={isRecording}
              />
            )}
            <button 
              onClick={(e) => {
                console.log('Button clicked!', { 
                  isRecording, 
                  hasMessage: !!newMessage.trim(), 
                  isUploading, 
                  isRequestingMic,
                  disabled: isUploading || isRequestingMic
                });
                
                if (isRecording) {
                  console.log('Calling stopRecording');
                  stopRecording();
                } else if (newMessage.trim()) {
                  console.log('Calling handleSend');
                  handleSend();
                } else {
                  console.log('Calling startRecording');
                  startRecording();
                }
              }}
              disabled={isUploading || isRequestingMic}
              className={`absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm flex-shrink-0 z-10 ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : isRequestingMic
                  ? 'bg-orange-500 text-white'
                  : newMessage.trim() 
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {isRequestingMic ? (
                <div className="loading loading-spinner w-3 h-3"></div>
              ) : isRecording ? (
                <Square className="w-4 h-4" />
              ) : newMessage.trim() ? (
                <Send className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
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