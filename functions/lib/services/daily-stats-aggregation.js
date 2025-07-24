"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualRecalculateStats = exports.recalculateDailyStats = exports.handleSleepLogChange = void 0;
const admin = require("firebase-admin");
/**
 * Handle sleep log changes and recalculate daily statistics
 */
async function handleSleepLogChange(change, context, db) {
    const logBefore = change.before.exists ? change.before.data() : null;
    const logAfter = change.after.exists ? change.after.data() : null;
    // Determine which dates need recalculation
    const datesToRecalculate = new Set();
    // If log was deleted or changed
    if (logBefore && logBefore.logType === 'sleep' && logBefore.localDate) {
        datesToRecalculate.add(logBefore.localDate);
        // Check if it was a bedtime that might affect next day
        if (logBefore.sleepType === 'bedtime' && logSpansMultipleDates(logBefore)) {
            const nextDate = getNextDate(logBefore.localDate);
            datesToRecalculate.add(nextDate);
        }
    }
    // If log was created or updated
    if (logAfter && logAfter.logType === 'sleep' && logAfter.localDate) {
        datesToRecalculate.add(logAfter.localDate);
        // Check if it's a bedtime that might affect next day
        if (logAfter.sleepType === 'bedtime' && logSpansMultipleDates(logAfter)) {
            const nextDate = getNextDate(logAfter.localDate);
            datesToRecalculate.add(nextDate);
        }
    }
    // Recalculate stats for affected dates
    const childId = (logAfter === null || logAfter === void 0 ? void 0 : logAfter.childId) || (logBefore === null || logBefore === void 0 ? void 0 : logBefore.childId);
    const timezone = (logAfter === null || logAfter === void 0 ? void 0 : logAfter.childTimezone) || (logBefore === null || logBefore === void 0 ? void 0 : logBefore.childTimezone);
    if (childId && timezone) {
        const promises = Array.from(datesToRecalculate).map(date => recalculateDailyStats(db, childId, date, timezone));
        await Promise.all(promises);
    }
}
exports.handleSleepLogChange = handleSleepLogChange;
/**
 * Recalculate daily sleep statistics for a specific date
 */
async function recalculateDailyStats(db, childId, date, timezone) {
    console.log(`Recalculating daily stats for child ${childId} on ${date}`);
    try {
        // Query all sleep logs that started on this date
        const logsSnapshot = await db.collection('logs')
            .where('childId', '==', childId)
            .where('localDate', '==', date)
            .where('logType', '==', 'sleep')
            .get();
        const logs = logsSnapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
        // Calculate aggregated statistics
        const stats = calculateAggregatedStats(logs, childId, date, timezone);
        // Save to daily_sleep_stats collection
        const statsId = `child_${childId}_date_${date}`;
        await db.collection('daily_sleep_stats').doc(statsId).set(stats);
        console.log(`Successfully updated daily stats for ${statsId}`);
    }
    catch (error) {
        console.error(`Error recalculating stats for child ${childId} on ${date}:`, error);
        throw error;
    }
}
exports.recalculateDailyStats = recalculateDailyStats;
/**
 * Calculate aggregated statistics from multiple sleep logs
 */
