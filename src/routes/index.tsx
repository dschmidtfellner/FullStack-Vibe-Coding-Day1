import { SignInButton, useUser } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated, useMutation } from "convex/react";
import { MessageCircle, Plus, Mic, Send, Image, X, Square, Play, Pause } from "lucide-react";
import { useState, useRef } from "react";
import { api } from "../../convex/_generated/api";

function ImageMessage({ imageId, onImageClick }: { imageId: string; onImageClick: (imageUrl: string) => void }) {
  const { data: imageUrl } = useSuspenseQuery(convexQuery(api.messages.getImageUrl, { imageId: imageId as any }));
  
  if (!imageUrl) return null;
  
  return (
    <img 
      src={imageUrl} 
      alt="Shared image" 
      className="max-w-full max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
      onClick={() => onImageClick(imageUrl)}
    />
  );
}

function AudioMessage({ audioId }: { audioId: string }) {
  const { data: audioUrl } = useSuspenseQuery(convexQuery(api.messages.getAudioUrl, { audioId: audioId as any }));
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  if (!audioUrl) return null;
  
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

const messagesQueryOptions = convexQuery(api.messages.list, {});
const currentUserQueryOptions = convexQuery(api.users.getCurrentUser, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(messagesQueryOptions);
    await queryClient.ensureQueryData(currentUserQueryOptions);
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="not-prose">
      <Unauthenticated>
        <div className="text-center min-h-screen flex flex-col items-center justify-center px-4">
          <MessageCircle className="w-16 h-16 text-primary mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Welcome to Chat</h1>
          <p className="text-base-content/70 mb-6">Sign in to start messaging</p>
          <SignInButton mode="modal">
            <button className="btn btn-primary btn-lg">Get Started</button>
          </SignInButton>
        </div>
      </Unauthenticated>

      <Authenticated>
        <MessagingApp />
      </Authenticated>
    </div>
  );
}

function MessagingApp() {
  const { data: messages } = useSuspenseQuery(messagesQueryOptions);
  const { data: currentUser } = useSuspenseQuery(currentUserQueryOptions);
  const { user } = useUser();
  const sendMessage = useMutation(api.messages.send);
  const sendImage = useMutation(api.messages.sendImage);
  const sendAudio = useMutation(api.messages.sendAudio);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const [newMessage, setNewMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;
    
    try {
      await sendMessage({
        text: newMessage.trim(),
      });
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handlePhotoSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check if it's an image
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    setIsUploading(true);

    try {
      // Generate upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload the file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const { storageId } = await result.json();

      // Send the image message
      await sendImage({
        imageId: storageId,
      });
    } catch (error) {
      console.error("Failed to upload image:", error);
      alert("Failed to upload image");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", { 
      month: "numeric", 
      day: "numeric" 
    }) + ", " + date.toLocaleTimeString("en-US", { 
      hour: "numeric", 
      minute: "2-digit" 
    }).toLowerCase();
  };

  const isOwnMessage = (senderId: string) => {
    return currentUser?._id === senderId;
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

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        // Stop all tracks to turn off microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAudioMessage = async () => {
    if (!audioBlob || !user) return;

    setIsUploading(true);

    try {
      // Generate upload URL
      const uploadUrl = await generateUploadUrl();

      // Upload the audio file
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": audioBlob.type },
        body: audioBlob,
      });

      const { storageId } = await result.json();

      // Send the audio message
      await sendAudio({
        audioId: storageId,
      });

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
      <div className="h-full overflow-y-auto px-4 py-6 pb-36 space-y-4">
        {messages.map((message) => {
          const isOwn = isOwnMessage(message.senderId);
          return (
            <div key={message._id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              {/* Sender name and timestamp */}
              <div className={`text-sm text-gray-600 mb-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                <span className="font-medium">{message.senderName}</span>
                <span className="ml-2">{formatTime(message._creationTime)}</span>
              </div>
              
              {/* Message bubble */}
              <div className={`max-w-[75%] rounded-2xl ${
                isOwn 
                  ? 'bg-purple-200 text-gray-800 rounded-br-md' 
                  : 'bg-gray-200 text-gray-800 rounded-bl-md'
              } ${message.type === 'image' ? 'p-2' : 'px-4 py-3'}`}>
                {message.type === 'image' && message.imageId ? (
                  <ImageMessage imageId={message.imageId} onImageClick={handleImageClick} />
                ) : message.type === 'audio' && message.audioId ? (
                  <AudioMessage audioId={message.audioId} />
                ) : (
                  <p className="text-base leading-relaxed">{message.text}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed Message Input */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 p-4 bg-white z-10">
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
              onClick={sendAudioMessage}
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
              <div className="input w-full pr-12 rounded-full bg-red-100 border-red-300 py-3 flex items-center gap-3">
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
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Start typing here"
                className="input w-full pr-12 rounded-full bg-gray-100 border-gray-300 focus:border-purple-400 focus:outline-none text-gray-700 placeholder-gray-500 py-3"
              />
            )}
            <button 
              onClick={isRecording ? stopRecording : newMessage.trim() ? handleSend : startRecording}
              disabled={isUploading}
              className={`absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm flex-shrink-0 ${
                isRecording
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : newMessage.trim() 
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {isRecording ? (
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
