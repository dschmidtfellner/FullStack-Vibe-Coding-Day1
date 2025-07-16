# Claude Notes

This file tracks ongoing work and important context for Claude Code sessions. It should be included in every commit to preserve context for future sessions.

## Current Feature: Child Local Time Implementation

### Objective
Implement a timezone-aware system that stores all log timestamps in "Child Local Time" - a normalized format that preserves the child's wall clock time regardless of viewer location or future timezone changes.

### Progress Status
✅ Updated SleepEvent and SleepLog interfaces to use Child Local Time fields
✅ Added Child Local Time conversion utilities:
  - `toChildLocalTime()` - converts actual time to child's wall clock time as "fake UTC"
  - `fromChildLocalTime()` - converts back for display
  - `getChildNow()` - gets current time in child's timezone
  - `getChildStartOfDay()` / `getChildEndOfDay()` - for date boundaries
✅ Updated `createSleepLog()` to store events in Child Local Time
✅ Updated `addSleepEvent()` to use Child Local Time
✅ Updated `updateSleepLog()` to convert all events to Child Local Time
✅ Updated `calculateSleepDuration()` to use childLocalTimestamp
✅ Updated validation logic in SleepLogModal to use child's perspective:
  - Future time warnings based on child's current time
  - Date comparisons use child's timezone boundaries
  - Gap calculations done in Child Local Time space
✅ Updated display logic to use childLocalTimestamp field
✅ Updated "day before" bedtime logic:
  - `isToday()` uses child's timezone
  - `getRelativeDateText()` compares dates in child's timezone
  - Previous day's bedtime uses childLocalTimestamp

### Commits Made During Session
1. "feat: Implement Child Local Time storage for sleep logs and events"
2. "feat: Update validation and display logic to use Child Local Time"
3. "fix: Display time and date inputs in user's local time instead of child timezone"

### Next Steps
- Clear existing data from Firebase logs collection
- Test the new system with various timezone scenarios
- Monitor for any edge cases with daylight saving time transitions

### Technical Implementation Details
- Child Local Time stores the child's wall clock time as if it were UTC
- Example: 8 PM in New York is stored as `2025-07-10T20:00:00.000Z`
- This ensures historical data never changes meaning when families move timezones
- All validation and display logic works with these normalized timestamps

## Windows View Implementation

### Objective
Create an alternative view for the LogList that shows sleep/wake periods chronologically with durations between events.

