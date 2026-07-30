/**
 * Config Manager for the Daily Learning Nudge system.
 * Handles reading, writing, and validating user configuration.
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { isValidTime as sharedIsValidTime, isValidTimezone as sharedIsValidTimezone, parseQuietDays } from '../shared/validators.js';

const DEFAULT_CONFIG = {
  telegramChatId: '',
  telegramBotToken: '',
  notificationTime: '09:00',
  timezone: 'UTC',
  quietDays: [],
  streakRecoveryEnabled: true,
  notificationsEnabled: true,
  webhookUrl: '',
};

/**
 * Load config from a JSON file.
 * Returns defaults for any missing fields.
 * If the file does not exist, returns the full default config.
 * @param {string} configPath - Path to config.json
 * @returns {object} Config object with all fields populated
 */
export function loadConfig(configPath) {
  try {
    const raw = readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...DEFAULT_CONFIG };
    }
    // For parse errors or other issues, return defaults
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Update config fields and persist atomically.
 * Validates time, timezone, and quietDays fields before persisting.
 * Invalid fields are rejected and the config remains unchanged for those fields.
 * @param {string} configPath - Path to config.json
 * @param {object} updates - Partial config fields to update
 * @returns {object} Updated config object
 */
export function updateConfig(configPath, updates) {
  const current = loadConfig(configPath);
  const validated = {};

  for (const [key, value] of Object.entries(updates)) {
    switch (key) {
      case 'notificationTime':
        if (isValidTime(value)) {
          validated[key] = value;
        }
        break;
      case 'timezone':
        if (isValidTimezone(value)) {
          validated[key] = value;
        }
        break;
      case 'quietDays':
        if (Array.isArray(value)) {
          // Validate each day name and enforce max 6
          const allValid = value.length <= 6 && value.every(
            (d) => typeof d === 'string' && parseQuietDays(d).valid
          );
          if (allValid) {
            validated[key] = value.map((d) => d.toLowerCase().trim());
          }
        } else if (typeof value === 'string') {
          const result = parseQuietDays(value);
          if (result.valid) {
            validated[key] = result.days;
          }
        }
        break;
      case 'notificationsEnabled':
      case 'streakRecoveryEnabled':
        if (typeof value === 'boolean') {
          validated[key] = value;
        }
        break;
      case 'telegramChatId':
      case 'telegramBotToken':
      case 'webhookUrl':
        if (typeof value === 'string') {
          validated[key] = value;
        }
        break;
      default:
        // Ignore unknown fields
        break;
    }
  }

  const merged = { ...current, ...validated };

  // Persist atomically: write to .tmp then rename
  const tmpPath = `${configPath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(merged, null, 2), 'utf8');
  renameSync(tmpPath, configPath);

  return merged;
}

/**
 * Validate a time string (HH:MM format).
 * Delegates to shared validator.
 * @param {string} time - Time string to validate
 * @returns {boolean}
 */
export function isValidTime(time) {
  return sharedIsValidTime(time);
}

/**
 * Validate an IANA timezone identifier.
 * Delegates to shared validator.
 * @param {string} tz - Timezone string
 * @returns {boolean}
 */
export function isValidTimezone(tz) {
  return sharedIsValidTimezone(tz);
}
