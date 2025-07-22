# Baby Sleep Tracker - Log Module Requirements

## Implementation Architecture

### Overview
The Log module will be integrated into the existing React messaging application as a single-page app with multiple views controlled by URL parameters. Components will be embedded in Bubble HTML elements and communicate via URL parameters and JWT authentication.

### Technology Stack
- **Frontend**: React + Vite + TanStack Router (same as messaging app)
- **Database**: Firebase Firestore
- **Authentication**: JWT tokens from Bubble (same system as messaging)
- **Real-time**: Firebase listeners for live updates
- **Styling**: Tailwind CSS 4 + DaisyUI 5 (matching existing app)

### URL Parameter Structure
The app will use URL parameters to determine which view to display:
- **Messaging View**: `?view=messaging&childId=xxx&childName=xxx`
- **Log List View**: `?view=logs&childId=xxx&childName=xxx&timezone=America/New_York`
- **New Sleep Log**: `?view=log-sleep&childId=xxx&timezone=America/New_York`
- **Edit Sleep Log**: `?view=log-sleep&childId=xxx&logId=xxx&timezone=America/New_York`
- **Log Detail View**: `?view=log-detail&childId=xxx&logId=xxx&timezone=America/New_York`

### Integration Approach
1. **Single React App**: One app handles both messaging and logging features
2. **Component Embedding**: App mounts in a single Bubble HTML element
3. **View Switching**: React router handles internal navigation based on URL parameters
4. **Modal Overlays**: Log entry forms appear as modals over Bubble page
5. **Bubble Navigation**: Bubble retains nav bar and controls page-level navigation

### Permission Model
- **Child-Based Access**: If user can view a child (via JWT claims), they can view all that child's logs
- **No Role Distinction**: Parents and professionals use same permission system
- **Real-time Validation**: Each view validates childId access on mount

### Data Architecture Philosophy
- **Performance First**: Optimized structure for common queries, not matching Bubble's structure
- **Migration Ready**: Design allows future bulk import from Bubble
- **Real-time Capable**: Structure supports live updates without full refreshes
- **Analytics Optimized**: Pre-computed aggregates for frequently accessed metrics

## Project Overview

### Purpose & Core Users
The Log module enables collaboration between parents and sleep professionals (doulas, sleep consultants, newborn care specialists) for comprehensive baby tracking. The system serves two primary user types:

1. **Parents**: Clients of sleep professionals who need to quickly log baby activities
2. **Sleep Professionals**: Service providers who log activities while working with families and review/analyze data for diagnostic purposes

### Core Logging Activities
**MVP Scope (Phase 1)**:
- Sleep tracking (naps and bedtime) - PRIMARY FOCUS
- Basic log list view with infinite scroll
- Log detail view with conversation threads

**Future Phases**:
- Feeding (breast, bottle)
- Pumping
- Diapers
- General notes/notebook
- Analytics dashboards
- Timer-based interfaces

## Critical Technical Requirements

### 1. Time Zone Management
**Core Challenge**: All users must see data in the baby's local time zone, regardless of their own location.

**Key Scenarios**:
- Sleep consultant in different time zone editing family's log
- Multiple caregivers in different locations logging for same baby
- Historical data must remain consistent when viewed by different users

**Implementation Requirements**:
- Baby's timezone passed via URL parameter (e.g., `&timezone=America/New_York`)
- Store all timestamps in UTC in Firestore, display in baby's timezone
- Use baby's timezone for all date calculations and day boundaries
- Handle cross-timezone editing and viewing seamlessly
- Maintain data integrity when users in different zones make edits

### 2. Smart Time Interpretation
**Core Challenge**: Intelligently interpret user time inputs to handle overnight periods.

**Key Logic**:
- When bedtime starts at 7 PM and user logs wake-up at 1 AM, system must recognize this is 1 AM the next day
- Prevent illogical sequences (e.g., wake-up before bedtime on same day)
- Handle AM/PM disambiguation automatically when possible

**Edge Cases**:
- Overnight sleep sessions spanning midnight
- Multiple wake-ups during single sleep session
- Editing timestamps that affect day boundaries

