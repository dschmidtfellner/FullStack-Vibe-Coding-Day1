# Claude Code Session Notes

## Session Start
- Starting commit hash: d9229dd (fix: Remove unused functions and imports causing TypeScript build errors)
- Session commits: [cleanup commit, a58681b (sleep statistics implementation)]

## Current Status - CONVEX CLEANUP COMPLETE ✅
- **COMPLETED: Convex completely removed from project**
- Firebase project "doulaconnect-messaging" created and configured
- Firestore database with security rules deployed
- Complete migration from Convex to Firebase accomplished
- Real-time messaging working with Firebase listeners
- Image and audio uploads using Firebase Storage
- All messaging features preserved (text, image, audio)
- **COMPLETED: Firebase Cloud Functions API implemented for Bubble integration**
- **READY: Test page created to demonstrate API functionality**

## Firebase Migration Progress
- ✅ Firebase CLI installed and authenticated
- ✅ Firebase project "doulaconnect-messaging" created
- ✅ Firestore database created with production mode
- ✅ Security rules deployed for messaging collections
- ✅ Firebase SDK installed and configured
- ✅ Environment variables set up for Firebase connection
- ✅ Firebase-Clerk authentication integration working
- ✅ Real-time messaging utilities created and implemented
- ✅ Convex dependencies completely removed
- ✅ UI components updated to use Firebase data structure
- ✅ Firebase Storage integration for file uploads
- ✅ Real-time listeners working for instant message updates

## App Status
- Messaging app successfully migrated to Firebase
- All features working: text messages, image uploads, audio recording
- Real-time updates faster than previous Convex implementation
- **COMPLETED: Clean audio recording implementation** ✅ - separate mic button works perfectly without layout shifts
- **COMPLETED: Real-time typing indicators** ✅ - shows when other users are typing with animated dots and smart debouncing
- **COMPLETED: Message reactions** ✅ - emoji reactions with picker, real-time updates, and user tracking
- **COMPLETED: Conversation-based messaging** ✅ - child-specific conversations with URL routing
- **COMPLETED: JWT authentication system** ✅ - replaced Clerk with Bubble-compatible JWT tokens
- **COMPLETED: Sleep statistics calculations** ✅ - comprehensive sleep analytics for Sleep Consulting children with 5 key metrics
- **COMPLETED: Wake-Windows view** ✅ - chronological timeline of sleep periods with duration calculations
- Ready for integration as module in Bubble app

## Important Context
- Full-stack TypeScript app with React + Vite + TanStack Router (frontend)
- TRANSITIONING: From Convex backend to Firebase for messaging performance
- Firebase project: doulaconnect-messaging
- Target: High-performance messaging module for integration with Bubble app
- Use `mcp__shell-commands__launch-dev-all` to start development servers
- Project follows git workflow with frequent commits as checkpoints

## Time Validation Implementation for Sleep Logs

### Feature: Time Input Validation Guardrails

### What was implemented:

1. **Overnight Logic (Prepped Time)**
   - Created `createEventTimestamp` function that adds 24 hours if the inputted time is before the most recent event
   - This handles overnight sleep sessions automatically

2. **Validation Rules:**
   - **Valid (No Warning)**: 0-12 hours after last event
   - **Warning (Confirmable)**: 12-16 hours after last event
     - Shows yellow warning with "Confirm" button
     - Message: "That time is more than 12 hours after the last logged time - are you sure you want to save it?"
     - Subtext: "Did you instead want to end this [Nap/Bedtime] and start another?"
   - **Error (Hard Block)**: 16+ hours after last event
     - Shows red error, no way to proceed
     - Message: "Unable to add a log more than 16 hours after your last logged time in this [Nap/Bedtime]."
     - Subtext: "Consider adding a new [Nap/Bedtime] instead."

3. **Future Time Validation:**
   - Warns if time is more than 5 minutes in the future
   - Applies to both initial timestamp and subsequent events
   - Shows yellow warning with "Confirm" button

4. **Button Rate Limiting:**
   - Add button disabled for 1.5 seconds after being pressed
   - Prevents accidental duplicate entries from button mashing

