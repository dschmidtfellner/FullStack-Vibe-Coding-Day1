import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  onSnapshot, 
  serverTimestamp, 
  arrayUnion, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './core';
import { SleepEvent, SleepLog } from './types';
import { 
  toChildLocalTime, 
  formatLocalDate, 
  formatLocalTime 
} from './timezone-utils';

/**
 * Create a new sleep log
 */
export async function createSleepLog(
  childId: string,
  userId: string,
  userName: string,
  sleepType: 'nap' | 'bedtime',
  initialEvent: { type: SleepEvent['type']; timestamp: Date },
  timezone: string
): Promise<string> {
  try {
    console.log('Creating sleep log:', { childId, userId, userName, sleepType, initialEvent, timezone });
    
    // Convert event timestamp to Child Local Time
    const childLocalTime = toChildLocalTime(initialEvent.timestamp, timezone);
    const childLocalTimestamp = Timestamp.fromDate(childLocalTime);
    
    const sleepEvent: SleepEvent = {
      childLocalTimestamp,
      originalTimezone: timezone,
      type: initialEvent.type,
      localTime: formatLocalTime(childLocalTime, 'UTC') // Since it's already in child local time
    };
    
    const logData: Omit<SleepLog, 'id'> = {
      childId,
      userId,
      userName,
      logType: 'sleep',
      childTimezone: timezone,
      sleepType,
      events: [sleepEvent],
      isComplete: false,
      localDate: formatLocalDate(childLocalTime, 'UTC'), // Use child local time for date
      sortTimestamp: childLocalTime.getTime(),
      createdAt: serverTimestamp() as any,
      updatedAt: serverTimestamp() as any,
      commentCount: 0,
    };
    
    console.log('Adding sleep log to Firestore:', logData);
    const logRef = await addDoc(collection(db, 'logs'), logData);
    console.log('Sleep log created successfully:', logRef.id);
    
    return logRef.id;
  } catch (error) {
    console.error('Error creating sleep log:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Add an event to an existing sleep log
 */
export async function addSleepEvent(
  logId: string,
  event: { type: SleepEvent['type']; timestamp: Date },
  timezone: string,
  isComplete?: boolean
): Promise<void> {
  try {
    console.log('Adding sleep event:', { logId, event, timezone, isComplete });
    
    const logRef = doc(db, 'logs', logId);
    const logDoc = await getDoc(logRef);
    
    if (!logDoc.exists()) {
      throw new Error('Sleep log not found');
    }
    
    // Convert event timestamp to Child Local Time
    const childLocalTime = toChildLocalTime(event.timestamp, timezone);
    const childLocalTimestamp = Timestamp.fromDate(childLocalTime);
    
    const sleepEvent: SleepEvent = {
      childLocalTimestamp,
      originalTimezone: timezone,
      type: event.type,
      localTime: formatLocalTime(childLocalTime, 'UTC') // Since it's already in child local time
    };
    
    const updateData: any = {
      events: arrayUnion(sleepEvent),
      updatedAt: serverTimestamp(),
    };
    
    if (isComplete !== undefined) {
      updateData.isComplete = isComplete;
    }
    
    await updateDoc(logRef, updateData);
    console.log('Sleep event added successfully');
  } catch (error) {
    console.error('Error adding sleep event:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Update an entire sleep log (for editing)
 */
export async function updateSleepLog(
  logId: string,
  events: { type: SleepEvent['type']; timestamp: Date }[],
  timezone: string,
  isComplete: boolean
): Promise<void> {
  try {
    console.log('Updating sleep log:', { logId, events, timezone, isComplete });
    
    const sleepEvents: SleepEvent[] = events.map(event => {
      const childLocalTime = toChildLocalTime(event.timestamp, timezone);
      return {
        childLocalTimestamp: Timestamp.fromDate(childLocalTime),
        originalTimezone: timezone,
        type: event.type,
        localTime: formatLocalTime(childLocalTime, 'UTC') // Since it's already in child local time
      };
    });
    
    // Calculate duration if log is complete
    const updateData: any = {
      events: sleepEvents,
      isComplete,
      updatedAt: serverTimestamp(),
    };
    
    // Only include duration if log is complete
    if (isComplete && sleepEvents.length >= 2) {
      const sleepPeriods = calculateSleepDuration(sleepEvents);
      updateData.duration = sleepPeriods.totalSleepMinutes;
    }
    
    const logRef = doc(db, 'logs', logId);
    await updateDoc(logRef, updateData);
    
    console.log('Sleep log updated successfully');
  } catch (error) {
    console.error('Error updating sleep log:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Get a specific log by ID
 */
export async function getLog(logId: string): Promise<SleepLog | null> {
  try {
    const logRef = doc(db, 'logs', logId);
    const logDoc = await getDoc(logRef);
    
    if (!logDoc.exists()) {
      return null;
    }
    
    return {
      id: logDoc.id,
      ...logDoc.data(),
    } as SleepLog;
  } catch (error) {
    console.error('Error getting log:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Listen to logs for a specific child with pagination
 */
export function listenToLogs(
  childId: string,
  callback: (logs: SleepLog[]) => void,
  limitCount: number = 20,
  lastVisible?: any
) {
  // Commented out to reduce console noise
  // if (import.meta.env.DEV) {
  //   console.log('Setting up logs listener:', { childId, limitCount });
  // }
  
  let q = query(
    collection(db, 'logs'),
    where('childId', '==', childId),
    orderBy('sortTimestamp', 'desc'),
    limit(limitCount)
  );
  
  if (lastVisible) {
    q = query(
      collection(db, 'logs'),
      where('childId', '==', childId),
      orderBy('sortTimestamp', 'desc'),
      startAfter(lastVisible),
      limit(limitCount)
    );
  }

  return onSnapshot(q, (snapshot) => {
    // Commented out to reduce console noise
    // if (import.meta.env.DEV) {
    //   console.log('Logs snapshot received:', snapshot.docs.length, 'logs');
    // }
    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as SleepLog[];
    
    callback(logs);
  }, (error) => {
    console.error('Error listening to logs:', error);
  });
}

/**
 * Calculate sleep duration from events
 */
export function calculateSleepDuration(events: SleepEvent[]): {
  totalSleepMinutes: number;
  totalAwakeMinutes: number;
} {
  if (events.length < 2) {
    return { totalSleepMinutes: 0, totalAwakeMinutes: 0 };
  }
  
  // Sort events by childLocalTimestamp
  const sortedEvents = [...events].sort((a, b) => 
    a.childLocalTimestamp.toDate().getTime() - b.childLocalTimestamp.toDate().getTime()
  );
  
  let totalSleepMs = 0;
  let totalAwakeMs = 0;
  let currentState: 'asleep' | 'awake' | 'out' = 'out';
  let stateStartTime: Date | null = null;
  
  for (const event of sortedEvents) {
    const eventTime = event.childLocalTimestamp.toDate();
    
    if (stateStartTime && currentState !== 'out') {
      const duration = eventTime.getTime() - stateStartTime.getTime();
      if (currentState === 'asleep') {
        totalSleepMs += duration;
      } else if (currentState === 'awake') {
        totalAwakeMs += duration;
      }
    }
    
    // Update state based on event type
    switch (event.type) {
      case 'put_in_bed':
        currentState = 'awake';
        stateStartTime = eventTime;
        break;
      case 'fell_asleep':
        currentState = 'asleep';
        stateStartTime = eventTime;
        break;
      case 'woke_up':
        currentState = 'awake';
        stateStartTime = eventTime;
        break;
      case 'out_of_bed':
        currentState = 'out';
        stateStartTime = null;
        break;
    }
  }
  
  return {
    totalSleepMinutes: Math.round(totalSleepMs / (1000 * 60)),
    totalAwakeMinutes: Math.round(totalAwakeMs / (1000 * 60)),
  };
}