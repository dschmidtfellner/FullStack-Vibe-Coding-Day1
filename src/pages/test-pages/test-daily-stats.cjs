// Quick test script to verify daily stats aggregation logic
// Run with: node src/pages/test-pages/test-daily-stats.js

const admin = require('firebase-admin');
const serviceAccount = require('../../../creds.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testDailyStats() {
  try {
    console.log('Testing daily stats aggregation...\n');
    
    // Find a child with sleep logs
    const logsSnapshot = await db.collection('logs')
      .where('logType', '==', 'sleep')
      .limit(5)
      .get();
    
    if (logsSnapshot.empty) {
      console.log('No sleep logs found in database');
      return;
    }
    
    // Get unique child IDs and dates
    const testCases = new Map();
    
    logsSnapshot.forEach(doc => {
      const log = doc.data();
      const key = `${log.childId}_${log.localDate}`;
      
      if (!testCases.has(key)) {
        testCases.set(key, {
          childId: log.childId,
          date: log.localDate,
          timezone: log.childTimezone
        });
      }
    });
    
    console.log(`Found ${testCases.size} unique child/date combinations to test\n`);
    
    // Test aggregation for each unique combination
    for (const [key, testCase] of testCases) {
      console.log(`Testing child ${testCase.childId} on ${testCase.date}...`);
      
      // Query all logs for this child/date
      const dayLogsSnapshot = await db.collection('logs')
        .where('childId', '==', testCase.childId)
        .where('localDate', '==', testCase.date)
        .where('logType', '==', 'sleep')
        .get();
      
      console.log(`  - Found ${dayLogsSnapshot.size} sleep logs`);
      
      // Show what would be calculated
      let totalEvents = 0;
      let hasNaps = false;
      let hasBedtime = false;
      
      dayLogsSnapshot.forEach(doc => {
        const log = doc.data();
        if (log.events) {
          totalEvents += log.events.length;
        }
        if (log.sleepType === 'nap') hasNaps = true;
        if (log.sleepType === 'bedtime') hasBedtime = true;
      });
      
      console.log(`  - Total events: ${totalEvents}`);
      console.log(`  - Has naps: ${hasNaps}, Has bedtime: ${hasBedtime}`);
      console.log(`  - Would create stats document: child_${testCase.childId}_date_${testCase.date}\n`);
    }
    
    console.log('Test completed successfully!');
    
  } catch (error) {
    console.error('Error testing daily stats:', error);
  } finally {
    // Clean up
    await admin.app().delete();
  }
}

testDailyStats();