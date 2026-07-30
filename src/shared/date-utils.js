/**
 * Date utility functions for the Daily Learning Nudge system.
 * Handles date formatting, week boundaries, quiet day checks, and date range generation.
 */

/**
 * Format a Date object as YYYY-MM-DD string.
 * @param {Date} date
 * @returns {string} Date in YYYY-MM-DD format
 */
export function formatDate(date) {
  return `${formatYear(date)}-${formatMonth(date)}-${formatDay(date)}`;
}

/**
 * Format the day portion of a Date as a zero-padded DD string.
 * @param {Date} date
 * @returns {string} Zero-padded day (01-31)
 */
export function formatDay(date) {
  return String(date.getDate()).padStart(2, '0');
}

/**
 * Format the month portion of a Date as a zero-padded MM string.
 * @param {Date} date
 * @returns {string} Zero-padded month (01-12)
 */
export function formatMonth(date) {
  return String(date.getMonth() + 1).padStart(2, '0');
}

/**
 * Format the year portion of a Date as a YYYY string.
 * @param {Date} date
 * @returns {string} Four-digit year
 */
export function formatYear(date) {
  return String(date.getFullYear());
}

/**
 * Get the start of the calendar week (Monday 00:00:00) in the user's timezone.
 * The calendar week runs Monday 00:00 to Sunday 23:59 in the user's configured timezone.
 * @param {Date} date - The reference date
 * @param {string} timezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns {Date} A Date object representing Monday 00:00:00 in the given timezone
 */
export function getWeekStart(date, timezone) {
  // Get the date components in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekdayStr = parts.find(p => p.type === 'weekday').value;

  // Determine day of week in the timezone (0=Sun, 1=Mon, ..., 6=Sat)
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = weekdayMap[weekdayStr];

  // Calculate days to subtract to get to Monday
  const daysToSubtract = dow === 0 ? 6 : dow - 1;

  // Subtract days to get to Monday (approximate, using ms)
  const mondayApprox = new Date(date.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);

  // Get Monday's date components in the timezone
  const mondayParts = formatter.formatToParts(mondayApprox);
  const mondayYear = parseInt(mondayParts.find(p => p.type === 'year').value, 10);
  const mondayMonth = parseInt(mondayParts.find(p => p.type === 'month').value, 10);
  const mondayDay = parseInt(mondayParts.find(p => p.type === 'day').value, 10);

  // Find the UTC timestamp that corresponds to Monday 00:00 in the target timezone.
  // Start with an estimate (Monday date at UTC midnight), then adjust based on
  // what local time that estimate maps to.
  const targetDateStr = `${mondayYear}-${String(mondayMonth).padStart(2, '0')}-${String(mondayDay).padStart(2, '0')}`;
  const estimate = new Date(`${targetDateStr}T00:00:00Z`).getTime();

  // Check what local time the estimate corresponds to
  const localParts = formatter.formatToParts(new Date(estimate));
  const localH = parseInt(localParts.find(p => p.type === 'hour').value, 10);
  const localD = parseInt(localParts.find(p => p.type === 'day').value, 10);
  const localM = parseInt(localParts.find(p => p.type === 'month').value, 10);

  // If local time at estimate is already Monday 00:00, we're done
  if (localD === mondayDay && localM === mondayMonth && localH === 0) {
    return new Date(estimate);
  }

  // Calculate offset in ms between UTC and the timezone
  let offsetMs;
  if (localD === mondayDay && localM === mondayMonth) {
    // Same day, offset is just the hours
    offsetMs = localH * 60 * 60 * 1000;
  } else if (localD > mondayDay || (localM > mondayMonth)) {
    // Local is ahead of UTC (positive offset like Asia/Tokyo +9)
    offsetMs = (localH + 24) * 60 * 60 * 1000;
  } else {
    // Local is behind UTC (negative offset like America/New_York -5)
    offsetMs = (localH - 24) * 60 * 60 * 1000;
  }

  return new Date(estimate - offsetMs);
}

/**
 * Check if a given date falls on a configured quiet day.
 * @param {Date} date - The date to check
 * @param {string[]} quietDays - Array of lowercase day names (e.g., ["saturday", "sunday"])
 * @returns {boolean} True if the date falls on a quiet day
 */
export function isQuietDay(date, quietDays) {
  if (!quietDays || quietDays.length === 0) {
    return false;
  }

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[date.getDay()];

  return quietDays.includes(dayName);
}

/**
 * Get an array of date strings (YYYY-MM-DD) for all days in a range (inclusive).
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {string[]} Array of date strings from startDate to endDate inclusive
 */
export function getDaysInRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  const current = new Date(start);
  while (current <= end) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, '0');
    const day = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}
