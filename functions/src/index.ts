import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize the new Firebase project (default)
admin.initializeApp();
const db = admin.firestore();

// Initialize connections to multiple old Firebase projects for push notifications
let restedFirebaseApp: admin.app.App | null = null;
let doulaConnectFirebaseApp: admin.app.App | null = null;

function initializeOldFirebaseApps() {
  const apps = {
    rested: initializeRestedFirebaseApp(),
    doulaConnect: initializeDoulaConnectFirebaseApp()
  };
  
  return apps;
}

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

// Multi-Firebase push notification service
async function sendPushNotificationToAllApps(
  tokens: { rested?: string; doulaConnect?: string },
  title: string,
  body: string,
  data?: { [key: string]: string }
) {
  const apps = initializeOldFirebaseApps();
  const results = [];

  // Send to Rested app if token available
  if (tokens.rested && apps.rested) {
    const restedResult = await sendPushNotificationViaApp(
      apps.rested, 
      tokens.rested, 
      title, 
      body, 
      data,
      'Rested'
    );
    results.push(restedResult);
  }

  // Send to DoulaConnect app if token available  
  if (tokens.doulaConnect && apps.doulaConnect) {
    const doulaConnectResult = await sendPushNotificationViaApp(
      apps.doulaConnect, 
      tokens.doulaConnect, 
      title, 
      body, 
      data,
      'DoulaConnect'
    );
    results.push(doulaConnectResult);
  }

  const successCount = results.filter(r => r).length;
  console.log(`Sent ${successCount}/${results.length} push notifications successfully`);
  
  return successCount > 0;
}

// Helper function to send via specific Firebase app
async function sendPushNotificationViaApp(
  firebaseApp: admin.app.App,
  fcmToken: string,
  title: string,
  body: string,
  data?: { [key: string]: string },
  appName?: string
) {
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
  } catch (error) {
    console.error(`Failed to send push notification via ${appName}:`, error);
    return false;
  }
}

// Legacy function for single-app compatibility
async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
  data?: { [key: string]: string }
) {
  // Try sending via both apps (for testing purposes)
  const apps = initializeOldFirebaseApps();
  
  if (apps.rested) {
    return sendPushNotificationViaApp(apps.rested, fcmToken, title, body, data, 'Rested');
  } else if (apps.doulaConnect) {
    return sendPushNotificationViaApp(apps.doulaConnect, fcmToken, title, body, data, 'DoulaConnect');
  }
  
  console.warn('No Firebase apps available - skipping push notification');
  return false;
}

// FCM Token Management Service
class FCMTokenManager {
  private static instance: FCMTokenManager;
  private tokenCache: Map<string, { token: string; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  static getInstance(): FCMTokenManager {
    if (!FCMTokenManager.instance) {
      FCMTokenManager.instance = new FCMTokenManager();
    }
    return FCMTokenManager.instance;
  }

  // Option A: Read directly from multiple old Firebase databases
  async getTokensFromOldFirebase(userId: string): Promise<{ rested?: string; doulaConnect?: string }> {
    const tokens: { rested?: string; doulaConnect?: string } = {};
    
    // Get token from Rested Firebase project
    tokens.rested = await this.getTokenFromSpecificFirebaseProject(userId, 'rested');
    
    // Get token from DoulaConnect Firebase project  
    tokens.doulaConnect = await this.getTokenFromSpecificFirebaseProject(userId, 'doulaConnect');
    
    return tokens;
  }

  private async getTokenFromSpecificFirebaseProject(userId: string, projectType: 'rested' | 'doulaConnect'): Promise<string | null> {
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
          } else {
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
        } catch (patternError) {
          console.warn(`Failed to check ${projectType} pattern ${pattern.collection}/${pattern.doc}:`, patternError);
        }
      }

