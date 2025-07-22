import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  setDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { db } from './core';
import { uploadFile } from './storage';
import { getAppVersion } from './auth';
import { FirebaseMessage } from './types';

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