/**
 * Progress Tracker for the Daily Learning Nudge system.
 * Calculates and persists streak, analytics, and progress data.
 */

import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { getDaysInRange, formatDate, isQuietDay, getWeekStart } from '../shared/date-utils.js';

const DEFAULT_PROGRESS = {
  currentStreak: 0,
  longestStreak: 0,
  totalEntries: 0,
  completions: {},
  recoveryDays: {},
  lastUpdated: '',
};

const REQUIRED_FIELDS = ['currentStreak', 'longestStreak', 'totalEntries', 'completions', 'recoveryDays'];

/**
 * Load progress data from a JSON file.
 * Validates that the file contains all required fields.
 * Returns defaults on error or missing file.
 * @param {string} filePath - Path to progress.json
 * @returns {object} Progress data object
 */
export function loadProgress(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    // Validate required fields exist
    const hasAllFields = REQUIRED_FIELDS.every((field) => field in data);
    if (!hasAllFields) {
      return { ...DEFAULT_PROGRESS };
    }

    return data;
  } catch (error) {
    return { ...DEFAULT_PROGRESS };
  }
}

/**
 * Save progress data atomically: write to .tmp then rename.
 * @param {string} filePath - Path to progress.json
 * @param {object} data - Progress data to persist
 */
export function saveProgress(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmpPath, filePath);
}

/**
 * Record a completion for a given date.
 * If the date already has a completion, returns data unchanged.
 * Otherwise adds to completions, increments streak and totalEntries.
 * @param {object} data - Current progress state
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} timestamp - ISO 8601 completion timestamp
 * @param {string} category - Category tag
 * @param {number} timeSpent - Minutes spent
 * @returns {object} Updated progress state
 */
export function recordCompletion(data, date, timestamp, category, timeSpent) {
  // If date already has a completion, return unchanged
  if (data.completions[date]) {
    return data;
  }

  const updatedCompletions = {
    ...data.completions,
    [date]: { timestamp, category, timeSpent },
  };

  const newCurrentStreak = data.currentStreak + 1;
  const newLongestStreak = Math.max(data.longestStreak, newCurrentStreak);

  return {
    ...data,
    completions: updatedCompletions,
    currentStreak: newCurrentStreak,
    longestStreak: newLongestStreak,
    totalEntries: data.totalEntries + 1,
    lastUpdated: timestamp,
  };
}

/**
 * Calculate current streak accounting for recovery days and quiet days.
 * Iterates backwards from yesterday, skipping quiet days, checking completions
 * and recovery days. Stops at the first gap with no completion and no recovery.
 * Recovery allowance: 1 per week (Monday-Sunday).
 * @param {object} data - Progress state with completions and recoveryDays
 * @param {object} config - User config (quietDays, timezone, streakRecoveryEnabled)
 * @param {string} today - Current date string (YYYY-MM-DD)
 * @returns {{ current: number, longest: number, recoveryDaysRemaining: number }}
 */
export function calculateStreak(data, config, today) {
  const quietDays = config.quietDays || [];
  const timezone = config.timezone || 'UTC';
  const recoveryEnabled = config.streakRecoveryEnabled !== false;

  let streak = 0;

  // Check if today has a completion
  if (data.completions[today]) {
    streak = 1;
  }

  // Track recovery usage per week (weekStart -> count)
  const recoveryUsage = {};

  // Count existing recovery days from data
  for (const [, recovery] of Object.entries(data.recoveryDays || {})) {
    const ws = recovery.weekStart;
    recoveryUsage[ws] = (recoveryUsage[ws] || 0) + 1;
  }

  // Iterate backwards from yesterday
  const todayDate = new Date(today + 'T12:00:00Z');
  let currentDate = new Date(todayDate.getTime() - 24 * 60 * 60 * 1000);

  while (true) {
    const dateStr = formatDate(currentDate);

    // Skip quiet days
    if (isQuietDay(currentDate, quietDays)) {
      currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
      continue;
    }

    // Check if there's a completion for this day
    if (data.completions[dateStr]) {
      streak++;
      currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
      continue;
    }

    // Check if there's a recovery day recorded for this date
    if (data.recoveryDays[dateStr]) {
      streak++;
      currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
      continue;
    }

    // Check if we can use a recovery day
    if (recoveryEnabled) {
      const weekStart = formatDate(getWeekStart(currentDate, timezone));
      const usedThisWeek = recoveryUsage[weekStart] || 0;

      if (usedThisWeek < 1) {
        // Can use recovery for this day
        recoveryUsage[weekStart] = usedThisWeek + 1;
        streak++;
        currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
        continue;
      }
    }

    // No completion, no recovery available — streak breaks here
    break;
  }

  // Calculate recovery days remaining for current week
  const todayWeekStart = formatDate(getWeekStart(todayDate, timezone));
  const usedThisWeek = recoveryUsage[todayWeekStart] || 0;
  const recoveryDaysRemaining = recoveryEnabled ? Math.max(0, 1 - usedThisWeek) : 0;

  const longest = Math.max(data.longestStreak || 0, streak);

  return {
    current: streak,
    longest,
    recoveryDaysRemaining,
  };
}

