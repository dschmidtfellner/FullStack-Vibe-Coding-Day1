# Sleep Analytics System Implementation Plan

## Project Context

This document outlines the implementation plan for a sleep analytics system that provides pre-calculated daily statistics for a sleep tracking application. The system needs to integrate with an existing Bubble.io frontend while leveraging Firebase/Firestore for data storage and real-time updates.

### Current System Architecture

- **Frontend**: Bubble.io with existing sleep tracking UI tiles
- **Backend**: Firebase/Firestore with TypeScript cloud functions
- **Auth**: Clerk integration
- **Data Structure**: Logs collection with events array containing timestamped sleep activities
- **Timezone Handling**: Child Local Time system (stores child's wall clock time as "fake UTC")

### Existing Data Structures

```typescript
// Current SleepLog structure in logs collection
interface SleepLog {
  id: string;
  childId: string;
  userId: string;
  userName: string;
  logType: 'sleep' | 'feeding' | 'diaper' | 'pump' | 'note';
  
  // Child Local Time fields
  childTimezone: string; // Child's timezone for this log
  
  // Sleep-specific fields
  sleepType?: 'nap' | 'bedtime';
  events?: SleepEvent[];
  isComplete?: boolean;
  duration?: number; // Total sleep duration in minutes (calculated)
  
  // Common calculated fields
  localDate: string; // YYYY-MM-DD in child's timezone for queries
  sortTimestamp: number; // For efficient ordering (based on first event's childLocalTimestamp)
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  commentCount: number;
  lastCommentAt?: Timestamp;
}

interface SleepEvent {
  childLocalTimestamp: Timestamp; // "fake UTC" - child's wall clock time stored as if UTC
  originalTimezone: string;       // timezone when event was recorded
  type: 'put_in_bed' | 'fell_asleep' | 'woke_up' | 'out_of_bed';
  localTime: string; // HH:MM AM/PM for display (calculated from childLocalTimestamp)
}
```

### Existing Calculation Logic

The system already has robust calculation logic in `src/utils/sleepStatistics.ts` that processes events from a single log to calculate:
- Total duration and time range
- Total time asleep vs awake in bed
- Number of wake-ups and average wake-up duration
- Segment-based analysis (asleep periods vs awake periods)

## Requirements

### Summary Page Metrics (Priority 1)

Create 6 pre-calculated daily statistics matching the existing Bubble.io UI:

1. **Time Asleep** - Total time spent asleep across all logs that started on the target date
2. **Time Awake in Bed** - Total time spent awake while in bed across all logs that started on the target date  
3. **Longest Sleep Stretch** - Longest continuous sleep period across all logs that started on the target date
4. **Number of Wake-Ups** - Total count of wake-up events across all logs that started on the target date
5. **Time to Fall Asleep** - Time between "Put in Bed" and "Fell Asleep" (for bedtime logs)
6. **Wake-Up Length** - Average duration of wake-up periods across all logs that started on the target date

**Key Business Rules:**
- **Date Attribution**: Include all logs that STARTED on the target date (even if they end the next day)
- **Cross-Midnight Handling**: A bedtime starting at 7:00 PM on Jan 15th includes all events until "Out of Bed" on Jan 16th morning
- **Timezone**: All calculations use Child Local Time (already implemented)
- **Today/Yesterday Logic**: Show Today for first day of logging, Yesterday for subsequent days (with future toggle option)

### Table View Foundation (Future Priority)

Understanding of detailed weekly analysis requirements for future implementation:

**Morning Section** (for each date):
- Wake-up time: Latest "woke_up" event before "out_of_bed" from bedtime that ENDED on target date
- Get-up time: "out_of_bed" timestamp from bedtime that ENDED on target date  
- Time awake in bed: Duration between wake-up and get-up from morning bedtime

**Individual Log Sections** (Nap 1, Nap 2, Bedtime):
- Direct event timestamp extraction
- Log-specific duration calculations
- Wake-up event details with timestamps and durations

**Totals Section**:
- Day sleep: Total nap time for logs starting on target date
- Night sleep: Total bedtime sleep for logs starting on target date
- Total sleep: Sum of day + night sleep

### Integration Requirements

- **Bubble.io Plugin**: Direct Firestore queries using existing Bubble Firestore plugin
- **Real-time Updates**: Live data feeds without page refresh
- **Performance**: O(1) reads for summary stats instead of O(n) log aggregation
- **Reliability**: Robust recalculation triggers that avoid the inconsistency issues experienced in previous Bubble implementations

## Technical Solution Architecture

### 1. Data Structure: Daily Sleep Statistics

Create new Firestore collection `daily_sleep_stats`:

```typescript
interface DailySleepStats {
  id: string; // Format: "child_{childId}_date_{YYYY-MM-DD}"
  childId: string;
  date: string; // YYYY-MM-DD in child's timezone
  timezone: string; // Child's timezone when calculated
  
  // Core metrics (matching Summary page UI)
  timeAsleep: string;           // "Xh Ym" format - total across all logs starting this date
  timeAwakeInBed: string;       // "Xh Ym" format - total across all logs starting this date
  longestSleepStretch: string;  // "Xh Ym" format - longest single stretch across all logs starting this date
  numberOfWakeUps: number;      // Total count across all logs starting this date
  timeToFallAsleep: string;     // "Xm" format - from bedtime log (Put in Bed → Fell Asleep)
  averageWakeUpLength: string;  // "X minutes" format - average across all wake-ups for logs starting this date
  
  // Metadata
  lastUpdated: Timestamp;
  sourceLogIds: string[];       // Array of log IDs that contributed to these stats
  calculationVersion: number;   // For future schema migrations
}
```

### 2. Calculation Engine

Extend existing `sleepStatistics.ts` logic to:

```typescript
interface DailyAggregationInput {
  childId: string;
  targetDate: string; // YYYY-MM-DD in child timezone
  timezone: string;
}

interface DailyAggregationResult {
  timeAsleep: string;
  timeAwakeInBed: string;
  longestSleepStretch: string;
  numberOfWakeUps: number;
  timeToFallAsleep: string;
  averageWakeUpLength: string;
  sourceLogIds: string[];
}

// Main aggregation function
function calculateDailySleepStats(input: DailyAggregationInput): Promise<DailyAggregationResult>
```

**Aggregation Logic:**
1. Query all logs where `localDate == targetDate AND logType == 'sleep'`
2. For each log, use existing `calculateSleepStatistics()` function
3. Aggregate results across all logs:
   - Sum total sleep/awake times
   - Find maximum sleep stretch
   - Count all wake-ups
   - Calculate bedtime-specific metrics (time to fall asleep)
   - Average wake-up durations

### 3. Trigger System

Implement Cloud Function triggers for robust recalculation:

```typescript
// Firestore trigger on logs collection
export const recalculateDailyStats = onDocumentWritten(
  'logs/{logId}',
  async (event) => {
    const log = event.data?.after?.data() as SleepLog;
    
    if (log.logType === 'sleep' && log.localDate) {
      // Recalculate stats for the date this log started
      await updateDailyStats(log.childId, log.localDate, log.childTimezone);
      
      // If log spans multiple dates (bedtime), also recalculate next day's morning stats
      if (log.sleepType === 'bedtime' && logSpansMultipleDates(log)) {
        const nextDate = getNextDate(log.localDate);
        await updateDailyStats(log.childId, nextDate, log.childTimezone);
      }
    }
  }
);

// Manual recalculation function for data fixes
export const manualRecalculation = httpsCallable(async (request) => {
  const { childId, startDate, endDate } = request.data;
  // Recalculate range of dates
});
```

**Key Features:**
- **Atomic Transactions**: Prevent race conditions during concurrent updates
- **Error Handling**: Built-in retry logic with exponential backoff  
- **Smart Recalculation**: Only recalculate affected dates using log's `localDate`
- **Cross-Date Logic**: Handle bedtime logs that affect multiple days' statistics

### 4. Bubble.io Integration

**Query Pattern for Summary Page:**
```javascript
// In Bubble, query daily_sleep_stats collection
{
  "childId": "[current_child_id]", 
  "date": "[target_date_YYYY-MM-DD]"
}
```

**Date Logic in Bubble:**
```javascript
// Determine whether to show Today or Yesterday
const isFirstDay = /* check if this is child's first day of logging */;
const targetDate = isFirstDay ? getTodayInChildTimezone() : getYesterdayInChildTimezone();
```

**Real-time Updates:**
- Bubble Firestore plugin automatically updates when `daily_sleep_stats` documents change
- No page refresh required
- Live data feeds work out of the box

### 5. Performance & Cost Optimization

**Read Efficiency:**
- Summary page: O(1) reads (single document lookup)
- 30-day chart: O(30) reads (efficient range query)
- Previous system: O(n×m) reads (n days × m logs per day)

**Write Efficiency:**
- Cloud Functions only execute when sleep data actually changes
- Smart recalculation limits scope to affected dates only
- Much more cost-effective than on-demand calculation

**Firestore Query Optimization:**
```typescript
// Efficient range query for charts
const statsQuery = query(
  collection(db, 'daily_sleep_stats'),
  where('childId', '==', childId),
  where('date', '>=', startDate),
  where('date', '<=', endDate),
  orderBy('date', 'asc')
);
```

## Implementation Steps

### Phase 1: Core Infrastructure
1. **Database Schema Setup**
   - Create `daily_sleep_stats` collection with proper indexes
   - Define TypeScript interfaces and validation rules

2. **Calculation Engine**
   - Extend `sleepStatistics.ts` for daily aggregation
   - Handle cross-midnight bedtime logic
   - Add comprehensive unit tests for edge cases

3. **Cloud Functions**
   - Implement Firestore trigger for automatic recalculation
   - Add manual recalculation function for data fixes
   - Include error handling and retry logic

### Phase 2: Data Migration
1. **Historical Data Backfill**
   - Create migration script for existing sleep logs
   - Batch process to avoid rate limits
   - Validate calculations against existing Bubble logic

2. **Testing & Validation**
   - Test with subset of users
   - Compare results with current Bubble calculations
   - Verify real-time update behavior

### Phase 3: Integration
1. **Bubble Configuration**
   - Configure Firestore plugin to query new collection
   - Update Summary page to use pre-calculated data
   - Implement Today/Yesterday toggle logic

2. **Gradual Rollout**
   - Deploy alongside existing system (no disruption)
   - Monitor performance and accuracy
   - Full migration once validated

### Phase 4: Future Enhancements
1. **Table View Preparation**
   - Design query patterns for individual log lookups
   - Plan caching strategy for weekly analysis
   - Consider additional indexes for performance

2. **Advanced Features**
   - Date range selector for historical analysis
   - Export functionality for charts
   - Additional metrics as requested

## Edge Cases & Considerations

### Data Integrity
- **Incomplete Logs**: Handle logs where `isComplete = false`
- **Deleted Logs**: Trigger recalculation when logs are removed
- **Timezone Changes**: Recalculate if child's timezone changes
- **Data Corrections**: Support for historical data fixes

### Performance Edge Cases
- **High Frequency Updates**: Rate limiting for rapid log changes
- **Large Date Ranges**: Efficient bulk recalculation strategies
- **Concurrent Users**: Transaction handling for simultaneous updates

### Business Logic Edge Cases
- **Multiple Bedtimes**: Handle unexpected multiple bedtimes per day
- **Missing Events**: Graceful degradation for incomplete event sequences
- **Clock Changes**: Handle daylight saving time transitions
- **Data Migration**: Ensure backward compatibility during rollout

## Success Metrics

### Performance Goals
- **Query Time**: < 100ms for Summary page data retrieval
- **Calculation Time**: < 5 seconds for daily stats recalculation
- **Cost Reduction**: 90%+ reduction in Firestore reads vs current system

### Reliability Goals
- **Accuracy**: 100% match with existing Bubble calculations during testing
- **Uptime**: No disruption to existing functionality during rollout
- **Consistency**: Zero missing or incorrect daily stats after implementation

### User Experience Goals
- **Real-time Updates**: Stats update immediately when sleep data changes
- **Historical Access**: Indefinite storage for long-term analysis
- **Performance**: Faster Summary page loading vs current aggregation approach

## Technical Notes

### Why Pre-calculated Aggregates Over Real-time Calculation

**Previous Issues in Bubble:**
- Timing issues with workflows triggering before data was fully saved
- Race conditions during rapid updates causing "off" calculations
- High Workload Unit costs for repeated aggregation queries
- Webhook reliability problems causing missed recalculations

**Firebase Solution:**
- Firestore triggers are more reliable than external webhooks
- Atomic transactions prevent race conditions
- Cloud Functions have built-in retry logic
- Pre-calculated data eliminates repeated expensive calculations

### Integration with Existing Table View Requirements

While this plan focuses on Summary page metrics, it's designed to work alongside the future Table View implementation:

- **Summary Page**: Uses pre-calculated `daily_sleep_stats` collection
- **Table View**: Uses direct log queries for detailed analysis
- **No Conflict**: Both approaches can coexist and complement each other
- **Shared Logic**: Both use the same underlying `sleepStatistics.ts` calculation engine

The Table View will use simple log lookups:
- Morning stats: Query bedtime logs where `localDate == previousDate`
- Nap sections: Query nap logs where `localDate == targetDate` ordered by time
- Individual metrics: Direct event timestamp and duration extraction

This hybrid approach provides optimal performance for both use cases without duplicating calculation logic or creating data consistency issues.