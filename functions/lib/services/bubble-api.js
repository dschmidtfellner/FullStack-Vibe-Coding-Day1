"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChildPushRecipientsAndSenderInfo = exports.getPlayerIdsForUser = void 0;
const functions = require("firebase-functions");
/**
 * Get Player IDs for a user from Bubble database
 */
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
exports.getPlayerIdsForUser = getPlayerIdsForUser;
/**
 * Helper function to get push notification recipients and sender info from Bubble
 */
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
exports.getChildPushRecipientsAndSenderInfo = getChildPushRecipientsAndSenderInfo;
//# sourceMappingURL=bubble-api.js.map