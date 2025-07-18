import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { getFCMTokenForUser } from "./fcm-tokens";
import { sendPushNotification, sendOneSignalNotification } from "./push-notifications";
import { getFirebaseApp } from "./firebase-apps";

/**
 * Test push notification functionality
 */
export async function testPushNotification(
  params: { userId?: string; fcmToken?: string; title?: string; body?: string },
  db: admin.firestore.Firestore
) {
  const { userId, fcmToken, title, body } = params;

  if (!fcmToken && !userId) {
    throw new Error('Must provide either fcmToken or userId');
  }

  let tokenToUse = fcmToken;
  
  // If userId provided, try to get FCM token from old Firebase project
  if (userId && !fcmToken) {
    tokenToUse = await getFCMTokenForUser(userId, db);
    if (!tokenToUse) {
      throw new Error('No FCM token found for user');
    }
  }

  const success = await sendPushNotification(
    tokenToUse!,
    title || 'Test Notification',
    body || 'This is a test message from the new Firebase messaging system'
  );

  return {
    success,
    message: success ? 'Push notification sent' : 'Failed to send push notification',
    fcmToken: tokenToUse
  };
}

/**
 * Send Claude Code notification
 */
export async function sendClaudeNotification(
  message: string,
  type: string
) {
  if (!message || !type) {
    throw new Error('Missing required parameters: message and type');
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
  const result = await sendOneSignalNotification(
    'rested',
    [davidPlayerId],
    `Claude Code - ${type}`,
    message
  );

  console.log('OneSignal notification result:', result);

  return {
    success: result.success,
    message: result.success ? 'Claude notification sent successfully' : 'Failed to send Claude notification',
    type,
    notificationId: result.id,
    recipients: result.recipients || 0,
    details: result.error || null
  };
}

/**
 * Diagnostic endpoint to explore FCM token storage patterns
 */
export async function exploreFCMTokenStorage(project: 'rested' | 'doulaConnect') {
  if (!project || (project !== 'rested' && project !== 'doulaConnect')) {
    throw new Error('Must specify project: rested or doulaConnect');
  }

  const app = getFirebaseApp(project);
  
  if (!app) {
    throw new Error(`${project} Firebase app not configured`);
  }

  const explorationResults: {
    project: string;
    databaseType: string;
    collections: { [key: string]: any };
    sampleDocuments: { [key: string]: any };
    errors: string[];
  } = {
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
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: Database exploration took too long')), 10000)
      )
    ]);
    
    await exploreWithTimeout;
    explorationResults.databaseType = 'realtime';
  } catch (rtdbError: any) {
    explorationResults.errors.push(`Realtime Database error: ${rtdbError.message}`);
    
    // Fallback to Firestore
    try {
      const db = admin.firestore(app);
      await exploreFirestore(db, explorationResults);
      explorationResults.databaseType = 'firestore';
    } catch (firestoreError: any) {
      explorationResults.errors.push(`Firestore not available: ${firestoreError.message}`);
    }
  }

  return explorationResults;
}

/**
 * Helper function to explore Realtime Database
 */
async function exploreRealtimeDatabase(rtdb: admin.database.Database, results: any) {
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
      topLevelKeys: topLevelKeys.slice(0, 10), // Show first 10 keys
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
                if ((value as any)[field]) {
                  (sampleDoc.hasTokenFields as any).push({
                    field,
                    valueType: typeof (value as any)[field],
                    valueLength: String((value as any)[field]).length,
                    valuePrefix: String((value as any)[field]).substring(0, 20) + '...'
                  });
                }
              });

              results.collections[path].sampleDocs.push(sampleDoc);
            }
          }
        }
      } catch (error: any) {
        results.errors.push(`Error checking Realtime DB path ${path}: ${error.message}`);
      }
    }
  } catch (error: any) {
    results.errors.push(`Error connecting to Realtime Database root: ${error.message}`);
  }
}

/**
 * Helper function to explore Firestore (for fallback)
 */
async function exploreFirestore(db: admin.firestore.Firestore, results: any) {
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
              (sampleDoc.hasTokenFields as any).push({
                field,
                valueLength: String(data[field]).length,
                valuePrefix: String(data[field]).substring(0, 20) + '...'
              });
            }
          });

          results.collections[collectionName].sampleDocs.push(sampleDoc);
        });
      }
    } catch (error: any) {
      results.errors.push(`Error checking Firestore collection ${collectionName}: ${error.message}`);
    }
  }
}