import { SignInButton, useUser } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated, useMutation } from "convex/react";
import { MessageCircle, Plus, Mic } from "lucide-react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

const messagesQueryOptions = convexQuery(api.messages.list, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) =>
    await queryClient.ensureQueryData(messagesQueryOptions),
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
  const { user } = useUser();
  const sendMessage = useMutation(api.messages.send);
  const [newMessage, setNewMessage] = useState("");

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;
    
    await sendMessage({
      text: newMessage.trim(),
      senderId: user.id as any,
      senderName: user.fullName || user.username || "Anonymous",
    });
    setNewMessage("");
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
    return user?.id === senderId;
  };

  return (
    <div className="flex flex-col h-screen max-h-screen bg-base-100">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message) => {
          const isOwn = isOwnMessage(message.senderId);
          return (
            <div key={message._id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              {/* Sender name and timestamp */}
              <div className={`text-sm text-base-content/60 mb-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                <span className="font-medium">{message.senderName}</span>
                <span className="ml-2">{formatTime(message._creationTime)}</span>
              </div>
              
              {/* Message bubble */}
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${
                isOwn 
                  ? 'bg-primary text-primary-content rounded-br-md' 
                  : 'bg-base-200 text-base-content rounded-bl-md'
              }`}>
                <p className="text-base leading-relaxed">{message.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message Input */}
      <div className="border-t border-base-300 p-4 bg-base-100">
        <div className="flex items-center gap-3">
          <button className="btn btn-circle btn-sm bg-primary/20 border-none text-primary hover:bg-primary hover:text-primary-content">
            <Plus className="w-4 h-4" />
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Start typing here"
              className="input input-bordered w-full pr-12 rounded-full bg-base-200 border-base-300 focus:border-primary"
            />
            <button 
              onClick={handleSend}
              disabled={!newMessage.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm btn-primary"
            >
              <Mic className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
