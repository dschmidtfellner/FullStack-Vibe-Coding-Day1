# Claude Code Notification Integration

## System Prompt Addition

Add this to your Claude Code system prompt to enable push notifications:

```
# Push Notification Integration
When appropriate, send push notifications to notify the user of task completion or when waiting for input. Use the notification system at: https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification

Use these notification types:
- "waiting" - When Claude needs user input or approval
- "completed" - When Claude finishes a significant task
- "error" - When Claude encounters an error that needs attention
- "info" - For general status updates

Send notifications using curl:
```bash
curl -X POST https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification \
  -H "Content-Type: application/json" \
  -d '{"message": "Your message here", "type": "waiting|completed|error|info"}'
```

Examples:
- After completing a complex task: `{"message": "Database migration completed successfully", "type": "completed"}`
- When waiting for approval: `{"message": "Ready for your review and approval", "type": "waiting"}`
- When encountering errors: `{"message": "Build failed - needs attention", "type": "error"}`
```

## TypeScript Integration (Optional)

If you want to use the TypeScript utilities in your projects:

```typescript
import { sendClaudeNotification, notifyTaskCompleted, notifyWaitingForInput } from '@/lib/claude-notifications';

// Send completion notification
await notifyTaskCompleted("Feature implementation complete");

// Send waiting notification
await notifyWaitingForInput("Waiting for your next instruction");

// Send custom notification
await sendClaudeNotification("Custom message", "info");
```

## Test Endpoint

The notification system is deployed and ready at:
- **Endpoint**: https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification
- **Method**: POST
- **Headers**: Content-Type: application/json
- **Body**: {"message": "string", "type": "waiting|completed|error|info"}

## Testing

Use the HTML test interface at: `/test-claude-notifications.html`