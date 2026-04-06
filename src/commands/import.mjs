import chalk from 'chalk';
import ora from 'ora';
import { confirm } from '@inquirer/prompts';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as tar from 'tar';
import { readManifestFromArchive } from '../unpacker.mjs';

/**
 * Expands a leading tilde to the user's home directory.
 * @param {string} p
 * @returns {string}
 */
function expandTilde(p) {
  if (p === '~' || p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Rewrites hook paths in settings.json content from sourceHome to targetHome.
 * Only rewrites "command": "<path>" values that start with sourceHome.
 *
 * @param {string} content - settings.json file content
 * @param {string} sourceHome - Original home directory path
 * @param {string} targetHome - Target home directory path
 * @returns {{ content: string, count: number }}
 */
function rewriteHookPaths(content, sourceHome, targetHome) {
  const pattern = /"command"\s*:\s*"([^"]*)"/g;
  let count = 0;
  const newContent = content.replace(pattern, (_, cmd) => {
    if (cmd.startsWith(sourceHome)) {
      count++;
      const newCmd = targetHome + cmd.slice(sourceHome.length);
      return `"command": "${newCmd}"`;
    }
    return `"command": "${cmd}"`;
  });
  return { content: newContent, count };
}

/**
 * Extracts an archive to a staging directory with SEC-03 path traversal validation.
 *
 * @param {string} archivePath
 * @param {string} stagingDir
 * @returns {Promise<void>}
 */
async function extractToStaging(archivePath, stagingDir) {
  await tar.extract({
    file: archivePath,
    cwd: stagingDir,
    onReadEntry: (entry) => {
      const resolved = path.resolve(stagingDir, entry.path);
      if (!resolved.startsWith(stagingDir)) {
        throw new Error(`SEC-03: Attempted path traversal attack in archive entry: ${entry.path}`);
      }
    },
  });
}

/**
 * Runs the import pipeline:
 * - Validates and reads the archive manifest
 * - Extracts to a staging directory
 * - Applies hook path rewriting to settings.json if needed
 * - Backs up existing files that will be overwritten
 * - Restores files with per-file conflict prompts (unless --force)
 * - Supports --dry-run to preview all changes without writing
 *
 * @param {string | undefined} archiveArg - Path to the .tar.gz archive
 * @param {{ force?: boolean, dryRun?: boolean, claudeDir?: string }} [options]
 * @returns {Promise<void>}
 */
