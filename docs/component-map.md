# Component Map & Architecture Guide

## Overview

This document provides a comprehensive map of all components in the sleep logging application, organized by feature and responsibility.

## Architecture Summary

**Before Refactor:** 3,938 lines in a single monolithic file  
**After Refactor:** 90-line orchestrator + 5 focused feature components + extracted custom hook  
**Reduction:** 97.7% size reduction with improved maintainability and business logic separation

---

## Feature-Based Component Structure

```
src/
├── features/
│   ├── logging/                     # Core sleep tracking functionality (renamed from sleep-logging)
│   │   ├── components/
│   │   │   ├── log-modal.tsx          # 140 lines - New log creation (refactored)
│   │   │   ├── log-first-screen.tsx   # 224 lines - Date/time/type selection
│   │   │   ├── log-subsequent-screen.tsx # 227 lines - Event selection screens
│   │   │   ├── log-modal-actions.tsx  # 110 lines - Action buttons & validation
│   │   │   ├── edit-log-modal.tsx     # 883 lines - Log editing & interjections
│   │   │   ├── log-detail-view.tsx    # 665 lines - Detailed log view & comments
│   │   │   ├── logs-list-view.tsx     # 580 lines - Main list with date navigation
│   │   │   ├── comments-modal.tsx     # 275 lines - Comments management
│   │   │   ├── sleep-log-tile.tsx     # Reusable log tile component
│   │   │   └── index.ts               # Barrel exports
│   │   └── index.ts                   # Feature main export
│   ├── messaging/                     # Real-time messaging
│   │   ├── components/
│   │   │   ├── messaging-view.tsx     # Main messaging interface
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── shared/                        # Reusable components
│   │   ├── components/
│   │   │   ├── media-messages.tsx     # Image/Audio message components
│   │   │   └── index.ts
│   │   └── index.ts
│   └── index.ts                       # All features export
└── routes/
    └── index.tsx                      # 90 lines - App orchestrator
```

---

## Component Detailed Map

### 🏠 **Application Orchestrator**

#### `src/routes/index.tsx` (90 lines)
**Purpose:** Main application entry point and view orchestrator  
**Responsibilities:**
- TanStack Router setup
- Authentication gateway
- URL parameter parsing (childId, timezone)
- Navigation context provisioning
- View routing logic
- Modal overlay management

**Key Functions:**
- `HomePage()` - Authentication & context setup
- `AppRouter()` - View routing based on navigation state

---

### 🛌 **Sleep Logging Feature**

#### `log-modal.tsx` (140 lines) - REFACTORED
**Purpose:** Main orchestration component for creating new sleep logs  
**Key Features:**
- Coordinates between first screen, subsequent screens, and actions
- Manages modal state and navigation
- Uses extracted custom hook for business logic
- Simplified UI-focused implementation

**Props:** None (uses navigation context)  
**Navigation:** Called when user clicks "+" button

#### `use-log-modal.ts` (564 lines) - NEW CUSTOM HOOK
**Purpose:** Contains all business logic extracted from original SleepLogModal  
**Key Features:**
- 15 state variables for form management
- 13 utility functions for validation and logic
- 4 useEffect hooks for data synchronization
- Sleep type selection and event tracking logic
- Time picker with timezone handling
- Auto-save and state persistence
- Complete/incomplete log management

#### `log-first-screen.tsx` (224 lines) - NEW COMPONENT
**Purpose:** Initial form screen for date/time/type selection  
**Key Features:**
- Date picker with timezone awareness
- Time picker for initial event
- Sleep type selection (bedtime/nap)
- Validation and error handling

#### `log-subsequent-screen.tsx` (227 lines) - NEW COMPONENT
**Purpose:** Follow-up screens for event type selection  
**Key Features:**
- Event history display
- Next event type selection with time input
- Recent events tile display
- Complex UI for event progression

#### `log-modal-actions.tsx` (110 lines) - NEW COMPONENT
**Purpose:** Action buttons and validation warning display  
**Key Features:**
- Confirm/save buttons with state management
- Validation warning display
- Button state management based on form validity

#### `edit-log-modal.tsx` (883 lines)
**Purpose:** Advanced editing interface for existing sleep logs  
**Key Features:**
- Event time editing with TimePicker
- Event deletion with validation
- Interjection insertion between existing events
- Date navigation (move entire log to different day)
- Validation warnings for consecutive same-type events
- Bulk save with Firebase integration

**Props:** None (uses navigation context for logId)  
**Navigation:** Opened from LogDetailView "Edit" button

