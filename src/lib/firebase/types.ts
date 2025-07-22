import { Timestamp } from 'firebase/firestore';

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
// MESSAGING TYPES
// =============================================================================

export interface FirebaseMessage {
  id: string;
  text?: string;
  senderId: string;
  senderName: string;
  conversationId: string;
  childId: string;
  type: 'text' | 'image' | 'audio';
  imageId?: string;
  audioId?: string;
  timestamp: Timestamp;
  read: boolean;
  appVersion?: string;
  logId?: string; // For log comments
  reactions?: {
    [emoji: string]: {
      emoji: string;
      users: string[];
      userNames: string[];
    };
  };
}

export interface Conversation {
  id: string;
  childId: string;
  childName: string;
  participants: string[];
  participantNames: { [userId: string]: string };
  createdAt: Timestamp;
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  isTyping: boolean;
  lastTyped: Timestamp;
}

// =============================================================================
// UNREAD COUNTER TYPES
// =============================================================================

export interface UnreadCounters {
  id: string;
  userId: string;
  childId: string;
  chatUnreadCount: number;
  logUnreadCount: number;
  logUnreadByLogId: { [logId: string]: number };
  totalUnreadCount: number;
  lastUpdated: Timestamp;
}

// =============================================================================
// USER TYPES
// =============================================================================

export interface FirebaseUser {
  id: string;
  clerkId: string;
  name: string;
  email: string;
  createdAt: Timestamp;
}