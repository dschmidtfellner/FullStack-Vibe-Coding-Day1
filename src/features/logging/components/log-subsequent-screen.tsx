import TimePicker from 'react-time-picker';
import { SleepEvent } from '@/lib/firebase-messaging';

interface LogSubsequentScreenProps {
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
  _selectedEventType?: SleepEvent["type"] | null;
  setSelectedEventType: (type: SleepEvent["type"]) => void;
}

export function LogSubsequentScreen({
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
  _selectedEventType: _unused,
  setSelectedEventType,
}: LogSubsequentScreenProps) {
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