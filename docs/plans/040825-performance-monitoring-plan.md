# Performance Monitoring Plan - April 8, 2025

**Status**: Future implementation - not highest priority yet

## Context

This plan addresses performance concerns as we transition from a multi-page Bubble app to a single-page architecture using React/Firebase (Rested-Hearth) embedded in iframes.

### Background
- **Current situation**: Multi-page Bubble app that gets laggy with heavy professional use (200+ clients)
- **Previous fix**: Consultant recommended splitting into multiple pages to force memory cleanup via page loads
- **New challenge**: Want to return to single-page architecture for better native feel, especially with Bubble's new mobile beta
- **Core concern**: Must avoid recreating the performance issues that forced the multi-page split

### The Original Performance Problem
1. Memory accumulation from viewing many clients' data
2. No automatic cleanup of hidden content in Bubble
3. DOM elements growing without bounds
4. Professionals with hundreds of clients experiencing severe lag after 10-15 minutes of use

## Performance Monitoring Strategy

### Priority 1: Establish Bubble Baseline (One-time, 30 minutes)

Use Chrome DevTools Memory tab on current multi-page Bubble app:

1. **Capture memory benchmarks**:
   - Fresh load → Memory snapshot: ___MB
   - View 5 clients → Snapshot: ___MB  
   - View 10 clients → Snapshot: ___MB
   - View 20 clients → Snapshot: ___MB
   - After typical 15-min session → Snapshot: ___MB

2. **Document page load effects**:
   - Memory before page change: ___MB
   - Memory after page load: ___MB (this becomes your target)

3. **Note pain points**:
   - UI becomes sluggish at: ___MB
   - Number of clients before degradation: ___
   - Memory ceiling before user complaints: ___MB

### Priority 2: Firebase Performance Monitoring (Setup: 30 minutes)

**Set and forget production monitoring**

```typescript
// Track only critical user paths
const perf = getPerformance();

// Client switching performance
async function switchClient(clientId: string) {
  const trace = perf.trace('client_switch_time');
  trace.start();
  // ... switch logic ...
  trace.stop();
}

// Initial load with many clients
async function loadClientList(clients: Client[]) {
  const trace = perf.trace('initial_load_with_many_clients');
  trace.putMetric('client_count', clients.length);
  trace.start();
  // ... load logic ...
  trace.stop();
}

// Message history performance
async function loadMessages(clientId: string) {
  const trace = perf.trace('message_history_load');
  trace.start();
  const messages = await getMessages(clientId);
  trace.putMetric('message_count', messages.length);
  trace.stop();
}
```

**Pass/Fail Criteria**:
- Alert if any trace > 3 seconds at 95th percentile
- Alert if performance degrades >50% week-over-week

### Priority 3: Simple Memory Watchdog (Setup: 10 minutes)

**Add to App.tsx**:

```typescript
useEffect(() => {
  if (!performance.memory) return;
  
  const BUBBLE_MEMORY_LIMIT = 120; // MB - from your baseline
  const BUBBLE_SLUGGISH_AT = 150;   // MB - from your baseline
  
  const checkMemory = setInterval(() => {
    const mb = Math.round(performance.memory.usedJSHeapSize / 1048576);
    
    if (mb > BUBBLE_SLUGGISH_AT) {
      console.error(`FAIL: Memory ${mb}MB exceeds Bubble pain point`);
      // Send alert to monitoring service
    } else if (mb > BUBBLE_MEMORY_LIMIT) {
      console.warn(`WARNING: Memory ${mb}MB approaching Bubble limits`);
    }
  }, 30000); // Check every 30 seconds
  
  return () => clearInterval(checkMemory);
}, []);
```

### Priority 4: Automated Load Test (Setup: 1 hour)

**Single Playwright test comparing against Bubble baseline**:

```typescript
test('Heavy professional usage stays under Bubble baseline', async ({ page }) => {
  // Test user with 100+ clients with realistic data
  await page.goto('/login');
  await login(page, 'load-test-user@test.com');
  
  // Simulate typical 15-minute professional session
  for (let i = 0; i < 20; i++) {
    // Switch between random clients
    await page.click(`[data-client-index="${Math.floor(Math.random() * 50)}"]`);
    await page.waitForSelector('[data-messages-loaded]');
    await page.waitForTimeout(2000);
    
    // View sleep logs
    await page.click('[data-tab="sleep"]');
    await page.waitForSelector('[data-logs-loaded]');
  }
  
  // Check final memory
  const finalMemory = await page.evaluate(() => 
    Math.round(performance.memory.usedJSHeapSize / 1048576)
  );
  
  expect(finalMemory).toBeLessThan(BUBBLE_BASELINE_MEMORY);
});
```

Run in CI/CD on every deploy.

## Key Advantages of React/Firebase Over Bubble

1. **Component unmounting**: React removes components from memory when switching views
2. **Controlled data loading**: Can unsubscribe from Firebase listeners
3. **Virtual DOM**: Only updates changed elements
4. **Better memory control**: Can explicitly clean up data

## What We're NOT Doing (Yet)

- Detailed React Profiler setup (too granular)
- Complex performance trace analysis (too manual)
- Synthetic data generation scripts (use real test account)
- Memory leak hunting (only if we fail benchmarks)

## Success Criteria

The React single-page app passes if:
1. Memory stays below Bubble's multi-page baseline during equivalent usage
2. No memory growth beyond Bubble's acceptable ceiling
3. 95th percentile operations complete faster than Bubble
4. 15-minute heavy usage sessions don't degrade performance

## Implementation Timeline

This is documented for future implementation when:
- Current feature development stabilizes
- We're ready to seriously consider single-page architecture
- Bubble's native mobile beta becomes available
- We need to optimize before adding more iframe features

## Next Steps When Ready

1. Run baseline measurements on current Bubble app (30 min)
2. Add monitoring code to React app (1 hour)
3. Set up alerts for threshold violations
4. Run weekly load tests comparing against baseline
5. Only optimize if we exceed Bubble benchmarks