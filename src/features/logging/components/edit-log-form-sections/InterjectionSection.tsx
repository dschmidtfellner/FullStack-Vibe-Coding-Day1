import { useState } from 'react';
import { SleepEvent, User } from '@/lib/firebase/types';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';

interface InterjectionSectionProps {
  show: boolean;
  interjectionIndex: number | null;
  events: { type: SleepEvent["type"]; timestamp: Date }[];
  user: User | null;
  formatTimeForDisplay: (date: Date) => string;
  getEventTypeText: (type: SleepEvent["type"]) => string;
  onSave: (type: SleepEvent["type"], time: Date) => void;
  onCancel: () => void;
  defaultType: SleepEvent["type"];
  defaultTime: Date;
}

export function InterjectionSection({
  show,
  interjectionIndex,
  events,
  user,
  formatTimeForDisplay,
  getEventTypeText,
  onSave,
  onCancel,
  defaultType,
  defaultTime
}: InterjectionSectionProps) {
  const [interjectionType, setInterjectionType] = useState<SleepEvent["type"]>(defaultType);
  const [interjectionTime, setInterjectionTime] = useState<Date>(defaultTime);
  const [validationWarning, setValidationWarning] = useState<any>(null);

  if (!show || interjectionIndex === null) return null;

  const beforeEvent = events[interjectionIndex];
  const afterEvent = events[interjectionIndex + 1];

  // Validate interjection time
  const validateTime = (time: Date) => {
    if (time < beforeEvent.timestamp) {
      return {
        isValid: false,
        warning: {
          type: "before-range",
          message: `Time must be after ${formatTimeForDisplay(beforeEvent.timestamp)}`,
        },
      };
    }

    if (time > afterEvent.timestamp) {
      return {
        isValid: false,
        warning: {
          type: "after-range",
          message: `Time must be before ${formatTimeForDisplay(afterEvent.timestamp)}`,
        },
      };
    }

    return { isValid: true, warning: null };
  };

  const handleSave = () => {
    const validation = validateTime(interjectionTime);
    if (!validation.isValid) {
      setValidationWarning(validation.warning);
      return;
    }
    onSave(interjectionType, interjectionTime);
  };

  return (
    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-end z-[120]">
      <div
        className={`w-full max-w-[800px] mx-auto rounded-t-2xl shadow-xl transform transition-transform duration-300 ease-out ${
          user?.darkMode ? "bg-[#15111B]" : "bg-white"
        }`}
      >
        {/* Modal Header */}
        <div className="px-6 py-6 text-center">
          <h2
            className={`text-2xl font-medium mb-2 ${
              user?.darkMode ? "text-white" : "text-gray-800"
            }`}
          >
            Add a Log
          </h2>
          <p
            className={`text-base ${
              user?.darkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            between {formatTimeForDisplay(beforeEvent.timestamp)} and{" "}
            {formatTimeForDisplay(afterEvent.timestamp)}
          </p>
        </div>

        {/* Context Events */}
        <div className="px-6 mb-8">
          <div className="space-y-4">
            {/* Before Event */}
            <div className="flex justify-between items-center">
              <span
                className={`text-base ${
                  user?.darkMode ? "text-white" : "text-gray-800"
                }`}
              >
                {getEventTypeText(beforeEvent.type)}
              </span>
              <span
                className={`text-base ${
                  user?.darkMode ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {formatTimeForDisplay(beforeEvent.timestamp)}
              </span>
            </div>

            {/* Input Row */}
            <div className="flex justify-between items-center gap-4">
              {/* Event Type Dropdown */}
              <div style={{ width: "120px" }}>
                <select
                  value={interjectionType}
                  onChange={(e) =>
                    setInterjectionType(e.target.value as SleepEvent["type"])
                  }
                  className={`w-full px-4 py-3 border-2 rounded-lg text-base transition-colors ${
                    user?.darkMode
                      ? "bg-[#2a223a] border-gray-600 text-white"
                      : "bg-white border-gray-300 text-gray-800"
                  }`}
                >
                  <option value="fell_asleep">Asleep</option>
                  <option value="woke_up">Awake</option>
                </select>
              </div>

              {/* Time Picker */}
              <div style={{ width: "120px" }}>
                <TimePicker
                  value={`${interjectionTime.getHours().toString().padStart(2, "0")}:${interjectionTime.getMinutes().toString().padStart(2, "0")}`}
                  onChange={(value) => {
                    if (value) {
                      const [hours, minutes] = value.split(":").map(Number);
                      const newTime = new Date(interjectionTime);
                      newTime.setHours(hours, minutes, 0, 0);
                      setInterjectionTime(newTime);
                      setValidationWarning(null);
                    }
                  }}
                  disableClock={true}
                  clearIcon={null}
                  format="h:mm a"
                  className={`w-32 ${user?.darkMode ? "dark-time-picker" : ""}`}
                />
              </div>
            </div>

            {/* After Event */}
            <div className="flex justify-between items-center">
              <span
                className={`text-base ${
                  user?.darkMode ? "text-white" : "text-gray-800"
                }`}
              >
                {getEventTypeText(afterEvent.type)}
              </span>
              <span
                className={`text-base ${
                  user?.darkMode ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {formatTimeForDisplay(afterEvent.timestamp)}
              </span>
            </div>
          </div>
        </div>

        {/* Validation Warning */}
        {validationWarning && (
          <div className="px-6 mb-6">
            <div
              className={`p-4 rounded-lg border-2 ${
                user?.darkMode
                  ? "bg-red-900/20 border-red-600 text-red-400"
                  : "bg-red-50 border-red-300 text-red-700"
              }`}
            >
              <p className="text-base font-medium">
                {validationWarning.message}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="px-6 pb-8 flex justify-center gap-4">
          <button
            onClick={onCancel}
            className={`px-6 py-3 rounded-full text-base transition-colors ${
              user?.darkMode
                ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={!!validationWarning}
            className={`px-8 py-3 rounded-full text-base text-white transition-colors ${
              validationWarning
                ? "opacity-50 cursor-not-allowed"
                : "hover:opacity-90"
            }`}
            style={{
              backgroundColor: user?.darkMode ? "#9B7EBD" : "#503460",
            }}
          >
            Add Log
          </button>
        </div>
      </div>
    </div>
  );
}