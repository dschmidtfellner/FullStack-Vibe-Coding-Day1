# API Reference

This document provides a comprehensive reference for all functions, types, and patterns in the sleep logging application.

## Navigation Functions

### Core Navigation
```typescript
// From NavigationContext
const { 
  navigateToLogDetail,
  navigateToNewLog, 
  navigateToEditLog,
  navigateToMessaging,
  navigateBack 
} = useNavigation();

// Navigate to specific log detail view
navigateToLogDetail(logId: string)

// Navigate to new log creation (with optional default date)
navigateToNewLog(defaultDate?: string)

// Navigate to log editing view
navigateToEditLog(logId: string)

// Navigate to chat/messaging view
navigateToMessaging()

// Navigate to previous view
navigateBack()
```

### Navigation State
```typescript
interface NavigationState {
  view: 'messaging' | 'LogList' | 'log-detail' | 'LoggingModal' | 'edit-log';
  logId: string | null;
  childId: string | null;
  timezone: string;
  logs: SleepLog[];
  logCache: Map<string, SleepLog>;
}
```

## Data Types & Interfaces

### Sleep Log Types
```typescript
interface SleepLog {
  id: string;
  childId: string;
  sleepType: 'bedtime' | 'nap';
  events: SleepEvent[];
  isComplete: boolean;
  localDate: string; // YYYY-MM-DD format
  sortTimestamp: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface SleepEvent {
  type: 'put_in_bed' | 'fell_asleep' | 'woke_up' | 'out_of_bed';
  childLocalTimestamp: Timestamp;
  originalTimezone: string;
  localTime: string; // Formatted display time
}
```

### Message Types
```typescript
interface FirebaseMessage {
  id: string;
  text?: string;
  type: 'text' | 'image' | 'audio';
  senderId: string;
  senderName: string;
  conversationId: string;
  timestamp: Timestamp;
  logId?: string; // Present for log comments
  imageId?: string;
  audioId?: string;
  readBy?: Record<string, boolean>;
  reactions?: MessageReaction[];
}

interface MessageReaction {
  emoji: string;
  users: string[];
  userNames: string[];
}

interface FirebaseConversation {
  id: string;
  participants: string[];
  childId: string;
  childName?: string;
  lastMessage?: string;
  lastMessageTime?: Timestamp;
  unreadCounts?: Record<string, number>;
}
```

### Unread Counter Types
```typescript
interface UnreadCounters {
  chatUnreadCount: number;        // Unread chat messages
  logUnreadCount: number;         // Total unread log comments  
  logUnreadByLogId: Record<string, number>; // Per-log unread counts
  totalUnreadCount: number;       // Combined chat + log unread
}
```

### User Types
```typescript
interface BubbleUser {
  id: string;
  name: string;
  email?: string;
  darkMode?: boolean;
}
```

## Firebase Collections

### Collection Structure
```typescript
// Collections
'messages'        // All chat messages and log comments
'conversations'   // Chat conversations organized by child  
'logs'           // Sleep logs with events and metadata
'users'          // User profiles
'typing'         // Real-time typing indicators
'unread_counters' // Unread message counts per user/child

// Document ID Patterns
conversations: `child_${childId}`
unread_counters: `user_${userId}_child_${childId}` 
messages: auto-generated Firebase IDs
logs: auto-generated Firebase IDs
```

## Firebase Functions

### Authentication Functions
```typescript
// Ensure user exists in Firebase
ensureUser(clerkUserId: string, name: string, email?: string): Promise<void>

// Get or create conversation for child
getOrCreateConversation(
  childId: string, 
  childName?: string, 
  userId?: string, 
  userName?: string
): Promise<string>
```

### Message Functions
```typescript
// Send text message
sendMessage(
  userId: string,
  userName: string, 
  text: string,
  conversationId: string,
  childId: string
): Promise<void>

// Send image message
sendImageMessage(
  userId: string,
  userName: string,
  file: File,
  conversationId: string, 
  childId: string
): Promise<void>

// Send audio message  
sendAudioMessage(
  userId: string,
  userName: string,
  audioBlob: Blob,
  conversationId: string,
  childId: string
): Promise<void>

// Toggle message reaction
toggleMessageReaction(
  messageId: string,
  emoji: string, 
  userId: string,
  userName: string
): Promise<void>
```

### Log Comment Functions
```typescript
// Send log comment
sendLogComment(
  userId: string,
  userName: string,
  text: string,
  conversationId: string,
  childId: string,
  logId: string
): Promise<void>

// Send log image comment
sendLogImageComment(
  userId: string,
  userName: string, 
  file: File,
  conversationId: string,
  childId: string,
  logId: string
): Promise<void>

// Send log audio comment
sendLogAudioComment(
  userId: string,
  userName: string,
  audioBlob: Blob,
  conversationId: string,
  childId: string, 
  logId: string
): Promise<void>
```

### Real-time Listener Functions
```typescript
// Listen to messages (returns unsubscribe function)
listenToMessages(
  conversationId: string,
  callback: (messages: FirebaseMessage[]) => void
): () => void

// Listen to logs (returns unsubscribe function)
listenToLogs(
  childId: string,
  callback: (logs: SleepLog[]) => void
): () => void

// Listen to log comments (returns unsubscribe function)
listenToLogComments(
  logId: string,
  callback: (comments: FirebaseMessage[]) => void
): () => void

// Listen to typing indicators (returns unsubscribe function)
listenToTypingIndicators(
  callback: (typingData: any) => void
): () => void
```

