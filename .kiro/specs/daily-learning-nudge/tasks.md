# Implementation Plan: Daily Learning Nudge

## Overview

Implement a serverless daily learning habit tracker using a Telegram bot for notifications, a CLI tool for entry management, and Git-based flat-file storage. The system uses GitHub Actions cron for scheduled nudges and a serverless webhook handler for Telegram commands. Implementation is in JavaScript/Node.js with Vitest + fast-check for testing.

## Tasks

- [x] 1. Set up project structure, dependencies, and shared utilities
  - [x] 1.1 Initialize project structure and install dependencies
    - Create `package.json` with Node.js 20, type: module, and dependencies: `node-telegram-bot-api`
    - Add dev dependencies: `vitest`, `fast-check`
    - Create directory structure: `src/config/`, `src/folders/`, `src/progress/`, `src/cli/`, `src/nudge/`, `src/webhook/`, `src/shared/`, `data/`, `tests/unit/`, `tests/property/`, `tests/integration/`
    - Add vitest config (`vitest.config.js`)
    - _Requirements: 1.6, 3.5_

  - [x] 1.2 Implement shared validators (`src/shared/validators.js`)
    - Implement `isValidTime(time)` — regex `/^([01]\d|2[0-3]):([0-5]\d)$/`
    - Implement `isValidTimezone(tz)` — check against `Intl.supportedValuesOf('timeZone')`
    - Implement `isValidDayName(day)` — validate against lowercase English day names
    - Implement `parseQuietDays(input)` — comma-separated day names, max 6, case-insensitive
    - Implement `validateEntry(content)` — check required fields (date YYYY-MM-DD, topic 1-100 chars, category non-empty) and optional constraints (time_spent 1-480)
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 4.3, 4.6, 4.7, 8.6_

  - [x] 1.3 Implement date utilities (`src/shared/date-utils.js`)
    - Implement `formatDate(date)` — returns YYYY-MM-DD string
    - Implement `formatDay(date)` — returns zero-padded DD
    - Implement `formatMonth(date)` — returns zero-padded MM
    - Implement `formatYear(date)` — returns YYYY
    - Implement `getWeekStart(date, timezone)` — returns Monday 00:00 in user's timezone
    - Implement `isQuietDay(date, quietDays)` — checks if date falls on a configured quiet day
    - Implement `getDaysInRange(startDate, endDate)` — returns array of date strings in range
    - _Requirements: 3.1, 5.3, 7.1, 7.4, 7.6_

  - [ ]* 1.4 Write unit tests for shared validators and date utilities
    - Test `isValidTime` with valid and invalid inputs (edge cases: "00:00", "23:59", "24:00", "9:00", "")
    - Test `isValidTimezone` with valid IANA names and invalid strings
    - Test `parseQuietDays` with valid combos, > 6 days rejection, invalid names
    - Test `validateEntry` with complete, partial, and invalid entries
    - Test date formatting functions for month/year boundaries
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 4.6, 4.7_

