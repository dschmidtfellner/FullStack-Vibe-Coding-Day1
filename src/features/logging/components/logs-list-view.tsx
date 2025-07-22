import { useState, useEffect } from 'react';
import { useBubbleAuth } from '@/hooks/useBubbleAuth';
import { useNavigation } from '@/contexts/NavigationContext';
import { useTopSpacing } from '@/hooks/useTopSpacing';
import { Plus, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import {
  SleepEvent,
  listenToLogs,
  fromChildLocalTime,
  getChildNow,
  getChildStartOfDay,
} from '@/lib/firebase-messaging';
import { getAppLogo } from '@/utils/logoUtils';
import { useUnreadCounters } from '@/hooks/useUnreadCounters';
import { UniversalSkeleton } from '@/components/shared/UniversalSkeleton';
import { SleepLogTile } from './sleep-log-tile';
import { CommentsModal } from '@/features/logging/components/comments-modal';

export function LogsListView() {
  const { user } = useBubbleAuth();
  const { topSpacingClass } = useTopSpacing();
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
      {/* Dynamic top spacing based on Show_CTA URL parameter */}
      <div className={topSpacingClass}></div>

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