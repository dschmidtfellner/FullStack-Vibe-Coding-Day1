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
  startAfter,
  Timestamp,
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  getStorage 
} from 'firebase/storage';
import { db } from './firebase';
import { FirebaseMessage } from '@/types/firebase';

const storage = getStorage();

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
 * Create or get conversation for a child
 */
export async function getOrCreateConversation(childId: string, childName?: string): Promise<string> {
  try {
    const conversationId = `child_${childId}`;
    const conversationRef = doc(db, 'conversations', conversationId);
    
    console.log('🔍 Attempting to read conversation:', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      // Create new conversation
      console.log('🔍 Creating new conversation:', conversationId);
      await setDoc(conversationRef, {
        id: conversationId,
        childId,
        childName: childName || `Child ${childId}`,
        participants: [], // Will be populated based on permissions
        participantNames: {},
        createdAt: serverTimestamp(),
      });
      if (import.meta.env.DEV) {
        console.log('Created new conversation:', conversationId);
      }
    }
    
    return conversationId;
  } catch (error) {
    console.error('Error creating/getting conversation:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Ensure user exists in Firebase
 */
export async function ensureUser(clerkUserId: string, name: string, email?: string) {
  try {
    const userRef = doc(db, 'users', clerkUserId);
    await setDoc(userRef, {
      id: clerkUserId,
      clerkId: clerkUserId,
      name,
      email: email || '',
      createdAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Error ensuring user:', error);
    throw error;
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
 * Upload file to Firebase Storage
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    if (import.meta.env.DEV) {
      console.log('Uploading file:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    }
    
    const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    if (import.meta.env.DEV) {
      console.log('File uploaded successfully');
    }
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
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
          const { [emoji]: removed, ...remainingReactions } = currentReactions;
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
  timestamp: Timestamp;
  type: 'put_in_bed' | 'fell_asleep' | 'woke_up' | 'out_of_bed';
  localTime: string; // HH:MM AM/PM in baby's timezone for display
}

export interface SleepLog {
  id: string;
  childId: string;
  userId: string;
  userName: string;
  logType: 'sleep' | 'feeding' | 'diaper' | 'pump' | 'note';
  timestamp: Timestamp; // UTC timestamp of log creation
  
  // Sleep-specific fields
  sleepType?: 'nap' | 'bedtime';
  events?: SleepEvent[];
  isComplete?: boolean;
  duration?: number; // Total sleep duration in minutes (calculated)
  
  // Common calculated fields
  localDate: string; // YYYY-MM-DD in baby's timezone for queries
  sortTimestamp: number; // For efficient ordering
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentCount: number;
  lastCommentAt?: Timestamp;
}

/**
 * Helper function to convert timezone and format local date
 */
function formatLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Helper function to format time in baby's timezone
 */
function formatLocalTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

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
    
    const now = new Date();
    const eventTimestamp = Timestamp.fromDate(initialEvent.timestamp);
    
    const sleepEvent: SleepEvent = {
      timestamp: eventTimestamp,
      type: initialEvent.type,
      localTime: formatLocalTime(initialEvent.timestamp, timezone)
    };
    
    const logData: Omit<SleepLog, 'id'> = {
      childId,
      userId,
      userName,
      logType: 'sleep',
      timestamp: Timestamp.fromDate(now),
      sleepType,
      events: [sleepEvent],
      isComplete: false,
      localDate: formatLocalDate(initialEvent.timestamp, timezone),
      sortTimestamp: initialEvent.timestamp.getTime(),
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
    
    const sleepEvent: SleepEvent = {
      timestamp: Timestamp.fromDate(event.timestamp),
      type: event.type,
      localTime: formatLocalTime(event.timestamp, timezone)
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
    
    const sleepEvents: SleepEvent[] = events.map(event => ({
      timestamp: Timestamp.fromDate(event.timestamp),
      type: event.type,
      localTime: formatLocalTime(event.timestamp, timezone)
    }));
    
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
 * Calculate sleep duration from events
 */
function calculateSleepDuration(events: SleepEvent[]): {
  totalSleepMinutes: number;
  totalAwakeMinutes: number;
} {
  if (events.length < 2) {
    return { totalSleepMinutes: 0, totalAwakeMinutes: 0 };
  }
  
  // Sort events by timestamp
  const sortedEvents = [...events].sort((a, b) => 
    a.timestamp.toDate().getTime() - b.timestamp.toDate().getTime()
  );
  
  let totalSleepMs = 0;
  let totalAwakeMs = 0;
  let currentState: 'asleep' | 'awake' | 'out' = 'out';
  let stateStartTime: Date | null = null;
  
  for (const event of sortedEvents) {
    const eventTime = event.timestamp.toDate();
    
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

/**
 * Listen to logs for a specific child with pagination
 */
export function listenToLogs(
  childId: string,
  callback: (logs: SleepLog[]) => void,
  limitCount: number = 20,
  lastVisible?: any
) {
  if (import.meta.env.DEV) {
    console.log('Setting up logs listener:', { childId, limitCount });
  }
  
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
    if (import.meta.env.DEV) {
      console.log('Logs snapshot received:', snapshot.docs.length, 'logs');
    }
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
 * Send a message with logId for log comments
 */
export async function sendLogComment(
  senderId: string,
  senderName: string,
  text: string,
  conversationId: string,
  childId: string,
  logId: string
) {
  try {
    console.log('Firebase sendLogComment called with:', { senderId, senderName, text, conversationId, childId, logId });
    
    const messageData = {
      text,
      senderId,
      senderName,
      conversationId,
      childId,
      logId, // Add logId for log comments
      type: 'text',
      timestamp: serverTimestamp(),
      read: false,
    };
    
    console.log('Adding log comment to Firestore:', messageData);
    const messageRef = await addDoc(collection(db, 'messages'), messageData);
    console.log('Log comment added successfully with ID:', messageRef.id);

    // Update conversation with last message info
    await updateConversationLastMessage(conversationId, text, serverTimestamp());
    
    // Update log comment count
    await updateLogCommentCount(logId);

    return messageRef.id;
  } catch (error) {
    console.error('Error sending log comment:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Send an image comment for a log
 */
export async function sendLogImageComment(
  senderId: string,
  senderName: string,
  imageFile: File,
  conversationId: string,
  childId: string,
  logId: string
) {
  try {
    console.log('sendLogImageComment called with:', {
      senderId,
      senderName,
      fileName: imageFile.name,
      fileSize: imageFile.size,
      conversationId,
      childId,
      logId
    });
    
    // Upload image to Firebase Storage
    console.log('Uploading image to Firebase Storage...');
    const imageUrl = await uploadFile(imageFile, 'images');
    console.log('Image uploaded, URL:', imageUrl);
    
    // Send message with image and logId
    console.log('Creating log image comment in Firestore...');
    const messageData = {
      senderId,
      senderName,
      conversationId,
      childId,
      logId, // Add logId for log comments
      type: 'image',
      imageId: imageUrl, // Store the download URL directly
      timestamp: serverTimestamp(),
      read: false,
    };
    
    const messageRef = await addDoc(collection(db, 'messages'), messageData);
    console.log('Log image comment created successfully:', messageRef.id);

    // Update conversation with last message info
    await updateConversationLastMessage(conversationId, '📷 Image', serverTimestamp());
    
    // Update log comment count
    await updateLogCommentCount(logId);

    return messageRef.id;
  } catch (error) {
    console.error('Error sending log image comment:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Send an audio comment for a log
 */
export async function sendLogAudioComment(
  senderId: string,
  senderName: string,
  audioBlob: Blob,
  conversationId: string,
  childId: string,
  logId: string
) {
  try {
    console.log('sendLogAudioComment called with:', {
      senderId,
      senderName,
      audioSize: audioBlob.size,
      conversationId,
      childId,
      logId
    });
    
    // Convert blob to file
    const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
      type: audioBlob.type
    });
    
    // Upload audio to Firebase Storage
    console.log('Uploading audio to Firebase Storage...');
    const audioUrl = await uploadFile(audioFile, 'audio');
    console.log('Audio uploaded, URL:', audioUrl);
    
    // Send message with audio and logId
    console.log('Creating log audio comment in Firestore...');
    const messageData = {
      senderId,
      senderName,
      conversationId,
      childId,
      logId, // Add logId for log comments
      type: 'audio',
      audioId: audioUrl, // Store the download URL directly
      timestamp: serverTimestamp(),
      read: false,
    };

    const messageRef = await addDoc(collection(db, 'messages'), messageData);
    console.log('Log audio comment created successfully:', messageRef.id);

    // Update conversation with last message info
    await updateConversationLastMessage(conversationId, '🎵 Audio', serverTimestamp());
    
    // Update log comment count
    await updateLogCommentCount(logId);

    return messageRef.id;
  } catch (error) {
    console.error('Error sending log audio comment:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}

/**
 * Update log comment count
 */
async function updateLogCommentCount(logId: string) {
  try {
    const logRef = doc(db, 'logs', logId);
    const logDoc = await getDoc(logRef);
    
    if (logDoc.exists()) {
      // For now, just increment - we can optimize later with a cloud function
      const currentData = logDoc.data() as SleepLog;
      await updateDoc(logRef, {
        commentCount: (currentData.commentCount || 0) + 1,
        lastCommentAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error updating log comment count:', error);
    // Don't throw - this is not critical
  }
}

/**
 * Listen to messages for a specific log
 */
export function listenToLogComments(
  logId: string,
  callback: (messages: FirebaseMessage[]) => void
) {
  const q = query(
    collection(db, 'messages'),
    where('logId', '==', logId),
    orderBy('timestamp', 'asc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FirebaseMessage[];
    
    callback(messages);
  });
}