5. **UI Updates:**
   - Added validation warning display above action buttons
   - Shows contextual buttons: "Confirm" for warnings, "Change Time" when there's an error
   - Color-coded warnings: Yellow for confirmable warnings, Red for hard blocks
   - Validation runs on both time picker and date picker changes

### Implementation Details:
- Added validation state variables: `validationWarning`, `isButtonDisabled`, `lastButtonPressTime`
- Created `validateTimeInput` function that checks all validation rules
- Updated `handleSave` to include validation checks and rate limiting
- Modified UI to display warnings and handle confirmation flow

### Commits Made:
- `feat: Add time validation guardrails for sleep log inputs`
- `fix: Complete modal relative date text implementation`

### Recently Completed:
- ✅ Implemented relative date text in sleep log modal
- ✅ Modal now shows "Yesterday", "2 days ago", etc. instead of just "Today"
- ✅ Matches the relative date functionality in the log list view
- ✅ Replaced hardcoded "Today" check with dynamic `getModalRelativeDateText()` function

### Next Steps:
- The validation system is fully implemented and ready for testing
- All validation scenarios should be tested with real user input
- Consider adding analytics to track how often validations are triggered

## Edit Interface for Sleep Logs

### Objective
Implement an Edit interface for the Log Detail page that allows users to:
- Edit times of existing sleep events
- Delete sleep events
- Add interjections between events
- Move the entire log to a different date

### Progress Status
✅ Added Edit button next to Delete button on Log Detail page
✅ Created new edit-log route and view
✅ Implemented EditLogView component with:
  - Header with Cancel/Save buttons
  - Preserved log tile from detail view with delete icon
  - Date selector to move entire log
  - Event list with Edit/Delete functionality
  - Inline time editing with TimePicker
  - Plus buttons between events for interjections
  - Smart interjection type detection
✅ Styled interface to match the provided screenshot:
  - Clean layout with horizontal dividers
  - Purple/pink themed buttons and icons
  - Proper spacing and alignment
  - Subtle gray delete icons

### Modal to Full-Screen Page Transformation
✅ Converted EditLogModal from modal overlay to full-screen page
✅ Removed backdrop and modal constraints 
✅ Fixed scrolling issues by removing fixed positioning
✅ Updated navigation to go back to LogDetailView instead of LogsListView
✅ Hidden comment input bar when EditLogModal is visible
✅ Added validation for consecutive same event types with red formatting and exclamation marks
✅ Implemented validation dialog to prevent saving with consecutive same types

### Commits Made During Session
1. "feat: Add Edit interface for sleep logs with date selector, inline time editing, and interjection support"
2. "fix: Polish Edit interface styling to match design specifications"
3. "fix: Restructure EditLogView as modal overlay to show LogDetailView background"
4. Multiple fixes for modal behavior, scrolling, and validation

### Important Implementation Details
- Created new 'edit-log' view type in NavigationState
- Modified navigateToEditLog to use 'edit-log' instead of 'log-sleep'
- Events are converted from Firestore Timestamp format to Date for editing
- Date changes move all events by the same time offset
- Interjections are placed halfway between existing events
- Save function updates Firebase and navigates back to log detail
- Validation prevents saving consecutive same event types (e.g., two "Awake" events in a row)

## Wake-Windows View Implementation

### Objective
Create an alternative view mode in the Log List that shows wake/sleep periods chronologically with duration calculations between events.

