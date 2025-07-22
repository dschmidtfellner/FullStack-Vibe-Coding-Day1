import {
  doc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from './core';
import { UnreadCounters } from './types';

/**
 * Listen to unread counters for a specific user/child combination
 */
export function listenToUnreadCounters(
  userId: string,
  childId: string,
  callback: (counters: UnreadCounters) => void
) {
  const counterId = `user_${userId}_child_${childId}`;
  const counterRef = doc(db, 'unread_counters', counterId);
  
  return onSnapshot(counterRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data() as UnreadCounters;
      callback(data);
    } else {
      // Initialize counters if they don't exist
      const defaultCounters = {
        id: counterId,
        userId,
        childId,
        chatUnreadCount: 0,
        logUnreadCount: 0,
        logUnreadByLogId: {},
        totalUnreadCount: 0,
        lastUpdated: Timestamp.now()
      };
      callback(defaultCounters);
    }
  }, (error) => {
    console.error('Error listening to unread counters:', error);
    // Return zero counts on error
    const errorCounters = {
      id: counterId,
      userId,
      childId,
      chatUnreadCount: 0,
      logUnreadCount: 0,
      logUnreadByLogId: {},
      totalUnreadCount: 0,
      lastUpdated: Timestamp.now()
    };
    callback(errorCounters);
  });
}

/**
 * Mark all chat messages as read for a user
 */
export async function markChatMessagesAsRead(
  userId: string,
  childId: string,
  conversationId: string
) {
  try {
    // Call the Cloud Function
    const response = await fetch(`${import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://us-central1-doulaconnect-messaging.cloudfunctions.net'}/markChatAsRead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, childId, conversationId }),
    });

    if (!response.ok) {
      throw new Error('Failed to mark chat messages as read');
    }

    const result = await response.json();
    console.log('Chat messages marked as read:', result);
    return result;
  } catch (error) {
    console.error('Error marking chat messages as read:', error);
    throw error;
  }
}

/**
 * Mark all log comments as read for a specific log
 */
export async function markLogCommentsAsRead(
  userId: string,
  childId: string,
  logId: string
) {
  try {
    // Call the Cloud Function
    const response = await fetch(`${import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://us-central1-doulaconnect-messaging.cloudfunctions.net'}/markLogAsRead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, childId, logId }),
    });

    if (!response.ok) {
      throw new Error('Failed to mark log comments as read');
    }

    const result = await response.json();
    console.log('Log comments marked as read:', result);
    return result;
  } catch (error) {
    console.error('Error marking log comments as read:', error);
    throw error;
  }
}

/**
 * Mark all log comments as read across all logs
 */
export async function markAllLogCommentsAsRead(
  userId: string,
  childId: string
) {
  try {
    // Call the Cloud Function
    const response = await fetch(`${import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://us-central1-doulaconnect-messaging.cloudfunctions.net'}/markAllLogsAsRead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, childId }),
    });

    if (!response.ok) {
      throw new Error('Failed to mark all log comments as read');
    }

    const result = await response.json();
    console.log('All log comments marked as read:', result);
    return result;
  } catch (error) {
    console.error('Error marking all log comments as read:', error);
    throw error;
  }
}