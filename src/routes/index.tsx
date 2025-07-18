import { useBubbleAuth, useChildAccess } from "@/hooks/useBubbleAuth";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Search,
} from "lucide-react";
import { getAppLogo } from "@/utils/logoUtils";
import {
  NavigationProvider,
  useNavigation,
} from "@/contexts/NavigationContext";
import { SleepLogModal } from "@/features/sleep-logging/components/SleepLogModal";
import { EditLogModal } from "@/features/sleep-logging/components/EditLogModal";
import { LogDetailView } from "@/features/sleep-logging/components/LogDetailView";
import { UniversalSkeleton } from "@/components/shared/UniversalSkeleton";
import { SleepLogTile } from "@/components/SleepLogTile";
import { MessagingView } from "@/features/messaging/components/messaging-view";
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { FirebaseMessage } from "@/types/firebase";
import { db } from "@/lib/firebase";
import {
  // Log-related imports
  SleepEvent,
  listenToLogs,
  // Unread counter imports
  markAllLogCommentsAsRead,
  // Child Local Time utilities
  fromChildLocalTime,
  getChildNow,
  getChildStartOfDay,
} from "@/lib/firebase-messaging";
import { useUnreadCounters } from "@/hooks/useUnreadCounters";

// Navigation Context for client-side routing

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { user, isLoading, error } = useBubbleAuth();

  // Show loading animation while authenticating or if there's an auth error
  if (isLoading || error || !user) {
    return <UniversalSkeleton />;
  }

  // Parse URL parameters for NavigationProvider
  const urlParams = new URLSearchParams(window.location.search);
  const childId = urlParams.get("childId");
  const timezone = urlParams.get("timezone") || "America/New_York";

  // Only show loading if we don't have required data
  if (!childId) {
    return <UniversalSkeleton />;
  }

  return (
    <div className="not-prose">
      <NavigationProvider initialChildId={childId} initialTimezone={timezone}>
        <AppRouter />
      </NavigationProvider>
    </div>
  );
}

// Main app router that switches views based on navigation state
function AppRouter() {
  const { state } = useNavigation();

  // Check if user has access to the current child
  const hasChildAccess = useChildAccess(state.childId);

  if (!hasChildAccess) {
    return <UniversalSkeleton />;
  }

  // Route to appropriate view based on navigation state
  const renderMainView = () => {
    switch (state.view) {
      case "messaging":
        return <MessagingView />;
      case "LogList":
        return <LogsListView />;
      case "log-detail":
        return <LogDetailView />;
      case "LoggingModal":
        // When modal is open, we need to determine what to show behind it
        if (state.logId) {
          // If editing an existing log, show the log detail view
          return <LogDetailView />;
        } else {
          // If creating a new log, show the logs list
          return <LogsListView />;
        }
      case "edit-log":
        return null; // Don't render background view when EditLogModal is open
      default:
        return <LogsListView />;
    }
  };

  return (
    <>
      {renderMainView()}
      {state.view === "LoggingModal" && <SleepLogModal />}
      {state.view === "edit-log" && <EditLogModal />}
    </>
  );
}

