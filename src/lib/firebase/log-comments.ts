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
  onSnapshot, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from './core';
import { uploadFile } from './storage';
import { getAppVersion } from './auth';
import { FirebaseMessage, SleepLog } from './types';

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
 * Send a text comment on a log
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
      appVersion: getAppVersion(),
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
      appVersion: getAppVersion(),
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
      appVersion: getAppVersion(),
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
export async function updateLogCommentCount(logId: string) {
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