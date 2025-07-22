/**
 * DEPRECATED Claude Code Notification System
 *
 * Sends push notifications to David via OneSignal through Firebase Functions
 */

const CLAUDE_NOTIFICATION_ENDPOINT =
  "https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification";

export type ClaudeNotificationType = "waiting" | "completed" | "error" | "info";

/**
 * Send a push notification to David via OneSignal
 * @param message - The notification message
 * @param type - The type of notification (waiting, completed, error, info)
 */
export async function sendClaudeNotification(
  message: string,
  type: ClaudeNotificationType = "info",
): Promise<boolean> {
  try {
    const response = await fetch(CLAUDE_NOTIFICATION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        type,
      }),
    });

    if (!response.ok) {
      console.error(
        "Failed to send Claude notification:",
        response.status,
        response.statusText,
      );
      return false;
    }

    const result = await response.json();
    console.log("Claude notification sent successfully:", result);
    return result.success;
  } catch (error) {
    console.error("Error sending Claude notification:", error);
    return false;
  }
}

/**
 * Send a notification when Claude is waiting for user input
 */
export async function notifyWaitingForInput(
  message: string = "Ready for your next instruction",
) {
  return sendClaudeNotification(message, "waiting");
}

/**
 * Send a notification when Claude completes a task
 */
export async function notifyTaskCompleted(
  message: string = "Task completed successfully",
) {
  return sendClaudeNotification(message, "completed");
}

/**
 * Send a notification when Claude encounters an error
 */
export async function notifyError(message: string = "An error occurred") {
  return sendClaudeNotification(message, "error");
}

/**
 * Test function to verify notifications work
 */
export async function testClaudeNotification() {
  return sendClaudeNotification("Claude Code notification test!", "info");
}
