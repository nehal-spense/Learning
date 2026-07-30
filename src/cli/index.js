/**
 * CLI Tool for the Daily Learning Nudge system.
 * Usage: node src/cli/index.js <command> [args]
 *
 * Commands:
 *   new [date]      - Scaffold a new learning entry (date in YYYY-MM-DD, defaults to today)
 *   validate <file> - Validate a learning entry file's frontmatter
 *   progress        - Display current learning progress summary
 *   record [file]   - Validate and record a completed entry
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEntry, buildFilePath } from '../folders/manager.js';
import { validateEntry } from '../shared/validators.js';
import { loadProgress, saveProgress, recordCompletion, calculateStreak, calculateAnalytics } from '../progress/tracker.js';
import { loadConfig } from '../config/manager.js';
import { formatDate } from '../shared/date-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const PROGRESS_PATH = path.join(DATA_DIR, 'progress.json');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

/**
 * Parse YAML-like frontmatter from a markdown file content.
 * Extracts content between --- markers and parses key: value lines.
 * @param {string} content - Raw file content
 * @returns {object|null} Parsed frontmatter fields, or null if no frontmatter found
 */
function parseFrontmatter(content) {
  const lines = content.split('\n');

  // First line must be '---'
  if (lines[0].trim() !== '---') {
    return null;
  }

  // Find closing '---'
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return null;
  }

  const frontmatterLines = lines.slice(1, endIndex);
  const result = {};

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Try to parse as number
    if (value !== '' && !isNaN(value)) {
      result[key] = Number(value);
    } else if (value === '' || value === '""' || value === "''") {
      result[key] = '';
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Command: new [date]
 * Scaffold a new learning entry for the given date or today.
 */
function commandNew(dateArg) {
  let date;

  if (dateArg) {
    // Validate YYYY-MM-DD format
    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!dateRegex.test(dateArg)) {
      console.error('Error: Invalid date format. Use YYYY-MM-DD.');
      process.exit(1);
    }
    // Parse as local date
    const [year, month, day] = dateArg.split('-').map(Number);
    date = new Date(year, month - 1, day);
  } else {
    date = new Date();
  }

  try {
    const result = createEntry(PROJECT_ROOT, date);
    console.log(result.path);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Command: validate <file>
 * Read the file, parse YAML frontmatter, validate fields.
 */
function commandValidate(filePath) {
  if (!filePath) {
    console.error('Error: Please provide a file path to validate.');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`);
    process.exit(1);
  }

  let content;
  try {
    content = fs.readFileSync(resolvedPath, 'utf8');
  } catch (error) {
    console.error(`Error: Could not read file: ${error.message}`);
    process.exit(1);
  }

  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    console.error('Error: No valid frontmatter found (expected --- markers).');
    process.exit(1);
  }

  const entry = {
    date: frontmatter.date != null ? String(frontmatter.date) : undefined,
    topic: frontmatter.topic != null ? String(frontmatter.topic) : undefined,
    category: frontmatter.category != null ? String(frontmatter.category) : undefined,
    time_spent: frontmatter.time_spent != null ? frontmatter.time_spent : undefined,
  };

  const result = validateEntry(entry);

  if (result.valid) {
    console.log('Valid entry!');
  } else {
    console.log('Validation errors:');
    for (const error of result.errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }
}

/**
 * Command: progress
 * Display a formatted progress summary.
 */
function commandProgress() {
  const progress = loadProgress(PROGRESS_PATH);
  const config = loadConfig(CONFIG_PATH);
  const today = formatDate(new Date());

  const streak = calculateStreak(progress, config, today);
  const analytics = calculateAnalytics(progress, config, today);

  console.log('📊 Learning Progress');
  console.log('━━━━━━━━━━━━━━━━━━━');
  console.log(`🔥 Current Streak: ${streak.current} days`);
  console.log(`🏆 Longest Streak: ${streak.longest} days`);
  console.log(`📚 Total Entries: ${progress.totalEntries}`);
  console.log(`📈 7-Day Rate: ${analytics.completionRate7d}%`);
  console.log(`📈 30-Day Rate: ${analytics.completionRate30d}%`);
  console.log(`⏱️  Avg Time: ${analytics.averageTimeSpent} min`);
  console.log(`🛡️  Recovery Days Left: ${streak.recoveryDaysRemaining}`);
}

/**
 * Command: record [file]
 * Validate an entry file and record its completion in progress.
 */
function commandRecord(fileArg) {
  let filePath;

  if (fileArg) {
    filePath = path.resolve(fileArg);
  } else {
    // Default to today's entry path
    filePath = buildFilePath(PROJECT_ROOT, new Date());
  }

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error: Could not read file: ${error.message}`);
    process.exit(1);
  }

  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    console.error('Error: No valid frontmatter found (expected --- markers).');
    process.exit(1);
  }

  const entry = {
    date: frontmatter.date != null ? String(frontmatter.date) : undefined,
    topic: frontmatter.topic != null ? String(frontmatter.topic) : undefined,
    category: frontmatter.category != null ? String(frontmatter.category) : undefined,
    time_spent: frontmatter.time_spent != null ? frontmatter.time_spent : undefined,
  };

  const validation = validateEntry(entry);

  if (!validation.valid) {
    console.error('Validation errors:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  // Record the completion
  const progress = loadProgress(PROGRESS_PATH);
  const config = loadConfig(CONFIG_PATH);
  const timestamp = new Date().toISOString();
  const entryDate = String(frontmatter.date);

  const updatedProgress = recordCompletion(progress, entryDate, timestamp);
  saveProgress(PROGRESS_PATH, updatedProgress);

  // Calculate and display updated streak
  const today = formatDate(new Date());
  const streak = calculateStreak(updatedProgress, config, today);
  console.log(`✅ Entry recorded! Current streak: ${streak.current} days`);
}

// --- Main CLI dispatcher ---

const [,, command, ...args] = process.argv;

switch (command) {
  case 'new':
    commandNew(args[0]);
    break;
  case 'validate':
    commandValidate(args[0]);
    break;
  case 'progress':
    commandProgress();
    break;
  case 'record':
    commandRecord(args[0]);
    break;
  default:
    console.log(`Usage: node src/cli/index.js <command> [args]

Commands:
  new [date]      Scaffold a new learning entry (YYYY-MM-DD, defaults to today)
  validate <file> Validate a learning entry file
  progress        Show current learning progress
  record [file]   Record a completed entry (defaults to today's entry)`);
    if (command) {
      process.exit(1);
    }
    break;
}