// Log List View Component - now uses navigation context
function LogsListView() {
  const { user } = useBubbleAuth();
  const {
    state,
    navigateToLogDetail,
    navigateToNewLog,
    navigateToLogDetailAndShowModal,
    setLogs,
  } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [viewMode, setViewMode] = useState<"events" | "windows">("events");

  // Selected date state - default to today in baby's timezone
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: state.timezone,
    }).format(today); // YYYY-MM-DD format
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  // Get unread counters
  const { counters } = useUnreadCounters(user?.id || null, state.childId);

  // Helper function to close comments modal
  const closeCommentsModal = () => {
    setShowCommentsModal(false);
  };

  // Expose function to open comments modal from outside (e.g., Bubble app)
  useEffect(() => {
    (window as any).openCommentsModal = () => {
      setShowCommentsModal(true);
    };

    return () => {
      delete (window as any).openCommentsModal;
    };
  }, [state.childId]);

  // Listen to logs with real-time updates
  useEffect(() => {
    if (!state.childId) return;

    // Only show loading if we haven't loaded data before AND no cached data
    if (!hasLoadedOnce && state.logs.length === 0) {
      setIsLoading(true);
    }

    const unsubscribe = listenToLogs(state.childId, (newLogs) => {
      setLogs(newLogs); // Update navigation state
      setIsLoading(false);
      setHasLoadedOnce(true);
    });

    return unsubscribe;
  }, [state.childId, hasLoadedOnce, state.logs.length, setLogs]);

  // Format time (for Child Local Time, just format as UTC since it's already in child's wall clock time)
  const formatTimeInTimezone = (timestamp: any) => {
    if (!timestamp) return "";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    // For childLocalTimestamp, format as UTC since it already represents child's wall clock time
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Format date in the baby's timezone (commented out as unused)
  // const formatDateInTimezone = (timestamp: any) => {
  //   if (!timestamp) return '';
  //
  //   const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  //   return new Intl.DateTimeFormat('en-US', {
  //     timeZone: state.timezone,
  //     month: 'short',
  //     day: 'numeric',
  //     weekday: 'short'
  //   }).format(date);
  // };

  // Date navigation functions
  const goToPreviousDay = () => {
    const currentDate = new Date(selectedDate + "T12:00:00"); // Add time to avoid timezone issues
    currentDate.setDate(currentDate.getDate() - 1);
    setSelectedDate(new Intl.DateTimeFormat("en-CA").format(currentDate));
  };

  const goToNextDay = () => {
    const currentDate = new Date(selectedDate + "T12:00:00"); // Add time to avoid timezone issues
    currentDate.setDate(currentDate.getDate() + 1);
    setSelectedDate(new Intl.DateTimeFormat("en-CA").format(currentDate));
  };

  // Format selected date for display
  const formatSelectedDate = () => {
    const date = new Date(selectedDate + "T12:00:00");
    return new Intl.DateTimeFormat("en-US", {
      timeZone: state.timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  // Check if selected date is today
  const isToday = () => {
    // Get today in child's timezone
    const childNow = getChildNow(state.timezone);
    const childTodayString = childNow.toISOString().split("T")[0];
    return selectedDate === childTodayString;
  };

  // Get relative date text for display under the date
  const getRelativeDateText = () => {
    // Get today in child's timezone
    const childNow = getChildNow(state.timezone);
    const childToday = getChildStartOfDay(childNow, state.timezone);
    const childTodayString = childToday.toISOString().split("T")[0];

    if (selectedDate === childTodayString) {
      return "Today";
    }

    // Compare selected date with child's today
    const selectedDateObj = new Date(selectedDate + "T00:00:00.000Z"); // Already in UTC from date picker
    const diffTime = selectedDateObj.getTime() - childToday.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === -1) {
      return "Yesterday";
    } else if (diffDays < -1) {
      return `${Math.abs(diffDays)} days ago`;
    } else if (diffDays === 1) {
      return "1 day from now";
    } else if (diffDays > 1) {
      return `${diffDays} days from now`;
    }

    return null;
  };

  // Filter logs for selected date and get previous day's bedtime
  const getLogsForSelectedDate = () => {
    const selectedDateLogs = state.logs.filter((log) => {
      const logDateKey = log.localDate || "";
      return logDateKey === selectedDate;
    });

    // Get previous day's bedtime (if any)
    const previousDate = new Date(selectedDate + "T12:00:00");
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateKey = new Intl.DateTimeFormat("en-CA").format(
      previousDate,
    );

    const previousDayBedtime = state.logs.find((log) => {
      const logDateKey = log.localDate || "";
      return logDateKey === previousDateKey && log.sleepType === "bedtime";
    });

    return { selectedDateLogs, previousDayBedtime };
  };

  const { selectedDateLogs, previousDayBedtime } = getLogsForSelectedDate();

  // Process all events for Windows view
  const getWindowsViewData = () => {
    // Collect events from logs that started on selected day + previous day bedtime's out of bed
    const allEvents: Array<{
      event: SleepEvent;
      logId: string;
      logType: "bedtime" | "nap";
      timestamp: Date;
    }> = [];

    // Add ONLY the "out of bed" event from previous day bedtime if exists
    if (previousDayBedtime && previousDayBedtime.events) {
      const outOfBedEvent = previousDayBedtime.events.find(
        (event) => event.type === "out_of_bed",
      );
      if (outOfBedEvent) {
        allEvents.push({
          event: outOfBedEvent,
          logId: previousDayBedtime.id,
          logType: previousDayBedtime.sleepType || "nap",
          timestamp: outOfBedEvent.childLocalTimestamp.toDate(),
        });
      }
    }

    // Add ALL events from current day logs (logs that started on selected day)
    selectedDateLogs.forEach((log) => {
      if (log.events) {
        log.events.forEach((event) => {
          allEvents.push({
            event,
            logId: log.id,
            logType: log.sleepType || "nap",
            timestamp: fromChildLocalTime(event.childLocalTimestamp),
          });
        });
      }
    });

    // Sort chronologically
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate durations between events
    const windowsData = allEvents.map((item, index) => {
      let duration = 0;
      if (index < allEvents.length - 1) {
        const nextTimestamp = allEvents[index + 1].timestamp;
        duration = nextTimestamp.getTime() - item.timestamp.getTime();
      }

      return {
        ...item,
        duration,
        durationString: formatDuration(duration),
      };
    });

    return windowsData;
  };

  // Format duration in "Xh Ym" format
  const formatDuration = (milliseconds: number) => {
    const totalMinutes = Math.floor(milliseconds / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Only show skeleton if we're loading AND have no data to show
  if (isLoading && state.logs.length === 0) {
    return <UniversalSkeleton />;
  }

  return (
    <div
      className={`relative h-[100vh] font-['Poppins'] max-w-[800px] mx-auto ${
        user?.darkMode ? "bg-[#15111B]" : "bg-white"
      }`}
    >
      {/* Top spacing - minimal for iframe embedding */}
      <div className="h-[20px]"></div>

      {/* Date Navigation Header */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between">
          {/* Left: Date Navigation Controls */}
          <div className="flex items-center">
            {/* Previous Day Button */}
            <button
              onClick={goToPreviousDay}
              className={`p-2 rounded-full transition-colors ${
                user?.darkMode
                  ? "hover:bg-gray-800 text-gray-400 hover:text-gray-200"
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-800"
              }`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Date Display - Clickable */}
            <div className="flex flex-col items-start mx-3">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`font-domine text-2xl font-medium transition-colors ${
                  user?.darkMode
                    ? "text-white hover:text-gray-200"
                    : "text-gray-800 hover:text-gray-600"
                }`}
              >
                {isToday() ? "Today" : formatSelectedDate()}
              </button>
              {/* Relative date text */}
              {getRelativeDateText() && getRelativeDateText() !== "Today" && (
                <div
                  className={`text-sm mt-1 ${
                    user?.darkMode ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {getRelativeDateText()}
                </div>
              )}
            </div>

            {/* Next Day Button */}
            <button
              onClick={goToNextDay}
              className={`p-2 rounded-full transition-colors ${
                user?.darkMode
                  ? "hover:bg-gray-800 text-gray-400 hover:text-gray-200"
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-800"
              }`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            {/* Windows/Events Toggle */}
            <button
              onClick={() =>
                setViewMode(viewMode === "events" ? "windows" : "events")
              }
              className={`px-4 py-2 rounded-full border transition-colors ${
                user?.darkMode
                  ? "border-gray-600 text-gray-300 hover:bg-gray-800"
                  : "border-gray-300 text-gray-700 hover:bg-gray-100"
              }`}
              style={{
                fontSize: "14px",
                fontWeight: "400",
              }}
            >
              {viewMode === "events" ? "Windows" : "Events"}
            </button>

            {/* Comments Icon */}
            <button
              onClick={() => {
                setShowCommentsModal(true);
              }}
              className={`p-2 rounded-full transition-colors relative ${
                user?.darkMode
                  ? "hover:bg-gray-800 text-gray-400 hover:text-gray-200"
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-800"
              }`}
            >
              <MessageSquare className="w-6 h-6" />
              {counters.logUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium">
                  {counters.logUnreadCount > 99
                    ? "99+"
                    : counters.logUnreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Date Picker */}
        {showDatePicker && (
          <div className="mt-4 flex justify-start">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setShowDatePicker(false);
              }}
              className={`input input-bordered ${
                user?.darkMode
                  ? "bg-[#3a3a3a] border-gray-600 text-white"
                  : "bg-white border-gray-300 text-gray-800"
              }`}
            />
          </div>
        )}
      </div>

      {/* Logs Container */}
      <div className="relative overflow-y-auto pb-[124px] h-[calc(100%-120px)]">
        {selectedDateLogs.length === 0 && !previousDayBedtime ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="mb-8">
              <img
                src={getAppLogo().src}
                alt={getAppLogo().alt}
                className="w-32 h-32 opacity-30"
              />
            </div>
            <h3 className="text-lg text-[#745288] opacity-50 mb-2">
              No logs for this day
            </h3>
            <p
              className={`text-center mb-6 ${
                user?.darkMode ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Tap the plus button to start tracking
            </p>
          </div>
        ) : viewMode === "events" ? (
          // Events view (original tile view)
          <div className="space-y-3 px-4">
            {/* Previous Day's Bedtime (if exists) */}
            {previousDayBedtime && (
              <div style={{ opacity: 0.5 }}>
                <SleepLogTile
                  key={`prev-${previousDayBedtime.id}`}
                  log={previousDayBedtime}
                  user={user}
                  napNumber={0}
                  onClick={() => navigateToLogDetail(previousDayBedtime.id)}
                  onContinueLogging={() =>
                    navigateToLogDetailAndShowModal(previousDayBedtime.id)
                  }
                  formatTimeInTimezone={formatTimeInTimezone}
                  showClickable={true}
                  isNightBefore={true}
                  nightBeforeEndTime={
                    previousDayBedtime.events &&
                    previousDayBedtime.events.length > 0
                      ? formatTimeInTimezone(
                          previousDayBedtime.events[
                            previousDayBedtime.events.length - 1
                          ].childLocalTimestamp,
                        )
                      : ""
                  }
                  unreadCount={
                    counters.logUnreadByLogId[previousDayBedtime.id] || 0
                  }
                />
              </div>
            )}

            {/* Current Day's Logs */}
            {(() => {
              const sortedLogs = selectedDateLogs.sort(
                (a, b) => a.sortTimestamp - b.sortTimestamp,
              );
              return sortedLogs.map((log, index) => {
                // Count naps for numbering
                const napNumber = sortedLogs
                  .slice(0, index + 1)
                  .filter((l) => l.sleepType === "nap").length;

                return (
                  <SleepLogTile
                    key={log.id}
                    log={log}
                    user={user}
                    napNumber={napNumber}
                    onClick={() => navigateToLogDetail(log.id)}
                    onContinueLogging={() =>
                      navigateToLogDetailAndShowModal(log.id)
                    }
                    formatTimeInTimezone={formatTimeInTimezone}
                    showClickable={true}
                    unreadCount={counters.logUnreadByLogId[log.id] || 0}
                  />
                );
              });
            })()}
          </div>
        ) : (
          // Windows view
          <div className="px-4">
            {(() => {
              const windowsData = getWindowsViewData();

              return windowsData.map((window, index) => {
                const { event, logId, durationString } = window;

                // Don't show duration for the last event
                if (index === windowsData.length - 1) return null;

                // Determine tile type and styling
                let tileColor = "";
                let textColor = "";
                let tileText = "";
                let showSeparator = false;

                if (event.type === "out_of_bed") {
                  tileColor = user?.darkMode ? "bg-gray-700" : "bg-gray-200";
                  textColor = user?.darkMode ? "text-white" : "text-gray-800";
                  tileText = `${durationString} out of bed`;
                  showSeparator = true;
                } else if (event.type === "fell_asleep") {
                  tileColor = "bg-[#745288]";
                  textColor = "text-white";
                  tileText = `${durationString} asleep`;
                } else if (
                  event.type === "put_in_bed" ||
                  event.type === "woke_up"
                ) {
                  tileColor = "bg-[#F0DDEF]";
                  textColor = user?.darkMode
                    ? "text-gray-800"
                    : "text-gray-800";
                  tileText = `${durationString} awake in bed`;
                }

                return (
                  <div key={`${logId}-${index}`}>
                    {/* Gray separator before out of bed tiles */}
                    {showSeparator && (
                      <div
                        className={`h-px my-2 ${
                          user?.darkMode ? "bg-gray-600" : "bg-gray-300"
                        }`}
                      />
                    )}

                    {/* Tile */}
                    <div className="flex items-start mb-2">
                      {/* Time label - top aligned */}
                      <div
                        className="text-sm mr-4"
                        style={{ minWidth: "70px", color: "#745288" }}
                      >
                        {event.localTime}
                      </div>

                      {/* Duration tile */}
                      <div
                        onClick={() => navigateToLogDetail(logId)}
                        className={`flex-1 px-4 py-3 rounded-2xl cursor-pointer transition-opacity hover:opacity-90 ${tileColor} ${textColor}`}
                      >
                        <span className="text-base">{tileText}</span>
                      </div>
                    </div>

                    {/* Gray separator after out of bed tiles */}
                    {showSeparator && index < windowsData.length - 2 && (
                      <div
                        className={`h-px my-2 ${
                          user?.darkMode ? "bg-gray-600" : "bg-gray-300"
                        }`}
                      />
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Floating Action Button - Centered and positioned within scrollable area */}
        <div className="fixed bottom-[120px] left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={() => navigateToNewLog(selectedDate)}
            className={`flex items-center justify-center rounded-full shadow-lg border-none ${
              user?.darkMode
                ? "text-white hover:opacity-90"
                : "text-white hover:opacity-90"
            }`}
            style={{
              backgroundColor: user?.darkMode ? "#9B7EBD" : "#503460",
              width: "64px",
              height: "64px",
            }}
          >
            <Plus className="w-8 h-8" />
          </button>
        </div>
      </div>

      {/* Minimal bottom spacing for iframe */}
      <div
        className={`h-[20px] ${user?.darkMode ? "bg-[#15111B]" : "bg-white"}`}
      ></div>

      {/* Comments Modal */}
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={closeCommentsModal}
        user={user}
        childId={state.childId}
      />
    </div>
  );
}


function CommentsModal({
  isOpen,
  onClose,
  user,
  childId,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  childId: string | null;
}) {
  const [viewMode, setViewMode] = useState<"unread" | "all">("unread");
  const [searchQuery, setSearchQuery] = useState("");
  const [comments, setComments] = useState<FirebaseMessage[]>([]);
  const [unreadComments, setUnreadComments] = useState<FirebaseMessage[]>([]);
  // const [isLoading, setIsLoading] = useState(false); // Removed - not used in UI
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
