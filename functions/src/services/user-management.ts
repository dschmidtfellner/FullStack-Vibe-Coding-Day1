import * as admin from "firebase-admin";
import { UserMapping } from "../types";

/**
 * Get user identity mapping between old and new systems
 */
export async function getUserMapping(
  identifier: { oldUserId?: string; newUserId?: string; email?: string },
  db: admin.firestore.Firestore
) {
  const { oldUserId, newUserId, email } = identifier;

  if (!oldUserId && !newUserId && !email) {
    throw new Error('Must provide oldUserId, newUserId, or email');
  }

  // Check if mapping exists
  let mappingDoc: admin.firestore.DocumentSnapshot | null = null;
  
  if (oldUserId) {
    mappingDoc = await db.collection('user_mappings').doc(oldUserId).get();
  } else if (newUserId) {
    const mappingQuery = await db.collection('user_mappings').where('newUserId', '==', newUserId).limit(1).get();
    mappingDoc = mappingQuery.empty ? null : mappingQuery.docs[0];
  } else if (email) {
    const mappingQuery = await db.collection('user_mappings').where('email', '==', email).limit(1).get();
    mappingDoc = mappingQuery.empty ? null : mappingQuery.docs[0];
  }

  if (mappingDoc && mappingDoc.exists) {
    const data = mappingDoc.data();
    return {
      found: true,
      mapping: {
        oldUserId: data?.oldUserId || mappingDoc.id,
        newUserId: data?.newUserId,
        email: data?.email,
        name: data?.name,
        createdAt: data?.createdAt,
        lastUpdated: data?.lastUpdated
      }
    };
  } else {
    return {
      found: false,
      message: 'No mapping found'
    };
  }
}

/**
 * Create or update user identity mapping
 */
export async function createUserMapping(
  mapping: { oldUserId: string; newUserId: string; email?: string; name?: string },
  db: admin.firestore.Firestore
) {
  const { oldUserId, newUserId, email, name } = mapping;

  if (!oldUserId || !newUserId) {
    throw new Error('Missing required parameters: oldUserId and newUserId');
  }

  // Create or update mapping
  const mappingData = {
    oldUserId,
    newUserId,
    email: email || undefined,
    name: name || undefined,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  };

  const mappingRef = db.collection('user_mappings').doc(oldUserId);
  const existingMapping = await mappingRef.get();

  if (existingMapping.exists) {
    await mappingRef.update(mappingData);
  } else {
    await mappingRef.set({
      ...mappingData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  return {
    success: true,
    message: 'User mapping created/updated successfully',
    mapping: {
      oldUserId,
      newUserId,
      email,
      name
    }
  };
}

/**
 * Sync FCM token from old Firebase project to new project
 */
export async function syncFCMToken(
  userId: string,
  fcmToken: string,
  db: admin.firestore.Firestore
) {
  if (!userId || !fcmToken) {
    throw new Error('Missing required parameters: userId and fcmToken');
  }

  // Store the FCM token in the new project for quick access
  await db.collection('fcm_tokens').doc(userId).set({
    token: fcmToken,
    userId,
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return {
    success: true,
    message: 'FCM token synced successfully',
    userId
  };
}