"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFCMTokenForUser = exports.FCMTokenManager = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const firebase_apps_1 = require("./firebase-apps");
/**
 * FCM Token Management Service
 */
class FCMTokenManager {
    constructor(db) {
        this.tokenCache = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
        this.db = db;
    }
    static getInstance(db) {
        if (!FCMTokenManager.instance) {
            FCMTokenManager.instance = new FCMTokenManager(db);
        }
        return FCMTokenManager.instance;
    }
    /**
     * Read directly from multiple old Firebase databases
     */
    async getTokensFromOldFirebase(userId) {
        const tokens = {};
        // Get token from Rested Firebase project
        tokens.rested = await this.getTokenFromSpecificFirebaseProject(userId, 'rested') || undefined;
        // Get token from DoulaConnect Firebase project  
        tokens.doulaConnect = await this.getTokenFromSpecificFirebaseProject(userId, 'doulaConnect') || undefined;
        return tokens;
    }
    async getTokenFromSpecificFirebaseProject(userId, projectType) {
        try {
            const app = (0, firebase_apps_1.getFirebaseApp)(projectType);
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
    /**
     * Call API endpoint in old project
     */
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
    /**
     * Use synced tokens from new project
     */
    async getTokenFromNewProject(userId) {
        try {
            // Check if tokens are synced to new project
            const syncedTokenDoc = await this.db.collection('fcm_tokens').doc(userId).get();
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
    /**
     * Main method to get FCM tokens from all apps with caching and fallback strategies
     */
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
    /**
     * Legacy method for backward compatibility
     */
    async getFCMToken(userId) {
        const tokens = await this.getFCMTokens(userId);
        // Return first available token for legacy compatibility
        return tokens.rested || tokens.doulaConnect || null;
    }
    /**
     * Clear cache for a specific user (useful when token updates)
     */
    clearCache(userId) {
        this.tokenCache.delete(userId);
    }
    /**
     * Clear all cached tokens
     */
    clearAllCache() {
        this.tokenCache.clear();
    }
}
exports.FCMTokenManager = FCMTokenManager;
/**
 * Legacy function for backward compatibility
 */
async function getFCMTokenForUser(userId, db) {
    const tokenManager = FCMTokenManager.getInstance(db);
    return tokenManager.getFCMToken(userId);
}
exports.getFCMTokenForUser = getFCMTokenForUser;
//# sourceMappingURL=fcm-tokens.js.map