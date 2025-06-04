import { SignInButton, useUser, SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Plus, Send, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { FirebaseMessage } from "@/types/firebase";
import {
  sendMessage,
  sendImageMessage,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                <div className={`min-w-[200px] rounded-2xl ${
                  isOwn 
                    ? 'bg-purple-200 text-gray-800 rounded-br-md' 
                    : 'bg-gray-200 text-gray-800 rounded-bl-md'
                } ${message.type === 'image' ? 'p-2' : 'px-4 py-3'}`}>
                {message.type === 'image' && message.imageId ? (
                  <ImageMessage imageUrl={message.imageId} onImageClick={handleImageClick} />
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
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Start typing here"
              className="input input-bordered w-full pr-12 rounded-full bg-gray-100 border-gray-300 focus:border-purple-400 focus:outline-none text-gray-700 placeholder-gray-500 h-12 box-border"
            />
            <button 
              onClick={handleSend}
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