import { 
  toChildLocalTime, 
  fromChildLocalTime, 
  getChildNow, 
  getChildStartOfDay, 
  getChildEndOfDay
} from './firebase/timezone-utils';
import { uploadFile } from './firebase/storage';
import { getAppVersion, ensureUser, getOrCreateConversation } from './firebase/auth';
import { 
  createSleepLog, 
  addSleepEvent, 
  updateSleepLog, 
  getLog, 
  listenToLogs, 
  calculateSleepDuration 
} from './firebase/sleep-logging';
import {
  sendLogComment,
  sendLogImageComment,
  sendLogAudioComment,
  updateLogCommentCount,
  listenToLogComments
} from './firebase/log-comments';
import {
  sendMessage,
  sendImageMessage,
  sendAudioMessage,
  listenToMessages,
  setTypingStatus,
  listenToTypingIndicators,
  toggleMessageReaction
} from './firebase/messaging';
import {
  listenToUnreadCounters,
  markChatMessagesAsRead,
  markLogCommentsAsRead,
  markAllLogCommentsAsRead
} from './firebase/unread-counters';

// Re-export types for backward compatibility
export type { SleepEvent, SleepLog } from './firebase/types';

// Re-export utilities for backward compatibility during migration
export { 
  toChildLocalTime, 
  fromChildLocalTime, 
  getChildNow, 
  getChildStartOfDay, 
  getChildEndOfDay,
  uploadFile,
  getAppVersion,
  ensureUser,
  getOrCreateConversation,
  createSleepLog,
  addSleepEvent,
  updateSleepLog,
  getLog,
  listenToLogs,
  calculateSleepDuration,
  sendLogComment,
  sendLogImageComment,
  sendLogAudioComment,
  updateLogCommentCount,
  listenToLogComments,
  sendMessage,
  sendImageMessage,
  sendAudioMessage,
  listenToMessages,
  setTypingStatus,
  listenToTypingIndicators,
  toggleMessageReaction,
  listenToUnreadCounters,
  markChatMessagesAsRead,
  markLogCommentsAsRead,
  markAllLogCommentsAsRead
};