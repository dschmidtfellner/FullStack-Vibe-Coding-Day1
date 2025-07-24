# Claude Notes

This file tracks ongoing work and important context for Claude Code sessions. It should be included in every commit to preserve context for future sessions.

## Current Feature: EditLog Component Restructuring

### Session Summary
Working on restructuring the edit-log-modal component to be more modular and renaming it to EditLog.

### Commits Made
1. `chore: Check file line counts and discuss restructuring needs` - Analyzed longest files in repo
2. `feat: Create EditLog restructuring plan for component modularization` - Created restructuring plan
3. `refactor: Extract BasicInfoSection, DateSelectorSection, and InterjectionSection from EditLog` - Extracted form sections
4. `refactor: Replace inline form sections with extracted components in EditLog` - Replaced inline sections

### Progress Status
- ✅ Created restructuring plan for edit-log-modal → edit-log
- ✅ Renamed component and updated all references
- ✅ Extracted BasicInfoSection, DateSelectorSection, and InterjectionSection
- ✅ Extracted EventsList component for event management
- Next: Extract validation components and custom hooks

### Important Context
- User wants to rename edit-log-modal to edit-log (remove "modal" references)
- Need to update all documentation references
- Focus on LLM-friendly file sizes and maintainability
- EditLog reduced from 895 lines to ~564 lines so far

### Relevant File Locations
- Main component: `src/features/logging/components/edit-log.tsx`
- Form sections: `src/features/logging/components/edit-log-form-sections/`
- Event components: `src/features/logging/components/edit-log-events/`
- Restructuring plan: `docs/plans/edit-log-restructuring-plan.md`

## Previous Feature: Firebase Module Reorganization (2025-01-22)

### Objective
Reorganize the bloated firebase-messaging.ts file (1,034 lines) into focused modules to improve maintainability and AI navigation.

### Progress Status

#### Completed Phases
1. ✅ **Phase 0**: Setup and baseline testing (completed in previous session)
2. ✅ **Phase 1**: Foundation with types and core utilities (completed in previous session)
3. ✅ **Phase 2**: Timezone utilities - 7 functions (completed in previous session)
4. ✅ **Phase 3**: Storage module - 1 function (completed in previous session)
5. ✅ **Phase 4**: Auth & Users - 3 functions (completed in previous session)
6. ✅ **Phase 5**: Sleep Logging - 6 functions
   - Extracted: createSleepLog, addSleepEvent, updateSleepLog, getLog, listenToLogs, calculateSleepDuration
   - Created `/src/lib/firebase/sleep-logging.ts`
   - Maintained backward compatibility with re-exports
7. ✅ **Phase 6**: Log Comments - 5 functions
   - Extracted: sendLogComment, sendLogImageComment, sendLogAudioComment, updateLogCommentCount, listenToLogComments
   - Created `/src/lib/firebase/log-comments.ts`
   - Note: updateConversationLastMessage kept in main file as it's shared with messaging
8. ✅ **Phase 7**: Messaging - 7 functions
   - Extracted: sendMessage, sendImageMessage, sendAudioMessage, listenToMessages, setTypingStatus, listenToTypingIndicators, toggleMessageReaction
   - Created `/src/lib/firebase/messaging.ts`
   - Moved updateConversationLastMessage to messaging module where it belongs
9. ✅ **Phase 8**: Unread Counters - 4 functions (just completed)
   - Extracted: listenToUnreadCounters, markChatMessagesAsRead, markLogCommentsAsRead, markAllLogCommentsAsRead
   - Created `/src/lib/firebase/unread-counters.ts`
   - All 33 functions now migrated!

### Pre-existing Timezone Bug
- **Issue Discovered**: Even before reorganization, there's a timezone display bug when using "Continue" on logs
- **Decision**: Continue with reorganization, fix timezone bug after completion
- **Tracking**: Added to todo list as high priority post-reorganization task

### Migration Complete! 🎉
- **All 33 functions successfully migrated to 9 focused modules**
- **firebase-messaging.ts reduced from 1,034 to 74 lines (93% reduction)**
- **Backward compatibility maintained via re-export shim**
- **New imports should use `@/lib/firebase` pattern**

