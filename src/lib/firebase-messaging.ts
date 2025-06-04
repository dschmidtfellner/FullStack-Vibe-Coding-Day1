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
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  receiverId: string;
  conversationId: string;
  timestamp: Timestamp;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
  unreadCount: { [userId: string]: number };
}

/**
 * Send a message
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  receiverId: string,
  text: string
) {
  try {
    // Add message to messages collection
    const messageRef = await addDoc(collection(db, 'messages'), {
      text,
      senderId,
      receiverId,
      conversationId,
      timestamp: serverTimestamp(),
      read: false,
    });

    // Update conversation with last message info
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      lastMessage: text,
      lastMessageTimestamp: serverTimestamp(),
      [`unreadCount.${receiverId}`]: arrayUnion(messageRef.id),
    });

    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Listen to messages in a conversation
 */
export function listenToMessages(
  conversationId: string,
  callback: (messages: Message[]) => void
) {
  const q = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    orderBy('timestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Message[];
    
    callback(messages);
  });
}

/**
 * Listen to conversations for a user
 */
export function listenToConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void
) {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTimestamp', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const conversations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Conversation[];
    
    callback(conversations);
  });
}

/**
 * Create or get existing conversation between two users
 */
export async function getOrCreateConversation(userId1: string, userId2: string) {
  try {
    // Try to find existing conversation
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId1)
    );

    // Check if conversation with both users exists
    // Note: Firestore doesn't support array-contains-all, so we filter client-side
    const snapshot = await new Promise((resolve) => {
      const unsubscribe = onSnapshot(q, resolve);
      setTimeout(() => unsubscribe(), 1000); // Cleanup after 1 second
    });

    const existingConversation = (snapshot as any).docs.find((doc: any) => 
      doc.data().participants.includes(userId2)
    );

    if (existingConversation) {
      return existingConversation.id;
    }

    // Create new conversation
    const conversationRef = await addDoc(collection(db, 'conversations'), {
      participants: [userId1, userId2],
      lastMessage: '',
      lastMessageTimestamp: serverTimestamp(),
      unreadCount: {
        [userId1]: [],
        [userId2]: [],
      },
    });

    return conversationRef.id;
  } catch (error) {
    console.error('Error creating/getting conversation:', error);
    throw error;
  }
}