### 3. Data Validation & Guardrails
**Current Approach**: Restrictive editing where timestamps can only be modified within bounds of adjacent events

**Challenges**:
- Prevents logical errors (e.g., two "fell asleep" events in sequence)
- May create poor user experience due to rigidity
- Balance needed between data cleanliness and usability

**Requirements**:
- Maintain data integrity for professional diagnostic use
- Provide clear error messaging for invalid entries
- Allow flexibility where logically appropriate

### 4. Analytics Data Structure & Performance
**NOT IN MVP - Future Phase**

**Core Challenge**: Efficiently calculate complex sleep and feeding analytics while maintaining real-time responsiveness.

**Analytics Requirements** (Future):
- Daily aggregates (total sleep, day vs. night breakdown, feeding totals)
- Sleep pattern analysis (efficiency, wake windows, longest stretches)
- Multi-week trend visualization
- Feeding pattern tracking (frequency, duration, volume)

**Performance Strategy** (For Future Implementation):
- Calculate analytics on-demand with <2 second load time requirement
- If calculation exceeds 2 seconds, implement pre-computed aggregates
- Real-time recalculation triggered by log modifications
- Firestore compound indexes for efficient time-range queries

**Day/Night Classification Logic**:
- **Bedtime logs** = Night sleep (regardless of actual time)
- **Nap logs** = Day sleep (regardless of actual time)
- **User-controlled**: Parents/professionals select log type during entry
- **Analytics Impact**: Aggregations respect user classification, not timestamp-based rules

**Session Boundaries**:
- All sleep sessions tied to the day they started
- No cross-day session spanning (simplifies aggregation logic)
- Midnight boundary handling only affects timestamp interpretation, not session classification

## User Experience Priorities

### 1. Mobile-First Design
- 98% of usage occurs on mobile devices
- Optimize for one-handed operation
- Touch-friendly interface elements
- Responsive design that works across screen sizes

### 2. Minimal Cognitive Load
**Target User State**: Tired, sleep-deprived parents

**Design Principles**:
- Minimize clicks required for common actions
- Auto-populate current time with simple AM/PM toggle
- Clear visual hierarchy and intuitive navigation
- Reduce decision fatigue through smart defaults

**Current Issues to Address**:
- Parents too tired to correctly press AM/PM buttons
- Need even simpler "current time" logging options

### 3. Speed & Performance
- Instant response to user interactions
- Smooth animations and transitions
- Quick data loading and saving
- Optimized for middle-of-night usage patterns

## Interface Design Requirements

### 1. Log List View (Primary Interface)
**Layout & Organization**:
- **Infinite Scroll**: Continuous scrolling across multiple days (not day-specific)
- **Real-time Updates**: New/edited logs appear instantly for all viewers
- Clean, card-based design with clear visual hierarchy
- Each log entry shows: timestamp, event type, duration/details
- Purple/lavender color scheme for sleep events
- **MVP Focus**: Sleep logs only, other types in future phases
- Date separators between days as user scrolls

**Notebook Log Functionality**:
- Primary use: Doulas leaving overall comments about entire shifts/nights
- Auto-pinned to top of date view for visibility
- Distinct visual styling from other log types
- Current implementation may need UX improvements

**Key UI Elements**:
- Client name and age display (e.g., "Eli, 4w")
- Each log entry is clickable to open detail view with conversation thread
- Real-time comment count indicators on logs with active conversations

**Conversation Integration**:
- Each log can have an embedded conversation thread
- Uses same messaging system with `logId` field added
- Comments appear in log detail view using messaging component
- Real-time updates for new comments
- Unread comment indicators synchronized with Bubble

### 2. Quick Actions Interface
**Plus Button Functionality**:
- Central floating action button (FAB) in app theme color
- Tap reveals radial menu with logging options:
  - Nap
  - Feed  
  - Bed Time
  - Diaper
  - Pump
  - Notebook
  - "Other" option for flexibility

**Design Requirements**:
- Large, thumb-friendly buttons in circular layout
- Clear iconography and labels
- Quick access to most common actions
- Smooth animation for menu appearance