      console.warn(`No FCM token found for user: ${userId} in ${projectType} Firebase project`);
      return null;

    } catch (error) {
      console.error(`Error getting FCM token from ${projectType} Firebase:`, error);
      return null;
    }
  }

  // Option B: Call API endpoint in old project
  async getTokenFromOldAPI(userId: string): Promise<string | null> {
    try {
      const oldApiUrl = functions.config().old_firebase?.api_url;
      if (!oldApiUrl) {
        console.warn('Old Firebase API URL not configured');
        return null;
      }

      // Make HTTP request to old project API
      const response = await fetch(`${oldApiUrl}/getFCMToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${functions.config().old_firebase?.api_key || ''}`
        },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const data = await response.json();
        return data.fcmToken || data.playerID || null;
      }

      console.warn(`Old Firebase API returned ${response.status}: ${response.statusText}`);
      return null;

    } catch (error) {
      console.error('Error calling old Firebase API:', error);
      return null;
    }
  }

  // Option C: Use synced tokens from new project
  async getTokenFromNewProject(userId: string): Promise<string | null> {
    try {
      // Check if tokens are synced to new project
      const syncedTokenDoc = await db.collection('fcm_tokens').doc(userId).get();
      
      if (syncedTokenDoc.exists) {
        const data = syncedTokenDoc.data();
        return data?.token || null;
      }

      console.warn(`No synced FCM token found for user: ${userId}`);
      return null;

    } catch (error) {
      console.error('Error getting synced FCM token:', error);
      return null;
    }
  }

  // Main method to get FCM tokens from all apps with caching and fallback strategies
  async getFCMTokens(userId: string): Promise<{ rested?: string; doulaConnect?: string }> {
    // Check cache first (simplified for now - could cache per app)
    // For now, let's always fetch fresh to ensure we get all available tokens
    
    // Try strategies in order based on configuration
    let tokens: { rested?: string; doulaConnect?: string } = {};
    
    // Strategy A: Read from old Firebase projects
    const oldFirebaseTokens = await this.getTokensFromOldFirebase(userId);
    if (oldFirebaseTokens.rested) tokens.rested = oldFirebaseTokens.rested;
    if (oldFirebaseTokens.doulaConnect) tokens.doulaConnect = oldFirebaseTokens.doulaConnect;
    
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
  async getFCMToken(userId: string): Promise<string | null> {
    const tokens = await this.getFCMTokens(userId);
    // Return first available token for legacy compatibility
    return tokens.rested || tokens.doulaConnect || null;
  }

  // Clear cache for a specific user (useful when token updates)
  clearCache(userId: string) {
    this.tokenCache.delete(userId);
  }

  // Clear all cached tokens
  clearAllCache() {
    this.tokenCache.clear();
  }
}

// Legacy function for backward compatibility
async function getFCMTokenForUser(userId: string): Promise<string | null> {
  const tokenManager = FCMTokenManager.getInstance();
  return tokenManager.getFCMToken(userId);
}

// Send push notifications for a new message
async function sendPushNotificationsForMessage(message: any, participants: string[]) {
  try {
    // Get sender info for the notification
    const senderDoc = await db.collection('users').doc(message.senderId).get();
    const senderName = senderDoc.exists ? senderDoc.data()?.name || 'Someone' : 'Someone';
    
    // Prepare notification content
    const isLogComment = !!message.logId;
    const notificationTitle = isLogComment ? 'New Log Comment' : 'New Message';
    
    let notificationBody = message.content || '';
    if (message.imageUrl) {
      notificationBody = '📷 Photo';
    } else if (message.audioUrl) {
      notificationBody = '🎵 Audio message';
    }
    
    // Truncate long messages
    if (notificationBody.length > 100) {
      notificationBody = notificationBody.substring(0, 97) + '...';
    }
    
    const finalBody = `${senderName}: ${notificationBody}`;
    
    // Send notifications to all participants (except sender)
    const notificationPromises = participants
      .filter(userId => userId !== message.senderId)
      .map(async (userId) => {
        // Get FCM tokens for this user from all Firebase projects
        const tokenManager = FCMTokenManager.getInstance();
        const tokens = await tokenManager.getFCMTokens(userId);
        
        if (tokens.rested || tokens.doulaConnect) {
          return sendPushNotificationToAllApps(
            tokens,
            notificationTitle,
            finalBody,
            {
              messageId: message.id || '',
              conversationId: message.conversationId || '',
              childId: message.childId || '',
              logId: message.logId || '',
              type: isLogComment ? 'log_comment' : 'chat_message'
            }
          );
        }
        return false;
      });
    
    const results = await Promise.allSettled(notificationPromises);
    const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    console.log(`Sent push notifications to ${successCount} users for message: ${message.id}`);
    
  } catch (error) {
    console.error('Error sending push notifications for message:', error);
  }
}

