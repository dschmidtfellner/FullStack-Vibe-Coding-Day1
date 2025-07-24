import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useBubbleAuth } from "@/hooks/useBubbleAuth";
import { useChildAccess } from "@/hooks/useBubbleAuth";
import { useTopSpacing } from "@/hooks/useTopSpacing";
import { MessageInputBar } from "@/components/shared/MessageInputBar";
import { FirebaseMessage } from "@/lib/firebase/types";
import {
  ImageMessage,
  AudioMessage,
} from "@/features/shared/components/media-messages";
import {
  listenToMessages,
  listenToTypingIndicators,
  toggleMessageReaction,
  getOrCreateConversation,
  markChatMessagesAsRead,
} from "@/lib/firebase/index";
import { useNavigation } from "@/contexts/NavigationContext";

// Universal skeleton loading component (will be extracted later)
function UniversalSkeleton() {
  return (
    <div className="relative h-full font-['Poppins'] max-w-[800px] mx-auto px-4 py-4">
      {/* Simple wide gray boxes */}
      <div className="space-y-3">
        <div className="h-12 w-full rounded animate-pulse bg-gray-300"></div>
        <div className="h-8 w-3/4 rounded animate-pulse bg-gray-400"></div>
        <div className="h-6 w-1/2 rounded animate-pulse bg-gray-300"></div>
        <div className="h-10 w-full rounded animate-pulse bg-gray-300"></div>
        <div className="h-6 w-2/3 rounded animate-pulse bg-gray-400"></div>
      </div>
    </div>
  );
}

