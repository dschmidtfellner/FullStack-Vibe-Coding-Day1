import { Timestamp } from 'firebase/firestore';

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
  reactions?: { [emoji: string]: MessageReaction };  // reactions organized by emoji
}

export interface FirebaseConversation {
  id: string;
  childId: string;  // The child this conversation is about
  childName?: string;  // Optional display name for the child
  participants: string[];  // User IDs who can access this conversation
  participantNames: { [userId: string]: string };
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
  unreadCount: { [userId: string]: number };
  createdAt: Timestamp;
}

export interface FirebaseUser {
  id: string;
  clerkId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  createdAt: Timestamp;
}