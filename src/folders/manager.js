/**
 * Folder Manager for the Daily Learning Nudge system.
 * Handles directory creation, template generation, and entry file management.
 */

import fs from 'node:fs';
import path from 'node:path';
import { formatDate, formatYear, formatMonth, formatDay } from '../shared/date-utils.js';

/**
 * Build the full file path for a learning entry given a base directory and date.
 * @param {string} baseDir - Root directory (e.g., project root)
 * @param {Date} date - Target date
 * @returns {string} Full path in the form `<baseDir>/learnings/YYYY/MM/DD.md`
 */
export function buildFilePath(baseDir, date) {
  const year = formatYear(date);
  const month = formatMonth(date);
  const day = formatDay(date);
  return path.join(baseDir, 'learnings', year, month, `${day}.md`);
}

/**
 * Ensure the directory structure exists for a given date.
 * Creates `learnings/YYYY/MM/` directories under baseDir.
 * Tracks created directories for potential rollback.
 * @param {string} baseDir - Root directory
 * @param {Date} date - Target date
 * @returns {{ dirPath: string, createdDirs: string[] }} Full directory path and list of newly created dirs
 */
export function ensureDirectoryStructure(baseDir, date) {
  const year = formatYear(date);
  const month = formatMonth(date);

  const dirChain = [
    path.join(baseDir, 'learnings'),
    path.join(baseDir, 'learnings', year),
    path.join(baseDir, 'learnings', year, month),
  ];

  const createdDirs = [];

  for (const dir of dirChain) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
      createdDirs.push(dir);
    }
  }

  return { dirPath: dirChain[dirChain.length - 1], createdDirs };
}

/**
 * Generate a markdown template for a learning entry.
 * Includes YAML frontmatter with date, topic, category, time_spent
 * and body sections for Topic, Summary, Key Takeaways, and Resources.
 * @param {Date} date - The learning day date
 * @returns {string} Template content string
 */
export function generateTemplate(date) {
  const dateStr = formatDate(date);

  return `---
date: ${dateStr}
topic: ""
category: ""
time_spent: 0
---

# Learning Entry: ${dateStr}

## Topic



## Summary



## Key Takeaways

- 

## Resources

- 
`;
}

/**
 * Create a learning entry file for the given date, or return the existing path if it already exists.
 * On failure, rolls back any created directories and files.
 * @param {string} baseDir - Root directory
 * @param {Date} date - Target date
 * @returns {{ path: string, created: boolean }}
 */
export function createEntry(baseDir, date) {
  const filePath = buildFilePath(baseDir, date);

  // If file already exists, return it without modification
  if (fs.existsSync(filePath)) {
    return { path: filePath, created: false };
  }

  let createdDirs = [];
  try {
    // Create directory structure
    const result = ensureDirectoryStructure(baseDir, date);
    createdDirs = result.createdDirs;

    // Write template
    const template = generateTemplate(date);
    fs.writeFileSync(filePath, template, 'utf8');

    return { path: filePath, created: true };
  } catch (error) {
    // Rollback: remove the file if it was created
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove created directories in reverse order
    for (const dir of createdDirs.reverse()) {
      try {
        fs.rmdirSync(dir);
      } catch {
        // Directory may not be empty or already removed, skip
      }
    }

    throw new Error(`Failed to create entry: ${error.message}`);
  }
}
