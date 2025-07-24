import { firestore } from "firebase-admin";

/**
 * Shared types for Firebase Cloud Functions
 */

// Re-export Timestamp type for convenience
export type Timestamp = firestore.Timestamp;

/**
 * Unread counters for individual user-child combinations
 */
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
  lastUpdated: firestore.FieldValue | Timestamp;
}

/**
 * Family-level unread counters (new for Phase 1)
 */
export interface FamilyUnreadCounters {
  id: string; // Format: "user_{userId}_family_{originalChildId}"
  userId: string;
  originalChildId: string;
  familyTotalUnreadCount: number;
  familyChatUnreadCount: number; // Same as original child's chat (shared)
  familyLogUnreadCount: number;  // Sum across all siblings
  lastUpdated: firestore.FieldValue | Timestamp;
}

/**
 * Push notification data for messages
 */
export interface PushNotificationData {
  recipients: string[];
  senderName: string;
  primaryCaregiverId: string;
  altOrg: string;
}

/**
 * Player IDs for different apps
 */
export interface PlayerIds {
  rested?: string[];
  doulaConnect?: string[];
}

/**
 * FCM tokens for different apps  
 */
export interface FCMTokens {
  rested?: string;
  doulaConnect?: string;
}

/**
 * Message data structure from Firestore
 */
export interface MessageData {
  id?: string;
  text?: string;
  content?: string;
  senderId: string;
  senderName?: string;
  conversationId: string;
  childId: string;
  type?: 'text' | 'image' | 'audio';
  imageId?: string;
  imageUrl?: string;
  audioId?: string;
  audioUrl?: string;
  timestamp?: Timestamp;
  readBy?: { [userId: string]: boolean };
  logId?: string;
  appVersion?: string;
  familyContext?: {
    originalChildId: string;
    siblings: string[];
  };
}

/**
 * User mapping between old and new systems
 */
export interface UserMapping {
  oldUserId: string;
  newUserId: string;
  email?: string;
  name?: string;
  createdAt?: firestore.FieldValue | Timestamp;
  lastUpdated?: firestore.FieldValue | Timestamp;
}