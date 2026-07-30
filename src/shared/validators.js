/**
 * Shared validators for the Daily Learning Nudge system.
 * Provides validation for time, timezone, day names, quiet days, and learning entries.
 */

const VALID_DAY_NAMES = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * Validate a time string in HH:MM format (00:00 to 23:59).
 * @param {string} time - Time string to validate
 * @returns {boolean} true if valid HH:MM format
 */
export function isValidTime(time) {
  if (typeof time !== 'string') return false;
  return TIME_REGEX.test(time);
}

/**
 * Validate an IANA timezone identifier.
 * Uses Intl.supportedValuesOf('timeZone') as the primary check,
 * with a fallback to Intl.DateTimeFormat for canonical names like 'UTC'
 * that may not appear in supportedValuesOf on all runtimes.
 * @param {string} tz - Timezone string to validate
 * @returns {boolean} true if recognized IANA timezone
 */
export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || tz.trim() === '') return false;
  try {
    const supported = Intl.supportedValuesOf('timeZone');
    if (supported.includes(tz)) return true;
    // Fallback: try creating a DateTimeFormat with the timezone
    // This handles canonical names like 'UTC' that some runtimes omit from supportedValuesOf
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a day name (case-insensitive, checks against English day names).
 * @param {string} day - Day name to validate
 * @returns {boolean} true if valid English day name
 */
export function isValidDayName(day) {
  if (typeof day !== 'string') return false;
  return VALID_DAY_NAMES.includes(day.toLowerCase().trim());
}

/**
 * Parse a comma-separated string of quiet day names.
 * Normalizes to lowercase, validates each day, enforces max 6 days.
 * @param {string} input - Comma-separated day names (case-insensitive)
 * @returns {{ valid: boolean, days?: string[], error?: string }}
 */
export function parseQuietDays(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    return { valid: false, error: 'Invalid day names. Use: monday,tuesday,...,sunday (max 6)' };
  }

  const parts = input.split(',').map((d) => d.trim().toLowerCase()).filter((d) => d !== '');

  if (parts.length === 0) {
    return { valid: false, error: 'Invalid day names. Use: monday,tuesday,...,sunday (max 6)' };
  }

  if (parts.length > 6) {
    return { valid: false, error: 'Invalid day names. Use: monday,tuesday,...,sunday (max 6)' };
  }

  for (const day of parts) {
    if (!VALID_DAY_NAMES.includes(day)) {
      return { valid: false, error: 'Invalid day names. Use: monday,tuesday,...,sunday (max 6)' };
    }
  }

  // Remove duplicates
  const unique = [...new Set(parts)];

  return { valid: true, days: unique };
}

/**
 * Validate a learning entry's content fields.
 * Required: date (YYYY-MM-DD), topic (1-100 chars), category (non-empty).
 * Optional: time_spent (integer 1-480 if provided).
 * @param {object} content - Entry content with fields: date, topic, category, time_spent
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEntry(content) {
  const errors = [];

  if (!content || typeof content !== 'object') {
    return { valid: false, errors: ['Entry content is required'] };
  }

  // Validate date (required, YYYY-MM-DD format)
  if (!content.date || typeof content.date !== 'string' || !DATE_REGEX.test(content.date)) {
    errors.push('Date is required in YYYY-MM-DD format');
  }

  // Validate topic (required, 1-100 characters, not whitespace-only)
  if (
    !content.topic ||
    typeof content.topic !== 'string' ||
    content.topic.trim().length === 0 ||
    content.topic.length > 100
  ) {
    errors.push('Topic title is required (1-100 characters)');
  }

  // Validate category (required, non-empty)
  if (
    !content.category ||
    typeof content.category !== 'string' ||
    content.category.trim().length === 0
  ) {
    errors.push('Category tag is required');
  }

  // Validate time_spent (optional, integer 1-480 if provided)
  if (content.time_spent !== undefined && content.time_spent !== null) {
    const timeSpent = content.time_spent;
    if (
      typeof timeSpent !== 'number' ||
      !Number.isInteger(timeSpent) ||
      timeSpent < 1 ||
      timeSpent > 480
    ) {
      errors.push('Time spent must be 1-480 minutes');
    }
  }

  return { valid: errors.length === 0, errors };
}
