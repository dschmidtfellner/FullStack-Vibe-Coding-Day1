# Multi-Firebase Push Notifications Setup Guide

This guide explains how to configure and use the multi-Firebase push notification system.

## Overview

The system allows your new Firebase messaging app to send push notifications through **multiple old Firebase projects** (Rested and DoulaConnect) FCM services. This enables you to reach devices registered with both old Firebase projects without requiring app updates.

### Multi-App Architecture

- **Rested App**: Users with Rested app installed will receive notifications via Rested Firebase project
- **DoulaConnect App**: Users with DoulaConnect app installed will receive notifications via DoulaConnect Firebase project  
- **Both Apps**: Users with both apps will receive notifications on both (they can delete the unused app)
- **Maximum Reach**: Ensures all users receive notifications regardless of which app they have

## Prerequisites

- Admin access to both Firebase projects (old and new)
- Service account key from the old Firebase project
- Firebase CLI installed and configured

## Step 1: Generate Service Account Keys (Both Old Firebase Projects)

### For Rested Firebase Project:
1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your **Rested Firebase project**
3. Navigate to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file (save as `rested-service-account.json`)

### For DoulaConnect Firebase Project:
1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your **DoulaConnect Firebase project** (`chatapp-vibe-coding`)
3. Navigate to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file (save as `doulaconnect-service-account.json`)

**Important**: Keep both files secure - they contain sensitive credentials

## Step 2: Configure Environment Variables

### For Local Development:

1. Base64 encode both service account JSON files:
   ```bash
   # For Rested
   cat path/to/rested-service-account.json | base64
   
   # For DoulaConnect  
   cat path/to/doulaconnect-service-account.json | base64
   ```

2. Set the Firebase config for both projects:
   ```bash
   cd functions
   
   # Configure Rested Firebase project
   firebase functions:config:set rested_firebase.service_account="<rested-base64-encoded-json>"
   
   # Configure DoulaConnect Firebase project
   firebase functions:config:set doulaconnect_firebase.service_account="<doulaconnect-base64-encoded-json>"
   ```

### Optional Configuration:

For API-based token retrieval (Option B):
```bash
firebase functions:config:set old_firebase.api_url="https://your-old-project.cloudfunctions.net"
firebase functions:config:set old_firebase.api_key="your-api-key"
```

## Step 3: Deploy Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

## Step 4: Test the Setup

1. Open `test-push-notifications.html` in a browser
2. Update the base URL to your Firebase Functions endpoint
3. Click "Test Configuration" to verify the connection
4. Test with known FCM tokens or user IDs

## Step 5: User Identity Mapping

### Creating Mappings

Map users between old and new Firebase projects:

```javascript
// Example API call
fetch('https://your-functions-url/createUserMapping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    oldUserId: 'old-firebase-user-id',
    newUserId: 'new-firebase-user-id',
    email: 'user@example.com',
    name: 'User Name'
  })
});
```

### Getting Mappings

```javascript
// Get mapping by old user ID
fetch('https://your-functions-url/getUserMapping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    oldUserId: 'old-firebase-user-id'
  })
});
```

## Step 6: FCM Token Management

The system tries three strategies to find FCM tokens:

### Strategy A: Direct Database Access (Default)
Reads tokens from old Firebase database using patterns:
- `users/{userId}` with fields: `fcmToken`, `playerID`, `deviceToken`, `pushToken`
- `fcmTokens/{userId}` with fields: `token`, `fcmToken`, `playerID`
- `users/{userId}/tokens` subcollection (gets most recent)

### Strategy B: API Endpoint
Calls API endpoint in old Firebase project (requires setup)

### Strategy C: Synced Tokens
Uses tokens synced to new Firebase project:

```javascript
// Sync token to new project
fetch('https://your-functions-url/syncFCMTokens', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-id',
    fcmToken: 'fcm-token-from-old-project'
  })
});
```

## How It Works

1. **Message Created**: When a message is sent in the new system
2. **Get Recipients**: System identifies conversation participants
3. **Map Users**: Maps new Firebase user IDs to old Firebase user IDs
4. **Get FCM Tokens**: Retrieves FCM tokens from **both** Rested and DoulaConnect Firebase projects
5. **Send Notifications**: Sends notifications via **all available channels**:
   - If user has Rested token → Send via Rested Firebase FCM
   - If user has DoulaConnect token → Send via DoulaConnect Firebase FCM  
   - If user has both tokens → Send via both (user gets notification on both apps)
6. **Error Handling**: Logs failures and continues with other recipients and apps

## Available Cloud Functions

| Function | Purpose | HTTP Method | Parameters |
|----------|---------|-------------|------------|
| `testPushNotification` | Test push notification sending | POST | `userId` or `fcmToken`, `title`, `body` |
| `createUserMapping` | Create/update user mapping | POST | `oldUserId`, `newUserId`, `email`, `name` |
| `getUserMapping` | Get user mapping | POST | `oldUserId`, `newUserId`, or `email` |
| `syncFCMTokens` | Sync FCM token to new project | POST | `userId`, `fcmToken` |

## Automatic Integration

The system automatically sends push notifications when:
- New chat messages are created
- New log comments are added
- Message reactions are added

## Error Handling

The system includes comprehensive error handling:
- Invalid/expired FCM tokens
- Network failures
- Service account permission issues
- Missing user mappings

## Security Considerations

1. **Service Account**: Store credentials securely using Firebase config
2. **Token Management**: Implement token refresh handling
3. **Rate Limiting**: FCM has rate limits - the system queues appropriately
4. **Permissions**: Limit service account permissions to FCM only

## Troubleshooting

### Common Issues:

1. **"Old Firebase app not available"**
   - Check service account configuration
   - Verify base64 encoding is correct
   - Ensure Firebase config is deployed

2. **"No FCM token found"**
   - Verify token storage patterns in old Firebase
   - Check user ID mapping
   - Test with known good tokens

3. **"Failed to send push notification"**
   - Check FCM token validity
   - Verify service account permissions
   - Check Firebase project settings

### Debug Steps:

1. Use the test interface to verify configuration
2. Check Cloud Functions logs for detailed error messages
3. Test with known FCM tokens directly
4. Verify user mappings are correct

## Future Migration

When ready to migrate to new Firebase project:
1. Update app to use new Firebase project
2. Switch FCM token strategy to new project
3. Gradually migrate users
4. Remove old Firebase dependencies

## Support

For issues or questions:
1. Check Cloud Functions logs
2. Use the test interface to isolate problems
3. Verify all configuration steps
4. Test with minimal data first

This system provides a robust bridge between Firebase projects while maintaining architectural separation and preparing for future migration.