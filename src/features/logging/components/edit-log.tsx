import { useState, useEffect } from 'react';
import { useBubbleAuth } from '@/hooks/useBubbleAuth';
import { useNavigation } from '@/contexts/NavigationContext';
import { Timestamp } from 'firebase/firestore';
import { SleepEvent, SleepLog } from '@/lib/firebase/types';
import { updateSleepLog, getLog } from '@/lib/firebase/index';
import { UniversalSkeleton } from '@/components/shared/UniversalSkeleton';
import { BasicInfoSection, DateSelectorSection, InterjectionSection } from './edit-log-form-sections';
import { EventsList } from './edit-log-events';

export function EditLog() {
  const { user } = useBubbleAuth();
  const { state, navigateBack, updateLog } = useNavigation();
  const [log, setLog] = useState<SleepLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<
    { type: SleepEvent["type"]; timestamp: Date }[]
  >([]);
  const [editingEventIndex, setEditingEventIndex] = useState<number | null>(
    null,
  );
  const [editingTime, setEditingTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);

  // Interjection modal state
  const [showInterjectionModal, setShowInterjectionModal] = useState(false);
  const [interjectionIndex, setInterjectionIndex] = useState<number | null>(
    null,
  );
  const [interjectionType, setInterjectionType] =
    useState<SleepEvent["type"]>("woke_up");
  const [interjectionTime, setInterjectionTime] = useState<Date>(new Date());

  // Validation dialog state
  const [showValidationDialog, setShowValidationDialog] = useState(false);

  // Get current log from cache or fetch it
  useEffect(() => {
    if (!state.logId) return;

    // First check cache
    const cachedLog = state.logCache.get(state.logId);
    if (cachedLog) {
      setLog(cachedLog);
      // Convert events from Firestore to local format
      if (cachedLog.events) {
        const localEvents = cachedLog.events.map((e) => ({
          type: e.type,
          timestamp: e.childLocalTimestamp.toDate(),
        }));
        setEvents(localEvents);
        // Set initial date from first event
        if (localEvents.length > 0) {
          setCurrentDate(localEvents[0].timestamp);
        }
      }
      return;
    }

    // If not in cache, fetch it
    setIsLoading(true);
    getLog(state.logId)
      .then((logData) => {
        if (logData) {
          setLog(logData);
          updateLog(logData); // Add to cache
          // Convert events from Firestore to local format
          if (logData.events) {
            const localEvents = logData.events.map((e) => ({
              type: e.type,
              timestamp: e.childLocalTimestamp.toDate(),
            }));
            setEvents(localEvents);
            // Set initial date from first event
            if (localEvents.length > 0) {
              setCurrentDate(localEvents[0].timestamp);
            }
          }
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error loading log:", error);
        setIsLoading(false);
      });
  }, [state.logId, state.logCache, updateLog]);

  // Format time for display
  const formatTimeForDisplay = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: state.timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Format date for the date selector
  const formatDateForSelector = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: state.timezone,
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  // Handle date change - move all events by the same offset
  const handleDateChange = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));

    // Calculate the offset in milliseconds
    const offset = newDate.getTime() - currentDate.getTime();

    // Update all events with the offset
    const updatedEvents = events.map((event) => ({
      ...event,
      timestamp: new Date(event.timestamp.getTime() + offset),
    }));

    setEvents(updatedEvents);
    setCurrentDate(newDate);
  };

  // Start editing an event
  const handleEditEvent = (index: number) => {
    setEditingEventIndex(index);
    const event = events[index];
    // Format time as HH:MM for the time picker
    const hours = event.timestamp.getHours().toString().padStart(2, "0");
    const minutes = event.timestamp.getMinutes().toString().padStart(2, "0");
    setEditingTime(`${hours}:${minutes}`);
  };

  // Save edited time
  const handleSaveEventTime = (index: number) => {
    if (!editingTime) return;

    const [hours, minutes] = editingTime.split(":").map(Number);
    const updatedEvents = [...events];
    const newTimestamp = new Date(updatedEvents[index].timestamp);
    newTimestamp.setHours(hours, minutes, 0, 0);

    updatedEvents[index] = {
      ...updatedEvents[index],
      timestamp: newTimestamp,
    };

    setEvents(updatedEvents);
    setEditingEventIndex(null);
    setEditingTime("");
  };

  // Cancel editing (unused but kept for future functionality)
  // const handleCancelEdit = () => {
  //   setEditingEventIndex(null);
  //   setEditingTime('');
  // };

  // Delete an event
  const handleDeleteEvent = (index: number) => {
    const updatedEvents = events.filter((_, i) => i !== index);
    setEvents(updatedEvents);
  };

  // Add an interjection event (unused but kept for future functionality)
  // const handleAddInterjection = (afterIndex: number, type: SleepEvent['type']) => {
  //   const updatedEvents = [...events];
  //
  //   // Calculate timestamp between current and next event
  //   const currentEvent = events[afterIndex];
  //   const nextEvent = events[afterIndex + 1];
  //
  //   let newTimestamp: Date;
  //   if (nextEvent) {
  //     // Place new event halfway between current and next
  //     const timeDiff = nextEvent.timestamp.getTime() - currentEvent.timestamp.getTime();
  //     newTimestamp = new Date(currentEvent.timestamp.getTime() + timeDiff / 2);
  //   } else {
  //     // If no next event, add 30 minutes after current
  //     newTimestamp = new Date(currentEvent.timestamp.getTime() + 30 * 60 * 1000);
  //   }
  //
  //   const newEvent = {
  //     type,
  //     timestamp: newTimestamp
  //   };
  //
  //   updatedEvents.splice(afterIndex + 1, 0, newEvent);
  //   setEvents(updatedEvents);
  // };

  // Get event type text
  const getEventTypeText = (type: SleepEvent["type"]) => {
    switch (type) {
      case "put_in_bed":
        return "Put in bed";
      case "fell_asleep":
        return "Asleep";
      case "woke_up":
        return "Awake";
      case "out_of_bed":
        return "Out of bed";
      default:
        return type;
    }
  };

  // Check if event has consecutive same type (for red formatting)
  const hasConsecutiveSameType = (index: number): boolean => {
    if (index === 0) return false;

    const currentEvent = events[index];
    const previousEvent = events[index - 1];

    // Only check for consecutive awake/asleep events
    const sleepWakeTypes = ["fell_asleep", "woke_up"];
    if (
      !sleepWakeTypes.includes(currentEvent.type) ||
      !sleepWakeTypes.includes(previousEvent.type)
    ) {
      return false;
    }

    return currentEvent.type === previousEvent.type;
  };

  // Check if there are any consecutive same types in the events array
  const hasAnyConsecutiveSameTypes = (): boolean => {
    for (let i = 1; i < events.length; i++) {
      if (hasConsecutiveSameType(i)) {
        return true;
      }
    }
    return false;
  };


  // Handle interjection modal save
  const handleSaveInterjection = (type: SleepEvent["type"], time: Date) => {
    if (interjectionIndex === null) return;

    // Add the interjection
    const updatedEvents = [...events];
    const newEvent = {
      type: type,
      timestamp: time,
    };

    updatedEvents.splice(interjectionIndex + 1, 0, newEvent);
    setEvents(updatedEvents);

    // Close modal
    setShowInterjectionModal(false);
    setInterjectionIndex(null);
    setInterjectionValidationWarning(null);
  };

  // Save all changes
  const handleSaveChanges = async () => {
    if (!state.logId || !log || !user) return;

    // Check for consecutive same types before saving
    if (hasAnyConsecutiveSameTypes()) {
      setShowValidationDialog(true);
      return;
    }

    setIsSaving(true);
    try {
      // Update the log with new events
      const isComplete = events.some((e) => e.type === "out_of_bed");
      await updateSleepLog(state.logId, events, state.timezone, isComplete);

      // Update the cache
      const eventsWithLocalTime = events.map((e) => ({
        type: e.type,
        childLocalTimestamp: Timestamp.fromDate(e.timestamp),
        originalTimezone: state.timezone,
        localTime: formatTimeForDisplay(e.timestamp),
      }));
      const updatedLog = {
        ...log,
        events: eventsWithLocalTime,
        isComplete,
        updatedAt: Timestamp.fromDate(new Date()),
      };
      updateLog(updatedLog);

      // Navigate back to log detail
      navigateBack();
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !log || !user) {
    return <UniversalSkeleton />;
  }

  return (
    <div
      className={`relative h-full font-['Poppins'] max-w-[800px] mx-auto ${
        user?.darkMode ? "bg-[#15111B]" : "bg-white"
      }`}
    >
      {/* Top spacing */}
      <div className="h-[20px]"></div>

      {/* Header with Back and Save buttons */}
      <div className="px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => {
            // Check for consecutive same types before navigating back
            if (hasAnyConsecutiveSameTypes()) {
              setShowValidationDialog(true);
              return;
            }
            navigateBack();
          }}
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
          <span className="text-sm font-medium">Cancel</span>
        </button>

        <button
          onClick={() => {
            void handleSaveChanges();
          }}
          disabled={isSaving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            user?.darkMode
              ? "bg-purple-800 text-white hover:bg-purple-900"
              : "bg-purple-800 text-white hover:bg-purple-900"
          }`}
        >
          {isSaving ? (
            <div className="loading loading-spinner w-4 h-4"></div>
          ) : (
            <span className="text-sm font-medium">Save</span>
          )}
        </button>
      </div>

      {/* Basic Info Section */}
      <BasicInfoSection
        log={log}
        user={user}
        formatTimeInTimezone={formatTimeForDisplay}
        onDelete={navigateBack}
        logId={state.logId}
      />

      {/* Date Selector */}
      <DateSelectorSection
        currentDate={currentDate}
        user={user}
        onDateChange={handleDateChange}
        formatDateForSelector={formatDateForSelector}
      />

      {/* Events List */}
      <EventsList
        events={events}
        user={user}
        editingEventIndex={editingEventIndex}
        editingTime={editingTime}
        formatTimeForDisplay={formatTimeForDisplay}
        getEventTypeText={getEventTypeText}
        hasConsecutiveSameType={hasConsecutiveSameType}
        onEditEvent={handleEditEvent}
        onSaveEventTime={handleSaveEventTime}
        onDeleteEvent={handleDeleteEvent}
        onEditingTimeChange={setEditingTime}
        onAddInterjection={(index, defaultType, defaultTime) => {
          setInterjectionIndex(index);
          setInterjectionType(defaultType);
          setInterjectionTime(defaultTime);
          setShowInterjectionModal(true);
        }}
      />

      {/* Bottom spacing */}
      <div
        className={`h-[20px] ${user?.darkMode ? "bg-[#15111B]" : "bg-white"}`}
      ></div>

      {/* Interjection Modal */}
      <InterjectionSection
        show={showInterjectionModal}
        interjectionIndex={interjectionIndex}
        events={events}
        user={user}
        formatTimeForDisplay={formatTimeForDisplay}
        getEventTypeText={getEventTypeText}
        onSave={handleSaveInterjection}
        onCancel={() => {
          setShowInterjectionModal(false);
          setInterjectionIndex(null);
        }}
        defaultType={interjectionType}
        defaultTime={interjectionTime}
      />

      {/* Validation Dialog */}
      {showValidationDialog && (
        <div className="absolute inset-0 z-[130] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowValidationDialog(false)}
          ></div>
          <div
            className={`relative w-full max-w-md mx-auto rounded-2xl p-8 shadow-xl ${
              user?.darkMode ? "bg-[#15111B]" : "bg-white"
            }`}
            style={{ backgroundColor: "#F4E6F3" }}
          >
            <div className="text-center">
              <h2
                className="text-2xl font-medium mb-4"
                style={{ color: "#503460" }}
              >
                Missing an awake or asleep
              </h2>

              <p className="text-base mb-6" style={{ color: "#503460" }}>
                You've tracked two 'Awakes' or two 'Asleeps' in a row. To save
                this log, add an 'Asleep' or 'Awake' in between them.
              </p>

              <p className="text-base mb-8" style={{ color: "#503460" }}>
                If you don't know exactly, just put your best guess.
              </p>

              <button
                onClick={() => setShowValidationDialog(false)}
                className="w-full py-4 rounded-full text-white font-medium text-lg"
                style={{ backgroundColor: "#503460" }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}