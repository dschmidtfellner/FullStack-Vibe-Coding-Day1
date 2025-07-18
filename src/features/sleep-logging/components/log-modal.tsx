import { X } from 'lucide-react';
import 'react-time-picker/dist/TimePicker.css';
import 'react-clock/dist/Clock.css';
import { UniversalSkeleton } from '@/components/shared/UniversalSkeleton';
import { useLogModal } from '@/hooks/use-log-modal';
import { LogFirstScreen } from './log-first-screen';
import { LogSubsequentScreen } from './log-subsequent-screen';
import { LogModalActions } from './log-modal-actions';

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



