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
  receiverId?: string;
  conversationId?: string;
  type: 'text' | 'image' | 'audio';
  imageId?: string;
  audioId?: string;
  timestamp: Timestamp;
  read: boolean;
  reactions?: { [emoji: string]: MessageReaction };  // reactions organized by emoji
}

export interface FirebaseConversation {
  id: string;
  participants: string[];
  participantNames: { [userId: string]: string };
  lastMessage?: string;
  lastMessageTimestamp?: Timestamp;
  unreadCount: { [userId: string]: number };
}

export interface FirebaseUser {
  id: string;
  clerkId: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  createdAt: Timestamp;
}