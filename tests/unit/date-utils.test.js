import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDay,
  formatMonth,
  formatYear,
  getWeekStart,
  isQuietDay,
  getDaysInRange,
} from '../../src/shared/date-utils.js';

describe('formatDate', () => {
  it('formats a regular date as YYYY-MM-DD', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(formatDate(date)).toBe('2024-01-15');
  });

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2024, 0, 1); // Jan 1, 2024
    expect(formatDate(date)).toBe('2024-01-01');
  });

  it('handles December 31 correctly', () => {
    const date = new Date(2024, 11, 31); // Dec 31, 2024
    expect(formatDate(date)).toBe('2024-12-31');
  });

  it('handles leap year Feb 29', () => {
    const date = new Date(2024, 1, 29); // Feb 29, 2024
    expect(formatDate(date)).toBe('2024-02-29');
  });
});

describe('formatDay', () => {
  it('returns zero-padded day for single digits', () => {
    expect(formatDay(new Date(2024, 0, 1))).toBe('01');
    expect(formatDay(new Date(2024, 0, 9))).toBe('09');
  });

  it('returns day as-is for double digits', () => {
    expect(formatDay(new Date(2024, 0, 10))).toBe('10');
    expect(formatDay(new Date(2024, 0, 31))).toBe('31');
  });
});

describe('formatMonth', () => {
  it('returns zero-padded month for single digits', () => {
    expect(formatMonth(new Date(2024, 0, 1))).toBe('01');
    expect(formatMonth(new Date(2024, 8, 1))).toBe('09');
  });

  it('returns month as-is for double digits', () => {
    expect(formatMonth(new Date(2024, 9, 1))).toBe('10');
    expect(formatMonth(new Date(2024, 11, 1))).toBe('12');
  });
});

describe('formatYear', () => {
  it('returns four-digit year', () => {
    expect(formatYear(new Date(2024, 0, 1))).toBe('2024');
    expect(formatYear(new Date(2000, 0, 1))).toBe('2000');
    expect(formatYear(new Date(2099, 0, 1))).toBe('2099');
  });
});

describe('getWeekStart', () => {
  it('returns Monday 00:00 for a Wednesday in UTC', () => {
    // Wed Jan 17, 2024 in UTC
    const wed = new Date('2024-01-17T12:00:00Z');
    const weekStart = getWeekStart(wed, 'UTC');

    // Should be Monday Jan 15, 2024 00:00 UTC
    expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('returns the same day for a Monday', () => {
    // Mon Jan 15, 2024 in UTC
    const mon = new Date('2024-01-15T10:00:00Z');
    const weekStart = getWeekStart(mon, 'UTC');

    expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('returns previous Monday for a Sunday', () => {
    // Sun Jan 21, 2024 in UTC
    const sun = new Date('2024-01-21T15:00:00Z');
    const weekStart = getWeekStart(sun, 'UTC');

    expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
  });

  it('handles timezone offset (America/New_York is UTC-5 in January)', () => {
    // Wed Jan 17, 2024 at noon Eastern
    const wed = new Date('2024-01-17T17:00:00Z'); // noon ET = 17:00 UTC
    const weekStart = getWeekStart(wed, 'America/New_York');

    // Monday Jan 15, 00:00 ET = 05:00 UTC
    expect(weekStart.toISOString()).toBe('2024-01-15T05:00:00.000Z');
  });

  it('handles week boundary crossing with positive offset timezone', () => {
    // When it's Monday in Asia/Tokyo but still Sunday in UTC
    // Mon Jan 15, 2024 01:00 JST (UTC+9) = Sun Jan 14, 16:00 UTC
    const monJST = new Date('2024-01-14T16:00:00Z');
    const weekStart = getWeekStart(monJST, 'Asia/Tokyo');

    // Monday Jan 15, 00:00 JST = Jan 14, 15:00 UTC
    expect(weekStart.toISOString()).toBe('2024-01-14T15:00:00.000Z');
  });
});

describe('isQuietDay', () => {
  it('returns true when date falls on a quiet day', () => {
    // Saturday Jan 20, 2024
    const sat = new Date(2024, 0, 20);
    expect(isQuietDay(sat, ['saturday', 'sunday'])).toBe(true);
  });

  it('returns false when date does not fall on a quiet day', () => {
    // Monday Jan 15, 2024
    const mon = new Date(2024, 0, 15);
    expect(isQuietDay(mon, ['saturday', 'sunday'])).toBe(false);
  });

  it('returns false when quietDays is empty', () => {
    const mon = new Date(2024, 0, 15);
    expect(isQuietDay(mon, [])).toBe(false);
  });

  it('returns false when quietDays is null or undefined', () => {
    const mon = new Date(2024, 0, 15);
    expect(isQuietDay(mon, null)).toBe(false);
    expect(isQuietDay(mon, undefined)).toBe(false);
  });

  it('handles all days of the week', () => {
    const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    // Jan 14 2024 is a Sunday, Jan 15 is Monday, etc.
    for (let i = 0; i < 7; i++) {
      const date = new Date(2024, 0, 14 + i);
      expect(isQuietDay(date, [allDays[i]])).toBe(true);
    }
  });
});

describe('getDaysInRange', () => {
  it('returns a single date when start equals end', () => {
    expect(getDaysInRange('2024-01-15', '2024-01-15')).toEqual(['2024-01-15']);
  });

  it('returns all dates in a short range', () => {
    expect(getDaysInRange('2024-01-15', '2024-01-18')).toEqual([
      '2024-01-15',
      '2024-01-16',
      '2024-01-17',
      '2024-01-18',
    ]);
  });

  it('handles month boundaries', () => {
    expect(getDaysInRange('2024-01-30', '2024-02-02')).toEqual([
      '2024-01-30',
      '2024-01-31',
      '2024-02-01',
      '2024-02-02',
    ]);
  });

  it('handles year boundaries', () => {
    expect(getDaysInRange('2023-12-30', '2024-01-02')).toEqual([
      '2023-12-30',
      '2023-12-31',
      '2024-01-01',
      '2024-01-02',
    ]);
  });

  it('returns empty array when start is after end', () => {
    expect(getDaysInRange('2024-01-15', '2024-01-14')).toEqual([]);
  });

  it('handles leap year February', () => {
    expect(getDaysInRange('2024-02-28', '2024-03-01')).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });
});