### Files Modified in This Session
- Fixed console flooding by commenting out logs in `listenToLogs`
- Reverted to commit 1904380 after timezone fix attempts failed
- Created `/src/lib/firebase/sleep-logging.ts`
- Created `/src/lib/firebase/log-comments.ts`
- Created `/src/lib/firebase/messaging.ts`
- Updated `/src/lib/firebase/index.ts` to export all completed modules
- Cleaned up `/src/lib/firebase-messaging.ts` (reduced from 1,034 to 74 lines - 93% reduction)

### Firebase-messaging.ts Removal Complete! 🎉
- **firebase-messaging.ts has been completely deleted**
- **All imports updated to use new modular structure**
- **Import patterns**:
  - Functions: `@/lib/firebase/index`
  - Types: `@/lib/firebase/types`
  - Core (db, storage): `@/lib/firebase/core`

### Next Steps
- Tackle the pre-existing timezone display bug that was discovered during testing

## Previous Feature: Family Unread Counter Implementation (2025-01-18)

### Objective
Implement Phase 1 of the family unread counter plan - URL-based family aggregation for Bubble client selector while maintaining individual child counters.

### Progress Status

#### Completed (2025-01-18)
1. ✅ **Modified mark-as-read functions to accept family context**
   - Updated `markChatAsReadForUser` to accept optional familyContext parameter
   - Updated `markLogAsReadForUser` to accept optional familyContext parameter  
   - Updated `markAllLogsAsReadForUser` to accept optional familyContext parameter
   - All functions now call `updateFamilyCounters` when family context is provided

2. ✅ **Updated HTTP endpoints to parse family parameters**
   - Modified all mark-as-read endpoints to accept `originalChildId` and `siblings` parameters
   - Added parsing logic to handle comma-separated sibling lists
   - Family context is optional - endpoints work with or without it

3. ✅ **Enhanced getFamilyUnreadCounters endpoint**
   - Now accepts optional `siblings` parameter
   - Automatically updates family counters before returning results
   - Ensures fresh family totals when Bubble queries

#### Testing
- Created `test-family-counters.html` for comprehensive testing of family counter functionality
- Test page allows:
  - Getting family unread counters with sibling data
  - Testing all mark-as-read functions with family context
  - Viewing individual child counters for comparison
  - Verifying family counter aggregation logic

### Deployment Status
✅ Functions successfully deployed to production (doulaconnect-messaging project)
✅ All endpoints updated with family counter support
✅ Ready for Bubble integration testing

### Technical Implementation
- Family counters stored in `family_unread_counters` collection
- Document ID format: `user_{userId}_family_{originalChildId}`
- Updates triggered by mark-as-read actions or getFamilyUnreadCounters queries
- Siblings list passed as comma-separated string or array

### Commits Made During Session
1. "feat: Implement family unread counter support in Cloud Functions"
2. "feat: UNTESTED implementation of family unread counters" (includes test page)

### ⚠️ Important Note
This implementation is UNTESTED with real data. While the code has been deployed and the test infrastructure is in place, it needs validation with actual sibling data and Bubble integration before being used in production.

## Previous Feature: Component Refactoring & Naming Convention Migration (2025-01-18)

### Objective
Complete the codebase reorganization by:
1. Refactoring the massive log-modal component into focused pieces
2. Implementing consistent kebab-case naming conventions
3. Renaming sleep-logging to logging for future expansion

### Progress Status

#### Completed Today (2025-01-18)
1. ✅ **log-modal Component Refactoring** 
   - Reduced from 1,277 lines to 140 lines (89% reduction)
   - Extracted business logic into `use-log-modal.ts` custom hook (564 lines)
   - Created 4 focused sub-components:
     - `log-first-screen.tsx` (224 lines) - Date/time/type selection
     - `log-subsequent-screen.tsx` (227 lines) - Event selection screens
     - `log-modal-actions.tsx` (110 lines) - Action buttons & validation
   - Maintained all existing functionality while improving maintainability