function calculateAggregatedStats(logs, childId, date, timezone) {
    // If no logs, return empty stats
    if (logs.length === 0) {
        return createEmptyStats(childId, date, timezone);
    }
    // Aggregate metrics
    let totalAsleepMs = 0;
    let totalAwakeInBedMs = 0;
    let longestSleepStretchMs = 0;
    let totalWakeUps = 0;
    let totalWakeUpDurationMs = 0;
    let wakeUpCount = 0;
    let timeToFallAsleepMs = null;
    const sourceLogIds = [];
    for (const log of logs) {
        if (!log.events || log.events.length < 2)
            continue;
        sourceLogIds.push(log.id);
        // Calculate stats for this individual log
        const logStats = calculateSingleLogStats(log);
        totalAsleepMs += logStats.asleepMs;
        totalAwakeInBedMs += logStats.awakeMs;
        totalWakeUps += logStats.wakeUps;
        if (logStats.wakeUps > 0) {
            totalWakeUpDurationMs += logStats.wakeUpDurationMs;
            wakeUpCount += logStats.wakeUps;
        }
        // Track longest sleep stretch
        if (logStats.longestStretchMs > longestSleepStretchMs) {
            longestSleepStretchMs = logStats.longestStretchMs;
        }
        // Time to fall asleep (only from bedtime logs)
        if (log.sleepType === 'bedtime' && timeToFallAsleepMs === null) {
            const putInBed = log.events.find(e => e.type === 'put_in_bed');
            const fellAsleep = log.events.find(e => e.type === 'fell_asleep');
            if (putInBed && fellAsleep) {
                timeToFallAsleepMs = fellAsleep.childLocalTimestamp.toMillis() -
                    putInBed.childLocalTimestamp.toMillis();
            }
        }
    }
    // Calculate numeric values in minutes for charting
    const timeAsleepMinutes = Math.round(totalAsleepMs / (1000 * 60));
    const timeAwakeInBedMinutes = Math.round(totalAwakeInBedMs / (1000 * 60));
    const longestSleepStretchMinutes = Math.round(longestSleepStretchMs / (1000 * 60));
    const timeToFallAsleepMinutes = timeToFallAsleepMs !== null
        ? Math.round(timeToFallAsleepMs / (1000 * 60))
        : 0;
    const averageWakeUpLengthMinutes = wakeUpCount > 0
        ? Math.round(totalWakeUpDurationMs / wakeUpCount / (1000 * 60))
        : 0;
    // Format results
    const statsId = `child_${childId}_date_${date}`;
    return {
        id: statsId,
        childId,
        date,
        timezone,
        timeAsleep: formatDuration(totalAsleepMs),
        timeAwakeInBed: formatDuration(totalAwakeInBedMs),
        longestSleepStretch: formatDuration(longestSleepStretchMs),
        numberOfWakeUps: totalWakeUps,
        timeToFallAsleep: timeToFallAsleepMinutes > 0 ? `${timeToFallAsleepMinutes}m` : '0m',
        averageWakeUpLength: formatDuration(averageWakeUpLengthMinutes * 60 * 1000),
        // Numeric versions for charting
        timeAsleepMin: timeAsleepMinutes,
        timeAwakeInBedMin: timeAwakeInBedMinutes,
        longestSleepStretchMin: longestSleepStretchMinutes,
        timeToFallAsleepMin: timeToFallAsleepMinutes,
        averageWakeUpLengthMin: averageWakeUpLengthMinutes,
        lastUpdated: admin.firestore.Timestamp.now(),
        sourceLogIds,
        calculationVersion: 1
    };
}
/**
 * Calculate statistics for a single sleep log
 */
function calculateSingleLogStats(log) {
    const events = [...log.events].sort((a, b) => a.childLocalTimestamp.toMillis() - b.childLocalTimestamp.toMillis());
    let asleepMs = 0;
    let awakeMs = 0;
    let wakeUps = 0;
    let wakeUpDurationMs = 0;
    let longestStretchMs = 0;
    let currentStretchMs = 0;
    let stretchStart = null;
    // Process events in pairs to create segments
    for (let i = 0; i < events.length - 1; i++) {
        const current = events[i];
        const next = events[i + 1];
        const segmentMs = next.childLocalTimestamp.toMillis() - current.childLocalTimestamp.toMillis();
        switch (current.type) {
            case 'fell_asleep':
                asleepMs += segmentMs;
                if (stretchStart === null) {
                    stretchStart = current.childLocalTimestamp.toMillis();
                }
                currentStretchMs += segmentMs;
                break;
            case 'put_in_bed':
            case 'woke_up':
                awakeMs += segmentMs;
                // End sleep stretch if we woke up
                if (current.type === 'woke_up' && stretchStart !== null) {
                    if (currentStretchMs > longestStretchMs) {
                        longestStretchMs = currentStretchMs;
                    }
                    stretchStart = null;
                    currentStretchMs = 0;
                    wakeUps++;
                    wakeUpDurationMs += segmentMs;
                }
                break;
        }
    }
    // Check final stretch
    if (currentStretchMs > longestStretchMs) {
        longestStretchMs = currentStretchMs;
    }
    return {
        asleepMs,
        awakeMs,
        wakeUps,
        wakeUpDurationMs,
        longestStretchMs
    };
}
/**
 * Manual recalculation function for data fixes
 */
