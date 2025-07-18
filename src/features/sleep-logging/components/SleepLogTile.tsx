import { MessageSquare } from "lucide-react";
import { SleepLog } from "@/lib/firebase-messaging";

interface SleepLogTileProps {
  log: SleepLog;
  user: any; // Use the same user type as in the main component
  napNumber?: number; // Optional nap number for display
  onClick?: () => void; // Optional click handler for tile
  onContinueLogging?: () => void; // Handler for Continue Logging button
  formatTimeInTimezone?: (timestamp: any) => string; // Time formatting function
  showClickable?: boolean; // Whether the tile should be clickable
  isNightBefore?: boolean; // Whether this is a previous night's bedtime
  nightBeforeEndTime?: string; // End time for night before display
  unreadCount?: number; // Number of unread comments for this log
}

export function SleepLogTile({
  log,
  user,
  napNumber,
  onClick,
  onContinueLogging,
  // formatTimeInTimezone = () => '',
  showClickable = true,
  isNightBefore = false,
  nightBeforeEndTime = '',
  unreadCount = 0,
}: SleepLogTileProps) {
  // Get time range for log display (e.g., "11:45 am—1:50 pm") or night before subtitle
  const getTimeRange = () => {
    // If it's a night before display, show the subtitle instead
    if (isNightBefore) {
      return `Night before—${nightBeforeEndTime || ''}`;
    }

    if (!log.events || log.events.length === 0) {
      return 'No events';
    }

    const firstEvent = log.events[0];
    const lastEvent = log.events[log.events.length - 1];
    
    if (log.events.length === 1 || !log.isComplete) {
      return firstEvent.localTime;
    }

    return `${firstEvent.localTime}—${lastEvent.localTime}`;
  };

  // Get display name for the log type
  const getLogDisplayName = () => {
    if (isNightBefore) {
      return 'Bedtime';
    }
    if (log.sleepType === 'bedtime') return 'Bedtime';
    if (log.sleepType === 'nap') {
      return napNumber ? `Nap ${napNumber}` : 'Nap';
    }
    return 'Sleep';
  };

  // No separate subtitle needed anymore - integrated into getTimeRange

  const tileContent = (
    <div className="flex justify-between items-center">
      <div className="flex-1">
        {/* Time range - Poppins 16px */}
        <div 
          className="font-poppins mb-1 text-[#745288]"
          style={{ 
            fontSize: '16px',
            fontWeight: '400',
            lineHeight: '1.2'
          }}
        >
          {getTimeRange()}
        </div>
        
        {/* Log type with number - Domine font, size 22, weight 400 */}
        <div 
          className={`font-domine ${user?.darkMode ? 'text-white' : 'text-gray-900'}`}
          style={{ 
            fontSize: '22px',
            fontWeight: '400',
            lineHeight: '1.2'
          }}
        >
          {getLogDisplayName()}
        </div>
        
      </div>
      
      <div className="flex items-center gap-3 ml-4">
        {/* Continue Logging button - only show if log is not complete */}
        {!log.isComplete && onContinueLogging && (
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent tile click
              onContinueLogging();
            }}
            className={`px-4 py-2 rounded-full transition-colors bg-[#503460] text-white hover:bg-[#5d3e70] ${isNightBefore ? 'opacity-100' : ''}`}
            style={{
              fontSize: '14px',
              fontWeight: '400'
            }}
          >
            Continue
          </button>
        )}
        
        {/* Comment indicator - far right */}
        {unreadCount > 0 && (
          <div className="flex items-center gap-1 text-[#4b355e]">
            <MessageSquare className="w-4 h-4 fill-current" />
            <span 
              className="font-poppins"
              style={{ 
                fontSize: '16px',
                fontWeight: '400'
              }}
            >
              {unreadCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={`p-4 rounded-2xl relative ${
      user?.darkMode 
        ? 'bg-[#4a3f5a]' 
        : 'bg-[#F0DDEF]'  // Purple background for all logs
    } ${isNightBefore ? 'opacity-50' : ''}`}>
      
      {showClickable && onClick ? (
        <div 
          onClick={onClick}
          className="cursor-pointer transition-all hover:opacity-90"
        >
          {tileContent}
        </div>
      ) : (
        tileContent
      )}
    </div>
  );
}