- [x] 2. Implement Config Manager and data files
  - [x] 2.1 Create initial data files
    - Create `data/config.json` with default values (notificationTime: "09:00", timezone: "UTC", quietDays: [], streakRecoveryEnabled: true, notificationsEnabled: true)
    - Create `data/progress.json` with empty initial state (currentStreak: 0, longestStreak: 0, totalEntries: 0, completions: {}, recoveryDays: {})
    - Create `data/messages.json` with at least 5 reminder messages and 5 congratulations messages including `{streak}` placeholder
    - _Requirements: 1.2, 2.1, 5.4, 6.7_

  - [x] 2.2 Implement Config Manager (`src/config/manager.js`)
    - Implement `loadConfig(configPath)` — read and parse JSON, return defaults for missing fields
    - Implement `updateConfig(configPath, updates)` — merge updates, validate fields, persist atomically (write to .tmp then rename)
    - Implement `isValidTime(time)` and `isValidTimezone(tz)` delegating to shared validators
    - Handle file-not-found by returning default config
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 2.3 Write unit tests for Config Manager
    - Test loading config with missing fields uses defaults
    - Test updating config persists changes
    - Test invalid time/timezone updates are rejected and config unchanged
    - Test atomic write (no corruption on failure)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Implement Folder Manager
  - [x] 3.1 Implement Folder Manager (`src/folders/manager.js`)
    - Implement `ensureDirectoryStructure(baseDir, date)` — create `learnings/YYYY/MM/` directories, track created dirs for rollback
    - Implement `generateTemplate(date)` — produce markdown with frontmatter (date, topic, category, time_spent) and body sections (Topic, Summary, Key Takeaways, Resources)
    - Implement `createEntry(baseDir, date)` — check if file exists (return path if so), otherwise create directories + write template. Rollback on failure.
    - Implement `buildFilePath(baseDir, date)` — returns `learnings/YYYY/MM/DD.md` path
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 4.1, 4.2_

  - [ ]* 3.2 Write property tests for Folder Manager
    - **Property 7: Date to file path mapping** — for any valid date, path matches `learnings/YYYY/MM/DD.md` with correct zero-padding
    - **Property 8: Template generation completeness** — for any valid date, template contains all required sections and date equals input
    - **Property 9: Entry creation idempotence** — for any date with existing file, calling createEntry returns existing path without modification
    - **Validates: Requirements 3.1, 3.3, 3.4, 4.1, 4.2**

  - [ ]* 3.3 Write unit tests for Folder Manager
    - Test directory creation for nested paths
    - Test template content structure
    - Test idempotent behavior when file exists
    - Test rollback on filesystem error
    - Test month/year boundary dates (e.g., 2024-01-01, 2024-12-31)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 4. Implement Progress Tracker
  - [x] 4.1 Implement Progress Tracker (`src/progress/tracker.js`)
    - Implement `loadProgress(filePath)` — read JSON, validate schema, return defaults on error
    - Implement `saveProgress(filePath, data)` — atomic write (temp file + rename)
    - Implement `recordCompletion(data, date, timestamp, category, timeSpent)` — add completion, increment streak if new date, update longest streak, increment totalEntries
    - Implement `calculateStreak(data, config, today)` — iterate backwards from today, skip quiet days, account for recovery days, return { current, longest, recoveryDaysRemaining }
    - Implement `calculateAnalytics(data, config, today)` — compute 7-day rate, 30-day rate, average time spent, total entries, category breakdown
    - Implement `generateMonthlyReport(data, year, month)` — generate markdown report with completed days, total learning days (excluding quiet days), completion rate, category breakdown
    - _Requirements: 4.3, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.4, 7.5, 7.6_

  - [ ]* 4.2 Write property tests for streak logic
    - **Property 12: Streak increments on new daily completion** — new date increases streak by exactly 1
    - **Property 13: Duplicate completion is idempotent** — same date again doesn't change streak
    - **Property 14: Missed day without recovery resets streak** — missed non-quiet day with no recovery → streak = 0
    - **Property 15: Longest streak monotonically updates** — longest never decreases, updates when current exceeds it
    - **Property 20: Streak recovery preserves streak and consumes allowance** — missed day with recovery available preserves streak, decrements allowance
    - **Property 21: Recovery allowance resets weekly** — crossing Monday resets recovery to 1
    - **Property 22: Quiet days are invisible to streak logic** — quiet days don't count as missed, don't consume recovery
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 7.1, 7.2, 7.4, 7.5, 7.6**

  - [ ]* 4.3 Write property tests for analytics
    - **Property 16: Completion rate calculation** — 7-day and 30-day rates correctly computed and bounded 0-100
    - **Property 17: Monthly report correctness** — report contains correct totals and category breakdown sums to total
    - **Property 18: Category breakdown consistency** — per-category counts sum to total completions, percentages sum to ~100
    - **Property 19: Average time spent calculation** — average equals Math.round(sum / count)
    - **Validates: Requirements 6.2, 6.4, 6.5, 6.6**

  - [ ]* 4.4 Write unit tests for Progress Tracker
    - Test empty progress state returns zeros for all metrics (Req 6.7)
    - Test streak calculation across month boundaries
    - Test recovery day consumption and weekly reset
    - Test monthly report generation with mixed categories
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.7, 7.1, 7.2_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement Nudge Sender
  - [x] 6.1 Implement Nudge Sender (`src/nudge/sender.js`)
    - Implement `composeMessage(streakCount, completedToday, messages)` — select random message from reminders or congratulations list, insert streak count
    - Implement `sendWithRetry(chatId, message, botToken, retries = 3)` — call Telegram sendMessage API, retry up to 3 times with 5-minute intervals on retryable errors, log failure after exhaustion
    - Implement `isRetryable(error)` — classify errors (429, 5xx, network errors as retryable; 400, 403 as non-retryable)
    - Implement `sendDailyNudge(config, progress, messages)` — orchestrate: check quiet day, check notifications enabled, check today's completion, compose message, send with retry
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.6, 2.7_

  - [x] 6.2 Implement Nudge runner (`src/nudge/run.js`)
    - Entry point for GitHub Actions: load config, load progress, load messages, call sendDailyNudge
    - Read TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment variables
    - Exit with code 0 on success or logged failure (don't fail the workflow on delivery failure)
    - _Requirements: 1.1, 1.4, 1.6_

  - [ ]* 6.3 Write property tests for Nudge Sender
    - **Property 1: Message composition includes streak and correct type** — composed message contains streak number and comes from correct list
    - **Property 2: Retry capped at maximum attempts** — at most 3 attempts on failure sequence
    - **Property 5: Quiet day notification suppression** — no send on quiet days
    - **Property 6: Notification toggle preserves progress data** — disabling doesn't modify progress
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.6, 2.7**

  - [ ]* 6.4 Write unit tests for Nudge Sender
    - Test message composition with streak 0, streak 1, large streaks
    - Test retry logic with mocked Telegram API (all succeed, all fail, partial fail)
    - Test quiet day suppression
    - Test notifications disabled skips sending
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 7. Implement CLI Tool
  - [x] 7.1 Implement CLI Tool (`src/cli/index.js`)
    - Parse commands: `new` (scaffold entry), `validate <file>` (validate entry), `progress` (show stats), `record` (record completion and update progress)
    - `new` command: call Folder Manager's `createEntry` for today (or optional date arg), print file path
    - `validate` command: read file, parse frontmatter, call `validateEntry`, print errors or success
    - `progress` command: load progress, load config, call `calculateStreak` and `calculateAnalytics`, print formatted summary to terminal
    - `record` command: validate entry, record completion in progress.json with ISO 8601 timestamp, print updated streak
    - _Requirements: 3.4, 4.1, 4.3, 4.5, 4.6, 5.1, 6.3_

  - [ ]* 7.2 Write property tests for entry validation
    - **Property 10: Entry validation — required fields and constraints** — valid iff date is YYYY-MM-DD, topic 1-100 chars, category non-empty; time_spent 1-480 if provided
    - **Property 11: Completion timestamp format** — recorded timestamps are valid ISO 8601 with timezone
    - **Validates: Requirements 4.3, 4.5, 4.6, 4.7**

  - [ ]* 7.3 Write unit tests for CLI Tool
    - Test `new` command creates entry and prints path
    - Test `validate` with valid and invalid entries
    - Test `progress` with empty and populated progress data
    - Test `record` updates progress.json correctly
    - _Requirements: 3.4, 4.1, 4.3, 4.6_

- [x] 8. Implement Webhook Handler
  - [x] 8.1 Implement Webhook Handler (`src/webhook/handler.js`)
    - Implement `handleWebhook(req)` — parse Telegram update, verify structure, route to command handler, return 200
    - Implement `routeCommand(update)` — extract command text, dispatch to handler functions
    - Implement `handleStart(chatId)` — register user (store chatId in config), send welcome message with instructions
    - Implement `handleStatus(chatId, config, progress)` — reply with current streak, today's completion, recovery days remaining
    - Implement `handleStats(chatId, config, progress)` — reply with full analytics (streak, longest, total, 7-day rate, 30-day rate, avg time)
    - Implement `handleSetTime(chatId, args, config)` — validate HH:MM, update config, confirm or reject
    - Implement `handleSetTimezone(chatId, args, config)` — validate IANA tz, update config, confirm or reject
    - Implement `handleQuietDays(chatId, args, config)` — parse days, validate (max 6), update config, confirm or reject
    - Implement `handleHelp(chatId)` — reply with list of all available commands
    - Send response messages back via Telegram sendMessage API
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 8.2 Write property tests for Webhook Handler
    - **Property 3: Time input validation** — accepts iff HH:MM where HH 00-23, MM 00-59
    - **Property 4: Timezone input validation** — accepts iff recognized IANA timezone
    - **Property 23: Command response completeness** — /status contains streak + completion + recovery; /stats contains all metrics; unrecognized → help
    - **Property 24: Quiet days command parsing** — valid day names stored normalized; >6 or invalid rejected
    - **Validates: Requirements 2.2, 2.3, 2.4, 2.5, 8.2, 8.3, 8.6, 8.7**

  - [ ]* 8.3 Write unit tests for Webhook Handler
    - Test `/start` registration flow
    - Test `/status` response format
    - Test `/settime` with valid and invalid input
    - Test `/settimezone` with valid and invalid input
    - Test `/quietdays` with various inputs
    - Test unrecognized command returns help
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Set up GitHub Actions workflow and integration
  - [x] 10.1 Create GitHub Actions workflow (`.github/workflows/daily-nudge.yml`)
    - Configure cron schedule `0 9 * * *` (default 09:00 UTC)
    - Add `workflow_dispatch` for manual testing
    - Steps: checkout, setup-node@v4 (node 20), npm ci, run `node src/nudge/run.js`
    - Pass secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID as env vars
    - _Requirements: 1.1, 1.6_

  - [x] 10.2 Create README.md at repository root
    - Document folder structure and usage instructions
    - Include setup steps (BotFather, secrets configuration, webhook setup)
    - Document CLI commands and bot commands
    - Include example learning entry
    - _Requirements: 3.5_

  - [ ]* 10.3 Write integration tests
    - Test full nudge send flow with mocked Telegram API
    - Test webhook command dispatch end-to-end with mocked Telegram
    - Test CLI scaffold creates correct file structure in temp directory
    - Validate GitHub Actions YAML syntax
    - _Requirements: 1.1, 1.2, 1.3, 8.1, 8.2, 8.3_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Telegram bot token should be stored as a GitHub secret, never in config.json for production
- The webhook handler is designed for Vercel/Netlify serverless deployment (exports a handler function)
- All data files use atomic writes (write to .tmp then rename) to prevent corruption

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1"] },
    { "id": 2, "tasks": ["1.4", "2.2"] },
    { "id": 3, "tasks": ["2.3", "3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "4.4", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "6.4", "7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "10.1", "10.2"] },
    { "id": 9, "tasks": ["10.3"] }
  ]
}
```
