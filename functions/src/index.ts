import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize the new Firebase project (default)
admin.initializeApp();
const db = admin.firestore();

// Import services
import { 
  handleMessageCreated, 
  markChatAsReadForUser, 
  markLogAsReadForUser, 
  markAllLogsAsReadForUser, 
  getUnreadCountersForUser, 
  getFamilyUnreadCounters as getFamilyUnreadCountersService 
} from "./services/unread-counters";
import { 
  getUserMapping as getUserMappingService, 
  createUserMapping as createUserMappingService, 
  syncFCMToken 
} from "./services/user-management";
import { 
  testPushNotification as testPushNotificationService, 
  sendClaudeNotification as sendClaudeNotificationService, 
  exploreFCMTokenStorage as exploreFCMTokenStorageService 
} from "./services/test-endpoints";
import { FCMTokenManager } from "./services/fcm-tokens";

// Trigger: When message is created - update unread counters
export const onMessageCreated = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    await handleMessageCreated(snap, context, db);
  });

// API endpoint for Bubble to get unread counts for a specific user/child combo
export const getUnreadCounters = functions.https.onRequest(async (req, res) => {
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

    const result = await getUnreadCountersForUser(userId as string, childId as string, db);
    res.json(result);

  } catch (error) {
    console.error('Error getting unread counters:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// API endpoint for Bubble to get family unread counts
export const getFamilyUnreadCounters = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { userId, originalChildId } = req.query;

    if (!userId || !originalChildId) {
      res.status(400).json({ 
        error: 'Missing required parameters: userId and originalChildId' 
      });
      return;
    }

    const result = await getFamilyUnreadCountersService(userId as string, originalChildId as string, db);
    res.json(result);

  } catch (error) {
    console.error('Error getting family unread counters:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// API endpoint to mark all chat messages as read
export const markChatAsRead = functions.https.onRequest(async (req, res) => {
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

    const result = await markChatAsReadForUser(userId, childId, conversationId, db);
    res.json(result);

  } catch (error) {
    console.error('Error marking chat as read:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// API endpoint to mark log comments as read
export const markLogAsRead = functions.https.onRequest(async (req, res) => {
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

    const result = await markLogAsReadForUser(userId, childId, logId, db);
    res.json(result);

  } catch (error) {
    console.error('Error marking log as read:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// API endpoint to mark all messages as read (for the CommentsModal "Mark all as read" button)
export const markAllLogsAsRead = functions.https.onRequest(async (req, res) => {
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

    const result = await markAllLogsAsReadForUser(userId, childId, db);
    res.json(result);

  } catch (error) {
    console.error('Error marking all logs as read:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Test endpoint for push notifications
export const testPushNotification = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const result = await testPushNotificationService(req.body, db);
    res.json(result);

  } catch (error: any) {
    console.error('Error testing push notification:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Sync FCM tokens from old Firebase project to new project
export const syncFCMTokens = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { userId, fcmToken } = req.body;
    const result = await syncFCMToken(userId, fcmToken, db);
    
    // Clear cache for this user so new token is picked up
    const tokenManager = FCMTokenManager.getInstance(db);
    tokenManager.clearCache(userId);
    
    res.json(result);

  } catch (error: any) {
    console.error('Error syncing FCM token:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Get user identity mapping between old and new systems
export const getUserMapping = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const { oldUserId, newUserId, email } = req.method === 'GET' ? req.query : req.body;
    const result = await getUserMappingService({ oldUserId, newUserId, email }, db);
    res.json(result);

  } catch (error: any) {
    console.error('Error getting user mapping:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Create or update user identity mapping
export const createUserMapping = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const result = await createUserMappingService(req.body, db);
    res.json(result);

  } catch (error: any) {
    console.error('Error creating user mapping:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Diagnostic endpoint to explore FCM token storage patterns (Firestore + Realtime Database)
export const exploreFCMTokenStorage = functions.https.onRequest(async (req, res) => {
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
    const result = await exploreFCMTokenStorageService(project as 'rested' | 'doulaConnect');
    res.json(result);

  } catch (error: any) {
    console.error('Error exploring FCM token storage:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Claude Code push notification function
export const sendClaudeNotification = functions.https.onRequest(async (req, res) => {
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
    const result = await sendClaudeNotificationService(message, type);
    res.json(result);

  } catch (error: any) {
    console.error('Error sending Claude notification:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});