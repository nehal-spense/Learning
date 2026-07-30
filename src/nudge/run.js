/**
 * Entry point for the Daily Learning Nudge GitHub Actions workflow.
 * Reads configuration from environment and data files, sends the nudge,
 * and always exits 0 to avoid failing the workflow.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendDailyNudge } from './sender.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error('Missing required environment variables: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID');
      process.exit(0);
    }

    // Load data files
    const dataDir = resolve(__dirname, '../../data');

    const config = JSON.parse(readFileSync(resolve(dataDir, 'config.json'), 'utf8'));
    const progress = JSON.parse(readFileSync(resolve(dataDir, 'progress.json'), 'utf8'));
    const messages = JSON.parse(readFileSync(resolve(dataDir, 'messages.json'), 'utf8'));

    // Merge env vars into config
    config.chatId = chatId;
    config.botToken = botToken;

    // Send the nudge
    const result = await sendDailyNudge(config, progress, messages);

    console.log('Nudge result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Nudge runner error:', error.message);
  }

  // Always exit 0 — don't fail the workflow
  process.exit(0);
}

main();
