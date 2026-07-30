/**
 * Webhook Handler for the Daily Learning Nudge Telegram bot.
 * Deployed as a Vercel/Netlify serverless function.
 * Receives Telegram updates via webhook POST and dispatches commands.
 */

import { loadConfig, updateConfig } from '../config/manager.js';
import { loadProgress } from '../progress/tracker.js';
import { calculateStreak, calculateAnalytics } from '../progress/tracker.js';
import { isValidTime, isValidTimezone, parseQuietDays } from '../shared/validators.js';
import { formatDate } from '../shared/date-utils.js';

/**
 * Send a message to a Telegram chat via the Bot API.
 * @param {string} chatId - Telegram chat ID
 * @param {string} text - Message text to send
 * @param {string} botToken - Telegram bot token
 * @returns {Promise<object>} Telegram API response
 */
export async function sendTelegramMessage(chatId, text, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  });
  return response.json();
}

/**
 * Handle the /start command. Returns a welcome message listing all commands.
 * @param {string} chatId - Telegram chat ID
 * @param {object} config - Current config
 * @returns {string} Welcome message text
 */
export function handleStart(chatId, config) {
  return (
    '👋 *Welcome to Daily Learning Nudge!*\n\n' +
    'I help you build a consistent learning habit by sending daily reminders ' +
    'and tracking your streak.\n\n' +
    '*Available commands:*\n' +
    '/status — Current streak and today\'s status\n' +
    '/stats — Full analytics summary\n' +
    '/settime HH:MM — Set notification time\n' +
    '/settimezone Region/City — Set timezone\n' +
    '/quietdays Day1,Day2 — Set quiet days (no reminders)\n' +
    '/help — Show this help message\n\n' +
    `⏰ Current notification time: ${config.notificationTime} (${config.timezone})`
  );
}

/**
 * Handle the /status command. Returns streak info and today's completion status.
 * @param {string} chatId - Telegram chat ID
 * @param {object} config - Current config
 * @param {object} progress - Current progress data
 * @returns {string} Status message text
 */
export function handleStatus(chatId, config, progress) {
  const today = formatDate(new Date());
  const streakInfo = calculateStreak(progress, config, today);
  const completedToday = !!(progress.completions && progress.completions[today]);

  const statusEmoji = completedToday ? '✅' : '⏳';
  const todayStatus = completedToday ? 'Complete' : 'Not yet';

  let message =
    `📊 *Your Status*\n\n` +
    `🔥 Current streak: *${streakInfo.current}* days\n` +
    `${statusEmoji} Today: ${todayStatus}\n`;

  if (streakInfo.recoveryDaysRemaining !== undefined) {
    message += `🛡️ Recovery days remaining this week: ${streakInfo.recoveryDaysRemaining}\n`;
  }

  return message;
}

/**
 * Handle the /stats command. Returns full analytics summary.
 * @param {string} chatId - Telegram chat ID
 * @param {object} config - Current config
 * @param {object} progress - Current progress data
 * @returns {string} Stats message text
 */
export function handleStats(chatId, config, progress) {
  const today = formatDate(new Date());
  const analytics = calculateAnalytics(progress, config, today);
  const streakInfo = calculateStreak(progress, config, today);

  let message =
    `📈 *Your Stats*\n\n` +
    `🔥 Current streak: *${streakInfo.current}* days\n` +
    `🏆 Longest streak: *${streakInfo.longest}* days\n` +
    `📚 Total entries: *${analytics.totalEntries}*\n` +
    `📅 7-day rate: *${analytics.completionRate7d}%*\n` +
    `📅 30-day rate: *${analytics.completionRate30d}%*\n`;

  if (analytics.averageTimeSpent !== undefined && analytics.averageTimeSpent > 0) {
    message += `⏱️ Avg time spent: *${analytics.averageTimeSpent}* min\n`;
  }

  return message;
}

/**
 * Handle the /settime command. Validates and updates notification time.
 * @param {string} chatId - Telegram chat ID
 * @param {string} args - Time argument (HH:MM)
 * @param {object} config - Current config
 * @param {string} configPath - Path to config.json
 * @returns {string} Confirmation or error message
 */
export function handleSetTime(chatId, args, config, configPath) {
  const time = args.trim();

  if (!isValidTime(time)) {
    return '❌ Invalid time format. Expected HH:MM (00:00 to 23:59)';
  }

  updateConfig(configPath, { notificationTime: time });
  return `✅ Notification time updated to *${time}* (${config.timezone})`;
}