export function MessagingView() {
  const { user } = useBubbleAuth();
  const { topSpacingClass, containerHeightClass } = useTopSpacing();
  const { state } = useNavigation();
  const [messages, setMessages] = useState<FirebaseMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<
    { userId: string; userName: string }[]
  >([]);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(
    null,
  ); // messageId or null
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);

  // Check if user has access to the current child
  const hasChildAccess = useChildAccess(childId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get unread counters (for future use)
  // const { counters } = useUnreadCounters(user?.id || null, childId);

  // Auto-scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize conversation from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const childIdParam = urlParams.get("childId");
    const childNameParam = urlParams.get("childName");

    console.log("🔍 Conversation initialization:", {
      fullURL: window.location.href,
      childIdParam,
      childNameParam,
      hasUser: !!user,
    });

    if (childIdParam && user) {
      console.log("✅ Found childId and user, creating conversation...");
      // Create or get conversation for this child
      getOrCreateConversation(
        childIdParam,
        childNameParam || undefined,
        user.id,
        user.name,
      )
        .then((convId) => {
          console.log("🎉 Conversation created successfully:", convId);
          setConversationId(convId);
          setChildId(childIdParam);
          setIsLoadingConversation(false);
        })
        .catch((error) => {
          console.error("❌ Error initializing conversation:", error);
          setIsLoadingConversation(false);
        });
    } else if (childIdParam && !user) {
      console.log("⏳ Waiting for user authentication...");
    } else {
      console.log("❌ No childId parameter found");
      // Development mode - require childId parameter
      setIsLoadingConversation(false);
    }
  }, [user]);

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

  // Mark chat messages as read when viewing conversation
  useEffect(() => {
    if (!conversationId || !user?.id || !childId) return;

    // Mark as read after a small delay to ensure user is actually viewing
    const timer = setTimeout(() => {
      markChatMessagesAsRead(user.id, childId, conversationId)
        .then(() => {
          console.log("Chat messages marked as read");
        })
        .catch((error) => {
          console.error("Error marking chat messages as read:", error);
        });
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [conversationId, user?.id, childId]);

  // Close reaction picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".reaction-picker") &&
        !target.closest(".reaction-button")
      ) {
        setShowReactionPicker(null);
      }
    };

    if (showReactionPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showReactionPicker]);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";

    // Handle Firebase Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    // Use the timezone from navigation state or fallback to local timezone
    const timezone = state.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        month: "numeric",
        day: "numeric",
      }).format(date) +
      ", " +
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date).toLowerCase()
    );
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

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      await toggleMessageReaction(messageId, emoji, user.id, user.name);
      setShowReactionPicker(null);
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];

  // Show loading for any of these conditions
  if (isLoadingConversation || !conversationId || !childId || !hasChildAccess) {
    return <UniversalSkeleton />;
  }

  return (
    <div
      className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
        user?.darkMode ? "bg-[#15111B]" : "bg-white"
      }`}
    >
      {/* Dynamic top spacing based on Show_CTA URL parameter */}
      <div className={topSpacingClass}></div>

      {/* Messages Container */}
      <div
        className={`overflow-y-auto px-4 py-6 pb-[116px] space-y-4 ${containerHeightClass}`}
      >
        {messages.map((message) => {
          const isOwn = isOwnMessage(message.senderId);
          return (
            <div
              key={message.id}
              className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
            >
              <div className="max-w-[75%] flex flex-col">
                {/* Sender name and timestamp */}
                <div
                  className={`text-xs mb-1 flex justify-between items-center ${
                    user?.darkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  <span>{message.senderName}</span>
                  <span>{formatTime(message.timestamp)}</span>
                </div>

                {/* Message bubble - clickable to show reactions */}
                <div className="relative group">
                  <div
                    className={`min-w-[200px] rounded-2xl cursor-pointer transition-opacity hover:opacity-90 ${
                      isOwn
                        ? `${user?.darkMode ? "text-white" : "text-gray-800"} rounded-br-md`
                        : `${user?.darkMode ? "bg-[#3a3a3a] text-gray-200" : "bg-gray-200 text-gray-800"} rounded-bl-md`
                    } ${message.type === "image" ? "p-2" : "px-4 py-3"}`}
                    style={{
                      backgroundColor: isOwn
                        ? user?.darkMode
                          ? "#2d2637"
                          : "#F0DDEF"
                        : undefined,
                    }}
                    onClick={() =>
                      setShowReactionPicker(
                        showReactionPicker === message.id ? null : message.id,
                      )
                    }
                  >
                    {message.type === "image" && message.imageId ? (
                      <ImageMessage
                        imageUrl={message.imageId}
                        onImageClick={handleImageClick}
                      />
                    ) : message.type === "audio" && message.audioId ? (
                      <AudioMessage audioUrl={message.audioId} />
                    ) : (
                      <p className="text-base leading-relaxed">
                        {message.text}
                      </p>
                    )}
                  </div>

                  {/* Reaction picker */}
                  {showReactionPicker === message.id && (
                    <div
                      className={`reaction-picker absolute top-8 right-0 rounded-lg shadow-lg border p-2 flex gap-1 z-20 ${
                        user?.darkMode
                          ? "bg-[#2a2a2a] border-gray-600"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      {commonEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => void handleReaction(message.id, emoji)}
                          className={`rounded p-1 text-lg transition-colors ${
                            user?.darkMode
                              ? "hover:bg-[#3a3a3a]"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Display existing reactions */}
                  {message.reactions &&
                    Object.keys(message.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.values(message.reactions).map((reaction) => (
                          <button
                            key={reaction.emoji}
                            onClick={() =>
                              void handleReaction(message.id, reaction.emoji)
                            }
                            title={`${reaction.userNames?.length === 1 ? reaction.userNames[0] : reaction.userNames?.slice(0, -1).join(", ") + " and " + reaction.userNames?.[reaction.userNames.length - 1]} reacted with ${reaction.emoji}`}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors ${
                              reaction.users.includes(user?.id || "")
                                ? user?.darkMode
                                  ? "bg-[#2d2637] border-gray-600 text-white"
                                  : "bg-gray-100 border-gray-300 text-gray-700"
                                : user?.darkMode
                                  ? "bg-[#3a3a3a] border-gray-600 text-white hover:bg-[#4a4a4a]"
                                  : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
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

      {/* Message Input - Shared component with all advanced features */}
      {user && conversationId && childId && (
        <MessageInputBar
          user={user}
          conversationId={conversationId}
          childId={childId}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          placeholder="Start typing here"
          typingUsers={typingUsers}
        />
      )}

      {/* Minimal bottom spacing for iframe */}
      <div
        className={`h-[20px] ${user?.darkMode ? "bg-[#15111B]" : "bg-white"}`}
      ></div>

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
              style={{
                maxHeight: "calc(100vh - 8rem)",
                maxWidth: "calc(100vw - 4rem)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
