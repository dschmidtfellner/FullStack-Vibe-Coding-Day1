import { Sun, Moon } from 'lucide-react';
import TimePicker from 'react-time-picker';
import { SleepEvent } from '@/lib/firebase-messaging';
import { ValidationWarning } from '@/hooks/use-log-modal';

interface LogFirstScreenProps {
  user: any;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
  currentTime: Date;
  sleepType: "nap" | "bedtime";
  setSleepType: (type: "nap" | "bedtime") => void;
  handleTimeChange: (value: string | null) => void;
  formatTimeForPicker: (date: Date) => string;
  getModalRelativeDateText: () => string | null;
  validateTimeInput: (timestamp: Date, isFirstEvent?: boolean) => {
    isValid: boolean;
    warning: ValidationWarning | null;
  };
  setValidationWarning: (warning: ValidationWarning | null) => void;
  events: Array<{ type: SleepEvent["type"]; timestamp: Date }>;
}

export function LogFirstScreen({
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
}: LogFirstScreenProps) {
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