/**
 * Handle the /settimezone command. Validates and updates timezone.
 * @param {string} chatId - Telegram chat ID
 * @param {string} args - Timezone argument (IANA format)
 * @param {object} config - Current config
 * @param {string} configPath - Path to config.json
 * @returns {string} Confirmation or error message
 */
export function handleSetTimezone(chatId, args, config, configPath) {
  const tz = args.trim();

  if (!isValidTimezone(tz)) {
    return '❌ Unrecognized timezone. Use IANA format (e.g., America/New_York)';
  }

  updateConfig(configPath, { timezone: tz });
  return `✅ Timezone updated to *${tz}*`;
}

/**
 * Handle the /quietdays command. Parses and updates quiet days.
 * @param {string} chatId - Telegram chat ID
 * @param {string} args - Comma-separated day names
 * @param {object} config - Current config
 * @param {string} configPath - Path to config.json
 * @returns {string} Confirmation or error message
 */
export function handleQuietDays(chatId, args, config, configPath) {
  const result = parseQuietDays(args.trim());

  if (!result.valid) {
    return `❌ ${result.error}`;
  }

  updateConfig(configPath, { quietDays: result.days });
  return `✅ Quiet days updated to: *${result.days.join(', ')}*`;
}

/**
 * Handle the /help command. Returns a list of all available commands.
 * @param {string} chatId - Telegram chat ID
 * @returns {string} Help message text
 */
export function handleHelp(chatId) {
  return (
    '📖 *Available Commands*\n\n' +
    '/start — Welcome message and setup\n' +
    '/status — Current streak and today\'s status\n' +
    '/stats — Full analytics summary\n' +
    '/settime HH:MM — Set notification time\n' +
    '/settimezone Region/City — Set timezone\n' +
    '/quietdays Day1,Day2 — Set quiet days (no reminders)\n' +
    '/help — Show this help message'
  );
}

/**
 * Route a Telegram update to the appropriate command handler.
 * Extracts the command (first word starting with /) from message text.
 * @param {object} update - Parsed Telegram update object
 * @param {string} configPath - Path to config.json
 * @param {string} progressPath - Path to progress.json
 * @returns {Promise<string|null>} Response message text, or null if no message to send
 */
export async function routeCommand(update, configPath, progressPath) {
  const message = update.message;
  if (!message || !message.text) {
    return null;
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // Extract command (first word starting with /)
  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  const config = loadConfig(configPath);
  const progress = loadProgress(progressPath);

  switch (command) {
    case '/start':
      return handleStart(chatId, config);
    case '/status':
      return handleStatus(chatId, config, progress);
    case '/stats':
      return handleStats(chatId, config, progress);
    case '/settime':
      return handleSetTime(chatId, args, config, configPath);
    case '/settimezone':
      return handleSetTimezone(chatId, args, config, configPath);
    case '/quietdays':
      return handleQuietDays(chatId, args, config, configPath);
    case '/help':
      return handleHelp(chatId);
    default:
      // Unrecognized command — return help
      return handleHelp(chatId);
  }
}

/**
 * Core webhook handler logic. Processes a Telegram update body and returns
 * the response text that was sent (or null if nothing to send).
 * @param {object} body - Parsed Telegram update body
 * @param {string} configPath - Path to config.json
 * @param {string} progressPath - Path to progress.json
 * @param {string} botToken - Telegram bot token
 * @returns {Promise<string|null>} The response text sent, or null
 */
export async function handleWebhook(body, configPath, progressPath, botToken) {
  const responseText = await routeCommand(body, configPath, progressPath);

  if (responseText && body.message && body.message.chat) {
    const chatId = String(body.message.chat.id);
    await sendTelegramMessage(chatId, responseText, botToken);
  }

  return responseText;
}

/**
 * Vercel/Netlify serverless function entry point.
 * Receives POST requests from Telegram webhook and responds with 200 OK.
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(200).json({ ok: true });
    return;
  }

  try {
    const body = req.body;

    const configPath = process.env.CONFIG_PATH || 'data/config.json';
    const progressPath = process.env.PROGRESS_PATH || 'data/progress.json';
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

    await handleWebhook(body, configPath, progressPath, botToken);
  } catch (error) {
    // Log but don't fail — always return 200 to acknowledge receipt
    console.error('Webhook handler error:', error);
  }

  // Always return 200 to acknowledge receipt to Telegram
  res.status(200).json({ ok: true });
}