async function manualRecalculateStats(data, db) {
    const { childId, startDate, endDate } = data;
    if (!childId || !startDate || !endDate) {
        throw new Error('Missing required parameters: childId, startDate, endDate');
    }
    console.log(`Manual recalculation requested for child ${childId} from ${startDate} to ${endDate}`);
    try {
        // Get child's timezone from a recent log
        const recentLog = await db.collection('logs')
            .where('childId', '==', childId)
            .where('logType', '==', 'sleep')
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();
        if (recentLog.empty) {
            return {
                success: false,
                message: 'No sleep logs found for this child',
                datesProcessed: 0
            };
        }
        const timezone = recentLog.docs[0].data().childTimezone;
        // Generate list of dates to process
        const dates = getDatesInRange(startDate, endDate);
        // Process each date
        const promises = dates.map(date => recalculateDailyStats(db, childId, date, timezone));
        await Promise.all(promises);
        return {
            success: true,
            message: `Successfully recalculated stats for ${dates.length} dates`,
            datesProcessed: dates.length
        };
    }
    catch (error) {
        console.error('Error in manual recalculation:', error);
        throw new Error(`Manual recalculation failed: ${error.message}`);
    }
}
exports.manualRecalculateStats = manualRecalculateStats;
// Helper functions
function logSpansMultipleDates(log) {
    if (!log.events || log.events.length < 2)
        return false;
    const firstEvent = log.events[0];
    const lastEvent = log.events[log.events.length - 1];
    const firstDate = firstEvent.childLocalTimestamp.toDate();
    const lastDate = lastEvent.childLocalTimestamp.toDate();
    return firstDate.getDate() !== lastDate.getDate() ||
        firstDate.getMonth() !== lastDate.getMonth() ||
        firstDate.getFullYear() !== lastDate.getFullYear();
}
function getNextDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    return formatDateString(date);
}
function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function getDatesInRange(startDate, endDate) {
    const dates = [];
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const current = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    while (current <= end) {
        dates.push(formatDateString(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}
function formatDuration(ms) {
    const totalMinutes = Math.round(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) {
        return `${minutes}m`;
    }
    else if (minutes === 0) {
        return `${hours}h`;
    }
    else {
        return `${hours}h ${minutes}m`;
    }
}
function createEmptyStats(childId, date, timezone) {
    const statsId = `child_${childId}_date_${date}`;
    return {
        id: statsId,
        childId,
        date,
        timezone,
        timeAsleep: '0h 0m',
        timeAwakeInBed: '0h 0m',
        longestSleepStretch: '0h 0m',
        numberOfWakeUps: 0,
        timeToFallAsleep: '0m',
        averageWakeUpLength: '0m',
        // Numeric versions for charting
        timeAsleepMin: 0,
        timeAwakeInBedMin: 0,
        longestSleepStretchMin: 0,
        timeToFallAsleepMin: 0,
        averageWakeUpLengthMin: 0,
        lastUpdated: admin.firestore.Timestamp.now(),
        sourceLogIds: [],
        calculationVersion: 1
    };
}
//# sourceMappingURL=daily-stats-aggregation.js.map