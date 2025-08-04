# Integration Test Plan
*Date: August 4, 2025*  
*Status: Future project - not immediate priority*

## Overview

This document summarizes a discussion about implementing comprehensive integration tests for Rested Hearth, focusing on complex multi-user scenarios that would catch bugs before they reach production.

## Background

Coming from Bubble.io development, the main pain point has been debugging production issues caused by complex user interactions across timezones, multiple users, and edge cases. While Bubble prevents syntax errors, it doesn't help catch logical errors in complex workflows.

## Key Insight: Integration Tests > Unit Tests

For this application, comprehensive integration tests provide more value than extensive unit testing because:

1. **They test real user flows** - exactly what breaks in production
2. **They catch all the errors unit tests would catch** - if a calculation is wrong, the integration test fails too
3. **They match how we think about the app** - in terms of user stories, not individual functions

## The Holy Grail Test Example

```typescript
test('multiple users logging across timezones with edits', async () => {
  // Setup users in different timezones
  const parent1 = await createTestUser({ timezone: 'America/New_York' });
  const parent2 = await createTestUser({ timezone: 'America/Los_Angeles' });
  const doula = await createTestUser({ timezone: 'Europe/London' });
  
  // Create logs, edit across timezones, change dates
  // Verify statistics calculate correctly
  // Verify each user sees correct times in their timezone
});
```

This single test verifies:
- User permissions
- Timezone conversions
- Edit history
- Date change logic
- Statistics calculations
- Multi-user concurrency
- Data consistency

## Recommended Testing Strategy

### 80/20 Rule
- **80% integration tests** - Test complete user flows
- **20% unit tests** - Only for complex algorithms

### Priority Test Scenarios

1. **Multi-timezone collaboration** - Multiple users in different timezones viewing/editing same logs
2. **Midnight edge cases** - Logs spanning midnight, timezone changes affecting dates
3. **Edit/delete cascades** - How changes propagate through statistics and views
4. **Complex statistics** - Multi-day aggregations with edited/deleted logs
5. **Concurrent operations** - Multiple users editing simultaneously

### Test Organization

```
tests/
  integration/
    sleep-logging-flow.test.ts         ✓ Essential
    multi-user-timezone.test.ts        ✓ Essential
    statistics-calculation.test.ts     ✓ Essential
    edit-delete-scenarios.test.ts      ✓ Essential
  unit/
    sleep-cycle-algorithm.test.ts      ✓ Only if algorithm is complex
```

## Implementation Benefits

1. **Faster than manual testing** - Run complex scenarios in seconds
2. **Automatic regression prevention** - Every push runs all tests
3. **Time travel testing** - Simulate days/weeks in milliseconds
4. **Confidence in refactoring** - Know immediately if changes break user flows

## Technical Approach

### Test Utilities Needed

```typescript
// Test user creation with timezone
createTestUser({ timezone, role })

// Time manipulation for testing
timeTravel(date)
runInTimezone(timezone, callback)

// Test data builders
createTestChild()
createSleepLog()
```

### Framework Choice
- **Vitest** for test runner (fast, good DX)
- **React Testing Library** for component tests
- **Mock Firebase** for faster tests
- **Playwright** for E2E tests (when needed)

## When to Implement

This is marked as a future project because:
1. Current focus is on feature development
2. Manual testing is sufficient for current user base
3. Need to establish core patterns first

Consider implementing when:
- User base grows significantly
- Bug reports increase
- Multiple developers join
- Before major refactoring

## Expected Outcomes

- **Reduce production bugs** by catching complex scenarios
- **Faster development** with confidence in changes
- **Better sleep** knowing the app is thoroughly tested
- **Documentation through tests** showing how features should work

## Next Steps (When Ready)

1. Set up Vitest and basic test infrastructure
2. Create test utilities for common operations
3. Write first integration test for core sleep logging flow
4. Add tests for each major user story
5. Only add unit tests where complexity demands it