// Helper function to get conversation participants
async function getConversationParticipants(conversationId: string): Promise<string[]> {
  const conversationDoc = await db.collection('conversations').doc(conversationId).get();
  if (!conversationDoc.exists) {
    console.error('Conversation not found:', conversationId);
    return [];
  }
  return conversationDoc.data()?.participants || [];
}

// Trigger: When message is created - update unread counters
export const onMessageCreated = functions.firestore
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
        
        const uniqueUsers = new Set<string>();
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
        if (userId === message.senderId) continue;
        
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
        } else {
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
      await sendPushNotificationsForMessage(message, participants);
      
    } catch (error) {
      console.error('Error updating unread counters:', error);
    }
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
      chatUnreadCount: data?.chatUnreadCount || 0,
      logUnreadCount: data?.logUnreadCount || 0,
      logUnreadByLogId: data?.logUnreadByLogId || {},
      totalUnreadCount: data?.totalUnreadCount || 0,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Error getting unread counters:', error);
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

    // Get the current counter to know how many to decrement
    const counterId = `user_${userId}_child_${childId}`;
    const counterRef = db.doc(`unread_counters/${counterId}`);
    const counterDoc = await counterRef.get();
    
    if (!counterDoc.exists || counterDoc.data()?.chatUnreadCount === 0) {
      res.json({
        success: true,
        message: 'No unread chat messages'
      });
      return;
    }

    const chatUnreadCount = counterDoc.data()?.chatUnreadCount || 0;

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
    const logUnreadCount = data?.logUnreadByLogId?.[logId] || 0;

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

    const success = await sendPushNotification(
      tokenToUse,
      title || 'Test Notification',
      body || 'This is a test message from the new Firebase messaging system'
    );

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

  } catch (error) {
    console.error('Error testing push notification:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
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

  } catch (error) {
    console.error('Error syncing FCM token:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
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

    if (!oldUserId && !newUserId && !email) {
      res.status(400).json({ 
        error: 'Must provide oldUserId, newUserId, or email' 
      });
      return;
    }

    // Check if mapping exists
    let mappingDoc: admin.firestore.DocumentSnapshot | null = null;
    
    if (oldUserId) {
      mappingDoc = await db.collection('user_mappings').doc(oldUserId).get();
    } else if (newUserId) {
      const mappingQuery = await db.collection('user_mappings').where('newUserId', '==', newUserId).limit(1).get();
      mappingDoc = mappingQuery.empty ? null : mappingQuery.docs[0];
    } else if (email) {
      const mappingQuery = await db.collection('user_mappings').where('email', '==', email).limit(1).get();
      mappingDoc = mappingQuery.empty ? null : mappingQuery.docs[0];
    }

    if (mappingDoc && mappingDoc.exists) {
      const data = mappingDoc.data();
      res.json({
        found: true,
        mapping: {
          oldUserId: data?.oldUserId || mappingDoc.id,
          newUserId: data?.newUserId,
          email: data?.email,
          name: data?.name,
          createdAt: data?.createdAt,
          lastUpdated: data?.lastUpdated
        }
      });
    } else {
      res.json({
        found: false,
        message: 'No mapping found'
      });
    }

  } catch (error) {
    console.error('Error getting user mapping:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
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
    } else {
      await mappingRef.set({
        ...mappingData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
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

  } catch (error) {
    console.error('Error creating user mapping:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
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
    } catch (rtdbError) {
      explorationResults.errors.push(`Realtime Database error: ${rtdbError.message}`);
      
      // Fallback to Firestore
      try {
        const db = admin.firestore(app);
        await exploreFirestore(db, explorationResults);
        explorationResults.databaseType = 'firestore';
      } catch (firestoreError) {
        explorationResults.errors.push(`Firestore not available: ${firestoreError.message}`);
      }
    }

    res.json(explorationResults);

  } catch (error) {
    console.error('Error exploring FCM token storage:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Helper function to explore Realtime Database
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
      } catch (error) {
        results.errors.push(`Error checking Realtime DB path ${path}: ${error.message}`);
      }
    }
  } catch (error) {
    results.errors.push(`Error connecting to Realtime Database root: ${error.message}`);
  }
}

// Helper function to explore Firestore (for fallback)
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
    } catch (error) {
      results.errors.push(`Error checking Firestore collection ${collectionName}: ${error.message}`);
    }
  }
}