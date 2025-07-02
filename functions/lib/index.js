"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllLogsAsRead = exports.markLogAsRead = exports.markChatAsRead = exports.getUnreadCounters = exports.onMessageCreated = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// Helper function to get conversation participants
async function getConversationParticipants(conversationId) {
    var _a;
    const conversationDoc = await db.collection('conversations').doc(conversationId).get();
    if (!conversationDoc.exists) {
        console.error('Conversation not found:', conversationId);
        return [];
    }
    return ((_a = conversationDoc.data()) === null || _a === void 0 ? void 0 : _a.participants) || [];
}
// Trigger: When message is created - update unread counters
exports.onMessageCreated = functions.firestore
    .document('messages/{messageId}')
    .onCreate(async (snap, context) => {
    try {
        const message = snap.data();
        console.log('New message created:', {
            messageId: context.params.messageId,
            senderId: message.senderId,
            childId: message.childId,
            logId: message.logId,
            conversationId: message.conversationId
        });
        // Get all users who should see this message (conversation participants)
        let participants = await getConversationParticipants(message.conversationId);
        // If no participants found, get all users who have access to this child
        if (participants.length === 0) {
            console.log('No participants found in conversation, getting all users with child access');
            // For now, we'll get all messages in this conversation to find unique users
            const messagesSnapshot = await db.collection('messages')
                .where('conversationId', '==', message.conversationId)
                .get();
            const uniqueUsers = new Set();
            messagesSnapshot.forEach(doc => {
                const msg = doc.data();
                if (msg.senderId) {
                    uniqueUsers.add(msg.senderId);
                }
            });
            participants = Array.from(uniqueUsers);
            console.log('Found participants from message history:', participants);
        }
        // Batch update all user counters
        const batch = db.batch();
        for (const userId of participants) {
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
    }
    catch (error) {
        console.error('Error updating unread counters:', error);
    }
});
// API endpoint for Bubble to get unread counts for a specific user/child combo
exports.getUnreadCounters = functions.https.onRequest(async (req, res) => {
    // Enable CORS for all origins (adjust for production)
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, childId } = req.query;
        if (!userId || !childId) {
            res.status(400).json({
                error: 'Missing required parameters: userId and childId'
            });
            return;
        }
        const counterId = `user_${userId}_child_${childId}`;
        const counterDoc = await db.collection('unread_counters').doc(counterId).get();
        if (!counterDoc.exists) {
            // Return zero counts if document doesn't exist
            res.json({
                userId,
                childId,
                chatUnreadCount: 0,
                logUnreadCount: 0,
                logUnreadByLogId: {},
                totalUnreadCount: 0,
                timestamp: Date.now()
            });
            return;
        }
        const data = counterDoc.data();
        res.json({
            userId,
            childId,
            chatUnreadCount: (data === null || data === void 0 ? void 0 : data.chatUnreadCount) || 0,
            logUnreadCount: (data === null || data === void 0 ? void 0 : data.logUnreadCount) || 0,
            logUnreadByLogId: (data === null || data === void 0 ? void 0 : data.logUnreadByLogId) || {},
            totalUnreadCount: (data === null || data === void 0 ? void 0 : data.totalUnreadCount) || 0,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Error getting unread counters:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
// API endpoint to mark all chat messages as read
exports.markChatAsRead = functions.https.onRequest(async (req, res) => {
    var _a, _b;
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, childId, conversationId } = req.body;
        if (!userId || !childId || !conversationId) {
            res.status(400).json({
                error: 'Missing required parameters: userId, childId, conversationId'
            });
            return;
        }
        // Get the current counter to know how many to decrement
        const counterId = `user_${userId}_child_${childId}`;
        const counterRef = db.doc(`unread_counters/${counterId}`);
        const counterDoc = await counterRef.get();
        if (!counterDoc.exists || ((_a = counterDoc.data()) === null || _a === void 0 ? void 0 : _a.chatUnreadCount) === 0) {
            res.json({
                success: true,
                message: 'No unread chat messages'
            });
            return;
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
        res.json({
            success: true,
            messagesMarkedRead: messagesSnapshot.size,
            message: 'Chat messages marked as read'
        });
    }
    catch (error) {
        console.error('Error marking chat as read:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
// API endpoint to mark log comments as read
exports.markLogAsRead = functions.https.onRequest(async (req, res) => {
    var _a;
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, childId, logId } = req.body;
        if (!userId || !childId || !logId) {
            res.status(400).json({
                error: 'Missing required parameters: userId, childId, logId'
            });
            return;
        }
        // Get the current counter
        const counterId = `user_${userId}_child_${childId}`;
        const counterRef = db.doc(`unread_counters/${counterId}`);
        const counterDoc = await counterRef.get();
        if (!counterDoc.exists) {
            res.json({
                success: true,
                message: 'No unread counters found'
            });
            return;
        }
        const data = counterDoc.data();
        const logUnreadCount = ((_a = data === null || data === void 0 ? void 0 : data.logUnreadByLogId) === null || _a === void 0 ? void 0 : _a[logId]) || 0;
        if (logUnreadCount === 0) {
            res.json({
                success: true,
                message: 'No unread messages for this log'
            });
            return;
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
        res.json({
            success: true,
            messagesMarkedRead: messagesSnapshot.size,
            message: 'Log comments marked as read'
        });
    }
    catch (error) {
        console.error('Error marking log as read:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
// API endpoint to mark all messages as read (for the CommentsModal "Mark all as read" button)
exports.markAllLogsAsRead = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, childId } = req.body;
        if (!userId || !childId) {
            res.status(400).json({
                error: 'Missing required parameters: userId, childId'
            });
            return;
        }
        // Reset all log counters
        const counterId = `user_${userId}_child_${childId}`;
        const counterRef = db.doc(`unread_counters/${counterId}`);
        await counterRef.update({
            logUnreadCount: 0,
            logUnreadByLogId: {},
            totalUnreadCount: admin.firestore.FieldValue.increment(-admin.firestore.FieldValue.delete()),
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
        res.json({
            success: true,
            messagesMarkedRead: messagesSnapshot.size,
            message: 'All log comments marked as read'
        });
    }
    catch (error) {
        console.error('Error marking all logs as read:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
//# sourceMappingURL=index.js.map