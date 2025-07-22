import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useNavigation } from '@/contexts/NavigationContext';
import { useBubbleAuth } from '@/hooks/useBubbleAuth';
import { SleepEvent, SleepLog } from '@/lib/firebase/types';
import {
  createSleepLog,
  updateSleepLog,
  getLog,
  toChildLocalTime,
  fromChildLocalTime,
  getChildNow,
  getChildStartOfDay,
  getChildEndOfDay,
} from '@/lib/firebase/index';

export interface ValidationWarning {
  type: "future" | "long-gap" | "too-long-gap";
  message: string;
  subtext?: string;
}

export function useLogModal() {
  const { user } = useBubbleAuth();
  const { state, navigateBack, updateLog } = useNavigation();
  
  // Core state
  const [isLoading, setIsLoading] = useState(false);
  const [sleepType, setSleepType] = useState<"nap" | "bedtime">("nap");
  const [events, setEvents] = useState<Array<{ type: SleepEvent["type"]; timestamp: Date }>>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(() => {
    if (state.defaultLogDate) {
      return new Date(state.defaultLogDate + "T12:00:00");
    }
    return new Date();
  });
  const [isComplete, setIsComplete] = useState(false);
  const [existingLog, setExistingLog] = useState<SleepLog | null>(null);
  const [selectedEventType, setSelectedEventType] = useState<SleepEvent["type"] | null>(null);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  
  // UI state
  const [isInitialMount, setIsInitialMount] = useState(true);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  
  // Validation state
  const [validationWarning, setValidationWarning] = useState<ValidationWarning | null>(null);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);
  const [lastButtonPressTime, setLastButtonPressTime] = useState(0);

  // Set default sleep type based on time (only on initial load)
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 18) {
      setSleepType("nap");
    } else {
      setSleepType("bedtime");
    }
  }, []);

  // Reset selected event type when events change
  useEffect(() => {
    setSelectedEventType(null);
  }, [events.length]);

  // Track initial mount for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialMount(false);
    }, 350);

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

          const originalDate = eventsWithDates[0].timestamp;
          const timeOnOriginalDate = new Date(originalDate);
          timeOnOriginalDate.setHours(
            new Date().getHours(),
            new Date().getMinutes(),
          );
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

              const originalDate = eventsWithDates[0].timestamp;
              const timeOnOriginalDate = new Date(originalDate);
              timeOnOriginalDate.setHours(
                new Date().getHours(),
                new Date().getMinutes(),
              );
              setCurrentTime(timeOnOriginalDate);
              setCurrentDate(new Date(originalDate));
            }
            updateLog(log);
          }
          setIsLoading(false);
        })
        .catch((error) => {
          console.error("Error loading log:", error);
          setIsLoading(false);
        });
    }
  }, [state.logId, state.logCache, updateLog]);

  // Utility functions
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

  const getNextEventType = (): SleepEvent["type"] => {
    return getCurrentEventType();
  };

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

  const getCurrentEventType = (): SleepEvent["type"] => {
    if (selectedEventType) {
      return selectedEventType;
    }
    const options = getEventTypeOptions();
    return options.primary;
  };

  const getModalRelativeDateText = () => {
    const childNow = getChildNow(state.timezone);
    const childToday = getChildStartOfDay(childNow, state.timezone);
    const selectedDateChildLocal = getChildStartOfDay(currentDate, state.timezone);
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

  const formatTimeForPicker = (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeForDisplay = (date: Date): string => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  const createEventTimestamp = (
    originalDate: Date,
    selectedTime: Date,
    lastEventTimestamp: Date,
  ): Date => {
    const eventTimestamp = new Date(originalDate);
    eventTimestamp.setHours(
      selectedTime.getHours(),
      selectedTime.getMinutes(),
      0,
      0,
    );

    if (eventTimestamp < lastEventTimestamp) {
      eventTimestamp.setDate(eventTimestamp.getDate() + 1);
    }

    return eventTimestamp;
  };

  const validateTimeInput = (
    timestamp: Date,
    isFirstEvent: boolean = false,
  ): {
    isValid: boolean;
    warning: ValidationWarning | null;
  } => {
    const childNow = getChildNow(state.timezone);
    
    let timeToCheck = timestamp;
    if (isFirstEvent || events.length === 0) {
      timeToCheck = new Date(currentDate);
      timeToCheck.setHours(timestamp.getHours(), timestamp.getMinutes(), 0, 0);
    }

    const childLocalTimeToCheck = toChildLocalTime(timeToCheck, state.timezone);
    const selectedDateInChildTz = toChildLocalTime(currentDate, state.timezone);
    const childTodayStart = getChildStartOfDay(childNow, state.timezone);
    const childTodayEnd = getChildEndOfDay(childNow, state.timezone);

    const isToday = selectedDateInChildTz >= childTodayStart && selectedDateInChildTz <= childTodayEnd;

    if (isToday) {
      const fiveMinutesFromChildNow = new Date(childNow.getTime() + 5 * 60 * 1000);
      if (childLocalTimeToCheck > fiveMinutesFromChildNow) {
        return {
          isValid: true,
          warning: {
            type: "future",
            message: "This time is in the future - are you sure you want to save it?",
          },
        };
      }
    }

    if (isFirstEvent || events.length === 0) {
      return { isValid: true, warning: null };
    }

    const lastEventTimestamp = events[events.length - 1].timestamp;
    const lastEventChildLocal = toChildLocalTime(lastEventTimestamp, state.timezone);
    const firstEventChildLocal = toChildLocalTime(events[0].timestamp, state.timezone);
    const preppedTimeChildLocal = createEventTimestamp(
      firstEventChildLocal,
      childLocalTimeToCheck,
      lastEventChildLocal,
    );

    const hoursDiff = (preppedTimeChildLocal.getTime() - lastEventChildLocal.getTime()) / (1000 * 60 * 60);

    if (hoursDiff >= 0 && hoursDiff <= 12) {
      return { isValid: true, warning: null };
    }

    if (hoursDiff > 12 && hoursDiff < 16) {
      return {
        isValid: true,
        warning: {
          type: "long-gap",
          message: `That time is more than 12 hours after the last logged time - are you sure you want to save it?`,
          subtext: `Did you instead want to end this ${sleepType} and start another?`,
        },
      };
    }

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

  const handleTimeChange = (value: string | null) => {
    if (!value) return;

    const [hours, minutes] = value.split(":").map(Number);
    if (!isNaN(hours) && !isNaN(minutes)) {
      const newTime = new Date(currentTime);
      newTime.setHours(hours, minutes, 0, 0);
      setCurrentTime(newTime);

      const validation = validateTimeInput(newTime, events.length === 0);
      setValidationWarning(validation.warning);
    }
  };

  const handleSave = async (skipValidation: boolean = false) => {
    if (!user || !state.childId) return;

    // Rate limiting
    const now = Date.now();
    if (now - lastButtonPressTime < 1500) {
      return;
    }
    setLastButtonPressTime(now);
    setIsButtonDisabled(true);
    setTimeout(() => setIsButtonDisabled(false), 1500);

    // Validation
    if (!skipValidation) {
      const validation = validateTimeInput(currentTime, events.length === 0);
      if (validation.warning) {
        setValidationWarning(validation.warning);
        if (!validation.isValid) {
          return;
        }
        if (validation.warning.type !== "future" && validation.warning.type !== "long-gap") {
          return;
        }
        return;
      }
    }

    setValidationWarning(null);
    setIsLoading(true);
    
    try {
      if (events.length === 0) {
        // Create first event
        const combinedDateTime = new Date(currentDate);
        combinedDateTime.setHours(currentTime.getHours(), currentTime.getMinutes(), 0, 0);

        const putInBedEvent = {
          type: "put_in_bed" as SleepEvent["type"],
          timestamp: combinedDateTime,
        };

        const newLogId = await createSleepLog(
          state.childId,
          user.id,
          user.name,
          sleepType,
          putInBedEvent,
          state.timezone,
        );

        setCurrentLogId(newLogId);
        setEvents([putInBedEvent]);
        setCurrentTime(new Date());
        setIsLoading(false);
        return;
      } else if (events.length > 0) {
        // Add subsequent event
        const nextEventType = getNextEventType();
        const originalDate = events[0].timestamp;
        const lastEvent = events[events.length - 1];
        const eventTimestamp = createEventTimestamp(originalDate, currentTime, lastEvent.timestamp);

        const newEvent = {
          type: nextEventType,
          timestamp: eventTimestamp,
        };

        const updatedEvents = [...events, newEvent];
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

        // Update cache
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
          navigateBack();
          return;
        } else {
          setEvents(updatedEvents);
          setCurrentTime(new Date());
          setIsLoading(false);
          return;
        }
      } else if (state.logId && existingLog) {
        // Update existing log
        await updateSleepLog(state.logId, events, state.timezone, isComplete);

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

        if (events.length > 1) {
          await updateSleepLog(newLogId, events, state.timezone, isComplete);
        }
      }

      navigateBack();
    } catch (error) {
      console.error("Error saving log:", error);
      alert("Failed to save log. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsExiting(true);
    setTimeout(() => {
      navigateBack();
    }, 300);
  };

  const canSave = events.length > 0 || events.length === 0;

  return {
    // State
    user,
    state,
    isLoading,
    sleepType,
    setSleepType,
    events,
    currentTime,
    setCurrentTime,
    currentDate,
    setCurrentDate,
    isComplete,
    existingLog,
    selectedEventType,
    setSelectedEventType,
    currentLogId,
    isInitialMount,
    isInitialLoading,
    isExiting,
    validationWarning,
    setValidationWarning,
    isButtonDisabled,
    canSave,
    
    // Utility functions
    getQuestionText,
    getNextEventType,
    getEventTypeText,
    getEventTypeOptions,
    getCurrentEventType,
    getModalRelativeDateText,
    formatTimeForPicker,
    formatTimeForDisplay,
    createEventTimestamp,
    validateTimeInput,
    handleTimeChange,
    handleSave,
    handleCancel,
  };
}