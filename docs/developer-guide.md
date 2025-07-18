# Developer Quick Start Guide

## 🚀 Working with the Refactored Codebase

### Component Locations (Quick Reference)

```bash
# Sleep logging components
src/features/sleep-logging/components/
├── SleepLogModal.tsx     # New log creation
├── EditLogModal.tsx      # Edit existing logs  
├── LogDetailView.tsx     # View log details + comments
├── LogsListView.tsx      # Main list view
└── CommentsModal.tsx     # Comments management

# Messaging
src/features/messaging/components/
└── messaging-view.tsx    # Chat interface

# Shared utilities
src/features/shared/components/
└── media-messages.tsx    # Image/audio components
```

### Import Patterns

```typescript
// ✅ Recommended - Use barrel exports
import { SleepLogModal, LogDetailView } from "@/features";

// ✅ Feature-specific imports
import { SleepLogModal } from "@/features/sleep-logging";

// ❌ Avoid - Direct component imports
import { SleepLogModal } from "@/features/sleep-logging/components/SleepLogModal";
```

### Adding New Components

1. **Choose the right location:**
   ```
   src/features/{feature-name}/components/YourComponent.tsx
   ```

2. **Add to barrel export:**
   ```typescript
   // In src/features/{feature-name}/components/index.ts
   export { YourComponent } from './YourComponent';
   ```

3. **Use navigation context:**
   ```typescript
   import { useNavigation } from '@/contexts/NavigationContext';
   
   function YourComponent() {
     const { state, navigateToLogDetail } = useNavigation();
     // ... component logic
   }
   ```

### Common Patterns

#### Navigation Between Components
```typescript
const { navigateToLogDetail, navigateToEditLog, navigateBack } = useNavigation();

// Navigate to log detail
navigateToLogDetail(logId);

// Navigate to edit mode
navigateToEditLog(logId);

// Go back
navigateBack();
```

#### Firebase Real-time Listeners
```typescript
useEffect(() => {
  if (!childId) return;
  
  const unsubscribe = listenToLogs(childId, (newLogs) => {
    setLogs(newLogs);
  });
  
  return unsubscribe; // Cleanup on unmount
}, [childId]);
```

#### Modal Management
```typescript
const [showModal, setShowModal] = useState(false);

// Modal component structure
if (!showModal) return null;

return (
  <>
    {/* Backdrop */}
    <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
    
    {/* Modal content */}
    <div className="modal-content">
      {/* Your modal UI */}
    </div>
  </>
);
```

### Testing Components

#### Unit Test Example
```typescript
// YourComponent.test.tsx
import { render, screen } from '@testing-library/react';
import { YourComponent } from './YourComponent';

test('renders component correctly', () => {
  render(<YourComponent />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

#### Mock Navigation Context
```typescript
const mockNavigation = {
  state: { view: 'LogList', logs: [] },
  navigateToLogDetail: jest.fn(),
  navigateBack: jest.fn(),
};

// Wrap component with mock context
```

### Debugging Tips

#### Check Navigation State
```typescript
const { state } = useNavigation();
console.log('Current view:', state.view);
console.log('Current logId:', state.logId);
console.log('Available logs:', state.logs.length);
```

#### Firebase Connection
```typescript
// Check if Firebase listeners are working
useEffect(() => {
  console.log('Firebase listener active for child:', childId);
  return () => console.log('Firebase listener cleanup');
}, [childId]);
```

#### Component Mount/Unmount
```typescript
useEffect(() => {
  console.log('Component mounted');
  return () => console.log('Component unmounted');
}, []);
```

### Performance Tips

#### Optimize Re-renders
```typescript
// Use useCallback for event handlers
const handleClick = useCallback(() => {
  // handler logic
}, [dependencies]);

// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return calculateComplexValue(data);
}, [data]);
```

#### Firebase Query Optimization
```typescript
// Limit query scope
const q = query(
  collection(db, "logs"),
  where("childId", "==", childId),
  where("date", ">=", startDate),
  orderBy("timestamp", "desc"),
  limit(50)
);
```

### Common Issues & Solutions

#### "Component not found" import error
- Check if component is exported in `index.ts`
- Verify import path uses barrel exports
- Ensure TypeScript compilation is clean

#### Navigation context undefined
- Ensure component is wrapped in `NavigationProvider`
- Check that provider has required props (childId, timezone)

#### Firebase listener not updating
- Verify listener cleanup in useEffect return
- Check Firebase rules and authentication
- Ensure component unmounts properly

#### Styling issues
- Verify Tailwind classes are correct
- Check if dark mode variants are needed
- Ensure responsive classes are applied

### Quick Commands

```bash
# Start development server
pnpm run dev

# Type checking
pnpm run typecheck

# Lint code
pnpm run lint

# Run tests
pnpm run test

# Build for production
pnpm run build
```

---

**Need help?** Check the full [Component Map](./component-map.md) for detailed architecture information.