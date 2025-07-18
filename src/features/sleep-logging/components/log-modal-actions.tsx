import { ValidationWarning } from '@/hooks/use-log-modal';

interface LogModalActionsProps {
  user: any;
  validationWarning: ValidationWarning | null;
  setValidationWarning: (warning: ValidationWarning | null) => void;
  handleSave: (skipValidation?: boolean) => Promise<void>;
  canSave: boolean;
  isLoading: boolean;
  isButtonDisabled: boolean;
}

export function LogModalActions({
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