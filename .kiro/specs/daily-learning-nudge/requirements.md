# Requirements Document

## Introduction

The Daily Learning Nudge system helps a software developer maintain a consistent daily learning habit. The system uses a Telegram bot to send daily nudge notifications (removing the need for a personal always-on server), organizes daily learning entries in a structured folder hierarchy within a Git repository, and tracks progress over time including streak data. The system is designed to run serverlessly using scheduled triggers (e.g., GitHub Actions cron jobs or cloud functions) so the user does not need to maintain infrastructure.

## Glossary

- **Nudge_Bot**: A Telegram bot responsible for sending daily learning reminders and receiving completion confirmations from the user
- **Learning_Entry**: A single daily learning record stored as a markdown file containing notes, topic, and metadata about what was learned
- **Folder_Manager**: The component responsible for creating and organizing the daily learning folder structure within the Git repository
- **Progress_Tracker**: The component that calculates and displays learning statistics including streaks, completion rates, and historical data
- **Streak**: A count of consecutive days where the user completed a Learning_Entry
- **Learning_Day**: A calendar day (midnight to midnight in the user's local timezone) during which a Learning_Entry is expected
- **Completion**: The state of a Learning_Day after the user has committed a Learning_Entry for that day
- **Scheduler**: A serverless trigger mechanism (GitHub Actions cron or cloud function) that invokes the Nudge_Bot at configured times without requiring a personal server
- **Learning_Repository**: The Git repository where all Learning_Entries, folder structure, and progress data are stored

## Requirements

### Requirement 1: Telegram Bot Notification Delivery

**User Story:** As a developer, I want to receive a Telegram message on my phone each day reminding me to learn something new, so that I stay consistent without needing to run my own server.

#### Acceptance Criteria

1. WHEN the Scheduler triggers at the configured notification time, THE Nudge_Bot SHALL send a reminder message to the user's Telegram chat
2. THE Nudge_Bot SHALL include a motivational message selected from a predefined list of at least 5 distinct messages and the current Streak count in each daily reminder
3. IF the Telegram API returns a delivery failure, THEN THE Nudge_Bot SHALL retry delivery up to 3 times with a 5-minute interval between retries
4. IF all 3 retry attempts fail, THEN THE Nudge_Bot SHALL log the delivery failure with the timestamp and error reason and skip delivery for that Learning_Day without affecting Streak data
5. WHEN the user has already completed a Learning_Entry for the current Learning_Day, THE Nudge_Bot SHALL send a congratulatory message including the current Streak count instead of a reminder
6. THE Nudge_Bot SHALL operate without requiring the user to maintain an always-on server by using a Scheduler for invocation

### Requirement 2: Notification Scheduling Configuration

**User Story:** As a developer, I want to configure when I receive my daily nudge, so that it arrives at a time that fits my routine.

#### Acceptance Criteria

1. THE Nudge_Bot SHALL provide a default notification time of 09:00 UTC when no timezone has been configured by the user
2. WHEN the user sends a configuration command with a valid time in HH:MM format (00:00 to 23:59), THE Nudge_Bot SHALL update the daily notification time and confirm the change by replying with the new scheduled time
3. IF the user sends a configuration command with an invalid time value, THEN THE Nudge_Bot SHALL reject the update and reply with an error message indicating the expected HH:MM format
4. WHEN the user sends a timezone command with a valid IANA timezone identifier, THE Nudge_Bot SHALL update the timezone used for scheduling and confirm the change by replying with the new timezone
5. IF the user sends a timezone command with an unrecognized timezone identifier, THEN THE Nudge_Bot SHALL reject the update, preserve the existing timezone, and reply with an error message indicating the expected format
6. WHERE the user configures quiet days, THE Nudge_Bot SHALL suppress notifications on the specified days of the week, up to a maximum of 6 days per week
7. WHEN the user disables notifications via command, THE Nudge_Bot SHALL stop sending reminders without affecting streak data, and SHALL resume sending reminders when the user sends an enable command

### Requirement 3: Daily Learning Folder Structure

**User Story:** As a developer, I want my daily learning notes to be organized in a clear folder structure within my Git repository, so that I can easily find and review past entries.

#### Acceptance Criteria

1. THE Folder_Manager SHALL organize Learning_Entries in the pattern `learnings/YYYY/MM/DD.md` within the Learning_Repository, where YYYY is the four-digit year, MM is the two-digit month (01-12), and DD is the two-digit day (01-31) of the Learning_Day
2. WHEN the user initiates a new Learning_Entry, THE Folder_Manager SHALL create the necessary year and month directories if they do not exist
3. WHEN the user initiates a new Learning_Entry and no file exists for the current Learning_Day, THE Folder_Manager SHALL generate a template markdown file containing the following sections in order: date, topic title, category, summary (max 500 characters), key takeaways (up to 10 items), resources (up to 10 links), and time spent (in minutes, 1-480)
4. IF a Learning_Entry file for the current Learning_Day already exists, THEN THE Folder_Manager SHALL return the file path of the existing entry and skip template creation
5. THE Folder_Manager SHALL include a README.md at the repository root documenting the folder structure and usage instructions
6. IF directory or file creation fails, THEN THE Folder_Manager SHALL return an error message indicating the failure reason without leaving partially created files or directories

### Requirement 4: Learning Entry Creation

**User Story:** As a developer, I want to easily record what I learned each day using a simple markdown template, so that I build a searchable knowledge base over time.

#### Acceptance Criteria

1. WHEN the user creates a new Learning_Entry, THE Folder_Manager SHALL pre-fill the date field with the current Learning_Day date in YYYY-MM-DD format
2. THE Folder_Manager SHALL support the following fields in each Learning_Entry: date, topic title (maximum 100 characters), category tag, summary text (maximum 2000 characters), key takeaways list (maximum 10 items), resource links (maximum 10 links), and time spent in minutes (1–480)
3. WHEN the user commits a Learning_Entry to the Learning_Repository, THE Progress_Tracker SHALL mark the Learning_Day as complete only if the Learning_Entry contains at minimum the date, topic title, and category tag fields filled in
4. THE Folder_Manager SHALL provide a CLI command to scaffold a new daily Learning_Entry from the template
5. WHEN a Learning_Entry is committed, THE Progress_Tracker SHALL record the completion timestamp in ISO 8601 format with timezone in the progress data file
6. IF the user commits a Learning_Entry with the topic title empty or the time spent value outside the range of 1–480 minutes, THEN THE Folder_Manager SHALL display an error message indicating the invalid fields and reject the commit from being tracked as a Completion
7. THE Folder_Manager SHALL treat the date, topic title, and category tag fields as mandatory, and the summary text, key takeaways list, resource links, and time spent fields as optional

### Requirement 5: Streak Tracking

**User Story:** As a developer, I want to see my current learning streak, so that I feel motivated to maintain my consistency.

#### Acceptance Criteria

1. WHEN the Progress_Tracker detects a new Learning_Entry commit and no prior Learning_Entry exists for that Learning_Day, THE Progress_Tracker SHALL increment the current Streak count by one
2. IF the Progress_Tracker detects a new Learning_Entry commit for a Learning_Day that already has a recorded completion, THEN THE Progress_Tracker SHALL not modify the current Streak count
3. WHEN a Learning_Day ends without a committed Learning_Entry and no streak recovery is available, THE Progress_Tracker SHALL reset the current Streak to zero
4. THE Progress_Tracker SHALL maintain a record of the current Streak count and the longest Streak achieved in a JSON data file within the Learning_Repository
5. WHEN the current Streak exceeds the longest Streak record, THE Progress_Tracker SHALL update the longest Streak value to equal the current Streak
6. WHEN the user queries the Nudge_Bot for streak status, THE Nudge_Bot SHALL reply with the current Streak count and longest Streak within 5 seconds of the request

### Requirement 6: Progress Analytics

**User Story:** As a developer, I want to see my learning progress over time, so that I can understand my habits and identify areas for improvement.

#### Acceptance Criteria

1. THE Progress_Tracker SHALL calculate and store the total number of completed Learning_Entries in the progress data file
2. THE Progress_Tracker SHALL calculate the completion rate as a percentage (rounded to the nearest integer) of Learning_Days with completed entries over the preceding 7 calendar days and preceding 30 calendar days, including the current day
3. WHEN the user sends a stats command to the Nudge_Bot, THE Nudge_Bot SHALL reply within 10 seconds with a progress summary including current streak, longest streak, total entries, 7-day completion rate, and 30-day completion rate
4. WHEN a new calendar month begins, THE Progress_Tracker SHALL generate a markdown progress report file in the Learning_Repository showing the previous month's total completed days, total Learning_Days, completion rate, and category breakdown
5. WHEN the user sends a category breakdown command to the Nudge_Bot, THE Nudge_Bot SHALL reply with the count and percentage of Learning_Entries per category tag
6. THE Progress_Tracker SHALL calculate the average time spent per Learning_Entry (rounded to the nearest minute) and include it in the stats command response
7. IF the user requests stats and no Learning_Entries exist, THEN THE Progress_Tracker SHALL return zero for all numeric metrics and indicate that no entries have been recorded

### Requirement 7: Streak Recovery

**User Story:** As a developer, I want a grace period for missed days, so that a single miss does not destroy my motivation and streak progress.

#### Acceptance Criteria

1. WHERE the user enables streak recovery, THE Progress_Tracker SHALL allow one missed Learning_Day per calendar week (Monday 00:00 to Sunday 23:59 in the user's configured timezone) without breaking the Streak
2. WHEN a Learning_Day ends without a committed Learning_Entry and streak recovery is enabled with remaining recovery days available in the current week, THE Progress_Tracker SHALL consume one recovery day and mark that Learning_Day as a recovery day in the progress data file, preserving the current Streak count
3. WHEN the user queries streak status, THE Nudge_Bot SHALL include the number of remaining recovery days available in the current week
4. WHEN a new calendar week begins (Monday 00:00 in the user's configured timezone), THE Progress_Tracker SHALL reset the available recovery count to one
5. IF the user misses a Learning_Day and no recovery days remain for the current week, THEN THE Progress_Tracker SHALL reset the Streak to zero
6. WHERE the user has configured quiet days, THE Progress_Tracker SHALL exclude quiet days from missed-day counting and SHALL NOT consume recovery days for quiet days

### Requirement 8: Telegram Bot Interaction Commands

**User Story:** As a developer, I want to interact with the bot using simple commands, so that I can quickly check my status and manage settings from my phone.

#### Acceptance Criteria

1. WHEN the user sends the `/start` command, THE Nudge_Bot SHALL register the user and confirm setup with initial instructions
2. WHEN the user sends the `/status` command, THE Nudge_Bot SHALL reply with current streak, today's completion status, and recovery days remaining
3. WHEN the user sends the `/stats` command, THE Nudge_Bot SHALL reply with full progress analytics summary
4. WHEN the user sends the `/settime HH:MM` command, THE Nudge_Bot SHALL update the daily notification time
5. WHEN the user sends the `/settimezone TIMEZONE` command, THE Nudge_Bot SHALL update the scheduling timezone
6. WHEN the user sends the `/quietdays DAY1,DAY2` command, THE Nudge_Bot SHALL configure notification-free days
7. WHEN the user sends an unrecognized command, THE Nudge_Bot SHALL reply with a help message listing available commands