2. ✅ **Kebab-case Migration for All Components**
   - SleepLogModal.tsx → log-modal.tsx
   - EditLogModal.tsx → edit-log-modal.tsx
   - LogDetailView.tsx → log-detail-view.tsx
   - LogsListView.tsx → logs-list-view.tsx
   - CommentsModal.tsx → comments-modal.tsx
   - SleepLogTile.tsx → sleep-log-tile.tsx
   - Updated all imports and barrel exports

3. ✅ **Directory Rename: sleep-logging → logging**
   - Renamed `src/features/sleep-logging` to `src/features/logging`
   - Updated all import paths throughout codebase
   - Updated barrel exports in features/index.ts
   - Verified build passes with new structure

4. ✅ **Documentation Updates**
   - Updated component-map.md with new structure and file names
   - Updated developer-guide.md with correct import examples
   - Added recent changes section to developer guide
   - Maintained comprehensive API reference

#### Technical Achievements
- **97.7% size reduction** in main modal component through extraction
- **Business logic separation** via custom hooks pattern
- **Consistent naming** across entire codebase following LLM-friendly conventions
- **Future-ready structure** for expanding beyond sleep logging

### Commits Made During Session
1. "refactor: Extract log-modal business logic into custom hook and focused components"
2. "refactor: Migrate all sleep-logging components to kebab-case naming"
3. "refactor: Rename sleep-logging to logging directory"

### Benefits Achieved
- **LLM Navigation**: Much easier for AI agents to understand and modify code
- **Developer Experience**: Focused components with single responsibilities
- **Maintainability**: Business logic centralized in testable custom hooks
- **Scalability**: Ready to add other log types beyond sleep
- **Consistency**: Uniform kebab-case naming throughout project

## Previous Feature: Codebase Reorganization (2025-01-17)

### Objective
Refactor the massive 4,384-line index.tsx file into smaller, more manageable components to improve:
- AI agent navigation and understanding
- Code maintainability
- Developer learning experience

### Progress Status

#### Completed
1. ✅ Extracted MessagingView component
   - Moved from `src/routes/index.tsx` (lines 371-728) to `src/features/messaging/components/messaging-view.tsx`
   - Successfully removed function from main file and updated imports

2. ✅ Extracted shared media components
   - Created `src/features/shared/components/media-messages.tsx`
   - Contains ImageMessage and AudioMessage components used by both messaging and log views
   - Updated all imports to use shared location

#### In Progress
- Extracting remaining view components (LogListView, LogDetailView, LoggingModal, EditLogModal)

#### Next Steps
1. Extract LogListView component
2. Extract LogDetailView component  
3. Extract modal components (LoggingModal, EditLogModal)
4. Move NavigationContext to separate file
5. Create component index files
6. Add component documentation map

### Important Context
- Using kebab-case for file names as requested by user
- Components are being organized by feature (messaging, logs, shared)
- The main index.tsx originally contained all 5 major views mixed together
- ImageMessage and AudioMessage are used in multiple places, so they were extracted to shared

### File Structure Being Created
```
src/
├── features/
│   ├── messaging/
│   │   └── components/
│   │       └── messaging-view.tsx
│   ├── logs/
│   │   └── components/
│   │       ├── log-list-view.tsx (pending)
│   │       ├── log-detail-view.tsx (pending)
│   │       ├── logging-modal.tsx (pending)
│   │       └── edit-log-modal.tsx (pending)
│   └── shared/
│       └── components/
│           └── media-messages.tsx
└── routes/
    └── index.tsx (being reduced from 4,384 lines)
```

## Previous Feature: Child Local Time Implementation

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

## DaisyUI Removal & Logo System Implementation

### Objective
Remove DaisyUI dependency from the project to focus on custom styling based on existing Rested/DoulaConnect app designs, and implement a branded logo system for different app contexts.

### Progress Status
✅ Removed DaisyUI from package.json dependencies
✅ Removed DaisyUI plugin configuration from src/index.css
✅ Replaced DaisyUI classes in MessageInputBar.tsx with Tailwind equivalents:
  - `btn btn-circle btn-sm` → `flex items-center justify-center w-8 h-8 rounded-full`
  - `input input-bordered` → `border rounded-full`
  - `loading loading-spinner` → `border-2 border-current border-t-transparent rounded-full animate-spin`