### Progress Status
✅ Added toggle button in upper right of Log List (Events/Windows)
✅ Created Windows view showing chronological timeline of sleep periods
✅ Implemented duration calculation between consecutive subevents
✅ Styled tiles with proper colors:
  - Pink (#F0DDEF) for awake in bed periods (Put in bed/Woke up events)
  - Purple (#745288) with white text for asleep periods (Fell asleep events)
  - Gray for out of bed periods
✅ Added gray line separators before/after out of bed tiles
✅ Made tiles clickable to open associated sleep log
✅ Fixed timestamp alignment to top of tiles
✅ Set timestamp color to light purple (#745288)
✅ Implemented correct event filtering logic:
  - Shows events from logs that started on selected day
  - PLUS previous day bedtime's "out of bed" event only
  - This creates proper bridge showing timespan from previous night to current day

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

### Solutions Implemented

#### Case 1: Bottom-Pinned Elements (Fixed)
✅ Changed from `fixed` to `absolute` positioning for iframe compatibility:
- **Floating Plus Button**: `fixed bottom-24` → `absolute bottom-24`
- **Message Input Bars**: `fixed left-0 right-0` → `absolute left-0 right-0`
- **Comment Input Bars**: `fixed bottom-0` → `absolute bottom-0`
- **App Containers**: `h-full` → `h-[100vh]` for consistent height

#### Case 2: Modal Communication System (Major Feature)
✅ Added postMessage communication between Firebase app and Bubble parent:
- **NEW_LOG_MODAL**: When Plus button clicked
- **EDIT_LOG_MODAL**: When Edit button clicked  
- **COMMENTS_MODAL**: When Comments icon clicked
- **Automatic Detection**: Checks if in iframe (`window.parent !== window`)
- **Graceful Fallback**: Shows inline modals when not embedded

### Bubble Integration Code

Add this JavaScript to your Bubble page to handle modal communications:

```javascript
// Listen for modal requests from Firebase app
window.addEventListener('message', function(event) {
  // Verify origin if needed: if (event.origin !== 'https://your-firebase-app.vercel.app') return;
  
  if (event.data.type === 'FIREBASE_APP_MODAL') {
    const { modalType, data } = event.data;
    
    switch(modalType) {
      case 'NEW_LOG_MODAL':
        // Show Bubble popup for creating new log
        // Pass data.defaultDate and data.childId to your Bubble workflow
        console.log('Show new log modal for child:', data.childId, 'date:', data.defaultDate);
        break;
        
      case 'EDIT_LOG_MODAL':
        // Show Bubble popup for editing log
        // Pass data.logId and data.childId to your Bubble workflow
        console.log('Show edit log modal for log:', data.logId, 'child:', data.childId);
        break;
        
      case 'COMMENTS_MODAL':
        // Show Bubble popup for comments
        // Pass data.childId to your Bubble workflow
        console.log('Show comments modal for child:', data.childId);
        break;
    }
  }
});
```

### Technical Implementation
- **Detection**: Uses `window.parent !== window` to detect iframe embedding
- **Communication**: Sends structured postMessage with type and data
- **Fallback**: Maintains original inline modal functionality for standalone use
- **Data Passing**: Includes relevant IDs (childId, logId) and context (defaultDate)

### Benefits
- **Better UX**: Full-page modals in Bubble instead of cramped iframe modals
- **Native Feel**: Modals use Bubble's native popup system
- **Responsive**: Proper mobile experience with full-screen coverage
- **Seamless**: Zero-config - automatically detects embedding context

## Modal Positioning Fix

### Objective
Replace "fixed inset-0" with "absolute inset-0" in modal components to make them position relative to the app container instead of the browser viewport.

### Progress Status
✅ Identified all modal components using "fixed inset-0" positioning
✅ Updated the following modals to use "absolute inset-0":
  - Image modal (selectedImage display)
  - Interjection modal for sleep log events
  - Validation dialog for time input validation
  - EditLogView modal overlay components (backdrop and container)

### Commits Made During Session
1. "fix: Replace fixed inset-0 with absolute inset-0 in modal components for proper container-relative positioning"

### Technical Implementation
- Changed positioning from viewport-relative (fixed) to container-relative (absolute)
- Affected 6 different modal overlay elements across various components
- Maintains same visual appearance but ensures proper containment within app boundaries
- Improves integration when app is embedded or used as a module

## Input Bar Positioning Fix

### Objective
Fix LogDetail page input bar to float properly at the bottom instead of requiring scrolling to reach it.

### Problem Identified
The LogDetail input bar was not floating properly due to:
1. **Conflicting height calculations**: `h-full h-[calc(100%-180px)]` in content container
2. **Inconsistent positioning**: LogDetail used `bottom-[92px]` while Chat used `bottom: '81px'`
3. **Mismatched padding**: Scroll container had `pb-[96px]` but input was at `bottom-[92px]`

### Progress Status
✅ Fixed content container height calculation by removing conflicting classes
✅ Standardized input positioning - both Chat and LogDetail now use `style={{ bottom: '81px' }}`
✅ Adjusted scroll container padding to `pb-[116px]` to match input position
✅ Verified both pages now have identical input positioning behavior

### Commits Made During Session
1. "fix: Fix LogDetail input bar positioning to float properly at bottom"

### Technical Implementation
- Removed conflicting `h-full h-[calc(100%-180px)]` from content container
- Changed to `flex-col flex-1 min-h-0` for proper flex layout
- Standardized both input bars to use `style={{ bottom: '81px' }}`
- Updated scroll area padding to prevent content from being hidden behind input

### Key Finding
Both Chat and LogDetail pages implement their input bars inline (not as shared components), but they now use identical positioning and styling patterns. The input bars are functionally equivalent with the same visual design, just different functionality (Chat handles messages, LogDetail handles comments).

## Shared MessageInputBar Component Implementation

### Objective
Extract the advanced Chat input bar functionality into a shared component and apply it to both Chat and LogDetail pages so that LogDetail gains all the advanced features.

### Problem Identified
The Chat input bar had comprehensive advanced features (photo upload, voice recording, typing indicators) that were implemented inline and not available in the LogDetail comment input. Both input bars were essentially duplicated code with the same visual design but different functionality.

### Progress Status
✅ **Verified Chat input bar advanced features**:
  - Photo upload with image validation and error handling
  - Voice recording with MediaRecorder API and automatic sending  
  - Real-time typing indicators with smart timeout cleanup
  - Upload state management with loading states and disabled buttons
  - Comprehensive error handling and user feedback

✅ **Created shared MessageInputBar component** with all advanced features:
  - Extracted all state management and functions from Chat input bar
  - Made component configurable for both Chat and LogDetail use cases
  - Added logId prop to distinguish between messages and log comments
  - Maintained all existing functionality while making it reusable

✅ **Replaced both input bars with shared component**:
  - Chat: Maintains all existing advanced functionality
  - LogDetail: Now gains photo upload, voice recording, and typing indicators
  - Both use identical positioning (`style={{ bottom: '81px' }}`) and styling
  - Cleaned up duplicate code by removing unused functions and state

✅ **Code cleanup completed**:
  - Removed 6 unused state variables from Chat view
  - Removed 7 unused functions from Chat view  
  - Removed 1 unused function from LogDetail view
  - No TypeScript compilation errors

### Commits Made During Session
1. "feat: Extract shared MessageInputBar component with all advanced features"

### Technical Implementation
- **Component location**: `/src/components/MessageInputBar.tsx`
- **Props interface**: Configurable for both Chat and LogDetail contexts
- **Feature detection**: `logId` prop determines if it's for log comments vs chat messages
- **Advanced features**: Photo upload, voice recording, typing indicators, upload state management
- **Styling**: Maintains existing theme system and responsive design
- **Error handling**: Comprehensive error states and user feedback

### Benefits Achieved
1. **Code reusability**: Single component handles both Chat and LogDetail input needs
2. **Feature parity**: LogDetail now has all the advanced features that Chat had
3. **Maintenance**: Changes to input logic now apply to both pages automatically
4. **Consistency**: Identical behavior and styling across both input implementations
5. **Clean codebase**: Removed ~200 lines of duplicate code and functions

### Key Features Now Available in Both Chat and LogDetail
- **Photo upload**: File selection, image validation, upload progress, error handling
- **Voice recording**: MediaRecorder API, real-time recording state, automatic sending
- **Typing indicators**: Real-time typing status with 2-second timeout cleanup (Chat only)
- **Upload states**: Loading spinners, disabled buttons during uploads
- **Error handling**: User-friendly alerts and comprehensive error management
- **Responsive design**: Consistent positioning and theming across devices

## CommentsModal Responsive Design Improvements

### Objective
Clean up the appearance of the unread message modal for narrow screen sizes to improve mobile user experience.

### Progress Status
✅ **Completed responsive design enhancements**:
  - Header layout using `flex-col gap-3 sm:flex-row` for proper mobile stacking
  - Reduced padding from `px-6` to `px-4 sm:px-6` for better mobile spacing
  - Shortened button text from "View All"/"View Unread" to "All"/"Unread" for mobile
  - Comment item layout stacks vertically on mobile with `flex-col sm:flex-row`
  - Proper timestamp alignment with time/date stacking on mobile
  - Exit button positioned correctly with responsive spacing

### Commits Made During Session
1. "fix: Complete responsive design cleanup for CommentsModal on narrow screens"

### Technical Implementation
- **Mobile-first approach**: Used responsive classes throughout (sm: prefixes)
- **Header layout**: Stacks title, buttons, and search vertically on mobile
- **Button sizing**: Consistent mobile-friendly button sizes and spacing
- **Comment tiles**: Responsive flex layout for author info and timestamps
- **Spacing optimization**: Reduced margins and padding for mobile screens

### Benefits Achieved
1. **Better mobile UX**: Modal no longer cramped on narrow screens
2. **Improved readability**: Proper text sizing and spacing on mobile
3. **Touch-friendly**: Buttons and interactive elements properly sized
4. **Clean layout**: Information hierarchy maintained across screen sizes

## Unread Message Counter System Implementation

### Objective
Create a performant, scalable system for tracking unread message counts per user across chat messages and log comments, with real-time updates and automatic mark-as-read functionality.

### Progress Status
✅ **Complete implementation of unread counter system**:
  - Denormalized counter documents in Firestore for O(1) lookups
  - Firebase Cloud Functions for automatic counter updates
  - Real-time counter listeners with React hooks
  - Mark-as-read functionality for chat and log comments
  - UI integration with unread count badges
  - Automatic marking as read when viewing content

### Commits Made During Session
1. "fix: Complete responsive design cleanup for CommentsModal on narrow screens"
2. "feat: Implement comprehensive unread message counter system with Firebase Cloud Functions"

### Technical Architecture
1. **Counter Document Structure** (`unread_counters` collection):
   ```typescript
   {
     id: "user_{userId}_child_{childId}",
     userId: string,
     childId: string,
     chatUnreadCount: number,
     logUnreadCount: number,
     logUnreadByLogId: { [logId: string]: number },
     totalUnreadCount: number,
     lastUpdated: Timestamp
   }
   ```

2. **Cloud Functions Implemented**:
   - `onMessageCreated`: Trigger that updates counters when new messages are created
   - `getUnreadCounters`: API endpoint to fetch counters for a user/child combination
   - `markChatAsRead`: Mark all chat messages as read
   - `markLogAsRead`: Mark log comments as read for a specific log
   - `markAllLogsAsRead`: Mark all log comments as read across all logs

3. **React Integration**:
   - `useUnreadCounters` hook for real-time counter listening
   - Automatic mark-as-read when viewing Chat (1s delay)
   - Automatic mark-as-read when viewing LogDetail (1s delay)
   - Mark all as read button in CommentsModal

4. **UI Components Updated**:
   - MessageSquare icon in LogList header shows total log unread count
   - Individual SleepLogTile components show per-log unread counts
   - Red badges with white numbers (99+ for counts > 99)
   - CommentsModal filters actually unread messages based on readBy status

### Performance Benefits
1. **O(1) Counter Reads**: No complex queries or filtering needed
2. **Real-time Updates**: Counters update instantly via Firestore listeners
3. **Scalable**: Works efficiently with thousands of messages
4. **Minimal Client Logic**: All counting handled by Cloud Functions
5. **Bubble-Ready**: Simple API endpoints for external integration

### Next Steps
- Monitor Cloud Function performance and costs
- Add API endpoints for Bubble to fetch unread counts
- Consider adding push notifications for new messages
- Add analytics to track counter update frequency

## Multi-Firebase Push Notifications Implementation (Rested + DoulaConnect)

### Objective
Implement push notifications for the new Firebase messaging system that can send notifications to devices registered with **both** old Firebase projects (Rested and DoulaConnect), enabling immediate notification delivery to all users without requiring app updates.

### Progress Status
✅ **Complete implementation of multi-Firebase push notification system**:
  - **Triple Firebase Admin SDK** initialization: New project + Rested + DoulaConnect
  - **Multi-channel FCM token management** with retrieval from both old projects
  - **Comprehensive notification delivery** via all available channels
  - User identity mapping system between old and new Firebase projects
  - Automatic push notification sending on new message creation
  - Robust error handling and testing infrastructure
  - Configuration management for multiple service account credentials

### Commits Made During Session
1. "feat: Implement cross-Firebase push notifications with dual Admin SDK and comprehensive token management"
2. "feat: Extend push notification system to support both Rested and DoulaConnect Firebase projects"

### Technical Architecture

#### 1. **Triple Firebase Admin SDK Setup**
   - **New Firebase project**: Default initialized instance (`doulaconnect-messaging`) for app data
   - **Rested Firebase project**: Secondary instance (`restedProject`) for FCM notifications to Rested app users
   - **DoulaConnect Firebase project**: Third instance (`doulaConnectProject`) for FCM notifications to DoulaConnect app users
   - Service account credentials for both old projects stored securely in Firebase config
   - Automatic fallback if either old project is not configured

#### 2. **Multi-Channel FCM Token Management**
   ```typescript
   class FCMTokenManager {
     // Get tokens from both Firebase projects
     async getFCMTokens(userId: string): Promise<{ rested?: string; doulaConnect?: string }>
     
     // Strategy A: Direct database access from both old Firebase projects
     async getTokensFromOldFirebase(userId: string): Promise<{ rested?: string; doulaConnect?: string }>
     
     // Strategy B: API endpoint calls to both old Firebase projects  
     async getTokensFromOldAPI(userId: string): Promise<{ rested?: string; doulaConnect?: string }>
     
     // Strategy C: Use tokens synced to new Firebase project
     async getTokenFromNewProject(userId: string): Promise<string | null>
   }
   ```

#### 3. **User Identity Mapping System**
   - `user_mappings` collection for linking old and new user IDs
   - API endpoints for creating and retrieving user mappings
   - Support for email-based lookups and multiple identifier types

#### 4. **Cloud Functions Implemented**
   - `onMessageCreated`: Enhanced to send push notifications automatically
   - `testPushNotification`: Test endpoint for validating push notification setup
   - `syncFCMTokens`: Sync tokens from old to new Firebase project
   - `createUserMapping`: Create/update user identity mappings
   - `getUserMapping`: Retrieve user identity mappings

#### 5. **Notification Content Generation**
   - Smart notification titles: "New Message" vs "New Log Comment"
   - Rich notification bodies with sender names and message previews
   - Special handling for image/audio messages with emoji indicators
   - Notification data payload with message context (IDs, conversation info)

### Configuration Setup

#### Environment Variables Required:
```bash
# Base64 encoded service account JSON from Rested Firebase project
firebase functions:config:set rested_firebase.service_account="<rested-base64-encoded-json>"

# Base64 encoded service account JSON from DoulaConnect Firebase project  
firebase functions:config:set doulaconnect_firebase.service_account="<doulaconnect-base64-encoded-json>"

# Optional: API endpoint configuration for both projects
firebase functions:config:set rested_firebase.api_url="https://rested-project.cloudfunctions.net"
firebase functions:config:set doulaconnect_firebase.api_url="https://doulaconnect-project.cloudfunctions.net"
```

#### Token Storage Patterns Supported:
- `users/{userId}` with fields: `fcmToken`, `playerID`, `deviceToken`, `pushToken`
- `fcmTokens/{userId}` with fields: `token`, `fcmToken`, `playerID` 
- `users/{userId}/tokens` subcollection (gets most recent by timestamp)

### Testing Infrastructure

#### Test Interface (`test-push-notifications.html`)
- Configuration testing to verify Firebase Functions connectivity
- Push notification testing with user ID or direct FCM token
- User mapping management (create/retrieve mappings)
- FCM token sync testing
- System status monitoring

#### Setup Documentation (`PUSH_NOTIFICATIONS_SETUP.md`)
- Step-by-step configuration guide
- Security considerations and best practices
- Troubleshooting common issues
- Future migration planning

### Integration Flow

1. **Message Created** → `onMessageCreated` Cloud Function triggered
2. **Get Recipients** → Extract conversation participants  
3. **Map Users** → Convert new Firebase user IDs to old Firebase user IDs
4. **Get FCM Tokens** → Retrieve tokens using multi-strategy approach
5. **Send Notifications** → Use old Firebase's FCM service to send notifications
6. **Error Handling** → Log failures and continue with other recipients

### Key Features

#### Error Handling & Resilience:
- Graceful degradation when old Firebase is not configured
- Token caching with 5-minute TTL for performance
- Multiple fallback strategies for token retrieval
- Comprehensive error logging and monitoring

#### Security:
- Service account credentials stored securely in Firebase config
- Base64 encoding for safe environment variable storage
- Minimal permissions required (FCM sending only)
- No sensitive data in notification payloads

#### Performance:
- Singleton pattern for Firebase Admin instances
- Token caching to reduce database queries
- Parallel notification sending to multiple recipients
- Efficient batch processing for group messages

### Benefits Achieved

1. **Immediate Deployment**: Works with existing app installations
2. **Zero App Updates**: No need to release new app versions
3. **Architectural Separation**: Maintains separation between old and new systems
4. **Future-Proof**: Easy migration path when ready to fully switch
5. **Robust Fallbacks**: Multiple strategies ensure high delivery success rate
6. **Comprehensive Testing**: Full test suite for validation and debugging

### Next Steps
- Deploy Cloud Functions with old Firebase service account configuration
- Test with real FCM tokens from old Firebase project
- Create user identity mappings for existing users
- Monitor delivery success rates and optimize token retrieval strategies
- Plan migration timeline for eventually switching to new Firebase project tokens

## Auto-Navigation Logic Complete Removal

### Objective
Completely remove auto-navigation logic that was causing page crashes when loading specific sleep logs via URL parameters, preparing for direct iframe URL navigation.

### Problem Identified  
Auto-navigation based on `sleep_ev` URL parameter was causing page crashes. Instead of fixing the infinite loops, the decision was made to completely remove auto-navigation in favor of direct iframe URL navigation in Bubble.

### Progress Status
✅ **Completely removed auto-navigation system**:
  - Removed `hasAutoNavigated` state and related logic from NavigationProvider
  - Removed the entire useEffect that handled `sleep_ev` parameter auto-navigation
  - Preserved all manual navigation functions (navigateToLogDetail, etc.)
  - Page now safely loads LogList view without attempting auto-navigation
  - Manual navigation via tile clicks still works perfectly

### Commits Made During Session
1. "fix: Remove auto-navigation logic that was causing page crashes"
2. "checkpoint: Auto-navigation removal complete"

### Technical Implementation
- **Removed from NavigationProvider**: 
  - `hasAutoNavigated` state variable (line 93)
  - Complete auto-navigation useEffect (lines 218-230)
- **Preserved**: All manual navigation context functions and UI interactions
- **Next Step**: Update Bubble iframe URL to use direct navigation: `?view=log-detail&logId=X4q50Kof2sH2wzdNF6TG&...`

### Benefits Achieved
1. **Crash Prevention**: No more page crashes from auto-navigation conflicts
2. **Simplified Architecture**: Removed complex auto-navigation state management  
3. **Maintained Functionality**: All manual navigation works perfectly
4. **Bubble-Ready**: Prepared for direct iframe URL navigation approach
5. **Reliable Loading**: Page consistently loads LogList view safely

### Next Integration Steps
Update Bubble iframe source URL from:
```
?view=logs&sleep_ev=X4q50Kof2sH2wzdNF6TG&childId=...
```
To:
```  
?view=log-detail&logId=X4q50Kof2sH2wzdNF6TG&childId=...
```

This eliminates the need for auto-navigation entirely while achieving the same result.