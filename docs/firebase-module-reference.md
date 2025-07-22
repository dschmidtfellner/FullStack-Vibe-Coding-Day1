# Firebase Module Quick Reference

## 📁 New Structure Overview

```
src/lib/firebase/
├── types.ts           # ✅ All TypeScript interfaces and types
├── core.ts            # ✅ Firebase initialization and shared utilities
├── auth.ts            # ✅ User authentication and management
├── messaging.ts       # ❌ Chat and real-time messaging (TODO)
├── storage.ts         # ✅ File uploads (images, audio)
├── sleep-logging.ts   # ✅ Sleep log CRUD operations
├── log-comments.ts    # ❌ Comments on sleep logs (TODO)
├── timezone-utils.ts  # ✅ Child timezone conversions
├── unread-counters.ts # ❌ Notification counters (TODO)
└── index.ts          # ✅ Barrel exports (partial)
```

## 🎯 Module Responsibilities

### **auth.ts**
- `ensureUser()` - Create/update user in Firebase
- `getOrCreateConversation()` - Initialize child conversations
- `getAppVersion()` - Handle app versioning

### **messaging.ts**
- `sendMessage()` - Send text messages
- `sendImageMessage()` - Send images in chat
- `sendAudioMessage()` - Send voice messages
- `listenToMessages()` - Real-time message updates
- `toggleMessageReaction()` - Add/remove emoji reactions
- `setTypingStatus()` - Show typing indicators
- `listenToTypingIndicators()` - Watch who's typing

### **storage.ts**
- `uploadFile()` - Upload any file to Firebase Storage

### **sleep-logging.ts**
- `createSleepLog()` - Start a new sleep log
- `addSleepEvent()` - Add events to existing log
- `updateSleepLog()` - Edit entire log
- `getLog()` - Fetch single log by ID
- `listenToLogs()` - Real-time log updates
- `calculateSleepDuration()` - Compute sleep stats

### **log-comments.ts**
- `sendLogComment()` - Add text comment to log
- `sendLogImageComment()` - Add image to log
- `sendLogAudioComment()` - Add audio to log
- `listenToLogComments()` - Real-time comment updates
- `updateLogCommentCount()` - Track comment counts

### **timezone-utils.ts**
- `toChildLocalTime()` - Convert to child's timezone
- `fromChildLocalTime()` - Convert from stored time
- `getChildNow()` - Current time in child's zone
- `getChildStartOfDay()` - Midnight in child's zone
- `getChildEndOfDay()` - 23:59 in child's zone

### **unread-counters.ts**
- `listenToUnreadCounters()` - Watch unread counts
- `markChatMessagesAsRead()` - Clear chat notifications
- `markLogCommentsAsRead()` - Clear log notifications
- `markAllLogCommentsAsRead()` - Clear all log notifications

## 📦 Import Examples

### Before (Monolithic)
```typescript
import { 
  sendMessage, 
  createSleepLog, 
  toChildLocalTime,
  uploadFile 
} from '@/lib/firebase-messaging';
```

### After (Modular) - Option 1: Specific Imports
```typescript
import { sendMessage } from '@/lib/firebase/messaging';
import { createSleepLog } from '@/lib/firebase/sleep-logging';
import { toChildLocalTime } from '@/lib/firebase/timezone-utils';
import { uploadFile } from '@/lib/firebase/storage';
```

### After (Modular) - Option 2: Barrel Import
```typescript
import { 
  sendMessage, 
  createSleepLog, 
  toChildLocalTime,
  uploadFile 
} from '@/lib/firebase';
```

## 🔍 Finding Functions

**Need to work with...**
- **Users?** → Check `auth.ts`
- **Chat messages?** → Check `messaging.ts`
- **Sleep logs?** → Check `sleep-logging.ts`
- **Comments on logs?** → Check `log-comments.ts`
- **File uploads?** → Check `storage.ts`
- **Time zones?** → Check `timezone-utils.ts`
- **Unread badges?** → Check `unread-counters.ts`

## 📊 Migration Status

**Completed Modules** (6/9):
- ✅ types.ts - All interfaces and types
- ✅ core.ts - Firebase initialization
- ✅ timezone-utils.ts - 7 timezone functions
- ✅ storage.ts - 1 upload function
- ✅ auth.ts - 3 user/conversation functions
- ✅ sleep-logging.ts - 6 core logging functions

**Remaining Modules** (3):
- ❌ log-comments.ts - 5 comment functions
- ❌ messaging.ts - 7 chat functions
- ❌ unread-counters.ts - 4 counter functions

**Progress**: 17 of 33 functions migrated (52%)
**Lines Reduced**: firebase-messaging.ts from 1,034 → 776 lines (25% reduction)

## 🏗️ Architecture Benefits

1. **Separation of Concerns**: Each module has a single responsibility
2. **Improved Testability**: Test modules in isolation
3. **Better Performance**: Import only what you need
4. **Easier Maintenance**: Find and fix issues faster
5. **Clear Dependencies**: See what each module relies on
6. **Scalability**: Add new features without bloating existing modules

## 🚀 Migration Tips

- Start with leaf modules (no dependencies on other new modules)
- Test after each module extraction
- Keep the old file working until fully migrated
- Update imports incrementally
- Document any gotchas or decisions