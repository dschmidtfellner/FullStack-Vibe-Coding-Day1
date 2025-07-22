import { doc, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from './core';

/**
 * Get app version from URL parameters for push notification deep links
 */
export function getAppVersion(): string {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('version') || 'live'; // Default to live if not specified
  } catch (error) {
    console.warn('Error getting app version from URL:', error);
    return 'live'; // Fallback to live
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
 * Create or get conversation for a child
 */
export async function getOrCreateConversation(
  childId: string, 
  childName?: string, 
  userId?: string, 
  userName?: string
): Promise<string> {
  try {
    const conversationId = `child_${childId}`;
    const conversationRef = doc(db, 'conversations', conversationId);
    
    console.log('🔍 Attempting to read conversation:', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      // Create new conversation
      console.log('🔍 Creating new conversation:', conversationId);
      const conversationData: any = {
        id: conversationId,
        childId,
        childName: childName || `Child ${childId}`,
        participants: userId ? [userId] : [],
        participantNames: userId && userName ? { [userId]: userName } : {},
        createdAt: serverTimestamp(),
      };
      
      await setDoc(conversationRef, conversationData);
      if (import.meta.env.DEV) {
        console.log('Created new conversation:', conversationId);
      }
    } else if (userId && conversationDoc.data()?.participants && !conversationDoc.data()?.participants.includes(userId)) {
      // Add user to participants if not already there
      console.log('Adding user to conversation participants:', userId);
      await updateDoc(conversationRef, {
        participants: arrayUnion(userId),
        [`participantNames.${userId}`]: userName || 'Unknown User'
      });
    }
    
    return conversationId;
  } catch (error) {
    console.error('Error creating/getting conversation:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
}