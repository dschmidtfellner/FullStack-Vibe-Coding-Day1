# Family Unread Counter Implementation Plan

## Overview
Implement family-level unread message aggregation for the Bubble client selector while maintaining individual child counters for messaging interfaces. This plan has two phases: immediate URL-based implementation and future webhook-based enhancement.

## Phase 1: URL-Based Implementation (Today)

### URL Parameter Structure
```
https://firebase-app.com/chat?childId=current123&originalChildId=hub456&siblings=hub456,sib789,current123
```

### Database Schema Changes

#### 1. Create New Collection: `family_unread_counters`
```typescript
interface FamilyUnreadCounters {
  id: string; // "user_{userId}_family_{originalChildId}"
  userId: string;
  originalChildId: string;
  familyTotalUnreadCount: number;
  familyChatUnreadCount: number; // Same as original child's chat (shared)
  familyLogUnreadCount: number;  // Sum across all siblings
  lastUpdated: Timestamp;
}
```

#### 2. Keep Existing Collection: `unread_counters`
- No changes to existing structure
- Continue using for individual messaging interfaces

### Implementation Steps

1. **Add URL Parameter Parsing**
   - Extract `childId`, `originalChildId`, and `siblings` from URL
   - Validate parameters and handle missing data

2. **Update Cloud Function: `onMessageCreated`**
   - Continue updating individual child counters (existing behavior)
   - Add family counter updates using URL-provided sibling info
   - Batch updates for performance

3. **Add Family Counter Update Logic**
   - Calculate family totals from individual sibling counters
   - Update `family_unread_counters` document atomically
   - Handle edge cases (missing siblings, etc.)

4. **Update Mark-as-Read Functions**
   - Modify `markChatAsRead`, `markLogAsRead`, `markAllLogsAsRead`
   - Update both individual and family counters
   - Use URL parameters to determine family context

5. **Add Family Counter API Endpoint**
   - Create `getFamilyUnreadCounters` endpoint
   - Query pattern: `user_{userId}_family_{originalChildId}`
   - Return family-aggregated totals

### Bubble Integration Changes

1. **Client Selector Update**
   - Change from querying `unread_counters` to `family_unread_counters`
   - Use original child ID for family lookup
   - Display family totals instead of individual child totals

2. **URL Parameter Addition**
   - Add `originalChildId` and `siblings` parameters when loading Firebase iframe
   - Use existing Bubble family relationship logic
   - Pass comma-separated sibling list

### Benefits
- **Zero Bubble Logic Changes**: Just pass additional URL parameters
- **Immediate Implementation**: Can be deployed today
- **No Sync Issues**: Bubble calculates everything fresh each time
- **Performance**: O(1) reads for family totals

### Limitations
- URL parameters can be manipulated (mitigated by Firebase security rules)
- Bubble must calculate sibling info on every page load
- No independent validation of family relationships in Firebase

## Phase 2: Webhook-Based Enhancement (Future)

### When to Implement
- After significant user adoption
- When URL parameter limitations become problematic
- When you're ready to make Bubble workflow changes

### Overview
Replace URL-based family info with event-driven sync from Bubble to Firebase using webhooks.

### Database Schema Additions

#### New Collection: `family_relationships`
```typescript
interface FamilyRelationships {
  id: string; // "family_{originalChildId}"
  originalChildId: string;
  siblingIds: string[];
  lastUpdated: Timestamp;
  version: number; // For conflict resolution
}
```

### Implementation Steps

1. **Add Bubble Webhooks**
   - Create workflow: "When child is added/removed from family"
   - POST to Firebase webhook endpoint with family structure
   - Include version numbers for conflict resolution

2. **Create Firebase Webhook Handler**
   - Endpoint: `updateFamilyStructure`
   - Atomic updates with version checking
   - Update `family_relationships` collection

3. **Update Counter Logic**
   - Remove dependency on URL parameters
   - Query `family_relationships` for sibling info
   - Cache family relationships for performance

4. **Add Validation & Recovery**
   - Validate family relationships against Bubble periodically
   - Handle webhook failures with retry logic
   - Fallback to URL parameters if webhook data is stale

### Migration Strategy
1. Deploy webhook handlers alongside URL-based system
2. Gradually migrate family counter updates to use webhook data
3. Keep URL parameters as fallback for reliability
4. Eventually remove URL parameter dependency

### Benefits
- **Bulletproof Sync**: Webhooks ensure Firebase knows about family changes
- **Performance**: No URL parameter parsing on every request
- **Validation**: Firebase can independently validate family relationships
- **Reliability**: Event-driven updates with retry logic

### Considerations
- Requires Bubble workflow changes
- More complex debugging and monitoring
- Potential for webhook delivery failures
- Need for data migration strategy

## Implementation Priority

**Phase 1 (Today)**: Solves immediate need with minimal risk
**Phase 2 (Future)**: Enhances reliability and performance when ready for Bubble changes

This approach provides immediate value while setting up for future enhancement without breaking changes.

## Technical Notes

### URL Parameter Parsing Example
```typescript
function parseFamilyData(): {
  childId: string;
  originalChildId: string;
  siblings: string[];
} {
  const params = new URLSearchParams(window.location.search);
  return {
    childId: params.get('childId') || '',
    originalChildId: params.get('originalChildId') || '',
    siblings: params.get('siblings')?.split(',') || []
  };
}
```

### Family Counter Update Logic
```typescript
async function updateFamilyCounter(userId: string, originalChildId: string, siblings: string[]) {
  const familyCounterId = `user_${userId}_family_${originalChildId}`;
  
  // Calculate totals across all siblings
  let familyLogTotal = 0;
  let familyChatTotal = 0;
  
  for (const siblingId of siblings) {
    const siblingCounterId = `user_${userId}_child_${siblingId}`;
    const siblingDoc = await db.doc(`unread_counters/${siblingCounterId}`).get();
    
    if (siblingDoc.exists) {
      const data = siblingDoc.data();
      familyLogTotal += data.logUnreadCount || 0;
      
      // Chat is shared via original child only
      if (siblingId === originalChildId) {
        familyChatTotal = data.chatUnreadCount || 0;
      }
    }
  }
  
  // Update family counter
  await db.doc(`family_unread_counters/${familyCounterId}`).set({
    id: familyCounterId,
    userId,
    originalChildId,
    familyTotalUnreadCount: familyLogTotal + familyChatTotal,
    familyChatUnreadCount: familyChatTotal,
    familyLogUnreadCount: familyLogTotal,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
}
```

### Bubble Query Changes
```
// Before: Query unread_counters
collection: unread_counters
constraints: id = "user_[userId]_child_[childId]"

// After: Query family_unread_counters  
collection: family_unread_counters
constraints: id = "user_[userId]_family_[originalChildId]"
```