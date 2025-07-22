# EditLog Component Restructuring Plan

## Overview
Restructure the current `edit-log-modal.tsx` (895 lines) into a more modular component architecture, renaming it to `EditLog` and removing "modal" references throughout the codebase.

## Current State Analysis
The EditLogModal component currently handles:
- Form state management
- Interjection logic
- Event management (add/edit/delete)
- Validation
- Firebase operations
- UI rendering for all form sections

## Proposed Component Structure

### 1. Main Component: `edit-log.tsx`
- Container component that orchestrates sub-components
- Manages overall form state and submission
- Handles navigation and modal behavior
- ~200 lines

### 2. Sub-components to Extract

#### `edit-log-form-sections/`
- `BasicInfoSection.tsx` - Date, child selection, log status
- `SleepEventsSection.tsx` - Sleep event management UI
- `InterjectionSection.tsx` - Interjection toggle and details
- `NotesSection.tsx` - Optional notes field

#### `edit-log-events/`
- `EventList.tsx` - Displays current events with edit/delete actions
- `EventForm.tsx` - Add/edit individual event UI
- `EventValidation.ts` - Event overlap and validation logic

#### `edit-log-interjection/`
- `InterjectionManager.tsx` - Main interjection logic
- `InterjectionEventForm.tsx` - Interjection-specific event handling
- `InterjectionValidation.ts` - Interjection-specific validation

#### `edit-log-hooks/`
- `useEditLogForm.ts` - Form state and submission logic
- `useEventManagement.ts` - Event CRUD operations
- `useInterjectionLogic.ts` - Interjection state management

## Implementation Steps

### Phase 1: Rename and Update References
1. Rename `edit-log-modal.tsx` to `edit-log.tsx`
2. Update all imports from `EditLogModal` to `EditLog`
3. Update component name and exports
4. Update all documentation references

### Phase 2: Extract Form Sections
1. Create `edit-log-form-sections/` directory
2. Extract each form section into its own component
3. Pass props for state and handlers

### Phase 3: Extract Event Management
1. Create `edit-log-events/` directory
2. Move event-related components and logic
3. Extract validation utilities

### Phase 4: Extract Interjection Logic
1. Create `edit-log-interjection/` directory
2. Isolate interjection-specific code
3. Create dedicated hooks for interjection state

### Phase 5: Extract Custom Hooks
1. Create `edit-log-hooks/` directory
2. Move form logic to `useEditLogForm`
3. Move event logic to `useEventManagement`
4. Move interjection logic to `useInterjectionLogic`

### Phase 6: Update Barrel Exports
1. Update `@/features/logging/index.ts`
2. Ensure all new components are properly exported
3. Maintain backward compatibility during transition

## Benefits
- **Improved maintainability**: Smaller, focused components
- **Better testability**: Isolated logic in custom hooks
- **Enhanced reusability**: Form sections can be reused
- **Easier navigation**: LLM-friendly file sizes
- **Clear separation**: UI, logic, and validation separated

## Documentation Updates Required
- `docs/component-map.md` - Update component hierarchy
- `docs/api-reference.md` - Update function references
- `docs/developer-guide.md` - Update usage examples
- Any inline documentation referencing "EditLogModal"

## Migration Checklist
- [ ] Backup current implementation
- [ ] Create new directory structure
- [ ] Rename main component
- [ ] Update all imports
- [ ] Extract form sections
- [ ] Extract event management
- [ ] Extract interjection logic
- [ ] Create custom hooks
- [ ] Update barrel exports
- [ ] Update all documentation
- [ ] Test all functionality
- [ ] Remove old references

## Risk Mitigation
- Make incremental commits after each extraction
- Maintain original functionality throughout
- Test after each major change
- Keep TypeScript types intact
- Preserve all existing features