### 3. Progressive States & Guidance
**In-Progress Session Management**:
- "Continue Logging" button for incomplete sessions
- "Timer Running" indicator for active feeding sessions
- Visual prominence to guide users back to incomplete logs
- Prevent multiple simultaneous sessions of same type

**Empty State Design**:
- Friendly guidance: "Tap the plus icon to add an event"
- Helpful iconography (star/magic wand icon)
- Non-intimidating introduction for new users

### 4. Sleep Timeline View ("Windows" Mode)
**Specialized Sleep Visualization**:
- Timeline-based layout showing sleep periods as horizontal bars
- Clear visual distinction between "asleep" (dark purple) and "awake in bed" (light purple)
- Time markers on left axis (e.g., 8:55am, 9:15am, etc.)
- Duration labels on sleep bars (e.g., "40m asleep", "20m awake in bed")
- "Out of bed" periods clearly marked with duration
- Comment thread indicators on relevant entries

## Analytics & Data Visualization Requirements

### 1. Analytics Dashboard ("Akios Data View")
**Comprehensive Weekly Analytics Table**:
- **Daily Totals Section**: Day sleep, night sleep, total sleep by date
- **Morning Metrics**: Wake-up time, get-up time, time awake in bed
- **Detailed Sleep Breakdown**: Individual nap analysis (Nap 1, Nap 2, Nap 3) with:
  - Time put in bed, time first asleep, time last awake, time out of bed
  - Total time, time to fall asleep, total asleep, total awake
  - Number of wake-ups, average wake-up duration
  - Individual wake-up timestamps with durations
- **Bedtime Analysis**: Same detailed breakdown as naps but for overnight sleep
- **Feeding Metrics**: Total feeds, solid feeds, breastfeeding minutes, bottle amounts, feeding timestamps

**Data Presentation**:
- Tabular format with days as columns, metrics as rows
- Easy scanning of patterns across multiple days
- Comprehensive detail level for professional analysis

