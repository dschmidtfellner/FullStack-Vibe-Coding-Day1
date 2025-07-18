"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendClaudeNotification = exports.exploreFCMTokenStorage = exports.createUserMapping = exports.getUserMapping = exports.syncFCMTokens = exports.testPushNotification = exports.markAllLogsAsRead = exports.markLogAsRead = exports.markChatAsRead = exports.getUnreadCounters = exports.onMessageCreated = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize the new Firebase project (default)
admin.initializeApp();
const db = admin.firestore();
// Initialize connections to multiple old Firebase projects for push notifications
let restedFirebaseApp = null;
let doulaConnectFirebaseApp = null;
function initializeOldFirebaseApps() {
    const apps = {
        rested: initializeRestedFirebaseApp(),
        doulaConnect: initializeDoulaConnectFirebaseApp()
    };
    return apps;
}
function initializeRestedFirebaseApp() {
    var _a;
    if (restedFirebaseApp) {
        return restedFirebaseApp;
    }
    try {
        // Get Rested Firebase project service account from environment
        const restedCredentials = (_a = functions.config().rested_firebase) === null || _a === void 0 ? void 0 : _a.service_account;
        if (!restedCredentials) {
            console.warn('Rested Firebase service account not configured');
            return null;
        }
        // Parse credentials (they should be base64 encoded JSON)
        const credentials = JSON.parse(Buffer.from(restedCredentials, 'base64').toString('utf8'));
        restedFirebaseApp = admin.initializeApp({
            credential: admin.credential.cert(credentials),
            databaseURL: 'https://rested-bubble-default-rtdb.firebaseio.com/'
        }, 'restedProject');
        console.log('Rested Firebase project initialized for push notifications');
        return restedFirebaseApp;
    }
    catch (error) {
        console.error('Failed to initialize Rested Firebase project:', error);
        return null;
    }
}
function initializeDoulaConnectFirebaseApp() {
    var _a;
    if (doulaConnectFirebaseApp) {
        return doulaConnectFirebaseApp;
    }
    try {
        // Get DoulaConnect Firebase project service account from environment
        const doulaConnectCredentials = (_a = functions.config().doulaconnect_firebase) === null || _a === void 0 ? void 0 : _a.service_account;
        if (!doulaConnectCredentials) {
            console.warn('DoulaConnect Firebase service account not configured');
            return null;
        }
        // Parse credentials (they should be base64 encoded JSON)
        const credentials = JSON.parse(Buffer.from(doulaConnectCredentials, 'base64').toString('utf8'));
        doulaConnectFirebaseApp = admin.initializeApp({
            credential: admin.credential.cert(credentials),
            databaseURL: 'https://doulaconnect-119a4-default-rtdb.firebaseio.com/'
        }, 'doulaConnectProject');
        console.log('DoulaConnect Firebase project initialized for push notifications');
        return doulaConnectFirebaseApp;
    }
    catch (error) {
        console.error('Failed to initialize DoulaConnect Firebase project:', error);
        return null;
    }
}
// OneSignal push notification service
async function sendOneSignalNotificationToAllApps(playerIds, title, body, data) {
    const results = [];
    // Send to Rested app users
    if (playerIds.rested && playerIds.rested.length > 0) {
        const restedResult = await sendOneSignalNotification('rested', playerIds.rested, title, body, data);
        results.push(restedResult);
    }
    // Send to DoulaConnect app users
    if (playerIds.doulaConnect && playerIds.doulaConnect.length > 0) {
        const doulaConnectResult = await sendOneSignalNotification('doulaConnect', playerIds.doulaConnect, title, body, data);
        results.push(doulaConnectResult);
    }
    const successCount = results.filter(r => r.success).length;
    console.log(`Sent ${successCount}/${results.length} OneSignal notifications successfully`);
    return successCount > 0;
}
// Send notification via OneSignal REST API
async function sendOneSignalNotification(app, playerIds, title, body, data) {
    try {
        const config = functions.config().onesignal;
        const appId = app === 'rested' ? config === null || config === void 0 ? void 0 : config.rested_app_id : config === null || config === void 0 ? void 0 : config.doulaconnect_app_id;
        const apiKey = app === 'rested' ? config === null || config === void 0 ? void 0 : config.rested_api_key : config === null || config === void 0 ? void 0 : config.doulaconnect_api_key;
        if (!appId || !apiKey) {
            console.error(`OneSignal credentials not configured for ${app}`);
            return { success: false, error: 'Missing credentials' };
        }
        const payload = {
            app_id: appId,
            include_player_ids: playerIds,
            headings: { en: title },
            contents: { en: body },
            data: {
                onLoadUrl: (data === null || data === void 0 ? void 0 : data.deepLink) || '' // BDK Native specific key for navigation
            }
        };
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${apiKey}`
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok) {
            console.log(`OneSignal notification sent successfully to ${app}:`, result.id);
            return { success: true, id: result.id, recipients: result.recipients };
        }
        else {
            console.error(`OneSignal notification failed for ${app}:`, result);
            return { success: false, error: result };
        }
    }
    catch (error) {
        console.error(`Error sending OneSignal notification to ${app}:`, error);
        return { success: false, error: error.message };
    }
}
// Helper function to send via specific Firebase app
async function sendPushNotificationViaApp(firebaseApp, fcmToken, title, body, data, appName) {
    try {
        const messaging = admin.messaging(firebaseApp);
        const message = {
            token: fcmToken,
            notification: {
                title,
                body,
            },
            data: data || {},
        };
        await messaging.send(message);
        console.log(`Push notification sent successfully via ${appName} to:`, fcmToken);
        return true;
    }
    catch (error) {
        console.error(`Failed to send push notification via ${appName}:`, error);
        return false;
    }
}
// Legacy function for single-app compatibility
async function sendPushNotification(fcmToken, title, body, data) {
    // Try sending via both apps (for testing purposes)
    const apps = initializeOldFirebaseApps();
    if (apps.rested) {
        return sendPushNotificationViaApp(apps.rested, fcmToken, title, body, data, 'Rested');
    }
    else if (apps.doulaConnect) {
        return sendPushNotificationViaApp(apps.doulaConnect, fcmToken, title, body, data, 'DoulaConnect');
    }
    console.warn('No Firebase apps available - skipping push notification');
    return false;
}
// FCM Token Management Service
class FCMTokenManager {
    constructor() {
        this.tokenCache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }
    static getInstance() {
        if (!FCMTokenManager.instance) {
            FCMTokenManager.instance = new FCMTokenManager();
        }
        return FCMTokenManager.instance;
    }
    // Option A: Read directly from multiple old Firebase databases
    async getTokensFromOldFirebase(userId) {
        const tokens = {};
        // Get token from Rested Firebase project
        tokens.rested = await this.getTokenFromSpecificFirebaseProject(userId, 'rested');
        // Get token from DoulaConnect Firebase project  
        tokens.doulaConnect = await this.getTokenFromSpecificFirebaseProject(userId, 'doulaConnect');
        return tokens;
    }
    async getTokenFromSpecificFirebaseProject(userId, projectType) {
        try {
            const apps = initializeOldFirebaseApps();
            const app = projectType === 'rested' ? apps.rested : apps.doulaConnect;
            if (!app) {
                console.warn(`${projectType} Firebase app not available`);
                return null;
            }
            const db = admin.firestore(app);
            // Try multiple common patterns for FCM token storage
            const patterns = [
                // Pattern 1: users/{userId} with fcmToken/playerID field
                { collection: 'users', doc: userId, fields: ['fcmToken', 'playerID', 'deviceToken', 'pushToken'] },
                // Pattern 2: fcmTokens/{userId} document
                { collection: 'fcmTokens', doc: userId, fields: ['token', 'fcmToken', 'playerID'] },
                // Pattern 3: users/{userId}/tokens subcollection (get most recent)
                { collection: 'users', doc: userId, subcollection: 'tokens', fields: ['token', 'fcmToken'] }
            ];
            for (const pattern of patterns) {
                try {
                    if (pattern.subcollection) {
                        // Handle subcollection pattern
                        const tokensSnapshot = await db
                            .collection(pattern.collection)
                            .doc(pattern.doc)
                            .collection(pattern.subcollection)
                            .orderBy('timestamp', 'desc')
                            .limit(1)
                            .get();
                        if (!tokensSnapshot.empty) {
                            const tokenDoc = tokensSnapshot.docs[0];
                            const tokenData = tokenDoc.data();
                            for (const field of pattern.fields) {
                                if (tokenData[field]) {
                                    console.log(`Found FCM token for user ${userId} in ${projectType} ${pattern.collection}/${pattern.doc}/${pattern.subcollection}.${field}`);
                                    return tokenData[field];
                                }
                            }
                        }
                    }
                    else {
                        // Handle document pattern
                        const doc = await db.collection(pattern.collection).doc(pattern.doc).get();
                        if (doc.exists) {
                            const data = doc.data();
                            for (const field of pattern.fields) {
                                if (data && data[field]) {
                                    console.log(`Found FCM token for user ${userId} in ${projectType} ${pattern.collection}/${pattern.doc}.${field}`);
                                    return data[field];
                                }
                            }
                        }
                    }
                }
                catch (patternError) {
                    console.warn(`Failed to check ${projectType} pattern ${pattern.collection}/${pattern.doc}:`, patternError);
                }
            }
            console.warn(`No FCM token found for user: ${userId} in ${projectType} Firebase project`);
            return null;
        }
        catch (error) {
            console.error(`Error getting FCM token from ${projectType} Firebase:`, error);
            return null;
        }
    }
    // Option B: Call API endpoint in old project
    async getTokenFromOldAPI(userId) {
        var _a, _b;
        try {
            const oldApiUrl = (_a = functions.config().old_firebase) === null || _a === void 0 ? void 0 : _a.api_url;
            if (!oldApiUrl) {
                console.warn('Old Firebase API URL not configured');
                return null;
            }
            // Make HTTP request to old project API
            const response = await fetch(`${oldApiUrl}/getFCMToken`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${((_b = functions.config().old_firebase) === null || _b === void 0 ? void 0 : _b.api_key) || ''}`
                },
                body: JSON.stringify({ userId })
            });
            if (response.ok) {
                const data = await response.json();
                return data.fcmToken || data.playerID || null;
            }
            console.warn(`Old Firebase API returned ${response.status}: ${response.statusText}`);
            return null;
        }
        catch (error) {
            console.error('Error calling old Firebase API:', error);
            return null;
        }
    }
    // Option C: Use synced tokens from new project
    async getTokenFromNewProject(userId) {
        try {
            // Check if tokens are synced to new project
            const syncedTokenDoc = await db.collection('fcm_tokens').doc(userId).get();
            if (syncedTokenDoc.exists) {
                const data = syncedTokenDoc.data();
                return (data === null || data === void 0 ? void 0 : data.token) || null;
            }
            console.warn(`No synced FCM token found for user: ${userId}`);
            return null;
        }
        catch (error) {
            console.error('Error getting synced FCM token:', error);
            return null;
        }
    }
    // Main method to get FCM tokens from all apps with caching and fallback strategies
    async getFCMTokens(userId) {
        // Check cache first (simplified for now - could cache per app)
        // For now, let's always fetch fresh to ensure we get all available tokens
        // Try strategies in order based on configuration
        let tokens = {};
        // Strategy A: Read from old Firebase projects
        const oldFirebaseTokens = await this.getTokensFromOldFirebase(userId);
        if (oldFirebaseTokens.rested)
            tokens.rested = oldFirebaseTokens.rested;
        if (oldFirebaseTokens.doulaConnect)
            tokens.doulaConnect = oldFirebaseTokens.doulaConnect;
        // Strategy B: API endpoints (if needed later)
        // const apiTokens = await this.getTokensFromOldAPI(userId);
        // Strategy C: Synced tokens from new project
        const syncedToken = await this.getTokenFromNewProject(userId);
        if (syncedToken && !tokens.rested && !tokens.doulaConnect) {
            // If we only have a synced token and don't know which app it's for,
            // we could try sending through both (or add app detection logic)
            tokens.rested = syncedToken; // Default to one for now
        }
        const tokenCount = (tokens.rested ? 1 : 0) + (tokens.doulaConnect ? 1 : 0);
        console.log(`Found ${tokenCount} FCM tokens for user ${userId}:`, tokens);
        return tokens;
    }
    // Legacy method for backward compatibility
    async getFCMToken(userId) {
        const tokens = await this.getFCMTokens(userId);
        // Return first available token for legacy compatibility
        return tokens.rested || tokens.doulaConnect || null;
    }
    // Clear cache for a specific user (useful when token updates)
    clearCache(userId) {
        this.tokenCache.delete(userId);
    }
    // Clear all cached tokens
    clearAllCache() {
        this.tokenCache.clear();
    }
}
// Legacy function for backward compatibility
async function getFCMTokenForUser(userId) {
    const tokenManager = FCMTokenManager.getInstance();
    return tokenManager.getFCMToken(userId);
}
// Get Player IDs for a user from Bubble database
async function getPlayerIdsForUser(userId) {
    var _a, _b, _c;
    try {
        // Get Bubble API configuration from environment
        const bubbleConfig = functions.config().bubble;
        const apiToken = bubbleConfig === null || bubbleConfig === void 0 ? void 0 : bubbleConfig.api_token;
        if (!apiToken) {
            console.warn('Bubble API token not configured - cannot retrieve Player IDs');
            return { rested: [], doulaConnect: [] };
        }
        // Try different API endpoints (dev first for testing, then test, then live)
        const apiEndpoints = [
            bubbleConfig === null || bubbleConfig === void 0 ? void 0 : bubbleConfig.api_url_dev,
            bubbleConfig === null || bubbleConfig === void 0 ? void 0 : bubbleConfig.api_url_test,
            bubbleConfig === null || bubbleConfig === void 0 ? void 0 : bubbleConfig.api_url_live
        ].filter(Boolean);
        if (apiEndpoints.length === 0) {
            console.warn('No Bubble API endpoints configured');
            return { rested: [], doulaConnect: [] };
        }
        // Try each endpoint until we find the user
        for (const apiUrl of apiEndpoints) {
            try {
                // Call Bubble Data API to get user by unique ID
                const response = await fetch(`${apiUrl}/user/${userId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (response.ok) {
                    const userData = await response.json();
                    const playerIds = ((_a = userData.response) === null || _a === void 0 ? void 0 : _a["Player ID(s)"]) || ((_b = userData.response) === null || _b === void 0 ? void 0 : _b.PlayerIDs) || ((_c = userData.response) === null || _c === void 0 ? void 0 : _c.player_ids) || [];
                    if (!Array.isArray(playerIds) || playerIds.length === 0) {
                        console.log(`No Player IDs found for user: ${userId}`);
                        return { rested: [], doulaConnect: [] };
                    }
                    console.log(`Found ${playerIds.length} Player IDs for user ${userId} via ${apiUrl}:`, playerIds);
                    // Since both Rested and DoulaConnect Player IDs are stored together,
                    // we'll send to both apps with the same list
                    // Note: OneSignal will only deliver to devices actually registered with each app
                    return {
                        rested: playerIds,
                        doulaConnect: playerIds
                    };
                }
                console.log(`User not found at ${apiUrl}, trying next endpoint...`);
            }
            catch (endpointError) {
                console.warn(`Error trying endpoint ${apiUrl}:`, endpointError.message);
                continue;
            }
        }
        console.log(`User ${userId} not found in any Bubble API endpoint`);
        return { rested: [], doulaConnect: [] };
    }
    catch (error) {
        console.error('Error getting Player IDs for user:', userId, error);
        return { rested: [], doulaConnect: [] };
    }
}
// Send push notifications for a new message
async function sendPushNotificationsForMessage(message, notificationData) {
    try {
        const { recipients, senderName, primaryCaregiverId, altOrg } = notificationData;
        // Prepare notification content
        const isLogComment = !!message.logId;
        const cleanSenderName = (senderName === null || senderName === void 0 ? void 0 : senderName.trim()) || 'Someone';
        const notificationTitle = cleanSenderName; // Use sender's name as title
        let notificationBody = message.text || message.content || '';
        if (message.imageId || message.imageUrl) {
            notificationBody = 'Sent an image';
        }
        else if (message.audioId || message.audioUrl) {
            notificationBody = 'Audio message';
        }
        // Truncate long messages
        if (notificationBody.length > 100) {
            notificationBody = notificationBody.substring(0, 97) + '...';
        }
        console.log(`Notification content - Title: "${notificationTitle}", Body: "${notificationBody}"`);
        // Get app context for deep links from message data
        const version = message.appVersion || 'live'; // Default to live if not specified
        // Build deep link URL based on version
        let baseUrl = 'https://app.rested.family';
        if (version === 'dev') {
            baseUrl += '/version-62es1';
        }
        else if (version === 'test') {
            baseUrl += '/version-test';
        }
        // live version uses base URL without version path
        const page = isLogComment ? 'log2' : 'chat2';
        let deepLinkUrl = `${baseUrl}/${page}?Sel_Par=${primaryCaregiverId}&alt_org=${altOrg}`;
        if (isLogComment && message.logId) {
            deepLinkUrl += `&sleep_ev=${message.logId}`;
        }
        console.log(`App version: ${version}, Deep link: ${deepLinkUrl}`);
        console.log(`Attempting to send notifications to ${recipients.filter(userId => userId !== message.senderId).length} recipients`);
        // Send notifications to all recipients (except sender)
        const notificationPromises = recipients
            .filter(userId => userId !== message.senderId)
            .map(async (userId) => {
            var _a, _b;
            console.log(`Getting Player IDs for user: ${userId}`);
            // Get Player IDs for this user from Bubble database
            const playerIds = await getPlayerIdsForUser(userId);
            console.log(`Player IDs for user ${userId}:`, {
                rested: ((_a = playerIds.rested) === null || _a === void 0 ? void 0 : _a.length) || 0,
                doulaConnect: ((_b = playerIds.doulaConnect) === null || _b === void 0 ? void 0 : _b.length) || 0
            });
            if (playerIds.rested || playerIds.doulaConnect) {
                console.log(`Sending OneSignal notification to user ${userId}`);
                return sendOneSignalNotificationToAllApps(playerIds, notificationTitle, notificationBody, {
                    messageId: message.id || '',
                    conversationId: message.conversationId || '',
                    childId: message.childId || '',
                    logId: message.logId || '',
                    type: isLogComment ? 'log_comment' : 'chat_message',
                    deepLink: deepLinkUrl
                });
            }
            else {
                console.log(`No Player IDs found for user ${userId}, skipping notification`);
            }
            return false;
        });
        const results = await Promise.allSettled(notificationPromises);
        const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
        console.log(`Sent push notifications to ${successCount} users for message: ${message.id}`);
    }
    catch (error) {
        console.error('Error sending push notifications for message:', error);
    }
}
// Helper function to get push notification recipients and sender info from Bubble
async function getChildPushRecipientsAndSenderInfo(childId, senderId) {
    var _a, _b, _c, _d, _e, _f;
    try {
        console.log(`Getting push recipients for child: ${childId}, sender: ${senderId}`);
        // Get Bubble API configuration
        const bubbleConfig = functions.config().bubble;
        const apiToken = bubbleConfig === null || bubbleConfig === void 0 ? void 0 : bubbleConfig.api_token;
        // Use dev version for testing, will switch to live later
        const apiBaseUrl = (bubbleConfig === null || bubbleConfig === void 0 ? void 0 : bubbleConfig.api_url_dev) || (bubbleConfig === null || bubbleConfig === void 0 ? void 0 : bubbleConfig.api_url_test) || (bubbleConfig === null || bubbleConfig === void 0 ? void 0 : bubbleConfig.api_url_live);
        if (!apiToken || !apiBaseUrl) {
            console.error('Bubble API not configured for push recipients');
            return { recipients: [], senderName: 'Someone', primaryCaregiverId: '', altOrg: '' };
        }
        // Call Bubble API to get recipients list and sender info
        const response = await fetch(`${apiBaseUrl.replace('/obj', '')}/wf/push_recipients_list_for_firebase`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ childId, senderId })
        });
        if (!response.ok) {
            console.error(`Bubble API error for push recipients: ${response.status} ${response.statusText}`);
            return { recipients: [], senderName: 'Someone', primaryCaregiverId: '', altOrg: '' };
        }
        const data = await response.json();
        const recipients = ((_a = data.response) === null || _a === void 0 ? void 0 : _a.userIds) || ((_b = data.response) === null || _b === void 0 ? void 0 : _b.users) || [];
        const senderName = ((_c = data.response) === null || _c === void 0 ? void 0 : _c.senderName) || 'Someone';
        const primaryCaregiverId = ((_d = data.response) === null || _d === void 0 ? void 0 : _d.primaryCaregiverId) || '';
        const altOrg = ((_e = data.response) === null || _e === void 0 ? void 0 : _e.altOrg) || ((_f = data.response) === null || _f === void 0 ? void 0 : _f.alt_org) || '';
        console.log(`Found ${recipients.length} push recipients for child ${childId}:`, recipients);
        console.log(`Sender name: ${senderName}, Primary caregiver: ${primaryCaregiverId}, Alt org: ${altOrg}`);
        return { recipients, senderName, primaryCaregiverId, altOrg };
    }
    catch (error) {
        console.error('Error getting push recipients from Bubble:', error);
        return { recipients: [], senderName: 'Someone', primaryCaregiverId: '', altOrg: '' };
    }
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
        // Get all users who should receive push notifications for this child and sender info
        const notificationData = await getChildPushRecipientsAndSenderInfo(message.childId, message.senderId);
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
        // Send push notifications to recipients
        await sendPushNotificationsForMessage(message, notificationData);
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
        const { userId, fcmToken, title, body } = req.body;
        if (!fcmToken && !userId) {
            res.status(400).json({
                error: 'Must provide either fcmToken or userId'
            });
            return;
        }
        let tokenToUse = fcmToken;
        // If userId provided, try to get FCM token from old Firebase project
        if (userId && !fcmToken) {
            tokenToUse = await getFCMTokenForUser(userId);
            if (!tokenToUse) {
                res.status(404).json({
                    error: 'No FCM token found for user'
                });
                return;
            }
        }
        const success = await sendPushNotification(tokenToUse, title || 'Test Notification', body || 'This is a test message from the new Firebase messaging system');
        const apps = initializeOldFirebaseApps();
        res.json({
            success,
            message: success ? 'Push notification sent' : 'Failed to send push notification',
            fcmToken: tokenToUse,
            firebaseAppsConfigured: {
                rested: !!apps.rested,
                doulaConnect: !!apps.doulaConnect,
                total: (apps.rested ? 1 : 0) + (apps.doulaConnect ? 1 : 0)
            }
        });
    }
    catch (error) {
        console.error('Error testing push notification:', error);
        res.status(500).json({
            error: 'Internal server error'
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
        if (!userId || !fcmToken) {
            res.status(400).json({
                error: 'Missing required parameters: userId and fcmToken'
            });
            return;
        }
        // Store the FCM token in the new project for quick access
        await db.collection('fcm_tokens').doc(userId).set({
            token: fcmToken,
            userId,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Clear cache for this user so new token is picked up
        const tokenManager = FCMTokenManager.getInstance();
        tokenManager.clearCache(userId);
        res.json({
            success: true,
            message: 'FCM token synced successfully',
            userId
        });
    }
    catch (error) {
        console.error('Error syncing FCM token:', error);
        res.status(500).json({
            error: 'Internal server error'
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
        if (!oldUserId && !newUserId && !email) {
            res.status(400).json({
                error: 'Must provide oldUserId, newUserId, or email'
            });
            return;
        }
        // Check if mapping exists
        let mappingDoc = null;
        if (oldUserId) {
            mappingDoc = await db.collection('user_mappings').doc(oldUserId).get();
        }
        else if (newUserId) {
            const mappingQuery = await db.collection('user_mappings').where('newUserId', '==', newUserId).limit(1).get();
            mappingDoc = mappingQuery.empty ? null : mappingQuery.docs[0];
        }
        else if (email) {
            const mappingQuery = await db.collection('user_mappings').where('email', '==', email).limit(1).get();
            mappingDoc = mappingQuery.empty ? null : mappingQuery.docs[0];
        }
        if (mappingDoc && mappingDoc.exists) {
            const data = mappingDoc.data();
            res.json({
                found: true,
                mapping: {
                    oldUserId: (data === null || data === void 0 ? void 0 : data.oldUserId) || mappingDoc.id,
                    newUserId: data === null || data === void 0 ? void 0 : data.newUserId,
                    email: data === null || data === void 0 ? void 0 : data.email,
                    name: data === null || data === void 0 ? void 0 : data.name,
                    createdAt: data === null || data === void 0 ? void 0 : data.createdAt,
                    lastUpdated: data === null || data === void 0 ? void 0 : data.lastUpdated
                }
            });
        }
        else {
            res.json({
                found: false,
                message: 'No mapping found'
            });
        }
    }
    catch (error) {
        console.error('Error getting user mapping:', error);
        res.status(500).json({
            error: 'Internal server error'
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
        const { oldUserId, newUserId, email, name } = req.body;
        if (!oldUserId || !newUserId) {
            res.status(400).json({
                error: 'Missing required parameters: oldUserId and newUserId'
            });
            return;
        }
        // Create or update mapping
        const mappingData = {
            oldUserId,
            newUserId,
            email: email || null,
            name: name || null,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        };
        const mappingRef = db.collection('user_mappings').doc(oldUserId);
        const existingMapping = await mappingRef.get();
        if (existingMapping.exists) {
            await mappingRef.update(mappingData);
        }
        else {
            await mappingRef.set(Object.assign(Object.assign({}, mappingData), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
        }
        res.json({
            success: true,
            message: 'User mapping created/updated successfully',
            mapping: {
                oldUserId,
                newUserId,
                email,
                name
            }
        });
    }
    catch (error) {
        console.error('Error creating user mapping:', error);
        res.status(500).json({
            error: 'Internal server error'
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
        const { project } = req.query; // 'rested' or 'doulaConnect'
        if (!project || (project !== 'rested' && project !== 'doulaConnect')) {
            res.status(400).json({
                error: 'Must specify project: rested or doulaConnect'
            });
            return;
        }
        const apps = initializeOldFirebaseApps();
        const app = project === 'rested' ? apps.rested : apps.doulaConnect;
        if (!app) {
            res.status(404).json({
                error: `${project} Firebase app not configured`
            });
            return;
        }
        const explorationResults = {
            project,
            databaseType: 'unknown',
            collections: {},
            sampleDocuments: {},
            errors: []
        };
        // Try Realtime Database (most Bubble apps use this) with timeout
        try {
            const rtdb = admin.database(app);
            // Add timeout wrapper
            const exploreWithTimeout = Promise.race([
                exploreRealtimeDatabase(rtdb, explorationResults),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Database exploration took too long')), 10000))
            ]);
            await exploreWithTimeout;
            explorationResults.databaseType = 'realtime';
        }
        catch (rtdbError) {
            explorationResults.errors.push(`Realtime Database error: ${rtdbError.message}`);
            // Fallback to Firestore
            try {
                const db = admin.firestore(app);
                await exploreFirestore(db, explorationResults);
                explorationResults.databaseType = 'firestore';
            }
            catch (firestoreError) {
                explorationResults.errors.push(`Firestore not available: ${firestoreError.message}`);
            }
        }
        res.json(explorationResults);
    }
    catch (error) {
        console.error('Error exploring FCM token storage:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
// Helper function to explore Realtime Database
async function exploreRealtimeDatabase(rtdb, results) {
    // First, just try to connect to the root
    try {
        const rootSnapshot = await rtdb.ref('/').limitToFirst(1).once('value');
        const rootData = rootSnapshot.val();
        if (rootData === null) {
            results.errors.push('Realtime Database is empty or does not exist');
            return;
        }
        // Get the top-level keys
        const topLevelKeys = Object.keys(rootData);
        results.collections.database_root = {
            exists: true,
            type: 'realtime_database_root',
            topLevelKeys: topLevelKeys.slice(0, 10),
            sampleDocs: []
        };
        // Check each top-level path for FCM tokens
        const pathsToCheck = topLevelKeys.slice(0, 5); // Check first 5 paths
        for (const path of pathsToCheck) {
            try {
                const snapshot = await rtdb.ref(path).limitToFirst(2).once('value');
                const data = snapshot.val();
                results.collections[path] = {
                    exists: data !== null,
                    type: 'realtime_database_node',
                    hasData: !!data,
                    sampleKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 3) : [],
                    sampleDocs: []
                };
                if (data && typeof data === 'object') {
                    // Analyze first few entries
                    const entries = Object.entries(data).slice(0, 2);
                    for (const [key, value] of entries) {
                        if (typeof value === 'object' && value !== null) {
                            const sampleDoc = {
                                id: key,
                                fields: Object.keys(value),
                                hasTokenFields: []
                            };
                            // Check for common FCM token field names
                            const tokenFields = ['fcmToken', 'playerID', 'deviceToken', 'pushToken', 'token', 'registrationToken', 'player_id'];
                            tokenFields.forEach(field => {
                                if (value[field]) {
                                    sampleDoc.hasTokenFields.push({
                                        field,
                                        valueType: typeof value[field],
                                        valueLength: String(value[field]).length,
                                        valuePrefix: String(value[field]).substring(0, 20) + '...'
                                    });
                                }
                            });
                            results.collections[path].sampleDocs.push(sampleDoc);
                        }
                    }
                }
            }
            catch (error) {
                results.errors.push(`Error checking Realtime DB path ${path}: ${error.message}`);
            }
        }
    }
    catch (error) {
        results.errors.push(`Error connecting to Realtime Database root: ${error.message}`);
    }
}
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
        if (!message || !type) {
            console.error('Missing required parameters:', { message, type });
            res.status(400).json({
                error: 'Missing required parameters: message and type'
            });
            return;
        }
        // Your OneSignal Player ID
        const davidPlayerId = '04618fe6-50c8-4c2a-bb64-9010776e3ec1';
        console.log('Sending OneSignal notification:', {
            app: 'rested',
            playerId: davidPlayerId,
            title: `Claude Code - ${type}`,
            message
        });
        // Send notification to Rested app
        const result = await sendOneSignalNotification('rested', [davidPlayerId], `Claude Code - ${type}`, message);
        console.log('OneSignal notification result:', result);
        res.json({
            success: result.success,
            message: result.success ? 'Claude notification sent successfully' : 'Failed to send Claude notification',
            type,
            notificationId: result.id,
            recipients: result.recipients || 0,
            details: result.error || null
        });
    }
    catch (error) {
        console.error('Error sending Claude notification:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});
// Helper function to explore Firestore (for fallback)
async function exploreFirestore(db, results) {
    const collectionsToCheck = ['users', 'fcmTokens', 'tokens', 'devices', 'players'];
    for (const collectionName of collectionsToCheck) {
        try {
            const snapshot = await db.collection(collectionName).limit(3).get();
            results.collections[collectionName] = {
                exists: !snapshot.empty,
                type: 'firestore_collection',
                documentCount: snapshot.size,
                sampleDocs: []
            };
            if (!snapshot.empty) {
                snapshot.docs.forEach((doc) => {
                    const data = doc.data();
                    const sampleDoc = {
                        id: doc.id,
                        fields: Object.keys(data),
                        hasTokenFields: []
                    };
                    const tokenFields = ['fcmToken', 'playerID', 'deviceToken', 'pushToken', 'token', 'registrationToken'];
                    tokenFields.forEach(field => {
                        if (data[field]) {
                            sampleDoc.hasTokenFields.push({
                                field,
                                valueLength: String(data[field]).length,
                                valuePrefix: String(data[field]).substring(0, 20) + '...'
                            });
                        }
                    });
                    results.collections[collectionName].sampleDocs.push(sampleDoc);
                });
            }
        }
        catch (error) {
            results.errors.push(`Error checking Firestore collection ${collectionName}: ${error.message}`);
        }
    }
}
//# sourceMappingURL=index-original-backup.js.map