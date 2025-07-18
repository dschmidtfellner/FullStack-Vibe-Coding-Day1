import React, { useState, useEffect } from 'react';
import { useBubbleAuth } from '@/hooks/useBubbleAuth';
import { useNavigation } from '@/contexts/NavigationContext';
import { X, Sun, Moon } from 'lucide-react';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import { Timestamp } from 'firebase/firestore';
import {
  SleepEvent,
  SleepLog,
  createSleepLog,
  updateSleepLog,
  getLog,
  toChildLocalTime,
  fromChildLocalTime,
  getChildNow,
  getChildStartOfDay,
  getChildEndOfDay,
} from '@/lib/firebase-messaging';
import { UniversalSkeleton } from '@/components/shared/UniversalSkeleton';

export function SleepLogModal() {
  const { user } = useBubbleAuth();
  const { state, navigateBack, updateLog } = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const [sleepType, setSleepType] = useState<"nap" | "bedtime">("nap");
  const [events, setEvents] = useState<
    Array<{ type: SleepEvent["type"]; timestamp: Date }>
  >([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(() => {
    // Use default date from navigation state if available, otherwise today
    if (state.defaultLogDate) {
      return new Date(state.defaultLogDate + "T12:00:00");
    }
    return new Date();
  });
  const [isComplete, setIsComplete] = useState(false);
  const [existingLog, setExistingLog] = useState<SleepLog | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<
    SleepEvent["type"] | null
  >(null);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // Validation states
  const [validationWarning, setValidationWarning] = useState<{
    type: "future" | "long-gap" | "too-long-gap";
    message: string;
    subtext?: string;
  } | null>(null);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [lastButtonPressTime, setLastButtonPressTime] = useState(0);

  // Set default sleep type based on time (only on initial load)
  useEffect(() => {
    const hour = new Date().getHours();
    // If between 4:00am and 6:00pm, default to nap, otherwise bedtime
    if (hour >= 4 && hour < 18) {
      setSleepType("nap");
    } else {
      setSleepType("bedtime");
    }
  }, []); // Empty dependency array - only run once on mount

  // Reset selected event type when events change (to default to primary option)
  useEffect(() => {
    setSelectedEventType(null);
  }, [events.length]);

  // Track initial mount for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialMount(false);
    }, 350); // Slightly longer than animation duration

    // Also set initial loading to false after a short delay
    const loadingTimer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 100);

    return () => {
      clearTimeout(timer);
      clearTimeout(loadingTimer);
    };
  }, []);

  // Load existing log if editing
  useEffect(() => {
    if (state.logId) {
      // First check cache
      const cachedLog = state.logCache.get(state.logId);
      if (cachedLog) {
        setExistingLog(cachedLog);
        setSleepType(cachedLog.sleepType || "nap");
        setIsComplete(cachedLog.isComplete || false);
        if (cachedLog.events) {
          const eventsWithDates = cachedLog.events.map((event) => ({
            type: event.type,
            timestamp: fromChildLocalTime(event.childLocalTimestamp),
          }));
          setEvents(eventsWithDates);

          // Set currentTime to a reasonable time on the original log date (not today's date)
          const originalDate = eventsWithDates[0].timestamp;
          const timeOnOriginalDate = new Date(originalDate);
          timeOnOriginalDate.setHours(
            new Date().getHours(),
            new Date().getMinutes(),
          ); // Use current time of day but original date
          setCurrentTime(timeOnOriginalDate);
          setCurrentDate(new Date(originalDate));
        }
        return;
      }

      // If not in cache, fetch it
      setIsLoading(true);
      getLog(state.logId)
        .then((log) => {
          if (log) {
            setExistingLog(log);
            setSleepType(log.sleepType || "nap");
            setIsComplete(log.isComplete || false);
            if (log.events) {
              const eventsWithDates = log.events.map((event) => ({
                type: event.type,
                timestamp: fromChildLocalTime(event.childLocalTimestamp),
              }));
              setEvents(eventsWithDates);

              // Set currentTime to a reasonable time on the original log date (not today's date)
              const originalDate = eventsWithDates[0].timestamp;
              const timeOnOriginalDate = new Date(originalDate);
              timeOnOriginalDate.setHours(
                new Date().getHours(),
                new Date().getMinutes(),
              ); // Use current time of day but original date
              setCurrentTime(timeOnOriginalDate);
              setCurrentDate(new Date(originalDate));
            }
            updateLog(log); // Add to cache
          }
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error loading log:", error);
          setIsLoading(false);
        });
    }
  }, [state.logId, state.logCache, updateLog]);

  // Get question text for sleep consulting flow
  const getQuestionText = (): string => {
    if (events.length === 0) {
      return "When were they put in bed?";
    }

    const lastEvent = events[events.length - 1];
    switch (lastEvent.type) {
      case "put_in_bed":
        return "When did they fall asleep?";
      case "fell_asleep":
        return "When did they wake up?";
      case "woke_up":
        return "When did they fall asleep?";
      default:
        return "When did they fall asleep?";
    }
  };

  // Get next event type for sleep consulting flow
  const getNextEventType = (): SleepEvent["type"] => {
    return getCurrentEventType();
  };

  // Get human-readable text for event types
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

  // Get event type options based on last subevent
  const getEventTypeOptions = (): {
    primary: SleepEvent["type"];
    secondary: SleepEvent["type"];
  } => {
    if (events.length === 0) {
      return { primary: "put_in_bed", secondary: "fell_asleep" };
    }

    const lastEvent = events[events.length - 1];
    switch (lastEvent.type) {
      case "put_in_bed":
        return { primary: "fell_asleep", secondary: "out_of_bed" };
      case "fell_asleep":
        return { primary: "woke_up", secondary: "out_of_bed" };
      case "woke_up":
        return { primary: "fell_asleep", secondary: "out_of_bed" };
      default:
        return { primary: "fell_asleep", secondary: "out_of_bed" };
    }
  };

  // Get currently selected event type (use selectedEventType or default to primary option)
  const getCurrentEventType = (): SleepEvent["type"] => {
    if (selectedEventType) {
      return selectedEventType;
    }
    const options = getEventTypeOptions();
    return options.primary;
  };

  // Get relative date text for modal date input
  const getModalRelativeDateText = () => {
    // Get today in child's timezone
    const childNow = getChildNow(state.timezone);
    const childToday = getChildStartOfDay(childNow, state.timezone);

    // Get selected date in child's timezone
    const selectedDateChildLocal = getChildStartOfDay(
      currentDate,
      state.timezone,
    );

    // Calculate difference in days
    const diffTime = selectedDateChildLocal.getTime() - childToday.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === -1) {
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

  // Format time for time picker (24-hour HH:MM format for react-time-picker)
  // Shows user's local time - will be converted to Child Local Time when saving
  const formatTimeForPicker = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format time for display
  // Shows user's local time - will be converted to Child Local Time when saving
  const formatTimeForDisplay = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Create event timestamp with overnight detection
  const createEventTimestamp = (
    originalDate: Date,
    selectedTime: Date,
    lastEventTimestamp: Date,
  ): Date => {
    // Create a timestamp using the selected time but on the original date
    const eventTimestamp = new Date(originalDate);
    eventTimestamp.setHours(
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
      0,
    );

    // If the new timestamp is before the last event, assume it's the next day
    if (eventTimestamp < lastEventTimestamp) {
      eventTimestamp.setDate(eventTimestamp.getDate() + 1);
    }

    return eventTimestamp;
  };

  // Validate time input
  const validateTimeInput = (
    timestamp: Date,
    isFirstEvent: boolean = false,
  ): {
    isValid: boolean;
    warning: typeof validationWarning;
  } => {
    // Get "now" in child's timezone
    const childNow = getChildNow(state.timezone);

    // For first event, we need to use the combined date/time
    let timeToCheck = timestamp;
    if (isFirstEvent || events.length === 0) {
      // Create combined datetime for first event
      timeToCheck = new Date(currentDate);
      timeToCheck.setHours(timestamp.getHours(), timestamp.getMinutes(), 0, 0);
    }

    // Convert timeToCheck to Child Local Time for comparison
    const childLocalTimeToCheck = toChildLocalTime(timeToCheck, state.timezone);

    // Check if selected date is "today" in child's timezone
    const selectedDateInChildTz = toChildLocalTime(currentDate, state.timezone);
    const childTodayStart = getChildStartOfDay(childNow, state.timezone);
    const childTodayEnd = getChildEndOfDay(childNow, state.timezone);

    const isToday =
      selectedDateInChildTz >= childTodayStart &&
      selectedDateInChildTz <= childTodayEnd;

    if (isToday) {
      // Check if time is more than 5 minutes in the future
      const fiveMinutesFromChildNow = new Date(
        childNow.getTime() + 5 * 60 * 1000,
      );
      if (childLocalTimeToCheck > fiveMinutesFromChildNow) {
        return {
          isValid: true, // Allow with confirmation
          warning: {
            type: "future",
            message:
              "This time is in the future - are you sure you want to save it?",
          },
        };
      }
    }

    // If first event, no other validations needed
    if (isFirstEvent || events.length === 0) {
      return { isValid: true, warning: null };
    }

    // Get the last event timestamp and convert to Child Local Time
    const lastEventTimestamp = events[events.length - 1].timestamp;
    const lastEventChildLocal = toChildLocalTime(
      lastEventTimestamp,
      state.timezone,
    );

    // Calculate the prepped time (with overnight logic applied) in Child Local Time
    const firstEventChildLocal = toChildLocalTime(
      events[0].timestamp,
      state.timezone,
    );
    const preppedTimeChildLocal = createEventTimestamp(
      firstEventChildLocal,
      childLocalTimeToCheck,
      lastEventChildLocal,
    );

    // Calculate hours difference in Child Local Time
    const hoursDiff =
      (preppedTimeChildLocal.getTime() - lastEventChildLocal.getTime()) /
      (1000 * 60 * 60);

    // Valid: 0-12 hours after last event
    if (hoursDiff >= 0 && hoursDiff <= 12) {
      return { isValid: true, warning: null };
    }

    // Warning: 12-16 hours after last event
    if (hoursDiff > 12 && hoursDiff < 16) {
      return {
        isValid: true, // Allow with confirmation
        warning: {
          type: "long-gap",
          message: `That time is more than 12 hours after the last logged time - are you sure you want to save it?`,
          subtext: `Did you instead want to end this ${sleepType} and start another?`,
        },
      };
    }

    // Error: 16+ hours after last event
    if (hoursDiff >= 16) {
      return {
        isValid: false,
        warning: {
          type: "too-long-gap",
          message: `Unable to save a time before your last log in this ${sleepType} - to interject another time, use Edit`,
        },
      };
    }

    return { isValid: true, warning: null };
  };

  // Handle time picker change
  const handleTimeChange = (value: string | null) => {
    if (!value) return;

    // Parse 24-hour format (HH:MM)
    const [hours, minutes] = value.split(":").map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const newTime = new Date(currentTime);
      newTime.setHours(hours, minutes, 0, 0);
      setCurrentTime(newTime);

      // Validate the new time
      const validation = validateTimeInput(newTime, events.length === 0);
      setValidationWarning(validation.warning);
    }
  };

  // Save the log
  const handleSave = async (skipValidation: boolean = false) => {
    if (!user || !state.childId) return;

    // Implement button rate limiting (1.5 seconds)
    const now = Date.now();
    if (now - lastButtonPressTime < 1500) {
      return;
    }
    setLastButtonPressTime(now);
    setIsButtonDisabled(true);
    setTimeout(() => setIsButtonDisabled(false), 1500);

    // Perform validation unless skipped (for confirmations)
    if (!skipValidation) {
      const validation = validateTimeInput(currentTime, events.length === 0);
      if (validation.warning) {
        setValidationWarning(validation.warning);
        // If it's a hard block (too-long-gap), don't proceed
        if (!validation.isValid) {
          return;
        }
        // For warnings that need confirmation, wait for user action
        if (
          validation.warning.type !== "future" &&
          validation.warning.type !== "long-gap"
        ) {
          return;
        }
        // Show the warning and return - user needs to confirm
        return;
      }
    }

    // Clear any warnings when proceeding
    setValidationWarning(null);

    setIsLoading(true);
    try {
      if (events.length === 0) {
        // For sleep consulting first screen - create "Put In Bed" event
        const combinedDateTime = new Date(currentDate);
        combinedDateTime.setHours(
          currentTime.getHours(),
          currentTime.getMinutes(),
          0,
          0,
        );

        const putInBedEvent = {
          type: "put_in_bed" as SleepEvent["type"],
          timestamp: combinedDateTime,
        };

        // Create new log with put in bed event
        const newLogId = await createSleepLog(
          state.childId,
          user.id,
          user.name,
          sleepType,
          putInBedEvent,
          state.timezone,
        );

        // Store the log ID for subsequent events
        setCurrentLogId(newLogId);

        // Add event to state for next screen
        setEvents([putInBedEvent]);

        // Reset time to current time for next event and don't navigate back
        setCurrentTime(new Date());
        setIsLoading(false);
        return;
      } else if (events.length > 0) {
        // For sleep consulting subsequent events - add event to existing log
        const nextEventType = getNextEventType();

        // Create timestamp with next-day detection
        const originalDate = events[0].timestamp; // Get date from first event
        const lastEvent = events[events.length - 1];
        const eventTimestamp = createEventTimestamp(
          originalDate,
          currentTime,
          lastEvent.timestamp,
        );

        const newEvent = {
          type: nextEventType,
          timestamp: eventTimestamp,
        };

        const updatedEvents = [...events, newEvent];

        // Update the existing log
        const logIdToUse = state.logId || currentLogId;

        if (!logIdToUse) {
          throw new Error("No log ID available for update");
        }

        await updateSleepLog(
          logIdToUse,
          updatedEvents,
          state.timezone,
          nextEventType === "out_of_bed",
        );

        // Immediately update the cache so changes appear in log view behind modal
        const currentLog = state.logCache.get(logIdToUse);
        if (currentLog) {
          const eventsWithLocalTime = updatedEvents.map((e) => ({
            type: e.type,
            childLocalTimestamp: Timestamp.fromDate(e.timestamp),
            originalTimezone: state.timezone,
            localTime: new Intl.DateTimeFormat("en-US", {
              timeZone: state.timezone,
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }).format(e.timestamp),
          }));
          const updatedLog = {
            ...currentLog,
            events: eventsWithLocalTime,
            isComplete: nextEventType === "out_of_bed",
            updatedAt: Timestamp.fromDate(new Date()),
          };
          updateLog(updatedLog);
        }

        if (nextEventType === "out_of_bed") {
          // If this was the final event, navigate back
          navigateBack();
          return;
        } else {
          // Add event to state and continue to next screen
          setEvents(updatedEvents);
          setCurrentTime(new Date());
          setIsLoading(false);
          return;
        }
      } else if (state.logId && existingLog) {
        // Update existing log
        await updateSleepLog(state.logId, events, state.timezone, isComplete);

        // Update the cache with new data - need to convert Date to Timestamp and include localTime
        const eventsWithLocalTime = events.map((e) => ({
          type: e.type,
          childLocalTimestamp: Timestamp.fromDate(e.timestamp),
          originalTimezone: state.timezone,
          localTime: formatTimeForDisplay(e.timestamp),
        }));
        const updatedLog = {
          ...existingLog,
          events: eventsWithLocalTime,
          isComplete,
        };
        updateLog(updatedLog);
      } else if (events.length > 0) {
        // Create new log with existing events
        const newLogId = await createSleepLog(
          state.childId,
          user.id,
          user.name,
          sleepType,
          events[0],
          state.timezone,
        );

        // If there are multiple events, update the log with all events
        if (events.length > 1) {
          await updateSleepLog(newLogId, events, state.timezone, isComplete);
        }
      }

      // Navigate back to logs list using navigation context
      navigateBack();
    } catch (error) {
      console.error("Error saving log:", error);
      alert("Failed to save log. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel and go back with exit animation
  const handleCancel = () => {
    // Start exit animation
    setIsExiting(true);

    // Navigate back after animation completes
    setTimeout(() => {
      navigateBack();
    }, 300); // Match animation duration
  };

  const canSave = events.length > 0 || events.length === 0;

  if (isLoading && isInitialLoading) {
    return <UniversalSkeleton />;
  }

  return (
    <>
      {/* Modal Backdrop - subtle overlay for click handling */}
      <div
        className="absolute inset-0 z-40"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.15)" }}
        onClick={handleCancel}
      ></div>

      {/* Modal Container */}
      <div className="absolute inset-0 z-50 flex items-end justify-center px-4 pt-16">
        <div
          className={`w-full max-w-[600px] h-[85vh] font-['Poppins'] rounded-t-3xl transition-transform duration-300 ease-out shadow-2xl relative flex flex-col ${
            user?.darkMode ? "bg-[#15111B]" : "bg-white"
          }`}
          style={{
            animation: isExiting
              ? "slideDown 0.3s ease-in"
              : isInitialMount
                ? "slideUp 0.3s ease-out"
                : "none",
          }}
        >
          {/* Close button - X in upper right */}
          <button
            onClick={handleCancel}
            className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center z-60 transition-colors ${
              user?.darkMode
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top spacing for modal */}
          <div className="h-[20px]"></div>

          {/* Content - Ensure space for fixed buttons */}
          <div className="overflow-y-auto px-8 py-8 flex-1 pb-[92px]">
            {/* First Screen: Date, Time, Type Selection */}
            {events.length === 0 && (
              <SleepLogFirstScreen
                user={user}
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                currentTime={currentTime}
                sleepType={sleepType}
                setSleepType={setSleepType}
                handleTimeChange={handleTimeChange}
                formatTimeForPicker={formatTimeForPicker}
                getModalRelativeDateText={getModalRelativeDateText}
                validateTimeInput={validateTimeInput}
                setValidationWarning={setValidationWarning}
                events={events}
              />
            )}

            {/* Subsequent Screens: Time Input with Event Type Selection */}
            {events.length > 0 && (
              <SleepLogSubsequentScreen
                user={user}
                events={events}
                currentTime={currentTime}
                handleTimeChange={handleTimeChange}
                formatTimeForPicker={formatTimeForPicker}
                formatTimeForDisplay={formatTimeForDisplay}
                getQuestionText={getQuestionText}
                getEventTypeText={getEventTypeText}
                getEventTypeOptions={getEventTypeOptions}
                getCurrentEventType={getCurrentEventType}
                selectedEventType={selectedEventType}
                setSelectedEventType={setSelectedEventType}
              />
            )}
          </div>

          {/* Bottom actions - now inside modal */}
          <SleepLogModalActions
            user={user}
            validationWarning={validationWarning}
            setValidationWarning={setValidationWarning}
            handleSave={handleSave}
            canSave={canSave}
            isLoading={isLoading}
            isButtonDisabled={isButtonDisabled}
          />
        </div>
      </div>
    </>
  );
}

// First Screen Component: Date, Time, Type Selection
interface SleepLogFirstScreenProps {
  user: any;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  currentTime: Date;
  sleepType: "nap" | "bedtime";
  setSleepType: (type: "nap" | "bedtime") => void;
  handleTimeChange: (value: string | null) => void;
  formatTimeForPicker: (date: Date) => string;
  getModalRelativeDateText: () => string | null;
  validateTimeInput: (timestamp: Date, isFirstEvent?: boolean) => any;
  setValidationWarning: (warning: any) => void;
  events: Array<{ type: SleepEvent["type"]; timestamp: Date }>;
}

function SleepLogFirstScreen({
  user,
  currentDate,
  setCurrentDate,
  currentTime,
  sleepType,
  setSleepType,
  handleTimeChange,
  formatTimeForPicker,
  getModalRelativeDateText,
  validateTimeInput,
  setValidationWarning,
  events,
}: SleepLogFirstScreenProps) {
  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center">
        <h2
          className={`text-2xl font-medium mb-2 ${
            user?.darkMode ? "text-white" : "text-gray-800"
          }`}
        >
          When were they put in bed?
        </h2>
      </div>

      {/* Date Input - Inline Label */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <label
            className={`text-lg font-medium mt-3 ${
              user?.darkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Date
          </label>
          <div
            className="flex flex-col items-end"
            style={{ width: "25%" }}
          >
            <div className="flex items-center gap-2">
              {/* Show relative date text (Today, Yesterday, etc.) */}
              <span
                className={`text-xs ${
                  user?.darkMode ? "text-gray-400" : "text-gray-500"
                }`}
              >
                {getModalRelativeDateText()}
              </span>
              <input
                type="date"
                value={new Intl.DateTimeFormat("en-CA").format(
                  currentDate,
                )}
                onChange={(e) => {
                  const newDate = new Date(
                    e.target.value + "T12:00:00",
                  );
                  setCurrentDate(newDate);
                  // Revalidate when date changes
                  const combinedDateTime = new Date(newDate);
                  combinedDateTime.setHours(
                    currentTime.getHours(),
                    currentTime.getMinutes(),
                    0,
                    0,
                  );
                  const validation = validateTimeInput(
                    combinedDateTime,
                    events.length === 0,
                  );
                  setValidationWarning(validation.warning);
                }}
                className={`input text-xl text-right w-44 border-2 rounded-lg ${
                  user?.darkMode
                    ? "bg-[#3a3a3a] border-gray-600 text-white"
                    : "bg-white border-gray-300 text-gray-800"
                }`}
                style={{
                  height: "48px",
                  padding: "0 12px",
                  colorScheme: user?.darkMode ? "dark" : "light",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Time Input - Inline Label */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <label
            className={`text-lg font-medium mt-3 ${
              user?.darkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Time
          </label>
          <div
            className="flex flex-col items-end"
            style={{ width: "25%" }}
          >
            <div className="flex items-center gap-2">
              {/* Show "Now" indicator when current time is selected */}
              {(() => {
                const now = new Date();
                const timeDiff = Math.abs(
                  currentTime.getTime() - now.getTime(),
                );
                const isCurrentTime = timeDiff < 60000; // Within 1 minute

                return (
                  isCurrentTime && (
                    <span
                      className={`text-xs ${user?.darkMode ? "text-gray-400" : "text-gray-500"}`}
                    >
                      Now
                    </span>
                  )
                );
              })()}
              <TimePicker
                value={formatTimeForPicker(currentTime)}
                onChange={handleTimeChange}
                clockIcon={null}
                clearIcon={null}
                disableClock={true}
                format="h:mm a"
                className={`react-time-picker compact right-align w-32 ${
                  user?.darkMode ? "dark-theme" : ""
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Type Selection - Inline Layout */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <label
            className={`text-lg font-medium mt-3 ${
              user?.darkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Type
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setSleepType("nap")}
              className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                sleepType === "nap"
                  ? user?.darkMode
                    ? "bg-[#3a2f4a] text-white"
                    : "bg-white text-gray-800"
                  : user?.darkMode
                    ? "border-gray-600 bg-[#2a223a] text-gray-300 hover:border-gray-500"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
              style={{
                borderColor:
                  sleepType === "nap" ? "#745288" : undefined,
                backgroundColor:
                  sleepType === "nap" && !user?.darkMode
                    ? "#F0DDEF"
                    : undefined,
              }}
            >
              <Sun className="w-5 h-5" />
              <span className="text-base font-medium">Nap</span>
            </button>
            <button
              onClick={() => setSleepType("bedtime")}
              className={`px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                sleepType === "bedtime"
                  ? user?.darkMode
                    ? "bg-[#3a2f4a] text-white"
                    : "bg-white text-gray-800"
                  : user?.darkMode
                    ? "border-gray-600 bg-[#2a223a] text-gray-300 hover:border-gray-500"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
              }`}
              style={{
                borderColor:
                  sleepType === "bedtime" ? "#745288" : undefined,
                backgroundColor:
                  sleepType === "bedtime" && !user?.darkMode
                    ? "#F0DDEF"
                    : undefined,
              }}
            >
              <Moon className="w-5 h-5" />
              <span className="text-base font-medium">Bedtime</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subsequent Screen Component: Time Input with Event Type Selection
interface SleepLogSubsequentScreenProps {
  user: any;
  events: Array<{ type: SleepEvent["type"]; timestamp: Date }>;
  currentTime: Date;
  handleTimeChange: (value: string | null) => void;
  formatTimeForPicker: (date: Date) => string;
  formatTimeForDisplay: (date: Date) => string;
  getQuestionText: () => string;
  getEventTypeText: (type: SleepEvent["type"]) => string;
  getEventTypeOptions: () => { primary: SleepEvent["type"]; secondary: SleepEvent["type"] };
  getCurrentEventType: () => SleepEvent["type"];
  selectedEventType: SleepEvent["type"] | null;
  setSelectedEventType: (type: SleepEvent["type"]) => void;
}

function SleepLogSubsequentScreen({
  user,
  events,
  currentTime,
  handleTimeChange,
  formatTimeForPicker,
  formatTimeForDisplay,
  getQuestionText,
  getEventTypeText,
  getEventTypeOptions,
  getCurrentEventType,
  selectedEventType,
  setSelectedEventType,
}: SleepLogSubsequentScreenProps) {
  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="text-center">
        <h2
          className={`text-2xl font-medium mb-2 ${
            user?.darkMode ? "text-white" : "text-gray-800"
          }`}
        >
          {getQuestionText()}
        </h2>
      </div>

      {/* Subevent Context with Inline Time Input */}
      <div className="mb-8">
        <div
          className="border-l-4 pl-2"
          style={{ borderColor: "#F0DDEF" }}
        >
          {(() => {
            // Get last 3 events for context
            const recentEvents = events.slice(-3);
            const hasMoreEvents = events.length > 3;

            return (
              <div className="space-y-4">
                {/* Show recent events */}
                {recentEvents.map((event, index) => {
                  const isTopEvent = index === 0 && hasMoreEvents;
                  return (
                    <div
                      key={index}
                      className={`flex justify-between items-center ${
                        isTopEvent ? "opacity-40 blur-[1px]" : ""
                      }`}
                    >
                      <span
                        className={`text-base ${
                          user?.darkMode
                            ? "text-white"
                            : "text-gray-800"
                        }`}
                      >
                        {getEventTypeText(event.type)}
                      </span>
                      <span
                        className={`text-base ${
                          user?.darkMode
                            ? "text-gray-300"
                            : "text-gray-600"
                        }`}
                      >
                        {formatTimeForDisplay(event.timestamp)}
                      </span>
                    </div>
                  );
                })}

                {/* Time input row with tile selector replacing text */}
                <div className="flex justify-between items-center">
                  {/* Event type tile selector - replaces the text */}
                  {(() => {
                    const options = getEventTypeOptions();
                    const currentType = getCurrentEventType();

                    return (
                      <div
                        className="flex gap-2"
                        style={{ width: "calc(50% + 12px)" }}
                      >
                        <button
                          onClick={() =>
                            setSelectedEventType(options.primary)
                          }
                          className={`flex-1 px-4 rounded-lg border-2 transition-all text-base ${
                            currentType === options.primary
                              ? user?.darkMode
                                ? "text-white border-[#503460]"
                                : "text-gray-800 border-[#503460]"
                              : user?.darkMode
                                ? "border-gray-600 bg-[#2a223a] text-gray-400 hover:border-gray-500"
                                : "border-gray-300 bg-white text-gray-500 hover:border-gray-400"
                          }`}
                          style={{
                            height: "60px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor:
                              currentType === options.primary
                                ? "#F0DDEF"
                                : undefined,
                          }}
                        >
                          {getEventTypeText(options.primary)}
                        </button>
                        <button
                          onClick={() =>
                            setSelectedEventType(options.secondary)
                          }
                          className={`flex-1 px-4 rounded-lg border-2 transition-all text-base ${
                            currentType === options.secondary
                              ? user?.darkMode
                                ? "text-white border-[#503460]"
                                : "text-gray-800 border-[#503460]"
                              : user?.darkMode
                                ? "border-gray-600 bg-[#2a223a] text-gray-400 hover:border-gray-500"
                                : "border-gray-300 bg-white text-gray-500 hover:border-gray-400"
                          }`}
                          style={{
                            height: "60px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "column",
                            backgroundColor:
                              currentType === options.secondary
                                ? "#F0DDEF"
                                : undefined,
                            width: "calc(50% + 8px)",
                          }}
                        >
                          <div style={{ lineHeight: "1.1" }}>
                            {getEventTypeText(options.secondary)}
                          </div>
                          {getEventTypeText(options.secondary) ===
                            "Out of bed" && (
                            <div
                              className={`text-xs ${
                                currentType === options.secondary
                                  ? user?.darkMode
                                    ? "text-gray-300"
                                    : "text-gray-600"
                                  : user?.darkMode
                                    ? "text-gray-500"
                                    : "text-gray-400"
                              }`}
                              style={{
                                lineHeight: "1.1",
                                marginTop: "1px",
                              }}
                            >
                              i.e. End of Sleep
                            </div>
                          )}
                        </button>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-2">
                    {/* Show "Now" if current time is selected */}
                    {(() => {
                      const now = new Date();
                      const timeDiff = Math.abs(
                        currentTime.getTime() - now.getTime(),
                      );
                      const isCurrentTime = timeDiff < 60000; // Within 1 minute

                      return (
                        isCurrentTime && (
                          <span
                            className="text-sm"
                            style={{ color: "#745288" }}
                          >
                            Now
                          </span>
                        )
                      );
                    })()}
                    <div
                      className="relative"
                      style={{ width: "25%" }}
                    >
                      <TimePicker
                        value={formatTimeForPicker(currentTime)}
                        onChange={handleTimeChange}
                        clockIcon={null}
                        clearIcon={null}
                        disableClock={true}
                        format="h:mm a"
                        className={`react-time-picker compact w-32 ${
                          user?.darkMode ? "dark-theme" : ""
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// Modal Actions Component: Bottom button area with validation warnings
interface SleepLogModalActionsProps {
  user: any;
  validationWarning: {
    type: "future" | "long-gap" | "too-long-gap";
    message: string;
    subtext?: string;
  } | null;
  setValidationWarning: (warning: any) => void;
  handleSave: (skipValidation?: boolean) => Promise<void>;
  canSave: boolean;
  isLoading: boolean;
  isButtonDisabled: boolean;
}

function SleepLogModalActions({
  user,
  validationWarning,
  setValidationWarning,
  handleSave,
  canSave,
  isLoading,
  isButtonDisabled,
}: SleepLogModalActionsProps) {
  return (
    <div
      className={`absolute bottom-[92px] left-0 right-0 border-t p-4 ${
        user?.darkMode
          ? "border-gray-700 bg-[#2d2637]"
          : "border-gray-200 bg-white"
      }`}
    >
      {/* Validation warning display */}
      {validationWarning && (
        <div className="mb-4">
          <p
            className={`text-sm ${
              validationWarning.type === "too-long-gap"
                ? "text-red-600"
                : user?.darkMode
                  ? "text-[#9B7EBD]"
                  : "text-[#745288]"
            }`}
          >
            {validationWarning.message}
          </p>
          {validationWarning.subtext && (
            <p
              className={`text-sm mt-1 ${
                validationWarning.type === "too-long-gap"
                  ? "text-red-600"
                  : user?.darkMode
                    ? "text-[#9B7EBD]"
                    : "text-[#745288]"
              }`}
            >
              {validationWarning.subtext}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-center gap-3">
        {/* Show confirm button for warnings that allow proceeding */}
        {validationWarning &&
          validationWarning.type !== "too-long-gap" && (
            <button
              onClick={() => {
                void handleSave(true);
              }}
              disabled={isLoading || isButtonDisabled}
              className={`btn text-lg py-4 h-14 rounded-2xl px-6 ${
                user?.darkMode ? "hover:opacity-90" : "hover:opacity-90"
              }`}
              style={{
                backgroundColor: user?.darkMode ? "#F0DDEF" : "#F0DDEF",
                color: user?.darkMode ? "#503460" : "#503460",
              }}
            >
              Confirm
            </button>
          )}

        <button
          onClick={() =>
            validationWarning
              ? setValidationWarning(null)
              : void handleSave()
          }
          disabled={
            !canSave ||
            isLoading ||
            isButtonDisabled ||
            validationWarning?.type === "too-long-gap"
          }
          className={`btn text-white text-lg py-4 h-14 rounded-2xl px-8 ${
            user?.darkMode ? "hover:opacity-90" : "hover:opacity-90"
          } ${validationWarning?.type === "too-long-gap" ? "opacity-50 cursor-not-allowed" : ""}`}
          style={{
            backgroundColor: user?.darkMode ? "#9B7EBD" : "#503460",
          }}
        >
          {isLoading ? (
            <div className="loading loading-spinner w-5 h-5"></div>
          ) : validationWarning ? (
            "Change Time"
          ) : (
            "Add"
          )}
        </button>
      </div>
    </div>
  );
}