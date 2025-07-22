import {
  collection,
  doc,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  setDoc,
  getDoc,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { FirebaseMessage, UnreadCounters } from '@/types/firebase';
import { 
  toChildLocalTime, 
  fromChildLocalTime, 
  getChildNow, 
  getChildStartOfDay, 
  getChildEndOfDay
} from './firebase/timezone-utils';
import { uploadFile } from './firebase/storage';
import { getAppVersion, ensureUser, getOrCreateConversation } from './firebase/auth';
import { 
  createSleepLog, 
  addSleepEvent, 
  updateSleepLog, 
  getLog, 
  listenToLogs, 
  calculateSleepDuration 
} from './firebase/sleep-logging';
import {
  sendLogComment,
  sendLogImageComment,
  sendLogAudioComment,
  updateLogCommentCount,
  listenToLogComments
} from './firebase/log-comments';

// Re-export utilities for backward compatibility during migration
export { 
  toChildLocalTime, 
  fromChildLocalTime, 
  getChildNow, 
  getChildStartOfDay, 
  getChildEndOfDay,
  uploadFile,
  getAppVersion,
  ensureUser,
  getOrCreateConversation,
  createSleepLog,
  addSleepEvent,
  updateSleepLog,
  getLog,
  listenToLogs,
  calculateSleepDuration,
  sendLogComment,
  sendLogImageComment,
  sendLogAudioComment,
  updateLogCommentCount,
  listenToLogComments
};


/**
 * Update conversation with last message info
 */
async function updateConversationLastMessage(conversationId: string, lastMessage: string, timestamp: any) {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      lastMessage,
      lastMessageTimestamp: timestamp,
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    // Don't throw - this is not critical for message sending
  }
}



/**
 * Send a text message
 */
export async function sendMessage(
  senderId: string,
  senderName: string,
  text: string,
  conversationId: string,
  childId: string
) {
  try {
    if (import.meta.env.DEV) {
      console.log('Firebase sendMessage called with:', { senderId, senderName, text: text.substring(0, 50), conversationId, childId });
    }
    
    const messageData = {
      text,
      senderId,
      senderName,
      conversationId,
      childId,
      type: 'text',
      timestamp: serverTimestamp(),
      read: false,
      appVersion: getAppVersion(),
    };
    
    const messageRef = await addDoc(collection(db, 'messages'), messageData);
    if (import.meta.env.DEV) {
      console.log('Message sent successfully with ID:', messageRef.id);
    }

    // Update conversation with last message info
    await updateConversationLastMessage(conversationId, text, serverTimestamp());

    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}


/**
 * Send an image message
 */
export async function sendImageMessage(
  senderId: string,
  senderName: string,
  imageFile: File,
  conversationId: string,
  childId: string
) {
  try {
    console.log('sendImageMessage called with:', {
      senderId,
      senderName,
      fileName: imageFile.name,
      fileSize: imageFile.size,
      conversationId,
      childId
    });
    
    // Upload image to Firebase Storage
    console.log('Uploading image to Firebase Storage...');
    const imageUrl = await uploadFile(imageFile, 'images');
    console.log('Image uploaded, URL:', imageUrl);
    
    // Send message with image
    console.log('Creating message document in Firestore...');
    const messageData = {
      senderId,
      senderName,
      conversationId,
      childId,
      type: 'image',
      imageId: imageUrl, // Store the download URL directly
      timestamp: serverTimestamp(),
      read: false,
      appVersion: getAppVersion(),
    };
    
    const messageRef = await addDoc(collection(db, 'messages'), messageData);
    console.log('Image message created successfully:', messageRef.id);

    // Update conversation with last message info
    await updateConversationLastMessage(conversationId, '📷 Image', serverTimestamp());

    return messageRef.id;
  } catch (error) {
    console.error('Error sending image message:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Send an audio message
 */
export async function sendAudioMessage(
  senderId: string,
  senderName: string,
  audioBlob: Blob,
  conversationId: string,
  childId: string
) {
  try {
    // Convert blob to file
    const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
      type: audioBlob.type
    });
    
    // Upload audio to Firebase Storage
    const audioUrl = await uploadFile(audioFile, 'audio');
    
    // Send message with audio
    const messageRef = await addDoc(collection(db, 'messages'), {
      senderId,
      senderName,
      conversationId,
      childId,
      type: 'audio',
      audioId: audioUrl, // Store the download URL directly
      timestamp: serverTimestamp(),
      read: false,
      appVersion: getAppVersion(),
    });

    // Update conversation with last message info
    await updateConversationLastMessage(conversationId, '🎵 Audio', serverTimestamp());

    return messageRef.id;
  } catch (error) {
    console.error('Error sending audio message:', error);
    throw error;
  }
}

/**
 * Listen to messages for a specific conversation
 */
export function listenToMessages(
  conversationId: string,
  callback: (messages: FirebaseMessage[]) => void
) {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'asc'), // Changed to ascending - oldest first
    limit(50) // Limit to last 50 messages
  );

  return onSnapshot(q, (snapshot) => {
    const allMessages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FirebaseMessage[];
    
    // Filter out log comments (messages with logId) from general chat
    const chatMessages = allMessages.filter(message => !message.logId);
    
    callback(chatMessages);
  });
}

