"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAsRead = exports.incrementUnreadCount = exports.getAllUnreadCounts = exports.getUnreadCount = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
// API endpoint for Bubble to get unread message count for a specific user/child combo
exports.getUnreadCount = functions.https.onRequest(async (req, res) => {
    var _a;
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
        // Query the unread count for this specific user/child combination
        const unreadCountDoc = await db
            .collection('unreadCounts')
            .doc(`${userId}_${childId}`)
            .get();
        const count = unreadCountDoc.exists ? ((_a = unreadCountDoc.data()) === null || _a === void 0 ? void 0 : _a.count) || 0 : 0;
        res.json({
            userId,
            childId,
            unreadCount: count,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
// API endpoint to get all unread counts for a specific user
exports.getAllUnreadCounts = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId } = req.query;
        if (!userId) {
            res.status(400).json({
                error: 'Missing required parameter: userId'
            });
            return;
        }
        // Query all unread counts for this user
        const unreadCountsSnapshot = await db
            .collection('unreadCounts')
            .where('userId', '==', userId)
            .get();
        const unreadCounts = {};
        unreadCountsSnapshot.forEach(doc => {
            const data = doc.data();
            unreadCounts[data.childId] = data.count || 0;
        });
        res.json({
            userId,
            unreadCounts,
            timestamp: Date.now()
        });
    }
    catch (error) {
        console.error('Error getting all unread counts:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
// Function to increment unread count when a new message is sent
exports.incrementUnreadCount = functions.firestore
    .document('messages/{conversationId}/messages/{messageId}')
    .onCreate(async (snap, context) => {
    try {
        const messageData = snap.data();
        const conversationId = context.params.conversationId;
        // Extract childId from conversationId (assuming format like "child_123")
        const childId = conversationId;
        // Get all users in this conversation (except the sender)
        const conversationDoc = await db
            .collection('conversations')
            .doc(conversationId)
            .get();
        if (!conversationDoc.exists) {
            console.log('Conversation not found:', conversationId);
            return;
        }
        const conversationData = conversationDoc.data();
        const participants = (conversationData === null || conversationData === void 0 ? void 0 : conversationData.participants) || [];
        // Increment unread count for all participants except the sender
        const batch = db.batch();
        for (const participantId of participants) {
            if (participantId !== messageData.senderId) {
                const unreadCountRef = db
                    .collection('unreadCounts')
                    .doc(`${participantId}_${childId}`);
                batch.set(unreadCountRef, {
                    userId: participantId,
                    childId: childId,
                    count: admin.firestore.FieldValue.increment(1),
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        }
        await batch.commit();
        console.log(`Incremented unread counts for conversation: ${conversationId}`);
    }
    catch (error) {
        console.error('Error incrementing unread count:', error);
    }
});
// Function to reset unread count when user reads messages
exports.markAsRead = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, childId } = req.body;
        if (!userId || !childId) {
            res.status(400).json({
                error: 'Missing required parameters: userId and childId'
            });
            return;
        }
        // Reset the unread count to 0
        await db
            .collection('unreadCounts')
            .doc(`${userId}_${childId}`)
            .set({
            userId,
            childId,
            count: 0,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        res.json({
            success: true,
            userId,
            childId,
            message: 'Marked as read'
        });
    }
    catch (error) {
        console.error('Error marking as read:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
//# sourceMappingURL=index.js.map