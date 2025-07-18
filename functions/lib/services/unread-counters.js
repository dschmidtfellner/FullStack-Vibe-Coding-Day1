"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFamilyUnreadCounters = exports.updateFamilyCounters = exports.getUnreadCountersForUser = exports.markAllLogsAsReadForUser = exports.markLogAsReadForUser = exports.markChatAsReadForUser = exports.handleMessageCreated = void 0;
const admin = require("firebase-admin");
const bubble_api_1 = require("./bubble-api");
const push_notifications_1 = require("./push-notifications");
/**
 * Handle message creation - update both individual and family counters
 */
async function handleMessageCreated(snap, context, db) {
    try {
        const message = snap.data();
        console.log('New message created:', {
            messageId: context.params.messageId,
            senderId: message.senderId,
            childId: message.childId,
            logId: message.logId,
            conversationId: message.conversationId
        });
        // Get all users who should receive push notifications for this child and sender info
        const notificationData = await (0, bubble_api_1.getChildPushRecipientsAndSenderInfo)(message.childId, message.senderId);
        console.log(`Found ${notificationData.recipients.length} push recipients for child ${message.childId}:`, notificationData.recipients);
        // Batch update all user counters
        const batch = db.batch();
        for (const userId of notificationData.recipients) {
            // Don't count for sender
            if (userId === message.senderId)
                continue;
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
            }
            else {
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
        // Update family counters (if family context exists)
        // TODO: We'll need URL parameters or family relationship data to determine this
        // For now, we'll skip family counter updates until we implement the URL parsing
        // Send push notifications to recipients
        await (0, push_notifications_1.sendPushNotificationsForMessage)(message, notificationData);
    }
    catch (error) {
        console.error('Error updating unread counters:', error);
    }
}
exports.handleMessageCreated = handleMessageCreated;
/**
 * Mark chat messages as read for a user/child combination
 */
async function markChatAsReadForUser(userId, childId, conversationId, db) {
    var _a, _b;
    // Get the current counter to know how many to decrement
    const counterId = `user_${userId}_child_${childId}`;
    const counterRef = db.doc(`unread_counters/${counterId}`);
    const counterDoc = await counterRef.get();
    if (!counterDoc.exists || ((_a = counterDoc.data()) === null || _a === void 0 ? void 0 : _a.chatUnreadCount) === 0) {
        return {
            success: true,
            message: 'No unread chat messages'
        };
    }
    const chatUnreadCount = ((_b = counterDoc.data()) === null || _b === void 0 ? void 0 : _b.chatUnreadCount) || 0;
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
    // TODO: Update family counters if applicable
    return {
        success: true,
        messagesMarkedRead: messagesSnapshot.size,
        message: 'Chat messages marked as read'
    };
}
exports.markChatAsReadForUser = markChatAsReadForUser;
/**
 * Mark log comments as read for a specific log
 */
async function markLogAsReadForUser(userId, childId, logId, db) {
    var _a;
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
    const logUnreadCount = ((_a = data === null || data === void 0 ? void 0 : data.logUnreadByLogId) === null || _a === void 0 ? void 0 : _a[logId]) || 0;
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
    // TODO: Update family counters if applicable
    return {
        success: true,
        messagesMarkedRead: messagesSnapshot.size,
        message: 'Log comments marked as read'
    };
}
exports.markLogAsReadForUser = markLogAsReadForUser;
/**
 * Mark all log messages as read for a user/child combination
 */
async function markAllLogsAsReadForUser(userId, childId, db) {
    var _a;
    // Reset all log counters
    const counterId = `user_${userId}_child_${childId}`;
    const counterRef = db.doc(`unread_counters/${counterId}`);
    const counterDoc = await counterRef.get();
    const currentLogUnread = counterDoc.exists ? (((_a = counterDoc.data()) === null || _a === void 0 ? void 0 : _a.logUnreadCount) || 0) : 0;
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
    // TODO: Update family counters if applicable
    return {
        success: true,
        messagesMarkedRead: messagesSnapshot.size,
        message: 'All log comments marked as read'
    };
}
exports.markAllLogsAsReadForUser = markAllLogsAsReadForUser;
/**
 * Get unread counters for a specific user/child combination
 */
async function getUnreadCountersForUser(userId, childId, db) {
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
        chatUnreadCount: (data === null || data === void 0 ? void 0 : data.chatUnreadCount) || 0,
        logUnreadCount: (data === null || data === void 0 ? void 0 : data.logUnreadCount) || 0,
        logUnreadByLogId: (data === null || data === void 0 ? void 0 : data.logUnreadByLogId) || {},
        totalUnreadCount: (data === null || data === void 0 ? void 0 : data.totalUnreadCount) || 0,
        timestamp: Date.now()
    };
}
exports.getUnreadCountersForUser = getUnreadCountersForUser;
/**
 * Update family counters based on URL parameters
 * This will be called when we have family context from URL parameters
 */
async function updateFamilyCounters(userId, originalChildId, siblings, db) {
    const familyCounterId = `user_${userId}_family_${originalChildId}`;
    // Calculate totals across all siblings
    let familyLogTotal = 0;
    let familyChatTotal = 0;
    for (const siblingId of siblings) {
        const siblingCounterId = `user_${userId}_child_${siblingId}`;
        const siblingDoc = await db.doc(`unread_counters/${siblingCounterId}`).get();
        if (siblingDoc.exists) {
            const data = siblingDoc.data();
            familyLogTotal += (data === null || data === void 0 ? void 0 : data.logUnreadCount) || 0;
            // Chat is shared via original child only
            if (siblingId === originalChildId) {
                familyChatTotal = (data === null || data === void 0 ? void 0 : data.chatUnreadCount) || 0;
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
exports.updateFamilyCounters = updateFamilyCounters;
/**
 * Get family unread counters
 */
async function getFamilyUnreadCounters(userId, originalChildId, db) {
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
        familyTotalUnreadCount: (data === null || data === void 0 ? void 0 : data.familyTotalUnreadCount) || 0,
        familyChatUnreadCount: (data === null || data === void 0 ? void 0 : data.familyChatUnreadCount) || 0,
        familyLogUnreadCount: (data === null || data === void 0 ? void 0 : data.familyLogUnreadCount) || 0,
        timestamp: Date.now()
    };
}
exports.getFamilyUnreadCounters = getFamilyUnreadCounters;
//# sourceMappingURL=unread-counters.js.map