### Sleep Log Functions
```typescript
// Create new sleep log
createSleepLog(
  childId: string,
  sleepType: 'bedtime' | 'nap',
  initialEvent: Omit<SleepEvent, 'childLocalTimestamp' | 'localTime'>,
  timezone: string,
  userId?: string,
  userName?: string
): Promise<string>

// Update existing sleep log
updateSleepLog(
  logId: string,
  events: Array<{ type: SleepEvent['type']; timestamp: Date }>,
  timezone: string,
  isComplete?: boolean,
  userId?: string,
  userName?: string
): Promise<void>

// Get single log by ID
getLog(logId: string): Promise<SleepLog | null>
```

### Unread Counter Functions
```typescript
// Mark chat messages as read
markChatMessagesAsRead(userId: string, childId: string): Promise<void>

// Mark specific log comments as read
markLogCommentsAsRead(
  userId: string, 
  childId: string, 
  logId: string
): Promise<void>

// Mark all log comments as read
markAllLogCommentsAsRead(userId: string, childId: string): Promise<void>

// Hook for unread counter state
useUnreadCounters(
  userId: string | null, 
  childId: string | null
): { counters: UnreadCounters; isLoading: boolean }
```

### Utility Functions
```typescript
// Calculate sleep statistics from log
calculateSleepStatistics(log: SleepLog): {
  timeRange: string;
  totalDuration: string;
  totalTimeAsleep: string;
  totalTimeAwakeInBed: string;
  numberOfWakeUps: number;
  averageWakeUpDuration: string;
}

// Format timestamp for timezone display
formatTimeInTimezone(timestamp: any, timezone: string): string

// Child timezone utilities
getChildNow(timezone: string): Date
getChildStartOfDay(date: Date, timezone: string): Date
fromChildLocalTime(childLocalTimestamp: Timestamp): Date
```

## React Hooks

### Core Hooks
```typescript
// Bubble authentication
useBubbleAuth(): {
  user: BubbleUser | null;
  isLoading: boolean;
  error: string | null;
}

// Child access permissions
useChildAccess(childId: string | null): boolean

// Navigation context
useNavigation(): {
  state: NavigationState;
  navigateToLogDetail: (logId: string) => void;
  navigateToNewLog: (defaultDate?: string) => void;
  navigateToEditLog: (logId: string) => void;
  navigateToMessaging: () => void;
  navigateBack: () => void;
  setLogs: (logs: SleepLog[]) => void;
  updateLog: (log: SleepLog) => void;
}

// Unread counters
useUnreadCounters(
  userId: string | null,
  childId: string | null
): {
  counters: UnreadCounters;
  isLoading: boolean;
}
```

## Component Props

### SleepLogTile
```typescript
interface SleepLogTileProps {
  log: SleepLog;
  user: BubbleUser;
  napNumber: number;
  onClick?: () => void;
  onContinueLogging?: () => void;
  formatTimeInTimezone: (timestamp: any) => string;
  showClickable?: boolean;
  isNightBefore?: boolean;
  nightBeforeEndTime?: string;
  unreadCount?: number;
}
```

### MessageInputBar
```typescript
interface MessageInputBarProps {
  user: BubbleUser;
  conversationId: string;
  childId: string;
  newMessage: string;
  setNewMessage: (message: string) => void;
  placeholder?: string;
  logId?: string;
  typingUsers?: any[];
  onMessageSent?: () => void;
}
```

### CommentsModal
```typescript
interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: BubbleUser;
  childId: string | null;
}
```

## Styling Reference

### Theme System
```typescript
// Dark mode detection
user?.darkMode // boolean that controls theme

// Color classes based on theme
const themeClasses = user?.darkMode 
  ? "bg-[#15111B] text-white" 
  : "bg-white text-gray-800";
```

### Key Colors
```css
/* Primary Colors */
--brand-purple: #503460;     /* Buttons, primary accents */
--brand-purple-light: #F0DDEF; /* Light backgrounds, borders */
--brand-purple-dark: #4b355e;  /* Text, dark accents */

/* Dark Mode */
--dark-bg: #15111B;          /* Main dark background */
--dark-surface: #2a223a;     /* Cards, modals in dark mode */
```

### Typography Classes
```css
font-['Poppins']  /* Default UI font */
font-domine       /* Headings and titles */
font-karla        /* Alternative body text */
```

## Common Patterns

### Error Handling
```typescript
try {
  await someFirebaseOperation();
} catch (error) {
  console.error('Operation failed:', error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Handle error appropriately
}
```

### Real-time Listeners
```typescript
useEffect(() => {
  if (!childId) return;
  
  const unsubscribe = listenToLogs(childId, (newLogs) => {
    setLogs(newLogs);
  });
  
  return unsubscribe; // Cleanup on unmount
}, [childId]);
```

### Modal Patterns
```typescript
const [showModal, setShowModal] = useState(false);

// Modal JSX pattern
if (!showModal) return null;

return (
  <>
    {/* Backdrop */}
    <div 
      className="absolute inset-0 bg-black bg-opacity-50 z-40"
      onClick={onClose}
    />
    
    {/* Modal Content */}
    <div className="absolute inset-0 z-50 flex items-center justify-center">
      {/* Modal UI */}
    </div>
  </>
);
```

### Performance Optimization
```typescript
// Memoize expensive calculations
const stats = useMemo(() => 
  calculateSleepStatistics(log), [log]
);

// Callback optimization
const handleClick = useCallback(() => {
  navigateToLogDetail(logId);
}, [logId, navigateToLogDetail]);
```

---

*This API reference covers all functions, types, and patterns in the refactored codebase. For architectural context, see the [Component Map](./component-map.md).*