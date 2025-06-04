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
  getDoc,
  limit,
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  getStorage 
} from 'firebase/storage';
import { db } from './firebase';
import { FirebaseMessage, FirebaseConversation, FirebaseUser, MessageReaction } from '@/types/firebase';

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
    console.log('Firebase sendMessage called with:', { senderId, senderName, text });
    
    // For now, send to global chat (no conversations yet)
    const messageData = {
      text,
      senderId,
      senderName,
      type: 'text',
      timestamp: serverTimestamp(),
      read: false,
    };
    
    console.log('Adding document to Firestore:', messageData);
    const messageRef = await addDoc(collection(db, 'messages'), messageData);
    console.log('Document added successfully with ID:', messageRef.id);

    return messageRef.id;
  } catch (error) {
    console.error('Error sending message:', error);
    console.error('Error details:', error.message);
    throw error;
  }
}

/**
 * Upload file to Firebase Storage
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    console.log('Starting file upload to Firebase Storage:', {
      fileName: file.name,
      fileSize: file.size,
      path: path
    });
    
    const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    console.log('Created storage reference:', fileRef.fullPath);
    
    console.log('Uploading file to Firebase Storage...');
    const snapshot = await uploadBytes(fileRef, file);
    console.log('File uploaded successfully, getting download URL...');
    
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('Download URL obtained:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading file:', error);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);
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
    console.log('sendImageMessage called with:', {
      senderId,
      senderName,
      fileName: imageFile.name,
      fileSize: imageFile.size
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
      type: 'image',
      imageId: imageUrl, // Store the download URL directly
      timestamp: serverTimestamp(),
      read: false,
    };
    
    const messageRef = await addDoc(collection(db, 'messages'), messageData);
    console.log('Image message created successfully:', messageRef.id);

    return messageRef.id;
  } catch (error) {
    console.error('Error sending image message:', error);
    console.error('Error details:', error.message);
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
    orderBy('timestamp', 'asc'), // Changed to ascending - oldest first
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
    const messageRef = doc(db, 'messages', messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (!messageDoc.exists()) {
      throw new Error('Message not found');
    }

    const messageData = messageDoc.data() as FirebaseMessage;
    const currentReactions = messageData.reactions || {};

    // Get current reaction for this emoji
    const currentReaction = currentReactions[emoji];

    if (currentReaction) {
      // Check if user already reacted with this emoji
      const userIndex = currentReaction.users.indexOf(userId);
      
      if (userIndex > -1) {
        // User already reacted, remove their reaction
        const updatedUsers = currentReaction.users.filter(id => id !== userId);
        const updatedUserNames = currentReaction.userNames.filter(name => name !== userName);
        
        if (updatedUsers.length === 0) {
          // No users left with this reaction, remove the entire emoji reaction
          const { [emoji]: removed, ...remainingReactions } = currentReactions;
          await updateDoc(messageRef, {
            reactions: remainingReactions
          });
        } else {
          // Update with remaining users
          await updateDoc(messageRef, {
            [`reactions.${emoji}.users`]: updatedUsers,
            [`reactions.${emoji}.userNames`]: updatedUserNames
          });
        }
      } else {
        // User hasn't reacted with this emoji, add their reaction
        await updateDoc(messageRef, {
          [`reactions.${emoji}.users`]: arrayUnion(userId),
          [`reactions.${emoji}.userNames`]: arrayUnion(userName)
        });
      }
    } else {
      // First reaction with this emoji
      await updateDoc(messageRef, {
        [`reactions.${emoji}`]: {
          emoji,
          users: [userId],
          userNames: [userName]
        }
      });
    }
  } catch (error) {
    console.error('Error toggling message reaction:', error);
    throw error;
  }
}