"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirebaseApp = exports.initializeOldFirebaseApps = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
// Singleton instances for multiple Firebase projects
let restedFirebaseApp = null;
let doulaConnectFirebaseApp = null;
/**
 * Initialize both old Firebase projects for push notifications
 */
function initializeOldFirebaseApps() {
    const apps = {
        rested: initializeRestedFirebaseApp(),
        doulaConnect: initializeDoulaConnectFirebaseApp()
    };
    return apps;
}
exports.initializeOldFirebaseApps = initializeOldFirebaseApps;
/**
 * Initialize Rested Firebase project
 */
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
/**
 * Initialize DoulaConnect Firebase project
 */
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
/**
 * Get specific Firebase app instance
 */
function getFirebaseApp(project) {
    const apps = initializeOldFirebaseApps();
    return project === 'rested' ? apps.rested : apps.doulaConnect;
}
exports.getFirebaseApp = getFirebaseApp;
//# sourceMappingURL=firebase-apps.js.map