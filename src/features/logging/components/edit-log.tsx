import { useState, useEffect } from 'react';
import { useBubbleAuth } from '@/hooks/useBubbleAuth';
import { useNavigation } from '@/contexts/NavigationContext';
import { Plus } from 'lucide-react';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import { Timestamp } from 'firebase/firestore';
import { SleepEvent, SleepLog } from '@/lib/firebase/types';
import { updateSleepLog, getLog } from '@/lib/firebase/index';
import { UniversalSkeleton } from '@/components/shared/UniversalSkeleton';
import { BasicInfoSection, DateSelectorSection, InterjectionSection } from './edit-log-form-sections';

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
  const [interjectionValidationWarning, setInterjectionValidationWarning] =
    useState<any>(null);

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

  // Validate interjection time
  const validateInterjectionTime = (
    time: Date,
    beforeEvent: Date,
    afterEvent: Date,
  ) => {
    if (time < beforeEvent) {
      return {
        isValid: false,
        warning: {
          type: "before-range",
          message: `Time must be after ${formatTimeForDisplay(beforeEvent)}`,
        },
      };
    }

    if (time > afterEvent) {
      return {
        isValid: false,
        warning: {
          type: "after-range",
          message: `Time must be before ${formatTimeForDisplay(afterEvent)}`,
        },
      };
    }

    return { isValid: true, warning: null };
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

  if (isLoading || !log) {
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
      <div className="px-4 pb-20 overflow-y-auto">
        <div>
          {events.map((event, index) => (
            <div key={index}>
              {/* Event Row */}
              <div className="py-4">
                {editingEventIndex === index ? (
                  // Editing mode
                  <div className="flex items-center justify-between gap-4">
                    <span
                      className={`text-base flex-1 ${
                        user?.darkMode ? "text-white" : "text-gray-800"
                      }`}
                    >
                      {getEventTypeText(event.type)}
                    </span>

                    <div className="flex items-center gap-2">
                      <TimePicker
                        value={editingTime}
                        onChange={(value) => setEditingTime(value || "")}
                        disableClock={true}
                        clearIcon={null}
                        format="h:mm a"
                        className={`w-32 ${user?.darkMode ? "dark-time-picker" : ""}`}
                      />

                      <button
                        onClick={() => handleSaveEventTime(index)}
                        className="px-4 py-1.5 rounded-full text-sm transition-colors"
                        style={{
                          backgroundColor: "#E8B4E3",
                          color: "white",
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-base ${
                          hasConsecutiveSameType(index)
                            ? "text-red-500"
                            : user?.darkMode
                              ? "text-white"
                              : "text-gray-800"
                        }`}
                      >
                        {getEventTypeText(event.type)}
                      </span>
                      {hasConsecutiveSameType(index) && (
                        <div className="w-6 h-6 rounded-full border-2 border-red-500 flex items-center justify-center">
                          <span className="text-red-500 text-sm font-bold">
                            !
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-base ${
                          user?.darkMode ? "text-gray-300" : "text-gray-600"
                        }`}
                      >
                        {formatTimeForDisplay(event.timestamp)}
                      </span>

                      <button
                        onClick={() => handleEditEvent(index)}
                        className="px-4 py-1.5 rounded-full text-sm transition-colors border"
                        style={{
                          borderColor: "#9B7EBD",
                          color: "#9B7EBD",
                          backgroundColor: "transparent",
                        }}
                      >
                        Edit
                      </button>

                      {events.length > 1 && (
                        <button
                          onClick={() => handleDeleteEvent(index)}
                          className="p-2 transition-colors text-gray-400 hover:text-gray-600"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Separator line with overlaid plus button - Only show between events */}
              {index < events.length - 1 && (
                <div className="relative flex items-center justify-center h-8">
                  {/* Pink separator line */}
                  <div
                    className="absolute inset-x-0 top-1/2 h-px"
                    style={{ backgroundColor: "#F0DDEF" }}
                  ></div>

                  {/* Plus button overlaid on top */}
                  <button
                    onClick={() => {
                      // Determine default type based on current and next event
                      const currentType = event.type;
                      const nextType = events[index + 1].type;
                      let defaultType: SleepEvent["type"] = "woke_up";

                      if (
                        currentType === "fell_asleep" &&
                        nextType === "out_of_bed"
                      ) {
                        defaultType = "woke_up";
                      } else if (
                        currentType === "woke_up" &&
                        nextType === "out_of_bed"
                      ) {
                        defaultType = "fell_asleep";
                      }

                      // Calculate default time (halfway between events)
                      const currentEvent = events[index];
                      const nextEvent = events[index + 1];
                      const timeDiff =
                        nextEvent.timestamp.getTime() -
                        currentEvent.timestamp.getTime();
                      const defaultTime = new Date(
                        currentEvent.timestamp.getTime() + timeDiff / 2,
                      );

                      // Open modal
                      setInterjectionIndex(index);
                      setInterjectionType(defaultType);
                      setInterjectionTime(defaultTime);
                      setInterjectionValidationWarning(null);
                      setShowInterjectionModal(true);
                    }}
                    className="p-1.5 rounded-full transition-colors relative z-10"
                    style={{
                      backgroundColor: "#E8B4E3",
                      color: "white",
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

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
          setInterjectionValidationWarning(null);
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