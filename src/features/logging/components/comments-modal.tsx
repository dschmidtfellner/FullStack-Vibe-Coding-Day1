import { useState, useEffect } from 'react';
import { useNavigation } from '@/contexts/NavigationContext';
import { X, MessageSquare, Search } from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { FirebaseMessage } from '@/types/firebase';
import { db } from '@/lib/firebase/core';
import { markAllLogCommentsAsRead } from '@/lib/firebase/index';

interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  childId: string | null;
}

export function CommentsModal({
  isOpen,
  onClose,
  user,
  childId,
}: CommentsModalProps) {
  const [viewMode, setViewMode] = useState<"unread" | "all">("unread");
  const [searchQuery, setSearchQuery] = useState("");
  const [comments, setComments] = useState<FirebaseMessage[]>([]);
  const [unreadComments, setUnreadComments] = useState<FirebaseMessage[]>([]);
  const { state, navigateToLogDetail } = useNavigation();

  // Fetch all log comments for this child
  useEffect(() => {
    if (!isOpen || !childId) return;

    // Listen to all messages in the child's conversation
    const conversationId = `child_${childId}`;
    const q = query(
      collection(db, "messages"),
      where("conversationId", "==", conversationId),
      orderBy("timestamp", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages: FirebaseMessage[] = [];
      const unreadMessages: FirebaseMessage[] = [];

      snapshot.forEach((doc) => {
        const message = { id: doc.id, ...doc.data() } as FirebaseMessage;

        // Only include messages that have a logId (are log comments)
        if (message.logId) {
          allMessages.push(message);

          // Check if message is unread for current user
          const isRead =
            message.readBy &&
            typeof message.readBy === "object" &&
            message.readBy[user?.id] === true;
          if (!isRead) {
            unreadMessages.push(message);
          }
        }
      });

      setComments(allMessages);
      setUnreadComments(unreadMessages);
    });

    return () => unsubscribe();
  }, [isOpen, childId, user?.id]);

  // Filter comments based on search query
  const filteredComments =
    viewMode === "all"
      ? comments.filter((comment) =>
          comment.text?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : unreadComments;

  const handleMarkAllAsRead = async () => {
    if (!user?.id || !childId) return;

    try {
      // Use the Cloud Function to mark all log comments as read
      await markAllLogCommentsAsRead(user.id, childId);
      console.log("All log comments marked as read");
      // The unreadComments will be updated automatically by the listener
    } catch (error) {
      console.error("Error marking all comments as read:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop - subtle overlay for click handling */}
      <div
        className="absolute inset-0 z-40"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.15)" }}
        onClick={onClose}
      ></div>

      {/* Modal Container */}
      <div className="absolute inset-0 z-50 flex items-end justify-center px-4 pt-16">
        <div
          className={`w-full max-w-[600px] h-[85vh] font-['Poppins'] rounded-t-3xl transition-transform duration-300 ease-out shadow-2xl relative flex flex-col ${
            user?.darkMode ? "bg-[#15111B]" : "bg-white"
          }`}
        >
          {/* Header */}
          <div className="px-4 sm:px-6 pt-6 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2
                className="font-domine text-xl sm:text-2xl font-medium"
                style={{ color: "#745288" }}
              >
                {viewMode === "unread" ? "Unread comments" : "All comments"}
              </h2>

              <div className="flex items-center gap-3 justify-between sm:justify-end">
                {/* Toggle Button */}
                <button
                  onClick={() =>
                    setViewMode(viewMode === "unread" ? "all" : "unread")
                  }
                  className={`px-3 py-2 rounded-full border transition-colors text-sm ${
                    user?.darkMode
                      ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                      : "border-gray-300 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {viewMode === "unread" ? "All" : "Unread"}
                </button>

                {/* Exit Button */}
                <button
                  onClick={onClose}
                  className={`p-2 rounded-full transition-colors ${
                    user?.darkMode
                      ? "text-gray-400 hover:text-gray-300 hover:bg-gray-800"
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Mark all as read button for unread view */}
            {viewMode === "unread" && unreadComments.length > 0 && (
              <button
                onClick={() => void handleMarkAllAsRead()}
                className="mt-4 px-6 py-2 rounded-full transition-colors"
                style={{
                  backgroundColor: "#F0DDEF",
                  color: "#745288",
                  fontSize: "14px",
                  fontWeight: "500",
                }}
              >
                Mark all as read
              </button>
            )}

            {/* Search bar for all view */}
            {viewMode === "all" && (
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search comments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                    user?.darkMode
                      ? "bg-[#3a3a3a] border-gray-600 text-white placeholder-gray-400"
                      : "bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-500"
                  }`}
                />
              </div>
            )}
          </div>

          {/* Comments List */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-[92px]">
            {filteredComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MessageSquare
                  className={`w-12 h-12 mb-4 ${
                    user?.darkMode ? "text-gray-600" : "text-gray-400"
                  }`}
                />
                <p
                  className={`text-center ${
                    user?.darkMode ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {viewMode === "unread"
                    ? "No unread comments"
                    : searchQuery
                      ? "No comments match your search"
                      : "No comments yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                {filteredComments.map((comment) => {
                  // Find the log type from the logs in state
                  const log = state.logs.find((l) => l.id === comment.logId);
                  const logType = log?.sleepType || "sleep";
                  const logTypeDisplay =
                    logType.charAt(0).toUpperCase() + logType.slice(1);

                  // Format timestamp
                  const messageDate = comment.timestamp.toDate();
                  const timeStr = messageDate.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  });
                  const dateStr = messageDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year:
                      messageDate.getFullYear() !== new Date().getFullYear()
                        ? "numeric"
                        : undefined,
                  });

                  return (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        user?.darkMode
                          ? "bg-gray-800 hover:bg-gray-700"
                          : "bg-gray-100 hover:bg-gray-200"
                      }`}
                      onClick={() => {
                        if (comment.logId) {
                          onClose();
                          navigateToLogDetail(comment.logId);
                        }
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-0 mb-2">
                        <p
                          className="text-sm sm:text-base"
                          style={{ color: "#745288", fontWeight: "500" }}
                        >
                          {comment.senderName} commented on {logTypeDisplay}
                        </p>
                        <div className="flex gap-2 sm:text-right sm:flex-col">
                          <p
                            className={`text-sm ${
                              user?.darkMode ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            {timeStr}
                          </p>
                          <p
                            className={`text-xs ${
                              user?.darkMode ? "text-gray-500" : "text-gray-500"
                            }`}
                          >
                            {dateStr}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`${
                          user?.darkMode ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
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