### Progress Status
✅ Added toggle between "Events" and "Windows" view in LogList header
✅ Implemented chronological timeline showing:
  - Timestamp on the left (light purple #745288)
  - Duration between events (e.g., "5h 30m")
  - Color-coded tiles for different states
  - Gray separators for out-of-bed periods
  - Sleep windows merged across midnight boundaries
✅ Windows are clickable and navigate to the source log
✅ Updated to use childLocalTimestamp for all event timestamps

### Commits Made During Session
1. "feat: Add Windows view toggle to show wake/sleep periods chronologically"
2. "fix: Polish Windows view with correct colors, alignment, and event filtering logic"
3. "fix: Remove padding from timestamp to align with top of tiles"

### Technical Implementation
- Added `viewMode` state with 'events' | 'windows' toggle
- Created `getWindowsViewData()` function to process chronological events
- Implemented `formatDuration()` helper for "Xh Ym" format
- Events sorted chronologically across all relevant logs
- Duration calculated between consecutive events
- Smart filtering to show only relevant events per day

### Visual Design
- Toggle button styled consistently with app design
- Timestamps in light purple (#745288) aligned with tile tops
- Color-coded tiles for different sleep states
- Gray separators visually distinguish out-of-bed periods
- Maintains clickability to navigate to source logs

### Next Steps
- Feature complete and ready for user testing
- Consider adding additional analytics or insights to Windows view
- Monitor user feedback for potential refinements

## Date and Time Input Styling Enhancements

### Objective
Improve the visual appearance and usability of date and time input fields throughout the application.

### Progress Status
✅ Enhanced font sizes for better readability:
  - Date inputs: `text-base` → `text-xl` (20px)
  - Time picker inputs: `1rem` → `1.25rem` (20px)
✅ Added consistent width styling to all TimePicker components (`w-32`)
✅ Fixed date input calendar icon visibility with `colorScheme` property
✅ Resolved date input width issues - increased to `w-44` to prevent text overlap with calendar icon
✅ Restructured header layout for better UX:
  - Date navigation controls (arrows + date) left-aligned as a group
  - Windows/Events toggle moved to right side of same row
✅ Left-aligned date picker dropdown for improved alignment

### Commits Made During Session
1. "feat: Enhance date and time input styling with larger fonts and improved layout"

### Technical Implementation
- Updated all TimePicker instances with `w-32` width class
- Modified CSS font sizes in `src/index.css` for TimePicker components
- Enhanced date input styling with proper width and color scheme
- Restructured header layout using flexbox justify-between
- Improved date picker alignment from center to left

### Visual Improvements
- Larger, more readable fonts for date and time inputs
- Consistent sizing across all time picker components
- Better calendar icon visibility in both light and dark modes
- Cleaner header layout with logical grouping of controls
- Fixed input field width issues preventing text overlap

## Comments Modal Implementation

### Objective
Create a modal overlay for viewing unread and all log comments across a child's sleep logs, with search functionality and mark as read capabilities.

### Progress Status
✅ Added MessageSquare icon button to LogList header
✅ Created CommentsModal component with proper overlay styling
✅ Implemented toggle between Unread/All views with "View All"/"View Unread" button
✅ Added "Mark all as read" button with pink background (#F0DDEF)
✅ Implemented real-time search bar for All comments view
✅ Styled comment tiles with:
  - Gray background tiles
  - Purple (#745288) author text showing "[Name] commented on [LogType]"
  - Right-aligned timestamps with time and date on separate lines
  - Clickable tiles that navigate to the associated log
✅ Connected to Firebase to:
  - Fetch all log comments for the child
  - Filter unread comments based on readBy array
  - Mark comments as read using arrayUnion
✅ Added global `window.openCommentsModal()` function for external triggers

### Commits Made During Session
1. "feat: Add Comments Modal for viewing unread and all log comments"

### Technical Implementation
- Modal uses same z-index layering as SleepLogModal (z-40 backdrop, z-50 content)
- Fetches messages from Firebase where logId != null
- Filters unread messages by checking if user ID is in readBy array
- Real-time listener updates comments as new ones arrive
- Search filters comments by text content (case-insensitive)
- Click handler navigates to log detail and closes modal

### Integration Points
- Can be triggered from within app via MessageSquare icon
- Can be triggered externally via `window.openCommentsModal()` 
- Works with existing Firebase message structure
- Integrates with navigation system for log detail views

## Bubble Integration & Modal Communication System

### Objective
Optimize the Firebase app for embedding in Bubble with proper handling of floating elements and full-page modals.

### Problem Solved
When embedded in Bubble's HTML element, the app had two issues:
1. **Bottom-pinned elements** extended way down the page requiring excessive scrolling
2. **Full-page modals** were confined to the HTML element instead of covering the entire Bubble page

### Progress Status
✅ Implemented iframe detection using `isInIframe()` helper function
✅ Created postMessage communication system between Firebase app and Bubble
✅ Added modal open/close message handlers for SleepLogModal and EditLogModal
✅ Configured Bubble to:
  - Listen for modal messages from the iframe
  - Show/hide native Bubble popups in response
  - Pass through necessary data (logId, childId, etc.)
✅ Firebase app now sends messages when users trigger modals
✅ Successfully integrated with Bubble's native modal system

### Commits Made During Session
1. "feat: Add iframe detection and postMessage communication for Bubble modal integration"
2. "fix: Update modal triggers to use postMessage when embedded in Bubble iframe"

### Technical Implementation
```javascript
// Iframe detection
const isInIframe = () => window.self !== window.top;

// Modal communication
if (isInIframe()) {
  window.parent.postMessage({
    type: 'openSleepLogModal',
    data: { childId, childName, sleepType }
  }, '*');
}
```

### Integration Architecture
1. **Firebase App (in iframe)**: Detects user actions and sends postMessage
2. **Bubble Parent Page**: Listens for messages and triggers native modals
3. **Data Flow**: Modal data passed through message event
4. **User Experience**: Seamless full-page modals despite iframe constraints

### Next Steps
- Continue adding postMessage handlers for any new modals
- Consider implementing response messages from Bubble back to Firebase
- Document the message API for future developers

## DaisyUI Removal

### Objective
Remove DaisyUI dependency from the project to focus on custom styling based on existing Rested/DoulaConnect app designs.

### Progress Status
✅ Removed DaisyUI from package.json dependencies
✅ Removed DaisyUI plugin configuration from src/index.css
✅ Replaced DaisyUI classes in MessageInputBar.tsx with Tailwind equivalents:
  - `btn btn-circle btn-sm` → `flex items-center justify-center w-8 h-8 rounded-full`
  - `input input-bordered` → `border rounded-full`
  - `loading loading-spinner` → `border-2 border-current border-t-transparent rounded-full animate-spin`
✅ Updated CLAUDE.md to remove DaisyUI references and add custom styling guidelines
✅ Verified no DaisyUI classes remain in other components

### Commits Made During Session
1. "refactor: Remove DaisyUI dependency and replace with Tailwind equivalents"

### Technical Changes
- Removed DaisyUI plugin from CSS configuration
- Replaced component classes with native Tailwind utilities
- Updated spinner animation to use pure CSS
- Maintained all existing functionality and styling
- Focused on custom color variables and design patterns

### Benefits
- Eliminates unused component library reducing bundle size
- Forces focus on matching existing app design patterns
- Removes Claude's tendency to use unapproved DaisyUI colors
- Simplifies styling approach to pure Tailwind utilities

## Previous Features Implemented

### Bedtime Label Update
- Changed "Last night's bedtime" to "Bedtime from yesterday" for clarity
- Applied consistently across LogList tiles

### Auto-navigation Prevention  
- Removed automatic navigation from log tiles to prevent accidental page changes
- Users must now explicitly click message icons or other navigation elements

### Message Input Bar Spacing
- Standardized 8px spacing between message bubble and input bar
- Consistent spacing applied across all views (chat and log detail)

### Continue Button Update
- Changed behavior to show LoggingModal instead of EditLogModal
- Provides cleaner flow for continuing sleep logs

## Claude Code Push Notification System

### Objective
Set up push notifications for Claude Code workflow using existing Firebase/OneSignal infrastructure to notify when Claude needs input or completes tasks.

### Progress Status
✅ Created Firebase Cloud Function `sendClaudeNotification` for push notifications
✅ Integrated with existing OneSignal system using player ID: 04618fe6-50c8-4c2a-bb64-9010776e3ec1
✅ Added TypeScript notification utilities in `src/lib/claude-notifications.ts`
✅ Created HTML test interface for debugging and validation
✅ Verified all notification types work correctly (info, waiting, completed, error)
✅ Tested API endpoints and confirmed successful responses
✅ Resolved JSON parsing errors that were occurring during development

### Commits Made During Session
1. "feat: Add push notification system for Claude Code workflow"

### Technical Implementation
- **Firebase Function**: `sendClaudeNotification` accepts message and type parameters
- **OneSignal Integration**: Uses existing DoulaConnect app infrastructure
- **API Endpoint**: `https://us-central1-doulaconnect-messaging.cloudfunctions.net/sendClaudeNotification`
- **CORS Support**: Configured for browser-based testing
- **Error Handling**: Proper validation and error responses

### Test Results
- All notification types return success responses
- API calls properly formatted and processed
- HTML test interface working correctly
- Recipients showing as 0 (likely due to device/player ID status)

### Next Steps
✅ Integrate notification calls into Claude Code system prompt
✅ Monitor notification delivery on actual device
✅ Consider adding notification scheduling for specific workflow events

### Integration Complete
- Created system prompt integration guide in `claude-code-notification-integration.md`
- Successfully tested all notification types on actual device
- System ready for production use in Claude Code workflow

## Navigation Context & Routing
- App uses URL parameters to determine current view and context
- Key params: `view`, `childId`, `logId`, `conversationId`
- Timezone passed via URL parameter from Bubble parent app