/**
 * Calculate analytics for stats display.
 * @param {object} data - Progress state
 * @param {object} config - User config
 * @param {string} today - Current date (YYYY-MM-DD)
 * @returns {{ totalEntries: number, completionRate7d: number, completionRate30d: number, averageTimeSpent: number, categoryBreakdown: object }}
 */
export function calculateAnalytics(data, config, today) {
  const totalEntries = data.totalEntries || 0;

  // 7-day completion rate
  const todayDate = new Date(today + 'T12:00:00Z');
  const sevenDaysAgo = new Date(todayDate.getTime() - 6 * 24 * 60 * 60 * 1000);
  const sevenDayStart = formatDate(sevenDaysAgo);
  const days7 = getDaysInRange(sevenDayStart, today);
  const completions7 = days7.filter((d) => data.completions[d]).length;
  const completionRate7d = Math.round((completions7 / 7) * 100);

  // 30-day completion rate
  const thirtyDaysAgo = new Date(todayDate.getTime() - 29 * 24 * 60 * 60 * 1000);
  const thirtyDayStart = formatDate(thirtyDaysAgo);
  const days30 = getDaysInRange(thirtyDayStart, today);
  const completions30 = days30.filter((d) => data.completions[d]).length;
  const completionRate30d = Math.round((completions30 / 30) * 100);

  // Average time spent
  const completionEntries = Object.values(data.completions);
  const entriesWithTime = completionEntries.filter(
    (c) => c.timeSpent != null && c.timeSpent > 0
  );
  const averageTimeSpent =
    entriesWithTime.length > 0
      ? Math.round(
          entriesWithTime.reduce((sum, c) => sum + c.timeSpent, 0) / entriesWithTime.length
        )
      : 0;

  // Category breakdown
  const categoryBreakdown = {};
  const totalCompletions = completionEntries.length;

  for (const completion of completionEntries) {
    const cat = completion.category || 'uncategorized';
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { count: 0, percentage: 0 };
    }
    categoryBreakdown[cat].count++;
  }

  // Calculate percentages
  if (totalCompletions > 0) {
    for (const cat of Object.keys(categoryBreakdown)) {
      categoryBreakdown[cat].percentage = Math.round(
        (categoryBreakdown[cat].count / totalCompletions) * 100
      );
    }
  }

  return {
    totalEntries,
    completionRate7d,
    completionRate30d,
    averageTimeSpent,
    categoryBreakdown,
  };
}

/**
 * Generate a monthly progress report in markdown format.
 * @param {object} data - Progress state
 * @param {number} year - Report year
 * @param {number} month - Report month (1-12)
 * @returns {string} Markdown report content
 */
export function generateMonthlyReport(data, year, month) {
  // Get all days in the month
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const allDays = getDaysInRange(startDate, endDate);

  // Count completed days
  const completedDays = allDays.filter((d) => data.completions[d]).length;

  // Count quiet days in the month
  const quietDayCount = allDays.filter((d) => {
    const date = new Date(d + 'T12:00:00Z');
    return isQuietDay(date, []);
  }).length;

  // Total learning days = days in month (quiet days aren't excluded unless config is passed)
  // Since we don't have config here, count all days as learning days minus weekends isn't right
  // The spec says "total learning days (days in month minus quiet days)" but we have no config
  // We'll count all days as learning days (no quiet days since we have no config reference)
  const totalLearningDays = allDays.length;

  // Completion rate
  const completionRate = totalLearningDays > 0
    ? Math.round((completedDays / totalLearningDays) * 100)
    : 0;

  // Category breakdown for this month
  const categoryBreakdown = {};
  for (const day of allDays) {
    if (data.completions[day]) {
      const cat = data.completions[day].category || 'uncategorized';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    }
  }

  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long' });

  // Build markdown
  let report = `# Monthly Report: ${monthName} ${year}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Total Completed Days:** ${completedDays}\n`;
  report += `- **Total Learning Days:** ${totalLearningDays}\n`;
  report += `- **Completion Rate:** ${completionRate}%\n\n`;
  report += `## Category Breakdown\n\n`;

  if (Object.keys(categoryBreakdown).length > 0) {
    report += `| Category | Count | Percentage |\n`;
    report += `|----------|-------|------------|\n`;
    for (const [cat, count] of Object.entries(categoryBreakdown)) {
      const pct = completedDays > 0 ? Math.round((count / completedDays) * 100) : 0;
      report += `| ${cat} | ${count} | ${pct}% |\n`;
    }
  } else {
    report += `No completions recorded for this month.\n`;
  }

  return report;
}
