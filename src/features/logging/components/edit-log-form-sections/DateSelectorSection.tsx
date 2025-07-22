import { ChevronLeft, ChevronRight } from 'lucide-react';
import { User } from '@/lib/firebase/types';

interface DateSelectorSectionProps {
  currentDate: Date;
  user: User | null;
  onDateChange: (direction: "prev" | "next") => void;
  formatDateForSelector: (date: Date) => string;
}

export function DateSelectorSection({
  currentDate,
  user,
  onDateChange,
  formatDateForSelector
}: DateSelectorSectionProps) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => onDateChange("prev")}
          className={`p-2 rounded-lg transition-colors ${
            user?.darkMode
              ? "text-gray-300 hover:bg-gray-800"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div
          className={`text-lg font-medium ${
            user?.darkMode ? "text-white" : "text-gray-800"
          }`}
        >
          {formatDateForSelector(currentDate)}
        </div>

        <button
          onClick={() => onDateChange("next")}
          className={`p-2 rounded-lg transition-colors ${
            user?.darkMode
              ? "text-gray-300 hover:bg-gray-800"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}