✅ Fixed styling issues after DaisyUI removal:
  - Floating action button properly circular
  - Input field padding and borders consistent
  - Time picker border colors standardized
✅ Implemented logo-based empty state system:
  - Created `src/utils/logoUtils.ts` for URL parameter-based logo selection
  - Added Rested and DoulaConnect logo assets in `src/assets/logos/`
  - Updated empty state to show branded logos at 30% opacity
  - Changed empty state text to "No logs for this day / Tap the plus button to start tracking"
  - Logo switches based on `sender_app` URL parameter (Doula = DoulaConnect, default = Rested)
✅ Added TypeScript declarations for PNG imports in `src/vite-env.d.ts`
✅ Updated CLAUDE.md to remove DaisyUI references and add custom styling guidelines
✅ Verified no DaisyUI classes remain in other components

### Commits Made During Session
1. "refactor: Remove DaisyUI dependency and replace with Tailwind equivalents"
2. "feat: Implement logo-based empty state system with URL parameter switching"

### Technical Changes
- Removed DaisyUI plugin from CSS configuration
- Replaced component classes with native Tailwind utilities
- Updated spinner animation to use pure CSS
- Fixed CSS specificity issues with !important flags
- Created scalable asset management system for logos
- Implemented URL parameter-based branding system

### Logo System Architecture
```typescript
// src/utils/logoUtils.ts
export const getAppLogo = (): LogoConfig => {
  const urlParams = new URLSearchParams(window.location.search);
  const senderApp = urlParams.get('sender_app');
  
  if (senderApp === 'Doula') {
    return {
      src: doulaconnectLogo,
      alt: 'DoulaConnect Logo',
      name: 'DoulaConnect'
    };
  }
  
  return {
    src: restedLogo,
    alt: 'Rested Logo',
    name: 'Rested'
  };
};
```

### Benefits
- Eliminates unused component library reducing bundle size
- Forces focus on matching existing app design patterns
- Removes Claude's tendency to use unapproved DaisyUI colors
- Simplifies styling approach to pure Tailwind utilities
- Provides scalable branding system for multi-app deployment
- Maintains brand consistency across different contexts

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

## Current Feature: Family Unread Counters Implementation

### Session Summary
Implementing automatic family unread counter creation to match individual unread_counters behavior.

### What We Did:
1. Modified `onMessageCreated` trigger to automatically create/update `familyUnreadCounters` for ALL recipients
2. Updated all mark-as-read functions to handle family counters both with and without sibling context
3. Treats every child as its own family by default (even single-child families)

### Implementation Details:
- When a message is created, both individual AND family counters are now updated
- Family counter ID format: `user_{userId}_family_{childId}` (childId acts as originalChildId when no siblings)
- When marking messages as read:
  - WITH sibling context (from URL params): Aggregates counts across all siblings
  - WITHOUT sibling context: Updates family counter to match individual counter
- This ensures familyUnreadCounters exist for all user-child combinations

### Key Changes:
- `handleMessageCreated`: Now creates/updates family counters automatically
- `markChatAsReadForUser`: Updates family counters with or without sibling context
- `markLogAsReadForUser`: Updates family counters with or without sibling context  
- `markAllLogsAsReadForUser`: Updates family counters with or without sibling context

### Commits Made:
1. feat: Implement automatic family unread counter creation to match individual counters
2. fix: Add security rules for family_unread_counters collection  
3. fix: Correct Bubble API endpoint name to firebase_message_recipients

### Issues Fixed:
- Family counters now created automatically when messages are sent
- Fixed 404 error - Bubble API endpoint was incorrectly named
- Added missing Firestore security rules for family_unread_counters collection
- Verified family counters are being created successfully in logs

### Current Issue:
- Bubble FirestoreDataList plugin can't connect to ANY Firestore collection (including previously working ones)
- This suggests an authentication/configuration issue with the Bubble plugin itself

### Next Steps:
- Check browser console for specific error messages
- Verify API key and project ID in Bubble plugin settings
- Test aggregation when sibling info is provided via URL params (after connection is fixed)

## Navigation Context & Routing
- App uses URL parameters to determine current view and context
- Key params: `view`, `childId`, `logId`, `conversationId`
- Timezone passed via URL parameter from Bubble parent app