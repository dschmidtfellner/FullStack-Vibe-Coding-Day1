import * as admin from "firebase-admin";
import { EventContext, Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";

interface SleepLog {
  id: string;
  childId: string;
  logType: string;
  localDate: string;
  childTimezone: string;
  sleepType?: 'nap' | 'bedtime';
  events?: Array<{
    childLocalTimestamp: admin.firestore.Timestamp;
    type: 'put_in_bed' | 'fell_asleep' | 'woke_up' | 'out_of_bed';
  }>;
}

interface DailySleepStats {
  id: string;
  childId: string;
  date: string;
  timezone: string;
  timeAsleep: string;
  timeAwakeInBed: string;
  longestSleepStretch: string;
  numberOfWakeUps: number;
  timeToFallAsleep: string;
  averageWakeUpLength: string;
  lastUpdated: admin.firestore.Timestamp;
  sourceLogIds: string[];
  calculationVersion: number;
}

/**
 * Handle sleep log changes and recalculate daily statistics
 */
export async function handleSleepLogChange(
  change: Change<DocumentSnapshot>,
  context: EventContext,
  db: admin.firestore.Firestore
): Promise<void> {
  const logBefore = change.before.exists ? change.before.data() as SleepLog : null;
  const logAfter = change.after.exists ? change.after.data() as SleepLog : null;
  
  // Determine which dates need recalculation
  const datesToRecalculate = new Set<string>();
  
  // If log was deleted or changed
  if (logBefore && logBefore.logType === 'sleep' && logBefore.localDate) {
    datesToRecalculate.add(logBefore.localDate);
    
    // Check if it was a bedtime that might affect next day
    if (logBefore.sleepType === 'bedtime' && logSpansMultipleDates(logBefore)) {
      const nextDate = getNextDate(logBefore.localDate);
      datesToRecalculate.add(nextDate);
    }
  }
  
  // If log was created or updated
  if (logAfter && logAfter.logType === 'sleep' && logAfter.localDate) {
    datesToRecalculate.add(logAfter.localDate);
    
    // Check if it's a bedtime that might affect next day
    if (logAfter.sleepType === 'bedtime' && logSpansMultipleDates(logAfter)) {
      const nextDate = getNextDate(logAfter.localDate);
      datesToRecalculate.add(nextDate);
    }
  }
  
  // Recalculate stats for affected dates
  const childId = logAfter?.childId || logBefore?.childId;
  const timezone = logAfter?.childTimezone || logBefore?.childTimezone;
  
  if (childId && timezone) {
    const promises = Array.from(datesToRecalculate).map(date => 
      recalculateDailyStats(db, childId, date, timezone)
    );
    
    await Promise.all(promises);
  }
}

/**
 * Recalculate daily sleep statistics for a specific date
 */
export async function recalculateDailyStats(
  db: admin.firestore.Firestore,
  childId: string,
  date: string,
  timezone: string
): Promise<void> {
  console.log(`Recalculating daily stats for child ${childId} on ${date}`);
  
  try {
    // Query all sleep logs that started on this date
    const logsSnapshot = await db.collection('logs')
      .where('childId', '==', childId)
      .where('localDate', '==', date)
      .where('logType', '==', 'sleep')
      .get();
    
    const logs = logsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as SleepLog));
    
    // Calculate aggregated statistics
    const stats = calculateAggregatedStats(logs, childId, date, timezone);
    
    // Save to daily_sleep_stats collection
    const statsId = `child_${childId}_date_${date}`;
    await db.collection('daily_sleep_stats').doc(statsId).set(stats);
    
    console.log(`Successfully updated daily stats for ${statsId}`);
  } catch (error) {
    console.error(`Error recalculating stats for child ${childId} on ${date}:`, error);
    throw error;
  }
}

/**
 * Calculate aggregated statistics from multiple sleep logs
 */
function calculateAggregatedStats(
  logs: SleepLog[],
  childId: string,
  date: string,
  timezone: string
): DailySleepStats {
  // If no logs, return empty stats
  if (logs.length === 0) {
    return createEmptyStats(childId, date, timezone);
  }
  
  // Aggregate metrics
  let totalAsleepMs = 0;
  let totalAwakeInBedMs = 0;
  let longestSleepStretchMs = 0;
  let totalWakeUps = 0;
  let totalWakeUpDurationMs = 0;
  let wakeUpCount = 0;
  let timeToFallAsleepMs: number | null = null;
  const sourceLogIds: string[] = [];
  
  for (const log of logs) {
    if (!log.events || log.events.length < 2) continue;
    
    sourceLogIds.push(log.id);
    
    // Calculate stats for this individual log
    const logStats = calculateSingleLogStats(log);
    
    totalAsleepMs += logStats.asleepMs;
    totalAwakeInBedMs += logStats.awakeMs;
    totalWakeUps += logStats.wakeUps;
    
    if (logStats.wakeUps > 0) {
      totalWakeUpDurationMs += logStats.wakeUpDurationMs;
      wakeUpCount += logStats.wakeUps;
    }
    
    // Track longest sleep stretch
    if (logStats.longestStretchMs > longestSleepStretchMs) {
      longestSleepStretchMs = logStats.longestStretchMs;
    }
    
    // Time to fall asleep (only from bedtime logs)
    if (log.sleepType === 'bedtime' && timeToFallAsleepMs === null) {
      const putInBed = log.events.find(e => e.type === 'put_in_bed');
      const fellAsleep = log.events.find(e => e.type === 'fell_asleep');
      
      if (putInBed && fellAsleep) {
        timeToFallAsleepMs = fellAsleep.childLocalTimestamp.toMillis() - 
                             putInBed.childLocalTimestamp.toMillis();
      }
    }
  }
  
  // Format results
  const statsId = `child_${childId}_date_${date}`;
  
  return {
    id: statsId,
    childId,
    date,
    timezone,
    timeAsleep: formatDuration(totalAsleepMs),
    timeAwakeInBed: formatDuration(totalAwakeInBedMs),
    longestSleepStretch: formatDuration(longestSleepStretchMs),
    numberOfWakeUps: totalWakeUps,
    timeToFallAsleep: timeToFallAsleepMs !== null 
      ? `${Math.round(timeToFallAsleepMs / (1000 * 60))}m`
      : '0m',
    averageWakeUpLength: wakeUpCount > 0
      ? formatDuration(Math.round(totalWakeUpDurationMs / wakeUpCount))
      : '0m',
    lastUpdated: admin.firestore.Timestamp.now(),
    sourceLogIds,
    calculationVersion: 1
  };
}