/**
 * Set user typing status
 */
export async function setTypingStatus(userId: string, userName: string, isTyping: boolean) {
  try {
    const typingRef = doc(db, 'typing', userId);
    
    if (isTyping) {
      await setDoc(typingRef, {
        userId,
        userName,
        isTyping: true,
        lastTyped: serverTimestamp(),
      });
    } else {
      // Remove typing indicator when user stops typing
      await setDoc(typingRef, {
        userId,
        userName,
        isTyping: false,
        lastTyped: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error setting typing status:', error);
  }
}

/**
 * Listen to typing indicators
 */
export function listenToTypingIndicators(
  currentUserId: string,
  callback: (typingUsers: { userId: string; userName: string }[]) => void
) {
  const q = query(
    collection(db, 'typing'),
    where('isTyping', '==', true)
  );

  return onSnapshot(q, (snapshot) => {
    const typingUsers = snapshot.docs
      .map((doc) => ({
        userId: doc.data().userId,
        userName: doc.data().userName,
        lastTyped: doc.data().lastTyped,
      }))
      .filter((user) => user.userId !== currentUserId) // Exclude current user
      .filter((user) => {
        // Only show users who typed in the last 5 seconds
        const now = Date.now();
        const lastTyped = user.lastTyped?.toDate?.() || new Date(user.lastTyped);
        return now - lastTyped.getTime() < 5000;
      });
    
    callback(typingUsers);
  });
}

/**
 * Add or remove a reaction to a message
 */
export async function toggleMessageReaction(
  messageId: string,
  emoji: string,
  userId: string,
  userName: string
) {
  try {
    console.log('toggleMessageReaction called:', { messageId, emoji, userId, userName });
    
    const messageRef = doc(db, 'messages', messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (!messageDoc.exists()) {
      throw new Error('Message not found');
    }

    const messageData = messageDoc.data() as FirebaseMessage;
    const currentReactions = messageData.reactions || {};
    
    console.log('Current reactions:', currentReactions);

    // Get current reaction for this emoji
    const currentReaction = currentReactions[emoji];

    if (currentReaction) {
      console.log('Existing reaction found:', currentReaction);
      // Check if user already reacted with this emoji
      const userIndex = currentReaction.users.indexOf(userId);
      console.log('User index in reaction:', userIndex);
      
      if (userIndex > -1) {
        console.log('Removing user reaction');
        // User already reacted, remove their reaction
        const updatedUsers = currentReaction.users.filter(id => id !== userId);
        const updatedUserNames = currentReaction.userNames.filter(name => name !== userName);
        
        if (updatedUsers.length === 0) {
          console.log('No users left, removing entire reaction');
          // No users left with this reaction, remove the entire emoji reaction
          const { [emoji]: _removed, ...remainingReactions } = currentReactions;
          await updateDoc(messageRef, {
            reactions: remainingReactions
          });
        } else {
          console.log('Updating with remaining users:', updatedUsers);
          // Update with remaining users
          await updateDoc(messageRef, {
            [`reactions.${emoji}.users`]: updatedUsers,
            [`reactions.${emoji}.userNames`]: updatedUserNames
          });
        }
      } else {
        console.log('Adding user to existing reaction');
        // User hasn't reacted with this emoji, add their reaction
        await updateDoc(messageRef, {
          [`reactions.${emoji}.users`]: arrayUnion(userId),
          [`reactions.${emoji}.userNames`]: arrayUnion(userName)
        });
      }
    } else {
      console.log('Creating first reaction with this emoji');
      // First reaction with this emoji
      await updateDoc(messageRef, {
        [`reactions.${emoji}`]: {
          emoji,
          users: [userId],
          userNames: [userName]
        }
      });
    }
    
    console.log('Reaction toggle completed successfully');
  } catch (error) {
    console.error('Error toggling message reaction:', error);
    throw error;
  }
}

// =============================================================================
// LOG-RELATED FUNCTIONS
// =============================================================================

export interface SleepEvent {
  // Child Local Time fields (primary source of truth)
  childLocalTimestamp: Timestamp; // "fake UTC" - child's wall clock time stored as if UTC
  originalTimezone: string;       // timezone when event was recorded
  
  // Display fields
  type: 'put_in_bed' | 'fell_asleep' | 'woke_up' | 'out_of_bed';
  localTime: string; // HH:MM AM/PM for display (calculated from childLocalTimestamp)
}

export interface SleepLog {
  id: string;
  childId: string;
  userId: string;
  userName: string;
  logType: 'sleep' | 'feeding' | 'diaper' | 'pump' | 'note';
  
  // Child Local Time fields
  childTimezone: string; // Child's timezone for this log
  
  // Sleep-specific fields
  sleepType?: 'nap' | 'bedtime';
  events?: SleepEvent[];
  isComplete?: boolean;
  duration?: number; // Total sleep duration in minutes (calculated)
  
  // Common calculated fields
  localDate: string; // YYYY-MM-DD in child's timezone for queries
  sortTimestamp: number; // For efficient ordering (based on first event's childLocalTimestamp)
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentCount: number;
  lastCommentAt?: Timestamp;
}




// =============================================================================
// UNREAD COUNTER FUNCTIONS
// =============================================================================

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