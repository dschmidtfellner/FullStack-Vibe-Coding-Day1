import * as functions from "firebase-functions";
import { PlayerIds, PushNotificationData } from "../types";

/**
 * Get Player IDs for a user from Bubble database
 */
export async function getPlayerIdsForUser(userId: string): Promise<PlayerIds> {
  try {
    // Get Bubble API configuration from environment
    const bubbleConfig = functions.config().bubble;
    const apiToken = bubbleConfig?.api_token;
    
    if (!apiToken) {
      console.warn('Bubble API token not configured - cannot retrieve Player IDs');
      return { rested: [], doulaConnect: [] };
    }
    
    // Try different API endpoints (dev first for testing, then test, then live)
    const apiEndpoints = [
      bubbleConfig?.api_url_dev,
      bubbleConfig?.api_url_test,
      bubbleConfig?.api_url_live
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
          const playerIds = userData.response?.["Player ID(s)"] || userData.response?.PlayerIDs || userData.response?.player_ids || [];
          
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
        
      } catch (endpointError: any) {
        console.warn(`Error trying endpoint ${apiUrl}:`, endpointError.message);
        continue;
      }
    }
    
    console.log(`User ${userId} not found in any Bubble API endpoint`);
    return { rested: [], doulaConnect: [] };
    
  } catch (error) {
    console.error('Error getting Player IDs for user:', userId, error);
    return { rested: [], doulaConnect: [] };
  }
}

/**
 * Helper function to get push notification recipients and sender info from Bubble
 */
export async function getChildPushRecipientsAndSenderInfo(childId: string, senderId: string): Promise<PushNotificationData> {
  try {
    console.log(`Getting push recipients for child: ${childId}, sender: ${senderId}`);
    
    // Get Bubble API configuration
    const bubbleConfig = functions.config().bubble;
    const apiToken = bubbleConfig?.api_token;
    // Use dev version for testing, will switch to live later
    const apiBaseUrl = bubbleConfig?.api_url_dev || bubbleConfig?.api_url_test || bubbleConfig?.api_url_live;
    
    if (!apiToken || !apiBaseUrl) {
      console.error('Bubble API not configured for push recipients');
      return { recipients: [], senderName: 'Someone', primaryCaregiverId: '', altOrg: '' };
    }
    
    // Call Bubble API to get recipients list and sender info
    const apiUrl = `${apiBaseUrl.replace('/obj', '')}/wf/firebase_message_recipients`;
    const requestBody = JSON.stringify({ childId, senderId });
    
    console.log(`Calling Bubble API: ${apiUrl}`);
    console.log(`Request body: ${requestBody}`);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: requestBody
    });
    
    console.log(`Bubble API response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bubble API error response body: ${errorText}`);
      console.error(`Bubble API error for push recipients: ${response.status} ${response.statusText}`);
      return { recipients: [], senderName: 'Someone', primaryCaregiverId: '', altOrg: '' };
    }
    
    const data = await response.json();
    console.log(`Bubble API response data:`, JSON.stringify(data, null, 2));
    const recipients = data.response?.userIds || data.response?.users || [];
    const senderName = data.response?.senderName || 'Someone';
    const primaryCaregiverId = data.response?.primaryCaregiverId || '';
    const altOrg = data.response?.altOrg || data.response?.alt_org || '';
    
    console.log(`Found ${recipients.length} push recipients for child ${childId}:`, recipients);
    console.log(`Sender name: ${senderName}, Primary caregiver: ${primaryCaregiverId}, Alt org: ${altOrg}`);
    
    return { recipients, senderName, primaryCaregiverId, altOrg };
    
  } catch (error) {
    console.error('Error getting push recipients from Bubble:', error);
    return { recipients: [], senderName: 'Someone', primaryCaregiverId: '', altOrg: '' };
  }
}