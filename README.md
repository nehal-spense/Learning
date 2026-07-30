# Daily Learning Nudge

A serverless personal learning habit tracker that sends daily Telegram reminders, tracks your learning streak, and provides progress analytics — all without any always-on infrastructure.

## Features

- **Telegram notifications** — Daily reminders with motivational messages and streak updates
- **CLI tool** — Scaffold learning entries, validate them, and check progress from the terminal
- **Streak tracking** — Consecutive day tracking with recovery days and quiet day support
- **Progress analytics** — Completion rates, category breakdowns, time tracking, and monthly reports
- **Git-based storage** — All data lives as markdown and JSON files in the repo
- **Serverless architecture** — GitHub Actions for scheduling, Vercel for webhooks (optional)

## Folder Structure

Learning entries are stored in a date-based directory layout:

```
learnings/
└── 2024/
    └── 01/
        ├── 14.md
        └── 15.md
```

Each file follows the path pattern `learnings/YYYY/MM/DD.md`.

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to name your bot
3. Copy the **bot token** you receive (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 2. Get Your Chat ID

1. Send `/start` to your new bot in Telegram
2. Visit `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in a browser
3. Find your `chat.id` value in the JSON response

### 3. Set GitHub Secrets

In your repository, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather |
| `TELEGRAM_CHAT_ID` | Your chat ID from step 2 |

### 4. Deploy Webhook to Vercel (Optional)

If you want the bot to respond to commands interactively:

1. Deploy the project to Vercel
2. Set the webhook URL with Telegram:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-app.vercel.app/api/webhook
   ```
3. Update `data/config.json` with your webhook URL

## CLI Usage

```bash
# Create today's learning entry
node src/cli/index.js new

# Create an entry for a specific date
node src/cli/index.js new 2024-01-15

# Validate a learning entry
node src/cli/index.js validate learnings/2024/01/15.md

# Record today's completion
node src/cli/index.js record

# Show progress stats
node src/cli/index.js progress
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Register with the bot and receive a welcome message |
| `/status` | View current streak and today's completion status |
| `/stats` | Full analytics summary (streaks, rates, time spent) |
| `/settime HH:MM` | Set your preferred notification time |
| `/settimezone TZ` | Set your timezone (IANA format, e.g. `America/New_York`) |
| `/quietdays D1,D2` | Set days to skip notifications (e.g. `saturday,sunday`) |
| `/help` | List all available commands |

## Example Learning Entry

```markdown
---
date: 2024-01-15
topic: "Rust ownership and borrowing"
category: "rust"
time_spent: 30
---

# Learning Entry: 2024-01-15

## Topic

Rust ownership and borrowing

## Summary

Explored Rust's ownership model including move semantics, borrowing rules,
and lifetime annotations. Built a small linked list to practice.

## Key Takeaways

- Each value in Rust has exactly one owner
- References allow borrowing without taking ownership
- Mutable references are exclusive (only one at a time)

## Resources

- https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html
- https://www.youtube.com/watch?v=VFIOSWy93H0
```

## Tech Stack

- **Runtime**: Node.js 20
- **Testing**: Vitest + fast-check (property-based testing)
- **Notifications**: Telegram Bot API
- **Scheduling**: GitHub Actions (cron)
- **Webhook hosting**: Vercel (optional)
- **Storage**: Git repository (markdown + JSON files)
