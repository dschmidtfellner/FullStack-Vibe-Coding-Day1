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
  getDocs,
  limit,
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  getStorage 
} from 'firebase/storage';
import { db } from './firebase';
import { FirebaseMessage, FirebaseConversation, FirebaseUser } from '@/types/firebase';

const storage = getStorage();

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
  text: string
) {
  try {
    // For now, send to global chat (no conversations yet)
    const messageRef = await addDoc(collection(db, 'messages'), {
      text,
      senderId,
      senderName,
      type: 'text',
      timestamp: serverTimestamp(),
      read: false,
    });

    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Upload file to Firebase Storage
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

/**
 * Send an image message
 */
export async function sendImageMessage(
  senderId: string,
  senderName: string,
  imageFile: File
) {
  try {
    // Upload image to Firebase Storage
    const imageUrl = await uploadFile(imageFile, 'images');
    
    // Send message with image
    const messageRef = await addDoc(collection(db, 'messages'), {
      senderId,
      senderName,
      type: 'image',
      imageId: imageUrl, // Store the download URL directly
      timestamp: serverTimestamp(),
      read: false,
    });

    return messageRef.id;
  } catch (error) {
    console.error('Error sending image message:', error);
    throw error;
  }
}

/**
 * Send an audio message
 */
export async function sendAudioMessage(
  senderId: string,
  senderName: string,
  audioBlob: Blob
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
      type: 'audio',
      audioId: audioUrl, // Store the download URL directly
      timestamp: serverTimestamp(),
      read: false,
    });

    return messageRef.id;
  } catch (error) {
    console.error('Error sending audio message:', error);
    throw error;
  }
}

/**
 * Listen to all messages (global chat for now)
 */
export function listenToMessages(
  callback: (messages: FirebaseMessage[]) => void
) {
  const q = query(
    collection(db, 'messages'),
    orderBy('timestamp', 'desc'),
    limit(50) // Limit to last 50 messages
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FirebaseMessage[];
    
    callback(messages);
  });
}