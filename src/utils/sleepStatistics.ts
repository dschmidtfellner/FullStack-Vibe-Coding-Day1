import { SleepLog } from '@/lib/firebase/types';

export interface SleepStatistics {
  totalDuration: string; // "Xh Ym" format
  timeRange: string; // "[Start]-[Latest]" format
  totalTimeAsleep: string; // "Xh Ym" format
  totalTimeAwakeInBed: string; // "Xh Ym" format
  numberOfWakeUps: number;
  averageWakeUpDuration: string; // "X minutes" format
}

/**
 * Calculate comprehensive sleep statistics for Sleep Consulting children
 * Based on the assumptions:
 * - First log is always "Put In Bed" 
 * - Second log is always "Fell Asleep"
 * - Last log is always "Out of Bed"
 * - Time asleep = segments starting with "Fell Asleep"
 * - Time awake = segments starting with "Woke Up" OR "Put In Bed"
 * - Children are assumed awake when put in bed until they log "Fell Asleep"
 */
export function calculateSleepStatistics(log: SleepLog): SleepStatistics {
  if (!log.events || log.events.length === 0) {
    return {
      totalDuration: "0h 0m",
      timeRange: "",
      totalTimeAsleep: "0h 0m",
      totalTimeAwakeInBed: "0h 0m",
      numberOfWakeUps: 0,
      averageWakeUpDuration: "0 minutes"
    };
  }

  // Sort events by timestamp
  const sortedEvents = [...log.events].sort((a, b) => 
    a.childLocalTimestamp.toDate().getTime() - b.childLocalTimestamp.toDate().getTime()
  );

  // Calculate overall duration and time range
  const firstEvent = sortedEvents[0];
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  const startTime = firstEvent.childLocalTimestamp.toDate();
  const endTime = lastEvent.childLocalTimestamp.toDate();
  
  const totalDurationMs = endTime.getTime() - startTime.getTime();
  const totalDuration = formatDuration(totalDurationMs);
  
  const timeRange = `${formatTimeRange(startTime)}-${formatTimeRange(endTime)}`;

  // Calculate time asleep and awake using segment-based approach
  let totalAsleepMs = 0;
  let totalAwakeMs = 0;
  let numberOfWakeUps = 0;
  let totalWakeUpDurationMs = 0;

  // Process events in pairs to create segments
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const currentEvent = sortedEvents[i];
    const nextEvent = sortedEvents[i + 1];
    
    const segmentStartTime = currentEvent.childLocalTimestamp.toDate();
    const segmentEndTime = nextEvent.childLocalTimestamp.toDate();
    const segmentDurationMs = segmentEndTime.getTime() - segmentStartTime.getTime();

    // Classify segment based on starting event type
    switch (currentEvent.type) {
      case 'fell_asleep':
        // Time asleep = segments starting with "Fell Asleep"
        totalAsleepMs += segmentDurationMs;
        break;
      
      case 'put_in_bed':
      case 'woke_up':
        // Time awake = segments starting with "Woke Up" OR "Put In Bed"
        totalAwakeMs += segmentDurationMs;
        
        // Count wake-ups and their durations
        if (currentEvent.type === 'woke_up') {
          numberOfWakeUps++;
          totalWakeUpDurationMs += segmentDurationMs;
        }
        break;
    }
  }

  const totalTimeAsleep = formatDuration(totalAsleepMs);
  const totalTimeAwakeInBed = formatDuration(totalAwakeMs);
  
  // Calculate average wake-up duration
  const averageWakeUpDuration = numberOfWakeUps > 0 
    ? Math.round(totalWakeUpDurationMs / numberOfWakeUps / (1000 * 60)) // Convert to minutes
    : 0;

  return {
    totalDuration,
    timeRange,
    totalTimeAsleep,
    totalTimeAwakeInBed,
    numberOfWakeUps,
    averageWakeUpDuration: `${averageWakeUpDuration} minutes`
  };
}

/**
 * Format duration in milliseconds to "Xh Ym" format
 */
function formatDuration(durationMs: number): string {
  const totalMinutes = Math.round(durationMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

/**
 * Format time for time range display (e.g., "7:30pm")
 */
function formatTimeRange(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).toLowerCase();
}