# App Terminology Reference

Use this document to specify exact component names, functions, and data structures when working with Claude.

## Navigation & Views

### Main Views

- **`messaging`** - Chat interface showing messages between users
- **`LogList`** - List view of all sleep logs for selected child
- **`log-detail`** - Individual log view showing sleep events and comments
- **`LoggingModal`** - Interface for creating a new sleep log entry
- **`edit-log`** - Interface for editing an existing sleep log
- **`InterjectionModal`** - Modal for adding sleep events between existing events (accessible from edit-log)

### Navigation Functions

- **`navigateToLogs()`** - Navigate to logs list view
- **`navigateToLogDetail(logId)`** - Navigate to specific log detail view
- **`navigateToNewLog(defaultDate?)`** - Navigate to new log creation view
- **`navigateToEditLog(logId)`** - Navigate to log editing view
- **`navigateToMessaging()`** - Navigate to chat/messaging view
- **`navigateBack()`** - Navigate to previous view

## UI Components

### Core Components

- **`SleepLogTile`** - Individual sleep log display tile (src/components/SleepLogTile.tsx)
- **`MessageInputBar`** - Text input with photo/audio upload (src/components/MessageInputBar.tsx)
- **`NavigationProvider`** - Context provider for view navigation
- **`RootComponent`** - Main app wrapper with QueryClientProvider

### Component Props

- **`SleepLogTile`** props: `log`, `user`, `napNumber`, `onClick`, `onContinueLogging`, `formatTimeInTimezone`, `showClickable`, `isNightBefore`, `nightBeforeEndTime`, `unreadCount`
- **`MessageInputBar`** props: `user`, `conversationId`, `childId`, `newMessage`, `setNewMessage`, `placeholder`, `logId`, `typingUsers`, `onMessageSent`

## Data Types & Interfaces

### Sleep Log Types

- **`SleepLog`** - Main sleep log interface with events, completion status, timestamps
- **`SleepEvent`** - Individual sleep event (bedtime, wake up, etc.) with local time
- **`SleepType`** - Either `'bedtime'` or `'nap'`

### Message Types

- **`FirebaseMessage`** - Message interface with text, type, sender info, reactions
- **`MessageReaction`** - Reaction with emoji, users array, userNames array
- **`FirebaseConversation`** - Conversation with participants, unread counts, child info
- **`FirebaseUser`** - User profile

### Unread Counter Types

- **`UnreadCounters`** - Interface for tracking unread messages per user/child
  - `chatUnreadCount` - Unread chat messages
  - `logUnreadCount` - Total unread log comments
  - `logUnreadByLogId` - Per-log unread comment counts
  - `totalUnreadCount` - Combined chat + log unread count

## Firebase Collections

### Primary Collections

- **`messages`** - All chat messages and log comments
- **`conversations`** - Chat conversations organized by child
- **`logs`** - Sleep logs with events and metadata
- **`users`** - User profiles
- **`typing`** - Real-time typing indicators for chat
- **`unread_counters`** - Unread message counts per user/child

### Collection Document IDs

- **Conversations**: `child_{childId}` format
- **Unread Counters**: `user_{userId}_child_{childId}` format
- **Messages**: Auto-generated Firebase document IDs
- **Logs**: Auto-generated Firebase document IDs

## Authentication & User Management

### Auth Types

- **`BubbleUser`** - User object from Bubble auth integration
- **`useChildAccess()`** - Hook for checking child access permissions
- **`useBubbleAuth()`** - Hook for Bubble authentication state

### Auth Functions

- **`ensureUser(clerkUserId, name, email?)`** - Create/update user in Firebase
- **`getOrCreateConversation(childId, childName?, userId?, userName?)`** - Get or create conversation

## Message & Communication Functions

### Message Functions

- **`sendMessage(userId, userName, text, conversationId, childId)`** - Send text message
- **`sendImageMessage(userId, userName, file, conversationId, childId)`** - Send image message
- **`sendAudioMessage(userId, userName, audioBlob, conversationId, childId)`** - Send audio message
- **`toggleMessageReaction(messageId, emoji, userId, userName)`** - Add/remove reaction

### Log Comment Functions

- **`sendLogComment(userId, userName, text, conversationId, childId, logId)`** - Send log comment
- **`sendLogImageComment(userId, userName, file, conversationId, childId, logId)`** - Send log image comment
- **`sendLogAudioComment(userId, userName, audioBlob, conversationId, childId, logId)`** - Send log audio comment

### Listener Functions

- **`listenToMessages(conversationId, callback)`** - Real-time message listener
- **`listenToLogs(childId, callback)`** - Real-time logs listener
- **`listenToLogComments(logId, callback)`** - Real-time log comments listener
- **`listenToTypingIndicators(callback)`** - Real-time typing indicators

## Sleep Log Functions

### Log Management

- **`createSleepLog(childId, sleepType, initialEvent, userId, userName)`** - Create new sleep log
- **`updateSleepLog(logId, events, isComplete?, userId?, userName?)`** - Update existing log
- **`getLog(logId)`** - Get single log by ID

### Log Utilities

- **`calculateSleepStatistics(logs)`** - Calculate sleep statistics from logs array
- **`formatTimeInTimezone(timestamp)`** - Format timestamp for display

## Unread Counter Functions

### Counter Management

- **`markChatMessagesAsRead(userId, childId)`** - Mark chat messages as read
- **`markLogCommentsAsRead(userId, childId, logId)`** - Mark specific log comments as read
- **`markAllLogCommentsAsRead(userId, childId)`** - Mark all log comments as read
- **`useUnreadCounters(userId, childId)`** - Hook for unread counter state

## Styling & UI Classes

### Theme Classes

- **Dark Mode**: `user?.darkMode` boolean controls theme
- **Light Mode**: Default theme with purple accents

### Key Color Variables

- **Primary Purple**: `#503460` (buttons, accents)
- **Light Purple**: `#F0DDEF` (backgrounds, light theme)
- **Dark Purple**: `#4b355e` (text, dark accents)
- **Background Purple**: `#4a3f5a` (dark mode backgrounds)

### Typography Classes

- **Poppins**: `font-poppins` - Used for time displays, UI text
- **Domine**: `font-domine` - Used for log titles and headings

## File Locations

### Source Structure

- **Routes**: `src/routes/` (main app logic in index.tsx)
- **Components**: `src/components/`
- **Hooks**: `src/hooks/`
- **Library**: `src/lib/` (Firebase, auth utilities)
- **Types**: `src/types/` (TypeScript interfaces)
- **Utils**: `src/utils/` (Helper functions)

### Key Files

- **Main App**: `src/routes/index.tsx` - Primary application logic
- **Firebase**: `src/lib/firebase-messaging.ts` - Firebase operations
- **Auth**: `src/lib/jwt-auth.ts` - Authentication utilities
- **Types**: `src/types/firebase.ts` - Firebase type definitions
- **Sleep Utils**: `src/utils/sleepStatistics.ts` - Sleep calculation utilities

## Common Patterns

### Error Handling

- Functions throw errors that should be caught by calling code
- Use `error instanceof Error ? error.message : 'Unknown error'` pattern
- Log errors with `console.error` before throwing

### State Management

- Use React Query for server state (messages, logs)
- Local state for UI (navigation, form inputs)
- Context for navigation state across components

### Real-time Updates

- All Firebase listeners use `onSnapshot` for real-time updates
- Cleanup listeners in component unmount
- Handle loading states while listeners initialize

This reference should help you specify exact names and avoid ambiguity when working with Claude on this codebase.