### 2. Summary Dashboard
**Key Daily Statistics** (Yesterday's focus):
- Time Asleep (primary metric with visual emphasis)
- Time Awake in Bed
- Longest Sleep Stretch
- Number of Wake-Ups
- Time to Fall Asleep
- Wake-Up Length
- Feeding totals (volume and duration)

**Interactive Charts**:
- **Weekly Sleep Trends**: Stacked bar charts showing night sleep (dark purple) vs. naps (light purple)
- **Multi-Week Sleep Patterns**: Extended trend view with daily breakdown
- **Longest Sleep Stretch Tracking**: Daily variation in continuous sleep periods
- **Wake-Up Length Trends**: Line chart showing average wake-up duration over time
- **Feeding Analysis**: 
  - Bottle volume tracking (when applicable)
  - Breastfeeding duration trends
  - Combined feeding frequency (stacked: solid feeds vs. breast/bottle)

**Time Period Controls**:
- Week (W), Month (M), 2-Week (2W) toggle buttons
- Historical navigation for indefinite lookback
- Optimized for recent data (last week primary use case)

### 3. Chart Interaction Requirements
**Real-Time Updates**:
- Charts refresh when returning to summary view after logging
- Immediate reflection of new data without manual refresh
- Smooth transitions when data changes

**Performance Targets**:
- Sub-second load times for recent data (last 30 days)
- Progressive loading for historical periods
- Efficient caching strategy for frequently accessed periods

## Logging Modal Architecture & User Flows

### 1. Modal-Based Logging Interface
**Access Method**: Modal overlays on log detail pages for step-by-step data entry

**Design Principles**:
- One question/input per screen to minimize cognitive load
- Progressive disclosure of information
- Clear navigation with back buttons
- Context-aware questioning based on previous entries

### 2. Sleep Logging Workflow (MVP Implementation)

**Flexible Event Sequence**:
- **Any Valid First Event**: User can start with any logical event:
  - "Fell asleep" (for babies who fall asleep before bed)
  - "Put in bed" (traditional approach)
  - "Woke up" (for editing existing sessions)
- **Smart State Management**: System suggests valid next events based on current sequence
- **Manual Time Entry**: All times entered manually for MVP (timer interface in future phase)

**Simplified Flow for MVP**:
1. **Quick Start**: Defaults to current time, no mandatory date selection
2. **Event Selection**: Choose event type (put in bed, fell asleep, etc.)
3. **Time Entry**: Simple time picker with AM/PM
4. **Continue or Complete**: Add more events or finish session

**Key Improvements Over Current System**:
- Supports newborn sleep patterns (fall asleep → put in bed)
- Eliminates mandatory date selection step
- Allows flexible event ordering while maintaining data integrity
- Designed to support future timer interface without major refactoring

### 3. Feeding Logging Workflows

**Breast Feeding - Timer-Based Interface**:
- **Dual Timer System**: Separate timers for Left (L) and Right (R) breast
- **Mutually Exclusive**: Starting one timer automatically pauses the other
- **Real-Time Tracking**: Live timer display with play/pause functionality
- **Manual Override**: "Add Manually" option for retrospective logging
- **Session Management**: "Timer Running" status, "Finish Later" option

**Bottle Feeding - Simple Input**:
- Date selection
- Time entry (simplified time + AM/PM)
- Volume input with unit switching (oz/ml)

### 4. Simple Log Workflows

**Diaper Logging**:
- Date selection
- Type selection: Wet, Dirty, Both, Dry/Neither
- Single-step completion

**Pumping Logging**:
- Date selection
- Dual volume input: Left and Right breast with oz/ml switching
- Skip option for incomplete data

**Notebook Logging**:
- Date selection with day/night context specification
- Free-form text input with guidance text
- "Use this for Other categories that need to be logged daily/nightly here... e.g., meds, mood, tasks, etc"

### 5. User Guidance & Education

**Sleep Logging Tutorial** (For Parents):
- **Trigger**: Appears for new parent users starting sleep logs
- **Content**: "Welcome to your sleep log" with 3-step process:
  1. "Add when the child went to bed"
  2. "Track each time they woke up and fell asleep"
  3. "Mark the nap/bedtime as complete when done"
- **Dismissal**: "Don't show this again" checkbox with "Got It" button
- **User Type Specific**: Only shows for parents, not professionals

### 6. Validation & Error Handling

**Temporal Logic Enforcement**:
- **Out of Order Prevention**: "You cannot log events out of order" error message
- **Learn More**: Link to help documentation for complex scenarios
- **Time Constraint Validation**: System prevents illogical time sequences

**Smart Defaults**:
- Current time pre-populated for most scenarios
- "Today" as default date selection
- Contextual AM/PM based on typical patterns

## Target Implementation: Modern Sleep Logging

### 1. Timer-Based Sleep Interface (Priority: High)
**Competitive Feature Parity**:
- Match or exceed Huckleberry and BabyTracker functionality
- Real-time timer interface for active sleep sessions
- Seamless transition between live tracking and retrospective entry

**Dual Interface Approach**:
- **Live Mode**: Timer-based tracking with visual state indicators
- **Manual Mode**: Quick retrospective entry for past events
- **Hybrid Support**: Switch between modes mid-session

### 2. Flexible Sleep Sequencing (Critical for Doulas)
**Newborn-Compatible Logic**:
- **Any Valid First Event**: "Fell asleep", "Put in bed", or "Started feeding to sleep"
- **Intelligent State Management**: System calculates valid next states based on current sequence
- **Professional Analytics Preservation**: Maintain statistical accuracy regardless of entry order

**Event Sequence Examples**:
```
Traditional: Put in bed → Fell asleep → Woke up → Fell asleep → Out of bed
Newborn: Fell asleep → Put in bed → Woke up → Fell asleep → Out of bed
Doula: Started feeding → Fell asleep → Put in bed → Out of bed
```

### 3. Smart Default Behavior (90% Use Case Optimization)
**"Now" as Primary Assumption**:
- Default all new logs to current timestamp
- Single-tap logging for immediate events
- Secondary access to date/time modification
- Eliminate mandatory date selection step

**Progressive Enhancement**:
- Start with "now" assumption
- Allow time adjustment if needed
- Quick access to "earlier today" options

## Data Structure Requirements

### 1. Firebase Firestore Collections

**logs** (Main collection for all log types):
```typescript
{
  id: string  // Auto-generated Firestore ID
  childId: string  // Reference to child
  userId: string  // Creator
  userName: string  // For display
  logType: "sleep" | "feeding" | "diaper" | "pump" | "note"  // Extensible
  timestamp: Timestamp  // UTC timestamp of log creation
  
  // Sleep-specific fields (only for logType="sleep")
  sleepType?: "nap" | "bedtime"  // Determines day/night classification
  events?: SleepEvent[]  // Array of sleep state changes
  isComplete?: boolean  // Whether sleep session is finished
  duration?: number  // Total sleep duration in minutes (calculated)
  
  // Common calculated fields
  localDate: string  // YYYY-MM-DD in baby's timezone for queries
  sortTimestamp: number  // For efficient ordering
  
  // Metadata
  createdAt: Timestamp
  updatedAt: Timestamp
  commentCount: number  // Denormalized for efficiency
  lastCommentAt?: Timestamp  // For showing activity
}

SleepEvent {
  timestamp: Timestamp  // UTC
  type: "put_in_bed" | "fell_asleep" | "woke_up" | "out_of_bed"
  localTime: string  // HH:MM AM/PM in baby's timezone for display
}
```

**Conversation Integration**:
- Messages collection extended with optional `logId` field
- When `logId` is present, message is a log comment
- Same real-time system as regular messaging
- Unread counts tracked per user in Firebase

### 2. Firestore Indexes for Performance

**Required Composite Indexes**:
```
// For log list infinite scroll
logs: childId + sortTimestamp (DESC)

// For date-range queries (future analytics)
logs: childId + localDate + sortTimestamp

// For filtering by log type
logs: childId + logType + sortTimestamp (DESC)
```

### 3. Migration Strategy from Bubble

**Mapping Bubble → Firebase Fields**:
```
Bubble "1Event Type" → logType (normalized)
Bubble "1MadeTime" → timestamp
Bubble "List of SubEvents" → events[] array
Bubble "Orig Child (Family)" → childId
Bubble sleep calculations → Computed on-the-fly
```

**Migration Approach**:
- Bulk import scripts can run per-child
- Maintain Bubble unique IDs for reference
- Calculate derived fields during import
- Support incremental migration (some users on old, some on new)

### 3. Professional Analytics Requirements
**Sleep Event Sequence**:
- Put in bed (start time)
- Asleep (fell asleep time)
- Awake (wake up times - can be multiple)
- Asleep (back to sleep times - can be multiple)
- Out of bed (end time)

**Calculated Metrics** (Auto-generated from events):
- Total duration and time range
- Time actually asleep
- Time awake in bed
- Number of wake-ups
- Average wake-up duration
- Sleep efficiency percentage
- Time to fall asleep

**Real-time Statistics**:
- Automatic calculation as events are logged
- Pattern recognition for sleep consultant analysis
- Wake window tracking between sleep periods

## Visual Design Requirements

### 1. Theming Support
- Light and dark mode compatibility (dark mode shown in screenshots)
- Dark mode optimized for nighttime usage with deep purple/black backgrounds
- Consistent theming across all components
- Professional appearance for consultant use
- Purple/lavender accent colors for primary actions and sleep events

### 2. Design System Specifications
**Typography**:
- **Body Text (Sans Serif)**: Karla
- **Headings (Serif)**: Prata
- **Text Hierarchy**: Consistent font weight and size scaling

**Color Palette (Light Mode)**:
- **Primary Text**: #503460 (deep purple)
- **Secondary Text**: #745288 (lighter purple)
- **Primary Background**: #FFFFFF (white)
- **Secondary Background**: #F3EFF5 (light gray)
- **Tertiary Background**: #F0DDEF (soft purple)
- **Purple/Lavender Accents**: For sleep events and primary actions

**Color Palette (Dark Mode)**:
- **Primary Text**: #E8E3EF (light purple-tinted text)
- **Secondary Text**: #B8A8C8 (muted purple)
- **Primary Background**: #1A1625 (deep dark purple)
- **Secondary Background**: #2A223A (elevated dark purple)
- **Tertiary Background**: #3A2F4A (card backgrounds)
- **Accent Colors**: #9B7EBD (purple accent), #C8B5E0 (lighter accent)

**Interface Quality**:
- Modern, polished mobile interface with card-based design
- Smooth animations and micro-interactions
- Clear visual feedback for user actions
- Accessible design principles (proper contrast ratios)
- Floating Action Button (FAB) with radial menu for quick actions
- Consistent spacing and padding throughout

## Technical Architecture Considerations

### 1. Data Structure
- Flexible event logging system
- Efficient timestamp storage and querying
- Support for complex sleep session structures (multiple wake-ups, etc.)
- Scalable for high-frequency logging

### 2. Real-Time Capabilities
- Live updates across multiple user sessions
- Instant synchronization of new log entries
- Real-time conversation threads
- Optimistic UI updates with conflict resolution

### 3. Validation Engine
- Smart time interpretation algorithms
- Comprehensive data validation rules
- Flexible constraint system
- Clear error messaging and recovery paths

### 4. Analytics Performance
- Efficient aggregation queries for chart generation
- Caching strategy for frequently accessed data
- Background processing for historical analysis
- Optimized database indexes for time-based queries

## Edge Cases & Special Scenarios

### 1. Time-Related Edge Cases
- Daylight saving time transitions
- International travel with babies
- Midnight boundary crossings
- Retroactive log editing affecting calculations

### 2. Multi-User Conflicts
- Simultaneous editing of same log entry
- Conflicting time interpretations
- Professional override capabilities
- Data integrity during conflicts

### 3. Data Quality Issues
- Incomplete log entries
- Out-of-order events
- Missing time periods
- Duplicate entries

### 4. Analytics Edge Cases
- Partial day data affecting trends
- Missing sleep sessions impacting averages
- Historical data recalculation after edits
- Performance with large datasets (months/years of data)

## Success Metrics

### 1. User Experience
- Time to complete common logging tasks
- Error rate in time entry
- User satisfaction with mobile interface
- Professional adoption and usage patterns

### 2. Data Quality
- Accuracy of automated time interpretation
- Reduction in data validation errors
- Completeness of log entries
- Professional confidence in data reliability

### 3. Analytics Performance
- Chart load times for various date ranges
- Cache hit rates for daily aggregates
- User engagement with analytics features
- Professional workflow efficiency

## MVP Implementation Checklist

### Phase 1 - Core Sleep Logging (MVP)

1. **App Architecture Setup**
   - Extend existing React app to handle `?view=` parameter
   - Create routing logic for logs vs messaging views
   - Set up Firebase Firestore collections and indexes

2. **Log List View**
   - Infinite scroll implementation loading logs in batches
   - Real-time updates when new logs are added/edited
   - Click handler to open log detail view
   - Date separators as user scrolls through days
   - Display sleep duration and event count per log

3. **Sleep Log Creation**
   - Modal overlay for new sleep logs
   - Flexible event sequence (any valid first event)
   - Manual time entry with AM/PM selection
   - Smart time interpretation for overnight sessions
   - Save to Firestore with proper timezone handling

4. **Sleep Log Editing**
   - Load existing log data into modal
   - Allow adding/editing/removing sleep events
   - Maintain event sequence validity
   - Real-time sync of changes

5. **Log Detail View**
   - Display all sleep events with times
   - Embed messaging component for comments
   - Pass `logId` to messaging system
   - Show comment count and last activity

6. **Authentication & Permissions**
   - Validate childId access via JWT
   - Pass timezone as URL parameter
   - Handle permission errors gracefully

### What's NOT in MVP
- Timer-based sleep tracking (future)
- Other log types (feeding, diapers, etc.)
- Analytics dashboards
- Pre-computed aggregates
- Data migration from Bubble

### Success Criteria
- Parents can log sleep sessions with flexible event ordering
- Sleep professionals can view and comment on logs in real-time
- All users see times in baby's timezone
- Infinite scroll performs smoothly with hundreds of logs
- Changes sync instantly across all connected users