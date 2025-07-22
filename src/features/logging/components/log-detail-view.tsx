import { useState, useEffect, useRef } from 'react';
import { useBubbleAuth } from '@/hooks/useBubbleAuth';
import { useNavigation } from '@/contexts/NavigationContext';
import { useTopSpacing } from '@/hooks/useTopSpacing';
import { Plus, Minus, X } from 'lucide-react';
import { SleepEvent, SleepLog } from '@/lib/firebase/types';
import {
  getLog,
  getOrCreateConversation,
  listenToLogComments,
  markLogCommentsAsRead,
} from '@/lib/firebase/index';
import { FirebaseMessage } from '@/lib/firebase/types';
import { calculateSleepStatistics } from '@/utils/sleepStatistics';
import { UniversalSkeleton } from '@/components/shared/UniversalSkeleton';
import { SleepLogTile } from './sleep-log-tile';
import { MessageInputBar } from '@/components/shared/MessageInputBar';
import {
  ImageMessage,
  AudioMessage,
} from '@/features/shared';

export function LogDetailView() {
  const { user } = useBubbleAuth();
  const { topSpacingClass } = useTopSpacing();
  const {
    state,
    navigateToEditLog,
    navigateToLogDetailAndShowModalFromDetail,
    navigateBack,
    updateLog,
  } = useNavigation();
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [comments, setComments] = useState<FirebaseMessage[]>([]);
  const [newComment, setNewComment] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const logEventsRef = useRef<HTMLDivElement>(null);

  // Section collapse states - Headlines collapsed by default, Log and Comments expanded
  const [headlinesExpanded, setHeadlinesExpanded] = useState(false);
  const [logExpanded, setLogExpanded] = useState(true);
  const [commentsExpanded, setCommentsExpanded] = useState(true);

  // Get current log from cache or fetch it
  useEffect(() => {
    if (!state.logId) return;

    // First check cache
    const cachedLog = state.logCache.get(state.logId);
    if (cachedLog) {
      setLog(cachedLog);
      return;
    }

    // If not in cache, fetch it
    setIsLoading(true);
    getLog(state.logId)
      .then((logData) => {
        if (logData) {
          setLog(logData);
          updateLog(logData); // Add to cache
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error loading log:", error);
        setIsLoading(false);
      });
  }, [state.logId, state.logCache, updateLog]);

  // Get conversation ID for this child - but only after user is authenticated
  useEffect(() => {
    if (!state.childId) {
      console.log("❌ No childId available for conversation setup");
      return;
    }

    if (!user) {
      console.log(
        "⏳ Waiting for user authentication before setting up conversation...",
      );
      return;
    }

    console.log("🔍 Setting up conversation for childId:", state.childId);
    console.log("🔍 Current user info:", {
      userId: user.id,
      userName: user.name,
      isAuthenticated: true,
    });

    getOrCreateConversation(state.childId, undefined, user.id, user.name)
      .then((convId) => {
        console.log("✅ Conversation ID obtained:", convId);
        setConversationId(convId);
      })
      .catch((error) => {
        console.error("❌ Error getting conversation:", error);
        console.error("❌ Error details:", {
          code: error.code,
          message: error.message,
          childId: state.childId,
          user: { id: user.id, name: user.name },
        });
      });
  }, [state.childId, user]); // Added user as dependency

  // Listen to comments for this log
  useEffect(() => {
    if (!state.logId) return;

    const unsubscribe = listenToLogComments(state.logId, (newComments) => {
      setComments(newComments);
    });

    return unsubscribe;
  }, [state.logId]);

  // Mark log comments as read when viewing this log
  useEffect(() => {
    if (!state.logId || !user || !state.childId) return;

    // Store values to avoid TypeScript null check issues
    const logId = state.logId;
    const childId = state.childId;
    const userId = user.id;

    // Mark as read after a small delay to ensure user is actually viewing
    const timer = setTimeout(() => {
      markLogCommentsAsRead(userId, childId, logId)
        .then(() => {
          console.log("Log comments marked as read");
        })
        .catch((error) => {
          console.error("Error marking log comments as read:", error);
        });
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [state.logId, user, state.childId]);

  // Auto-scroll to bottom when comments change
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // Scroll to log events to show recent timestamps behind modal
  useEffect(() => {
    // Check if we're in the log detail view and expand log section by default
    if (log && log.events && log.events.length > 0) {
      setLogExpanded(true);

      // Scroll to show the most recent events after a short delay
      const timer = setTimeout(() => {
        if (logEventsRef.current) {
          const lastEvent = logEventsRef.current.lastElementChild;
          if (lastEvent) {
            lastEvent.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [log, state.view]); // Run when log data changes or view changes

  // Format time in the baby's timezone
  const formatTimeInTimezone = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: state.timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Get event type text
  const getEventTypeText = (type: SleepEvent["type"]): string => {
    switch (type) {
      case "put_in_bed":
        return "Put in bed";
      case "fell_asleep":
        return "Asleep";
      case "woke_up":
        return "Awake";
      case "out_of_bed":
        return "Out of bed";
    }
  };

  // Temporary delete function for testing
  const handleDeleteLog = async () => {
    if (!log || !state.logId) return;

    const confirmDelete = confirm(
      "Are you sure you want to delete this log? This action cannot be undone.",
    );
    if (!confirmDelete) return;

    try {
      // Simple Firebase delete
      const { deleteDoc, doc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/core");

      await deleteDoc(doc(db, "logs", state.logId));

      // Navigate back to logs list
      navigateBack();
    } catch (error) {
      console.error("Error deleting log:", error);
      alert("Failed to delete log. Please try again.");
    }
  };

  // Image modal functions
  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  // Only show skeleton if we're loading AND have no log data
  if (isLoading && !log) {
    return <UniversalSkeleton />;
  }

  // If we don't have log data but aren't loading, show error state
  if (!log) {
    return (
      <div
        className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto flex items-center justify-center ${
          user?.darkMode ? "bg-[#15111B] text-white" : "bg-white text-gray-800"
        }`}
      >
        <div className="text-center">
          <p>Log not found</p>
          <button
            onClick={() => {
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.set("view", "logs");
              newUrl.searchParams.delete("logId");
              window.location.href = newUrl.toString();
            }}
            className="btn btn-primary mt-4"
          >
            Back to Logs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
        user?.darkMode ? "bg-[#15111B]" : "bg-white"
      }`}
    >
      {/* Dynamic top spacing based on Show_CTA URL parameter */}
      <div className={topSpacingClass}></div>

      {/* Back Button and Delete Button */}
      <div className="px-4 py-2 flex items-center justify-between">
        <button
          onClick={navigateBack}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
            user?.darkMode
              ? "text-gray-300 hover:bg-gray-800"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Edit Button */}
          <button
            onClick={() => navigateToEditLog(state.logId!)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              user?.darkMode
                ? "text-purple-400 hover:bg-purple-900/20"
                : "text-purple-600 hover:bg-purple-50"
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            <span className="text-sm font-medium">Edit</span>
          </button>

          {/* Delete Button */}
          <button
            onClick={() => void handleDeleteLog()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            <span className="text-sm font-medium">Delete</span>
          </button>
        </div>
      </div>

      {/* Log Tile - Visual Continuity from List View */}
      <div className="px-4 py-4">
        <SleepLogTile
          log={log}
          user={user}
          napNumber={1} // Simplified for detail view - could be made dynamic
          onContinueLogging={() =>
            navigateToLogDetailAndShowModalFromDetail(state.logId!)
          }
          formatTimeInTimezone={formatTimeInTimezone}
          showClickable={false}
        />
      </div>

      {/* Content Container with Collapsible Sections */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Headlines Section */}
        <div>
          <button
            onClick={() => setHeadlinesExpanded(!headlinesExpanded)}
            className={`w-full px-4 py-2 flex items-center justify-between text-left ${
              user?.darkMode ? "hover:bg-gray-800" : "hover:bg-gray-50"
            }`}
          >
            <h2
              className={`font-domine text-2xl ${
                user?.darkMode ? "text-white" : "text-gray-800"
              }`}
            >
              Headlines
            </h2>
            <div
              className="w-6 h-6"
              style={{
                color: user?.darkMode ? "#c084fc" : "#745288",
              }}
            >
              {headlinesExpanded ? (
                <Minus className="w-6 h-6" />
              ) : (
                <Plus className="w-6 h-6" />
              )}
            </div>
          </button>

          {headlinesExpanded && log && (
            <div className="px-4 pb-4">
              <div
                className="border-l-4 pl-2 space-y-3"
                style={{ borderColor: "#F0DDEF" }}
              >
                {(() => {
                  const stats = calculateSleepStatistics(log);
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-base ${
                            user?.darkMode ? "text-white" : "text-gray-800"
                          }`}
                        >
                          {stats.timeRange}, {stats.totalDuration}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-base ${
                            user?.darkMode ? "text-white" : "text-gray-800"
                          }`}
                        >
                          {stats.totalTimeAsleep} asleep
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-base ${
                            user?.darkMode ? "text-white" : "text-gray-800"
                          }`}
                        >
                          {stats.totalTimeAwakeInBed} awake in bed
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-base ${
                            user?.darkMode ? "text-white" : "text-gray-800"
                          }`}
                        >
                          {stats.numberOfWakeUps} wake-ups
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-base ${
                            user?.darkMode ? "text-white" : "text-gray-800"
                          }`}
                        >
                          {stats.averageWakeUpDuration} avg wake-up
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Log Section */}
        <div>
          <button
            onClick={() => setLogExpanded(!logExpanded)}
            className={`w-full px-4 py-2 flex items-center justify-between text-left ${
              user?.darkMode ? "hover:bg-gray-800" : "hover:bg-gray-50"
            }`}
          >
            <h2
              className={`font-domine text-2xl ${
                user?.darkMode ? "text-white" : "text-gray-800"
              }`}
            >
              Log
            </h2>
            <div
              className="w-6 h-6"
              style={{
                color: user?.darkMode ? "#c084fc" : "#745288",
              }}
            >
              {logExpanded ? (
                <Minus className="w-6 h-6" />
              ) : (
                <Plus className="w-6 h-6" />
              )}
            </div>
          </button>

          {logExpanded && log.events && log.events.length > 0 && (
            <div className="px-4 pb-4">
              <div
                ref={logEventsRef}
                className="border-l-4 pl-2 space-y-3"
                style={{ borderColor: "#F0DDEF" }}
              >
                {log.events
                  .sort(
                    (a, b) =>
                      a.childLocalTimestamp.toDate().getTime() -
                      b.childLocalTimestamp.toDate().getTime(),
                  )
                  .map((event, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center"
                    >
                      <span
                        className={`text-base ${
                          user?.darkMode ? "text-white" : "text-gray-800"
                        }`}
                      >
                        {getEventTypeText(event.type)}
                      </span>
                      <span
                        className={`text-base ${
                          user?.darkMode ? "text-gray-300" : "text-gray-600"
                        }`}
                      >
                        {event.localTime}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Comments Section */}
        <div className="flex-1 flex flex-col min-h-0 pb-20">
          <button
            onClick={() => setCommentsExpanded(!commentsExpanded)}
            className={`w-full px-4 py-2 flex items-center justify-between text-left ${
              user?.darkMode ? "hover:bg-gray-800" : "hover:bg-gray-50"
            }`}
          >
            <h2
              className={`font-domine text-2xl ${
                user?.darkMode ? "text-white" : "text-gray-800"
              }`}
            >
              Comments
            </h2>
            <div
              className="w-6 h-6"
              style={{
                color: user?.darkMode ? "#c084fc" : "#745288",
              }}
            >
              {commentsExpanded ? (
                <Minus className="w-6 h-6" />
              ) : (
                <Plus className="w-6 h-6" />
              )}
            </div>
          </button>

          {commentsExpanded && (
            <div className="flex-1 overflow-y-auto px-4 pb-[116px]">
              {comments.length === 0 ? (
                <div
                  className="border-l-4 pl-2 space-y-3"
                  style={{ borderColor: "#F0DDEF" }}
                >
                  <div className="flex justify-between items-center">
                    <span
                      className={`text-base italic ${
                        user?.darkMode ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      No comments yet
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="border-l-4 pl-2 space-y-4"
                  style={{ borderColor: "#F0DDEF" }}
                >
                  {comments.map((comment) => {
                    const isOwn = user?.id === comment.senderId;
                    return (
                      <div
                        key={comment.id}
                        className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
                      >
                        <div className="max-w-[75%] flex flex-col">
                          {/* Sender name and timestamp */}
                          <div className="text-xs mb-1 flex justify-between items-center">
                            <span
                              className={
                                user?.darkMode
                                  ? "text-gray-400"
                                  : "text-gray-600"
                              }
                            >
                              {comment.senderName}
                            </span>
                            <span
                              className={
                                user?.darkMode
                                  ? "text-gray-300"
                                  : "text-gray-600"
                              }
                            >
                              {formatTimeInTimezone(comment.timestamp)}
                            </span>
                          </div>

                          {/* Comment bubble */}
                          <div
                            className={`min-w-[120px] rounded-2xl ${
                              isOwn
                                ? `${user?.darkMode ? "text-white" : "text-gray-800"} rounded-br-md`
                                : `${user?.darkMode ? "bg-[#3a3a3a] text-gray-200" : "bg-gray-200 text-gray-800"} rounded-bl-md`
                            } ${comment.type === "image" ? "p-2" : "px-4 py-3"}`}
                            style={{
                              backgroundColor: isOwn
                                ? user?.darkMode
                                  ? "#2d2637"
                                  : "#F0DDEF"
                                : undefined,
                            }}
                          >
                            {comment.type === "image" && comment.imageId ? (
                              <ImageMessage
                                imageUrl={comment.imageId}
                                onImageClick={handleImageClick}
                              />
                            ) : comment.type === "audio" && comment.audioId ? (
                              <AudioMessage audioUrl={comment.audioId} />
                            ) : (
                              <p className="text-sm leading-relaxed">
                                {comment.text}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Comment Input - Shared component with all advanced features */}
      {user && (
        <MessageInputBar
          user={user}
          conversationId={conversationId!}
          childId={state.childId!}
          newMessage={newComment}
          setNewMessage={setNewComment}
          placeholder="Add a comment..."
          logId={state.logId || undefined}
        />
      )}

      {/* Minimal bottom spacing for iframe */}
      <div
        className={`h-[20px] ${user?.darkMode ? "bg-[#15111B]" : "bg-white"}`}
      ></div>

      {/* Image modal */}
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