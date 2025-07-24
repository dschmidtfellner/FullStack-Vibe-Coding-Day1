import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { UnreadCounters, FamilyUnreadCounters, MessageData } from "../types";
import { getChildPushRecipientsAndSenderInfo } from "./bubble-api";
import { sendPushNotificationsForMessage } from "./push-notifications";

/**
 * Handle message creation - update both individual and family counters
 */
export async function handleMessageCreated(
  snap: functions.firestore.DocumentSnapshot,
  context: functions.EventContext,
  db: admin.firestore.Firestore
) {
  try {
    const message = snap.data() as MessageData;
    console.log('New message created:', {
      messageId: context.params.messageId,
      senderId: message.senderId,
      childId: message.childId,
      logId: message.logId,
      conversationId: message.conversationId
    });
    
    // Get all users who should receive push notifications for this child and sender info
    const notificationData = await getChildPushRecipientsAndSenderInfo(message.childId, message.senderId);
    console.log(`Found ${notificationData.recipients.length} push recipients for child ${message.childId}:`, notificationData.recipients);
    
    // Batch update all user counters
    const batch = db.batch();
    
    for (const userId of notificationData.recipients) {
      // Don't count for sender
      if (userId === message.senderId) continue;
      
      const counterId = `user_${userId}_child_${message.childId}`;
      const counterRef = db.doc(`unread_counters/${counterId}`);
      
      // Initialize counter document if it doesn't exist
      const counterDoc = await counterRef.get();
      if (!counterDoc.exists) {
        batch.set(counterRef, {
          id: counterId,
          userId,
          childId: message.childId,
          chatUnreadCount: 0,
          logUnreadCount: 0,
          logUnreadByLogId: {},
          totalUnreadCount: 0,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      if (message.logId) {
        // Log comment
        batch.update(counterRef, {
          logUnreadCount: admin.firestore.FieldValue.increment(1),
          [`logUnreadByLogId.${message.logId}`]: admin.firestore.FieldValue.increment(1),
          totalUnreadCount: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Chat message
        batch.update(counterRef, {
          chatUnreadCount: admin.firestore.FieldValue.increment(1),
          totalUnreadCount: admin.firestore.FieldValue.increment(1),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Also mark the message as unread for this user
      batch.update(snap.ref, {
        [`readBy.${userId}`]: false
      });
    }
    
    await batch.commit();
    console.log(`Updated unread counters for message: ${context.params.messageId}`);
    
    // Update family counters for each recipient
    const familyBatch = db.batch();
    
    for (const userId of notificationData.recipients) {
      // Don't count for sender
      if (userId === message.senderId) continue;
      
      // Check if message has family context
      if (message.familyContext && message.familyContext.originalChildId && message.familyContext.siblings.length > 0) {
        // Use family context from message to aggregate across siblings
        await updateFamilyCounters(userId, message.familyContext.originalChildId, message.familyContext.siblings, db);
      } else {
        // No family context - treat this child as its own family
        const familyCounterId = `user_${userId}_family_${message.childId}`;
        const familyCounterRef = db.doc(`family_unread_counters/${familyCounterId}`);
        
        // Get the individual counter we just updated to calculate family totals
        const individualCounterId = `user_${userId}_child_${message.childId}`;
        const individualDoc = await db.doc(`unread_counters/${individualCounterId}`).get();
        
        if (individualDoc.exists) {
          const individualData = individualDoc.data();
          
          // For single-child families, family counts = individual counts
          familyBatch.set(familyCounterRef, {
            id: familyCounterId,
            userId,
            originalChildId: message.childId,
            familyTotalUnreadCount: individualData?.totalUnreadCount || 0,
            familyChatUnreadCount: individualData?.chatUnreadCount || 0,
            familyLogUnreadCount: individualData?.logUnreadCount || 0,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      }
    }
    
    await familyBatch.commit();
    console.log(`Updated family counters for message: ${context.params.messageId}`);
    
    // Send push notifications to recipients
    await sendPushNotificationsForMessage(message, notificationData);
    
  } catch (error) {
    console.error('Error updating unread counters:', error);
  }
}

/**
 * Mark chat messages as read for a user/child combination
 */
export async function markChatAsReadForUser(
  userId: string, 
  childId: string, 
  conversationId: string,
  db: admin.firestore.Firestore,
  familyContext?: { originalChildId: string; siblings: string[] }
) {
  // Get the current counter to know how many to decrement
  const counterId = `user_${userId}_child_${childId}`;
  const counterRef = db.doc(`unread_counters/${counterId}`);
  const counterDoc = await counterRef.get();
  
  if (!counterDoc.exists || counterDoc.data()?.chatUnreadCount === 0) {
    return {
      success: true,
      message: 'No unread chat messages'
    };
  }

  const chatUnreadCount = counterDoc.data()?.chatUnreadCount || 0;

  // Update counter
  await counterRef.update({
    chatUnreadCount: 0,
    totalUnreadCount: admin.firestore.FieldValue.increment(-chatUnreadCount),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });

  // Mark all chat messages as read for this user
  const messagesSnapshot = await db.collection('messages')
    .where('conversationId', '==', conversationId)
    .where('logId', '==', null)
    .get();

  const batch = db.batch();
  messagesSnapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      [`readBy.${userId}`]: true
    });
  });

  await batch.commit();

  // Update family counters
  if (familyContext && familyContext.originalChildId && familyContext.siblings.length > 0) {
    // We have sibling info from URL params - aggregate across siblings
    await updateFamilyCounters(userId, familyContext.originalChildId, familyContext.siblings, db);
  } else {
    // No sibling info - treat this child as its own family
    const familyCounterId = `user_${userId}_family_${childId}`;
    const updatedCounter = await counterRef.get();
    const updatedData = updatedCounter.data();
    
    await db.doc(`family_unread_counters/${familyCounterId}`).set({
      id: familyCounterId,
      userId,
      originalChildId: childId,
      familyTotalUnreadCount: updatedData?.totalUnreadCount || 0,
      familyChatUnreadCount: updatedData?.chatUnreadCount || 0,
      familyLogUnreadCount: updatedData?.logUnreadCount || 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return {
    success: true,
    messagesMarkedRead: messagesSnapshot.size,
    message: 'Chat messages marked as read'
  };
}

/**
 * Mark log comments as read for a specific log
 */
export async function markLogAsReadForUser(
  userId: string,
  childId: string,
  logId: string,
  db: admin.firestore.Firestore,
  familyContext?: { originalChildId: string; siblings: string[] }
) {
  // Get the current counter
  const counterId = `user_${userId}_child_${childId}`;
  const counterRef = db.doc(`unread_counters/${counterId}`);
  const counterDoc = await counterRef.get();
  
  if (!counterDoc.exists) {
    return {
      success: true,
      message: 'No unread counters found'
    };
  }

  const data = counterDoc.data();
  const logUnreadCount = data?.logUnreadByLogId?.[logId] || 0;

  if (logUnreadCount === 0) {
    return {
      success: true,
      message: 'No unread messages for this log'
    };
  }

  // Update counter
  await counterRef.update({
    logUnreadCount: admin.firestore.FieldValue.increment(-logUnreadCount),
    [`logUnreadByLogId.${logId}`]: 0,
    totalUnreadCount: admin.firestore.FieldValue.increment(-logUnreadCount),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });

  // Mark all log comments as read for this user
  const messagesSnapshot = await db.collection('messages')
    .where('logId', '==', logId)
    .get();

  const batch = db.batch();
  messagesSnapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      [`readBy.${userId}`]: true
    });
  });

  await batch.commit();

  // Update family counters
  if (familyContext && familyContext.originalChildId && familyContext.siblings.length > 0) {
    // We have sibling info from URL params - aggregate across siblings
    await updateFamilyCounters(userId, familyContext.originalChildId, familyContext.siblings, db);
  } else {
    // No sibling info - treat this child as its own family
    const familyCounterId = `user_${userId}_family_${childId}`;
    const updatedCounter = await counterRef.get();
    const updatedData = updatedCounter.data();
    
    await db.doc(`family_unread_counters/${familyCounterId}`).set({
      id: familyCounterId,
      userId,
      originalChildId: childId,
      familyTotalUnreadCount: updatedData?.totalUnreadCount || 0,
      familyChatUnreadCount: updatedData?.chatUnreadCount || 0,
      familyLogUnreadCount: updatedData?.logUnreadCount || 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return {
    success: true,
    messagesMarkedRead: messagesSnapshot.size,
    message: 'Log comments marked as read'
  };
}

/**
 * Mark all log messages as read for a user/child combination
 */
export async function markAllLogsAsReadForUser(
  userId: string,
  childId: string,
  db: admin.firestore.Firestore,
  familyContext?: { originalChildId: string; siblings: string[] }
) {
  // Reset all log counters
  const counterId = `user_${userId}_child_${childId}`;
  const counterRef = db.doc(`unread_counters/${counterId}`);
  
  const counterDoc = await counterRef.get();
  const currentLogUnread = counterDoc.exists ? (counterDoc.data()?.logUnreadCount || 0) : 0;
  
  await counterRef.update({
    logUnreadCount: 0,
    logUnreadByLogId: {},
    totalUnreadCount: admin.firestore.FieldValue.increment(-currentLogUnread),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });

  // Mark all log messages as read for this user
  const messagesSnapshot = await db.collection('messages')
    .where('childId', '==', childId)
    .where('logId', '!=', null)
    .get();

  const batch = db.batch();
  messagesSnapshot.docs.forEach(doc => {
    batch.update(doc.ref, {
      [`readBy.${userId}`]: true
    });
  });

  await batch.commit();

  // Update family counters
  if (familyContext && familyContext.originalChildId && familyContext.siblings.length > 0) {
    // We have sibling info from URL params - aggregate across siblings
    await updateFamilyCounters(userId, familyContext.originalChildId, familyContext.siblings, db);
  } else {
    // No sibling info - treat this child as its own family
    const familyCounterId = `user_${userId}_family_${childId}`;
    const updatedCounter = await counterRef.get();
    const updatedData = updatedCounter.data();
    
    await db.doc(`family_unread_counters/${familyCounterId}`).set({
      id: familyCounterId,
      userId,
      originalChildId: childId,
      familyTotalUnreadCount: updatedData?.totalUnreadCount || 0,
      familyChatUnreadCount: updatedData?.chatUnreadCount || 0,
      familyLogUnreadCount: updatedData?.logUnreadCount || 0,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  return {
    success: true,
    messagesMarkedRead: messagesSnapshot.size,
    message: 'All log comments marked as read'
  };
}

/**
 * Get unread counters for a specific user/child combination
 */
export async function getUnreadCountersForUser(
  userId: string,
  childId: string,
  db: admin.firestore.Firestore
) {
  const counterId = `user_${userId}_child_${childId}`;
  const counterDoc = await db.collection('unread_counters').doc(counterId).get();

  if (!counterDoc.exists) {
    // Return zero counts if document doesn't exist
    return {
      userId,
      childId,
      chatUnreadCount: 0,
      logUnreadCount: 0,
      logUnreadByLogId: {},
      totalUnreadCount: 0,
      timestamp: Date.now()
    };
  }

  const data = counterDoc.data();
  return {
    userId,
    childId,
    chatUnreadCount: data?.chatUnreadCount || 0,
    logUnreadCount: data?.logUnreadCount || 0,
    logUnreadByLogId: data?.logUnreadByLogId || {},
    totalUnreadCount: data?.totalUnreadCount || 0,
    timestamp: Date.now()
  };
}

/**
 * Update family counters based on URL parameters
 * This will be called when we have family context from URL parameters
 */
export async function updateFamilyCounters(
  userId: string,
  originalChildId: string,
  siblings: string[],
  db: admin.firestore.Firestore
) {
  const familyCounterId = `user_${userId}_family_${originalChildId}`;
  
  // Calculate totals across all siblings
  let familyLogTotal = 0;
  let familyChatTotal = 0;
  
  for (const siblingId of siblings) {
    const siblingCounterId = `user_${userId}_child_${siblingId}`;
    const siblingDoc = await db.doc(`unread_counters/${siblingCounterId}`).get();
    
    if (siblingDoc.exists) {
      const data = siblingDoc.data();
      familyLogTotal += data?.logUnreadCount || 0;
      
      // Chat is shared via original child only
      if (siblingId === originalChildId) {
        familyChatTotal = data?.chatUnreadCount || 0;
      }
    }
  }
  
  // Update family counter
  await db.doc(`family_unread_counters/${familyCounterId}`).set({
    id: familyCounterId,
    userId,
    originalChildId,
    familyTotalUnreadCount: familyLogTotal + familyChatTotal,
    familyChatUnreadCount: familyChatTotal,
    familyLogUnreadCount: familyLogTotal,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Updated family counter for user ${userId}, family ${originalChildId}: chat=${familyChatTotal}, log=${familyLogTotal}`);
}

/**
 * Get family unread counters
 */
export async function getFamilyUnreadCounters(
  userId: string,
  originalChildId: string,
  db: admin.firestore.Firestore
) {
  const familyCounterId = `user_${userId}_family_${originalChildId}`;
  const counterDoc = await db.collection('family_unread_counters').doc(familyCounterId).get();

  if (!counterDoc.exists) {
    return {
      userId,
      originalChildId,
      familyTotalUnreadCount: 0,
      familyChatUnreadCount: 0,
      familyLogUnreadCount: 0,
      timestamp: Date.now()
    };
  }

  const data = counterDoc.data();
  return {
    userId,
    originalChildId,
    familyTotalUnreadCount: data?.familyTotalUnreadCount || 0,
    familyChatUnreadCount: data?.familyChatUnreadCount || 0,
    familyLogUnreadCount: data?.familyLogUnreadCount || 0,
    timestamp: Date.now()
  };
}