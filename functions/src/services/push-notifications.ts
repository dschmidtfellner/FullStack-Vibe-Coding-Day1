import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { initializeOldFirebaseApps } from "./firebase-apps";
import { PlayerIds, MessageData, PushNotificationData } from "../types";

/**
 * OneSignal push notification service
 */
export async function sendOneSignalNotificationToAllApps(
  playerIds: PlayerIds,
  title: string,
  body: string,
  data?: { [key: string]: string }
) {
  const results = [];

  // Send to Rested app users
  if (playerIds.rested && playerIds.rested.length > 0) {
    const restedResult = await sendOneSignalNotification(
      'rested',
      playerIds.rested,
      title,
      body,
      data
    );
    results.push(restedResult);
  }

  // Send to DoulaConnect app users
  if (playerIds.doulaConnect && playerIds.doulaConnect.length > 0) {
    const doulaConnectResult = await sendOneSignalNotification(
      'doulaConnect',
      playerIds.doulaConnect,
      title,
      body,
      data
    );
    results.push(doulaConnectResult);
  }

  const successCount = results.filter(r => r.success).length;
  console.log(`Sent ${successCount}/${results.length} OneSignal notifications successfully`);
  
  return successCount > 0;
}

/**
 * Send notification via OneSignal REST API
 */
export async function sendOneSignalNotification(
  app: 'rested' | 'doulaConnect',
  playerIds: string[],
  title: string,
  body: string,
  data?: { [key: string]: string }
) {
  try {
    const config = functions.config().onesignal;
    
    const appId = app === 'rested' ? config?.rested_app_id : config?.doulaconnect_app_id;
    const apiKey = app === 'rested' ? config?.rested_api_key : config?.doulaconnect_api_key;
    
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
        onLoadUrl: data?.deepLink || '' // BDK Native specific key for navigation
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
    } else {
      console.error(`OneSignal notification failed for ${app}:`, result);
      return { success: false, error: result };
    }

  } catch (error: any) {
    console.error(`Error sending OneSignal notification to ${app}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to send via specific Firebase app
 */
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

/**
 * Legacy function for single-app compatibility
 */
export async function sendPushNotification(
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

/**
 * Send push notifications for a new message
 */
export async function sendPushNotificationsForMessage(message: MessageData, notificationData: PushNotificationData) {
  try {
    const { recipients, senderName, primaryCaregiverId, altOrg } = notificationData;
    
    // Prepare notification content
    const isLogComment = !!message.logId;
    const cleanSenderName = senderName?.trim() || 'Someone';
    const notificationTitle = cleanSenderName; // Use sender's name as title
    
    let notificationBody = message.text || message.content || '';
    if (message.imageId || message.imageUrl) {
      notificationBody = 'Sent an image';
    } else if (message.audioId || message.audioUrl) {
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
    } else if (version === 'test') {
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
    
    // Import getPlayerIdsForUser from bubble-api module (we'll create this next)
    const { getPlayerIdsForUser } = await import('./bubble-api');
    
    // Send notifications to all recipients (except sender)
    const notificationPromises = recipients
      .filter(userId => userId !== message.senderId)
      .map(async (userId) => {
        console.log(`Getting Player IDs for user: ${userId}`);
        
        // Get Player IDs for this user from Bubble database
        const playerIds = await getPlayerIdsForUser(userId);
        
        console.log(`Player IDs for user ${userId}:`, { 
          rested: playerIds.rested?.length || 0, 
          doulaConnect: playerIds.doulaConnect?.length || 0 
        });
        
        if (playerIds.rested || playerIds.doulaConnect) {
          console.log(`Sending OneSignal notification to user ${userId}`);
          return sendOneSignalNotificationToAllApps(
            playerIds,
            notificationTitle,
            notificationBody,
            {
              messageId: message.id || '',
              conversationId: message.conversationId || '',
              childId: message.childId || '',
              logId: message.logId || '',
              type: isLogComment ? 'log_comment' : 'chat_message',
              deepLink: deepLinkUrl
            }
          );
        } else {
          console.log(`No Player IDs found for user ${userId}, skipping notification`);
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