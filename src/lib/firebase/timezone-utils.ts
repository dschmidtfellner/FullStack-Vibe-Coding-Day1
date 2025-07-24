import { Timestamp } from 'firebase/firestore';

/**
 * Convert time string from standard format to compact format
 * @param timeStr - Time string like "7:31 PM"
 * @returns Compact time string like "7:31p"
 */
export function toCompactTime(timeStr: string): string {
  return timeStr.replace(" AM", "a").replace(" PM", "p");
}

/**
 * Convert a date to Child Local Time (stored as "fake UTC")
 * This takes the wall clock time in the child's timezone and stores it as if it were UTC
 * @param date - The actual date/time
 * @param childTimezone - The child's timezone (e.g., "America/New_York")
 * @returns A Date object representing the child's wall clock time as UTC
 */
export function toChildLocalTime(date: Date, childTimezone: string): Date {
  // Format the date in the child's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: childTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(date);
  const dateParts: { [key: string]: string } = {};
  
  for (const part of parts) {
    if (part.type !== 'literal') {
      dateParts[part.type] = part.value;
    }
  }
  
  // Create a "fake UTC" date using the child's local time components
  const childLocalTime = new Date(
    `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}.000Z`
  );
  
  return childLocalTime;
}

/**
 * Convert Child Local Time back to display format
 * Since Child Local Time is already the wall clock time, we just format it
 * @param childLocalTimestamp - The Firestore timestamp in Child Local Time
 * @returns The Date object for display (no conversion needed)
 */
export function fromChildLocalTime(childLocalTimestamp: Timestamp): Date {
  // Child Local Time is already the wall clock time, just convert to Date
  return childLocalTimestamp.toDate();
}

/**
 * Get the current time in the child's timezone as Child Local Time
 * @param childTimezone - The child's timezone
 * @returns Current time in child's timezone as "fake UTC"
 */
export function getChildNow(childTimezone: string): Date {
  return toChildLocalTime(new Date(), childTimezone);
}

/**
 * Get the start of day (midnight) in child's timezone as Child Local Time
 * @param date - The date to get start of day for
 * @param childTimezone - The child's timezone
 * @returns Midnight in child's timezone as "fake UTC"
 */
export function getChildStartOfDay(date: Date, childTimezone: string): Date {
  const childLocal = toChildLocalTime(date, childTimezone);
  childLocal.setUTCHours(0, 0, 0, 0);
  return childLocal;
}

/**
 * Get the end of day (23:59:59) in child's timezone as Child Local Time
 * @param date - The date to get end of day for
 * @param childTimezone - The child's timezone
 * @returns 23:59:59 in child's timezone as "fake UTC"
 */
export function getChildEndOfDay(date: Date, childTimezone: string): Date {
  const childLocal = toChildLocalTime(date, childTimezone);
  childLocal.setUTCHours(23, 59, 59, 999);
  return childLocal;
}

/**
 * Helper function to convert timezone and format local date
 */
export function formatLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * Helper function to format time in baby's timezone
 */
export function formatLocalTime(date: Date, timezone: string): string {
  return toCompactTime(new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date));
}