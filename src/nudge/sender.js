/**
 * Nudge Sender — composes and sends daily learning reminders via Telegram.
 */

import { isQuietDay, formatDate } from '../shared/date-utils.js';

/**
 * Compose a motivational message based on streak and completion status.
 * @param {number} streakCount - Current streak count
 * @param {boolean} completedToday - Whether today's entry is already done
 * @param {object} messages - Message pool with .congratulations and .reminders arrays
 * @returns {string} Composed message with {streak} replaced
 */
export function composeMessage(streakCount, completedToday, messages) {
  const pool = completedToday ? messages.congratulations : messages.reminders;
  const index = Math.floor(Math.random() * pool.length);
  const template = pool[index];
  return template.replace(/\{streak\}/g, String(streakCount));
}

/**
 * Determine if an error is retryable.
 * @param {Error} error - The error from a fetch attempt
 * @returns {boolean} True if the request should be retried
 */
export function isRetryable(error) {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // HTTP status-based errors
  if (error.status !== undefined) {
    if (error.status === 429 || error.status >= 500) {
      return true;
    }
    if (error.status === 400 || error.status === 403) {
      return false;
    }
  }

  return false;
}

/**
 * Send a message via Telegram Bot API with retry logic.
 * @param {string} chatId - Telegram chat ID
 * @param {string} message - Message text to send
 * @param {string} botToken - Telegram bot token
 * @param {number} retries - Remaining retry attempts (default 3)
 * @returns {Promise<{success: boolean, error?: Error}>}
 */
export async function sendWithRetry(chatId, message, botToken, retries = 3) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });

    if (!response.ok) {
      const error = new Error(`Telegram API error: ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return { success: true };
  } catch (error) {
    if (isRetryable(error) && retries > 0) {
      // Wait 5 minutes before retrying
      await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
      return sendWithRetry(chatId, message, botToken, retries - 1);
    }

    console.error(`Failed to send nudge after retries: ${error.message}`);
    return { success: false, error };
  }
}

/**
 * Orchestrate the daily nudge: check conditions, compose, and send.
 * @param {object} config - User configuration
 * @param {object} progress - Current progress data
 * @param {object} messages - Message pool
 * @returns {Promise<{sent: boolean, reason?: string, success?: boolean, error?: Error}>}
 */
export async function sendDailyNudge(config, progress, messages) {
  // Check if notifications are disabled
  if (!config.notificationsEnabled) {
    return { sent: false, reason: 'disabled' };
  }

  // Check if today is a quiet day
  const today = new Date();
  if (isQuietDay(today, config.quietDays)) {
    return { sent: false, reason: 'quiet_day' };
  }

  // Check if today is already completed
  const todayStr = formatDate(today);
  const completedToday = Boolean(progress.completions && progress.completions[todayStr]);

  // Compose the message
  const message = composeMessage(progress.currentStreak, completedToday, messages);

  // Send with retry
  const result = await sendWithRetry(config.chatId, message, config.botToken);

  return { sent: true, ...result };
}
