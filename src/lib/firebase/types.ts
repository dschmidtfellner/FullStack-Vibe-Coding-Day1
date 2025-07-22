import { Timestamp } from 'firebase/firestore';

// =============================================================================
// MESSAGING & CONVERSATION TYPES
// =============================================================================

export interface MessageReaction {
  emoji: string;
  users: string[];  // Array of user IDs who reacted with this emoji
  userNames: string[];  // Array of user names for easy display
}

export interface FirebaseMessage {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  conversationId: string;  // Required - every message belongs to a conversation
  childId: string;  // Required - the child this conversation is about
  type: 'text' | 'image' | 'audio';
  imageId?: string;
  audioId?: string;
  timestamp: Timestamp;
  read: boolean;
  readBy?: { [userId: string]: boolean };  // Object mapping user IDs to read status
  logId?: string;  // Optional - if this message is a comment on a log
  reactions?: { [emoji: string]: MessageReaction };  // reactions organized by emoji
  appVersion?: string;  // App version for push notification deep links (dev, test, live)
}

export interface Conversation {
  id: string;
  childId: string;  // The child this conversation is about
  childName: string;  // Display name for the child
  participants: string[];  // User IDs who can access this conversation
  participantNames: { [userId: string]: string };
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
  createdAt: Timestamp;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
  lastTyped: Timestamp;
}

// =============================================================================
// SLEEP LOG TYPES
// =============================================================================

export interface SleepEvent {
  // Child Local Time fields (primary source of truth)
  childLocalTimestamp: Timestamp; // "fake UTC" - child's wall clock time stored as if UTC
  originalTimezone: string;       // timezone when event was recorded
  
  // Display fields
  type: 'put_in_bed' | 'fell_asleep' | 'woke_up' | 'out_of_bed';
  localTime: string; // HH:MM AM/PM for display (calculated from childLocalTimestamp)
}

export interface SleepLog {
  id: string;
  childId: string;
  userId: string;
  userName: string;
  logType: 'sleep' | 'feeding' | 'diaper' | 'pump' | 'note';
  
  // Child Local Time fields
  childTimezone: string; // Child's timezone for this log
  
  // Sleep-specific fields
  sleepType?: 'nap' | 'bedtime';
  events?: SleepEvent[];
  isComplete?: boolean;
  duration?: number; // Total sleep duration in minutes (calculated)
  
  // Common calculated fields
  localDate: string; // YYYY-MM-DD in child's timezone for queries
  sortTimestamp: number; // For efficient ordering (based on first event's childLocalTimestamp)
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentCount: number;
  lastCommentAt?: Timestamp;
}

// =============================================================================
// USER TYPES
// =============================================================================

export interface FirebaseUser {
  id: string;
  clerkId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  createdAt: Timestamp;
}

// =============================================================================
// UNREAD COUNTER TYPES
// =============================================================================

export interface UnreadCounters {
  id: string; // Format: "user_{userId}_child_{childId}"
  userId: string;
  childId: string;
  
  // Chat counters
  chatUnreadCount: number;
  
  // Log counters  
  logUnreadCount: number; // Total across all logs
  logUnreadByLogId: { [logId: string]: number }; // Per-log counts
  
  // Combined counters
  totalUnreadCount: number; // Chat + Logs combined
  
  // Metadata
  lastUpdated: Timestamp;
}