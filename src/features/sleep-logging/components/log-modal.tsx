import { X, Sun, Moon } from 'lucide-react';
import TimePicker from 'react-time-picker';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import { SleepEvent } from '@/lib/firebase-messaging';
import { UniversalSkeleton } from '@/components/shared/UniversalSkeleton';
import { useLogModal } from '@/hooks/use-log-modal';

export function LogModal() {
  const {
    user,
    isLoading,
    sleepType,
    setSleepType,
    events,
    currentTime,
    currentDate,
    setCurrentDate,
    isInitialMount,
    isInitialLoading,
    isExiting,
    validationWarning,
    setValidationWarning,
    isButtonDisabled,
    canSave,
    selectedEventType,
    setSelectedEventType,
    getQuestionText,
    getEventTypeText,
    getEventTypeOptions,
    getCurrentEventType,
    getModalRelativeDateText,
    formatTimeForPicker,
    formatTimeForDisplay,
    validateTimeInput,
    handleTimeChange,
    handleSave,
    handleCancel,
  } = useLogModal();

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
              <LogFirstScreen
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
              <LogSubsequentScreen
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
                _selectedEventType={selectedEventType}
                setSelectedEventType={setSelectedEventType}
              />
            )}
          </div>

          {/* Bottom actions - now inside modal */}
          <LogModalActions
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
  validateTimeInput: (timestamp: Date, isFirstEvent?: boolean) => any;
  setValidationWarning: (warning: any) => void;
  events: Array<{ type: SleepEvent["type"]; timestamp: Date }>;
}

function LogFirstScreen({
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

// Subsequent Screen Component: Time Input with Event Type Selection
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

function LogSubsequentScreen({
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

// Modal Actions Component: Bottom button area with validation warnings
interface LogModalActionsProps {
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

function LogModalActions({
  user,
  validationWarning,
  setValidationWarning,
  handleSave,
  canSave,
  isLoading,
  isButtonDisabled,
}: LogModalActionsProps) {
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