/**
 * Calculate statistics for a single sleep log
 */
function calculateSingleLogStats(log: SleepLog) {
  const events = [...log.events!].sort((a, b) => 
    a.childLocalTimestamp.toMillis() - b.childLocalTimestamp.toMillis()
  );
  
  let asleepMs = 0;
  let awakeMs = 0;
  let wakeUps = 0;
  let wakeUpDurationMs = 0;
  let longestStretchMs = 0;
  let currentStretchMs = 0;
  let stretchStart: number | null = null;
  
  // Process events in pairs to create segments
  for (let i = 0; i < events.length - 1; i++) {
    const current = events[i];
    const next = events[i + 1];
    const segmentMs = next.childLocalTimestamp.toMillis() - current.childLocalTimestamp.toMillis();
    
    switch (current.type) {
      case 'fell_asleep':
        asleepMs += segmentMs;
        if (stretchStart === null) {
          stretchStart = current.childLocalTimestamp.toMillis();
        }
        currentStretchMs += segmentMs;
        break;
        
      case 'put_in_bed':
      case 'woke_up':
        awakeMs += segmentMs;
        
        // End sleep stretch if we woke up
        if (current.type === 'woke_up' && stretchStart !== null) {
          if (currentStretchMs > longestStretchMs) {
            longestStretchMs = currentStretchMs;
          }
          stretchStart = null;
          currentStretchMs = 0;
          
          wakeUps++;
          wakeUpDurationMs += segmentMs;
        }
        break;
    }
  }
  
  // Check final stretch
  if (currentStretchMs > longestStretchMs) {
    longestStretchMs = currentStretchMs;
  }
  
  return {
    asleepMs,
    awakeMs,
    wakeUps,
    wakeUpDurationMs,
    longestStretchMs
  };
}

/**
 * Manual recalculation function for data fixes
 */
export async function manualRecalculateStats(
  data: { childId: string; startDate: string; endDate: string },
  db: admin.firestore.Firestore
): Promise<{ success: boolean; message: string; datesProcessed: number }> {
  const { childId, startDate, endDate } = data;
  
  if (!childId || !startDate || !endDate) {
    throw new Error('Missing required parameters: childId, startDate, endDate');
  }
  
  console.log(`Manual recalculation requested for child ${childId} from ${startDate} to ${endDate}`);
  
  try {
    // Get child's timezone from a recent log
    const recentLog = await db.collection('logs')
      .where('childId', '==', childId)
      .where('logType', '==', 'sleep')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (recentLog.empty) {
      return {
        success: false,
        message: 'No sleep logs found for this child',
        datesProcessed: 0
      };
    }
    
    const timezone = recentLog.docs[0].data().childTimezone;
    
    // Generate list of dates to process
    const dates = getDatesInRange(startDate, endDate);
    
    // Process each date
    const promises = dates.map(date => 
      recalculateDailyStats(db, childId, date, timezone)
    );
    
    await Promise.all(promises);
    
    return {
      success: true,
      message: `Successfully recalculated stats for ${dates.length} dates`,
      datesProcessed: dates.length
    };
  } catch (error: any) {
    console.error('Error in manual recalculation:', error);
    throw new Error(`Manual recalculation failed: ${error.message}`);
  }
}

// Helper functions

function logSpansMultipleDates(log: SleepLog): boolean {
  if (!log.events || log.events.length < 2) return false;
  
  const firstEvent = log.events[0];
  const lastEvent = log.events[log.events.length - 1];
  
  const firstDate = firstEvent.childLocalTimestamp.toDate();
  const lastDate = lastEvent.childLocalTimestamp.toDate();
  
  return firstDate.getDate() !== lastDate.getDate() ||
         firstDate.getMonth() !== lastDate.getMonth() ||
         firstDate.getFullYear() !== lastDate.getFullYear();
}

function getNextDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + 1);
  
  return formatDateString(date);
}

function formatDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  
  const current = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  
  while (current <= end) {
    dates.push(formatDateString(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / (1000 * 60));
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

function createEmptyStats(childId: string, date: string, timezone: string): DailySleepStats {
  const statsId = `child_${childId}_date_${date}`;
  
  return {
    id: statsId,
    childId,
    date,
    timezone,
    timeAsleep: '0h 0m',
    timeAwakeInBed: '0h 0m',
    longestSleepStretch: '0h 0m',
    numberOfWakeUps: 0,
    timeToFallAsleep: '0m',
    averageWakeUpLength: '0m',
    lastUpdated: admin.firestore.Timestamp.now(),
    sourceLogIds: [],
    calculationVersion: 1
  };
}