export async function runImport(archiveArg, options = {}) {
  // Validate archiveArg
  if (!archiveArg) {
    console.error(chalk.red('Error: archive path required'));
    console.error(chalk.dim('Usage: claude-sync import <archive.tar.gz> [--force] [--dry-run]'));
    process.exitCode = 1;
    return;
  }

  const archivePath = expandTilde(path.resolve(archiveArg));

  // Verify archive exists
  try {
    await fs.access(archivePath);
  } catch {
    console.error(chalk.red(`Archive not found: ${archivePath}`));
    process.exitCode = 1;
    return;
  }

  const claudeDir = options.claudeDir ?? path.join(os.homedir(), '.claude');

  // Read manifest to validate archive and get file list
  let manifest;
  try {
    manifest = await readManifestFromArchive(archivePath);
  } catch (err) {
    console.error(chalk.red(`Invalid archive: ${err.message}`));
    process.exitCode = 1;
    return;
  }

  // Create staging directory and extract archive
  const stagingDir = path.join(os.tmpdir(), 'claude-sync-import-' + Date.now());
  await fs.mkdir(stagingDir, { recursive: true });

  // --- Phase 1: Read and extract archive ---
  const extractSpinner = ora('Reading archive...').start();
  try {
    await extractToStaging(archivePath, stagingDir);
    extractSpinner.succeed(chalk.green('Archive verified'));
  } catch (err) {
    extractSpinner.fail(chalk.red('Archive extraction failed: ' + err.message));
    process.exitCode = 1;
    return;
  }

  // --- Hook path rewriting (IMP-04) ---
  let hookRewriteCount = 0;
  if (manifest.source_home && manifest.source_home !== os.homedir()) {
    const settingsPath = path.join(stagingDir, 'settings.json');
    try {
      const content = await fs.readFile(settingsPath, 'utf-8');
      const { content: rewritten, count } = rewriteHookPaths(content, manifest.source_home, os.homedir());
      hookRewriteCount = count;
      if (count > 0) {
        await fs.writeFile(settingsPath, rewritten, 'utf-8');
        console.log(
          chalk.dim(`  Rewrote ${count} hook paths: ${manifest.source_home} → ${os.homedir()}`),
        );
      }
    } catch {
      // settings.json may not exist — skip rewriting
    }
  }

  // --- Dry-run mode ---
  if (options.dryRun) {
    console.log(chalk.bold('Dry-run: no files will be written\n'));

    let newCount = 0;
    let conflictCount = 0;

    for (const file of manifest.files) {
      const destPath = path.join(claudeDir, file.path);
      const exists = await fs.access(destPath).then(() => true).catch(() => false);
      if (exists) {
        console.log(
          chalk.yellow('  ! ') + file.path + chalk.dim(' (conflict — would overwrite)'),
        );
        conflictCount++;
      } else {
        console.log(chalk.green('  + ') + file.path + chalk.dim(' (new)'));
        newCount++;
      }
    }

    console.log(
      chalk.dim(
        `\n  ${newCount} new, ${conflictCount} conflict${conflictCount === 1 ? '' : 's'}`,
      ),
    );
    return;
  }

  // --- Phase 2: Backup and restore ---
  const importSpinner = ora('Importing...').start();

  try {
    // Collect all existing files that will be overwritten
    const filesToOverwrite = [];
    for (const file of manifest.files) {
      const destPath = path.join(claudeDir, file.path);
      try {
        await fs.access(destPath);
        filesToOverwrite.push(file.path);
      } catch {
        // File doesn't exist — no conflict
      }
    }

    // Per-file prompts for conflicts (only if not --force)
    /** @type {Set<string>} */
    const skipFiles = new Set();
    if (!options.force && filesToOverwrite.length > 0) {
      console.log();
      for (const filePath of filesToOverwrite) {
        const answer = await confirm({
          message: `Overwrite ${filePath}?`,
          default: false,
        });
        if (!answer) {
          skipFiles.add(filePath);
          console.log(chalk.dim(`  Skipped: ${filePath}`));
        }
      }
    }

    // --- Backup all files that will be overwritten (IMP-05) ---
    if (filesToOverwrite.length > 0) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const backupDir = path.join(claudeDir, 'backups', timestamp);
      const backupSpinner = ora(`Backing up ${filesToOverwrite.length} file(s)...`).start();

      try {
        for (const relPath of filesToOverwrite) {
          if (skipFiles.has(relPath)) continue;
          const srcPath = path.join(claudeDir, relPath);
          const backupPath = path.join(backupDir, relPath);
          await fs.mkdir(path.dirname(backupPath), { recursive: true });
          await fs.copyFile(srcPath, backupPath);
        }
        backupSpinner.succeed(chalk.green(`Backed up ${filesToOverwrite.length} files`));
      } catch (err) {
        backupSpinner.fail(chalk.red('Backup failed: ' + err.message));
        process.exitCode = 1;
        return;
      }
    }

    // --- Restore files from staging to target ---
    importSpinner.text = 'Restoring files...';
    let restoredCount = 0;
    for (const file of manifest.files) {
      if (skipFiles.has(file.path)) continue;
      const destPath = path.join(claudeDir, file.path);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(path.join(stagingDir, file.path), destPath);
      restoredCount++;
    }

    importSpinner.succeed(chalk.green(`Restored ${restoredCount} files`));
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
}
