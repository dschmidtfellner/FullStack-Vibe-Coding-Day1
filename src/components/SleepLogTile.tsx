import { MessageCircle } from "lucide-react";
import { SleepLog } from "@/lib/firebase-messaging";

interface SleepLogTileProps {
  log: SleepLog;
  user: any; // Use the same user type as in the main component
  napNumber?: number; // Optional nap number for display
  onClick?: () => void; // Optional click handler for tile
  onContinueLogging?: () => void; // Handler for Continue Logging button
  formatTimeInTimezone: (timestamp: any) => string; // Time formatting function
  showClickable?: boolean; // Whether the tile should be clickable
}

export function SleepLogTile({
  log,
  user,
  napNumber,
  onClick,
  onContinueLogging,
  formatTimeInTimezone,
  showClickable = true,
}: SleepLogTileProps) {
  // Get time range for log display (e.g., "11:45 am—1:50 pm")
  const getTimeRange = () => {
    if (!log.events || log.events.length === 0) {
      return formatTimeInTimezone(log.timestamp);
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
    if (log.sleepType === 'bedtime') return 'Bedtime';
    if (log.sleepType === 'nap') {
      return napNumber ? `Nap ${napNumber}` : 'Nap';
    }
    return 'Sleep';
  };

  const tileContent = (
    <div className="flex justify-between items-center">
      <div className="flex-1">
        {/* Time range - smaller purple text */}
        <div className="text-sm mb-1" style={{
          color: '#745288'
        }}>
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
            className="px-4 py-2 rounded-full font-karla transition-colors bg-[#503460] text-white hover:bg-[#5d3e70]"
            style={{
              fontSize: '14px',
              fontWeight: '400'
            }}
          >
            Continue Logging
          </button>
        )}
        
        {/* Comment indicator - far right */}
        {log.commentCount > 0 && (
          <div className={`flex items-center gap-1 ${
            user?.darkMode ? 'text-white' : 'text-gray-700'
          }`}>
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">{log.commentCount}</span>
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
    }`}>
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