#### `log-detail-view.tsx` (665 lines)
**Purpose:** Comprehensive detailed view of a single sleep log  
**Key Features:**
- Collapsible sections (Headlines, Log, Comments)
- Sleep statistics calculation and display
- Real-time comments with Firebase integration
- Image/audio message support
- Comment input with media upload
- Edit/delete log actions

**Props:** None (uses navigation context for logId)  
**Navigation:** Opened when user clicks on a log tile

#### `logs-list-view.tsx` (580 lines)
**Purpose:** Main interface showing all logs with navigation  
**Key Features:**
- Date navigation with timezone awareness
- Dual view modes: "Events" (tiles) and "Windows" (duration analysis)
- Previous day bedtime integration
- Real-time log updates via Firebase
- Floating action button for new logs
- Comments modal integration

**Props:** None (uses navigation context)  
**Navigation:** Default view, always accessible

#### `comments-modal.tsx` (275 lines)
**Purpose:** Standalone modal for managing comments across all logs  
**Key Features:**
- Unread vs All comments view modes
- Search functionality (text filtering)
- Mark all as read functionality
- Click-to-navigate to specific logs
- Real-time comment updates
- Responsive design for mobile/desktop

**Props:**
```typescript
interface CommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  childId: string | null;
}
```

---

### 💬 **Messaging Feature**

#### `messaging-view.tsx`
**Purpose:** Real-time messaging interface  
**Key Features:**
- Live chat functionality
- Message history
- Integration with Firebase messaging

---

### 🔄 **Shared Components**

#### `media-messages.tsx`
**Purpose:** Reusable media message components  
**Components:**
- `ImageMessage` - Display and interaction for image messages
- `AudioMessage` - Audio playback and controls

---

## Data Flow & State Management

### Navigation Context Pattern
All components use the `NavigationContext` for:
- Current view state (`LogList`, `log-detail`, `edit-log`, etc.)
- Active log ID for detail/edit views
- Child timezone for date/time calculations
- Log cache for performance optimization

### Firebase Integration
- **Real-time listeners:** All components use Firebase `onSnapshot` for live updates
- **Optimistic updates:** UI updates immediately, Firebase syncs in background
- **Error handling:** Graceful fallbacks and user notifications

### Component Communication
- **Parent → Child:** Props and context
- **Child → Parent:** Navigation functions (`navigateToLogDetail`, `navigateToEditLog`, etc.)
- **Sibling:** Via shared navigation context state

---

## Import Patterns

### Clean Barrel Exports
```typescript
// ✅ Clean - Single import for all features
import {
  LogModal,
  EditLogModal,
  LogDetailView,
  LogsListView,
  MessagingView,
} from "@/features";

// ❌ Verbose - Old pattern (before refactoring)
import { LogModal } from "@/features/logging/components/log-modal";
import { EditLogModal } from "@/features/logging/components/edit-log-modal";
// ... etc
```

---

## Performance Optimizations

### Component-Level
- **Lazy loading:** Components only loaded when needed
- **Memoization:** Expensive calculations cached
- **Debounced inputs:** Search and form inputs optimized

### Firebase-Level
- **Real-time listeners:** Only active when component mounted
- **Query optimization:** Indexes and filtered queries
- **Offline support:** Firebase handles offline/online transitions

---

## Testing Strategy

### Component Testing
Each component should be tested for:
- **Rendering:** Correct UI elements display
- **Interactions:** User actions trigger expected behavior
- **State management:** Context and local state updates
- **Firebase integration:** Mock Firebase for reliable tests

### Integration Testing
- **Navigation flows:** User journeys between components
- **Real-time updates:** Firebase listener behavior
- **Error states:** Network failures and edge cases

---

## Development Guidelines

### Adding New Components
1. Create in appropriate feature directory
2. Add to feature's `components/index.ts`
3. Follow existing naming conventions
4. Use navigation context for shared state
5. Add TypeScript interfaces
6. Include proper error handling

### Modifying Existing Components
1. Maintain backward compatibility
2. Update props interfaces if needed
3. Test all user flows
4. Update this documentation

### Performance Best Practices
- Use `useCallback` for event handlers
- Memoize expensive calculations
- Minimize Firebase listener scope
- Implement proper cleanup in `useEffect`

---

## Future Enhancements

### Potential Optimizations
- **Code splitting:** Dynamic imports for large components
- **Service worker:** Offline functionality
- **PWA features:** Install prompts, background sync
- **Performance monitoring:** Track component render times

### Architecture Improvements
- **Micro-frontends:** Further feature isolation
- **Component library:** Extract reusable UI components
- **State management:** Consider Zustand or Redux for complex state
- **GraphQL:** Replace direct Firebase calls with typed GraphQL

---

*Last updated: Component extraction and kebab-case migration completion - 97.7% reduction achieved with business logic separation*