import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Singleton instances for multiple Firebase projects
let restedFirebaseApp: admin.app.App | null = null;
let doulaConnectFirebaseApp: admin.app.App | null = null;

/**
 * Initialize both old Firebase projects for push notifications
 */
export function initializeOldFirebaseApps() {
  const apps = {
    rested: initializeRestedFirebaseApp(),
    doulaConnect: initializeDoulaConnectFirebaseApp()
  };
  
  return apps;
}

/**
 * Initialize Rested Firebase project
 */
function initializeRestedFirebaseApp() {
  if (restedFirebaseApp) {
    return restedFirebaseApp;
  }

  try {
    // Get Rested Firebase project service account from environment
    const restedCredentials = functions.config().rested_firebase?.service_account;
    
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
  } catch (error) {
    console.error('Failed to initialize Rested Firebase project:', error);
    return null;
  }
}

/**
 * Initialize DoulaConnect Firebase project
 */
function initializeDoulaConnectFirebaseApp() {
  if (doulaConnectFirebaseApp) {
    return doulaConnectFirebaseApp;
  }

  try {
    // Get DoulaConnect Firebase project service account from environment
    const doulaConnectCredentials = functions.config().doulaconnect_firebase?.service_account;
    
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
  } catch (error) {
    console.error('Failed to initialize DoulaConnect Firebase project:', error);
    return null;
  }
}

/**
 * Get specific Firebase app instance
 */
export function getFirebaseApp(project: 'rested' | 'doulaConnect'): admin.app.App | null {
  const apps = initializeOldFirebaseApps();
  return project === 'rested' ? apps.rested : apps.doulaConnect;
}