"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendClaudeNotification = exports.exploreFCMTokenStorage = exports.createUserMapping = exports.getUserMapping = exports.syncFCMTokens = exports.testPushNotification = exports.markAllLogsAsRead = exports.markLogAsRead = exports.markChatAsRead = exports.getFamilyUnreadCounters = exports.getUnreadCounters = exports.onMessageCreated = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize the new Firebase project (default)
admin.initializeApp();
const db = admin.firestore();
// Import services
const unread_counters_1 = require("./services/unread-counters");
const user_management_1 = require("./services/user-management");
const test_endpoints_1 = require("./services/test-endpoints");
const fcm_tokens_1 = require("./services/fcm-tokens");
// Trigger: When message is created - update unread counters
exports.onMessageCreated = functions.firestore
    .document('messages/{messageId}')
    .onCreate(async (snap, context) => {
    await (0, unread_counters_1.handleMessageCreated)(snap, context, db);
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
        const result = await (0, unread_counters_1.getUnreadCountersForUser)(userId, childId, db);
        res.json(result);
    }
    catch (error) {
        console.error('Error getting unread counters:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
// API endpoint for Bubble to get family unread counts
exports.getFamilyUnreadCounters = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, originalChildId, siblings } = req.query;
        if (!userId || !originalChildId) {
            res.status(400).json({
                error: 'Missing required parameters: userId and originalChildId'
            });
            return;
        }
        // If siblings are provided, update family counters first
        if (siblings) {
            const siblingList = typeof siblings === 'string' ? siblings.split(',') : siblings;
            await (0, unread_counters_1.updateFamilyCounters)(userId, originalChildId, siblingList, db);
        }
        const result = await (0, unread_counters_1.getFamilyUnreadCounters)(userId, originalChildId, db);
        res.json(result);
    }
    catch (error) {
        console.error('Error getting family unread counters:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
// API endpoint to mark all chat messages as read
exports.markChatAsRead = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, childId, conversationId, originalChildId, siblings } = req.body;
        if (!userId || !childId || !conversationId) {
            res.status(400).json({
                error: 'Missing required parameters: userId, childId, conversationId'
            });
            return;
        }
        // Parse family context if provided
        const familyContext = originalChildId && siblings ? {
            originalChildId,
            siblings: typeof siblings === 'string' ? siblings.split(',') : siblings
        } : undefined;
        const result = await (0, unread_counters_1.markChatAsReadForUser)(userId, childId, conversationId, db, familyContext);
        res.json(result);
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
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, childId, logId, originalChildId, siblings } = req.body;
        if (!userId || !childId || !logId) {
            res.status(400).json({
                error: 'Missing required parameters: userId, childId, logId'
            });
            return;
        }
        // Parse family context if provided
        const familyContext = originalChildId && siblings ? {
            originalChildId,
            siblings: typeof siblings === 'string' ? siblings.split(',') : siblings
        } : undefined;
        const result = await (0, unread_counters_1.markLogAsReadForUser)(userId, childId, logId, db, familyContext);
        res.json(result);
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
        const { userId, childId, originalChildId, siblings } = req.body;
        if (!userId || !childId) {
            res.status(400).json({
                error: 'Missing required parameters: userId, childId'
            });
            return;
        }
        // Parse family context if provided
        const familyContext = originalChildId && siblings ? {
            originalChildId,
            siblings: typeof siblings === 'string' ? siblings.split(',') : siblings
        } : undefined;
        const result = await (0, unread_counters_1.markAllLogsAsReadForUser)(userId, childId, db, familyContext);
        res.json(result);
    }
    catch (error) {
        console.error('Error marking all logs as read:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});
// Test endpoint for push notifications
exports.testPushNotification = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const result = await (0, test_endpoints_1.testPushNotification)(req.body, db);
        res.json(result);
    }
    catch (error) {
        console.error('Error testing push notification:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
// Sync FCM tokens from old Firebase project to new project
exports.syncFCMTokens = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { userId, fcmToken } = req.body;
        const result = await (0, user_management_1.syncFCMToken)(userId, fcmToken, db);
        // Clear cache for this user so new token is picked up
        const tokenManager = fcm_tokens_1.FCMTokenManager.getInstance(db);
        tokenManager.clearCache(userId);
        res.json(result);
    }
    catch (error) {
        console.error('Error syncing FCM token:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
// Get user identity mapping between old and new systems
exports.getUserMapping = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const { oldUserId, newUserId, email } = req.method === 'GET' ? req.query : req.body;
        const result = await (0, user_management_1.getUserMapping)({ oldUserId, newUserId, email }, db);
        res.json(result);
    }
    catch (error) {
        console.error('Error getting user mapping:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
// Create or update user identity mapping
exports.createUserMapping = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        const result = await (0, user_management_1.createUserMapping)(req.body, db);
        res.json(result);
    }
    catch (error) {
        console.error('Error creating user mapping:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
// Diagnostic endpoint to explore FCM token storage patterns (Firestore + Realtime Database)
exports.exploreFCMTokenStorage = functions.https.onRequest(async (req, res) => {
    // Enable CORS for all origins
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
    if (req.method === 'OPTIONS') {
        res.status(200).send('');
        return;
    }
    try {
        const { project } = req.query;
        const result = await (0, test_endpoints_1.exploreFCMTokenStorage)(project);
        res.json(result);
    }
    catch (error) {
        console.error('Error exploring FCM token storage:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
// Claude Code push notification function
exports.sendClaudeNotification = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        console.log('Claude notification request received:', req.body);
        const { message, type } = req.body;
        const result = await (0, test_endpoints_1.sendClaudeNotification)(message, type);
        res.json(result);
    }
    catch (error) {
        console.error('Error sending Claude notification:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
//# sourceMappingURL=index.js.map