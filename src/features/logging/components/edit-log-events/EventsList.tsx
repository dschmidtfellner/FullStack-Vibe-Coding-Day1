import { Plus } from "lucide-react";
import TimePicker from "react-time-picker";
import "react-time-picker/dist/TimePicker.css";
import "react-clock/dist/Clock.css";
import { SleepEvent } from "@/lib/firebase/types";
import { BubbleUser } from "@/lib/jwt-auth";

interface EventsListProps {
  events: { type: SleepEvent["type"]; timestamp: Date }[];
  user: BubbleUser | null;
  editingEventIndex: number | null;
  editingTime: string;
  formatTimeForDisplay: (date: Date) => string;
  getEventTypeText: (type: SleepEvent["type"]) => string;
  hasConsecutiveSameType: (index: number) => boolean;
  onEditEvent: (index: number) => void;
  onSaveEventTime: (index: number) => void;
  onDeleteEvent: (index: number) => void;
  onEditingTimeChange: (time: string) => void;
  onAddInterjection: (
    index: number,
    defaultType: SleepEvent["type"],
    defaultTime: Date,
  ) => void;
}

export function EventsList({
  events,
  user,
  editingEventIndex,
  editingTime,
  formatTimeForDisplay,
  getEventTypeText,
  hasConsecutiveSameType,
  onEditEvent,
  onSaveEventTime,
  onDeleteEvent,
  onEditingTimeChange,
  onAddInterjection,
}: EventsListProps) {
  return (
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
                      onChange={(value) => onEditingTimeChange(value || "")}
                      disableClock={true}
                      clearIcon={null}
                      format="h:mm a"
                      className={`w-32 ${user?.darkMode ? "dark-time-picker" : ""}`}
                    />

                    <button
                      onClick={() => onSaveEventTime(index)}
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
                      onClick={() => onEditEvent(index)}
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
                        onClick={() => onDeleteEvent(index)}
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

                    onAddInterjection(index, defaultType, defaultTime);
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
  );
}
