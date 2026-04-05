import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import { scanExportTargets } from '../scanner.mjs';
import { buildManifest, createArchive } from '../packer.mjs';
import { scanForSecrets } from '../secrets.mjs';
import { DEFAULT_TYPES, OAUTH_FILE, resolveScope } from '../exclusions.mjs';

/**
 * Expands a leading tilde to the user's home directory.
 *
 * @param {string} p - A file path, potentially starting with ~
 * @returns {string} The expanded absolute path
 */
function expandTilde(p) {
  if (p === '~' || p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Generates the default output filename based on today's date.
 *
 * @returns {string} Absolute path like ./claude-sync-YYYY-MM-DD.tar.gz in CWD
 */
function generateDefaultOutput() {
  const dateStr = new Date().toISOString().slice(0, 10);
  return path.join(process.cwd(), `claude-sync-${dateStr}.tar.gz`);
}

/**
 * Formats a byte count into a human-readable string.
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Groups an array of objects by a key function.
 * Polyfill for Object.groupBy (Node 21+).
 *
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => string} keyFn
 * @returns {Record<string, T[]>}
 */
function groupBy(arr, keyFn) {
  if (typeof Object.groupBy === 'function') {
    return Object.groupBy(arr, keyFn);
  }
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

/**
 * Maps data type names to their display labels for CLI output.
 * @type {Record<string, string>}
 */
const TYPE_LABELS = {
  skills: 'skills/',
  rules: 'rules/',
  hooks: 'hooks',
  commands: 'commands/',
  agents: 'agents/',
  instructions: 'CLAUDE.md',
  keybindings: 'keybindings',
  conversations: 'projects/',
};

/**
 * Maps data type kind — directory types show file count, file types show 'found'.
 * @type {Set<string>}
 */
const DIRECTORY_TYPES = new Set(['skills', 'rules', 'commands', 'agents', 'conversations']);

/**
 * Orchestrates the full export pipeline:
 * scans ~/.claude/, builds manifest, creates tar.gz archive, and prints output.
 *
 * @param {string | undefined} outputArg - Optional output path from CLI argument
 * @param {{ include?: string, exclude?: string, claudeDir?: string, skipSecretScan?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function runExport(outputArg, options = {}) {
  // Determine output path
  const outputPath = outputArg
    ? expandTilde(path.resolve(outputArg))
    : generateDefaultOutput();

  // Parse include/exclude strings from CLI into arrays
  const parsedInclude = options.include
    ? options.include.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const parsedExclude = options.exclude
    ? options.exclude.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;

  // Validate and resolve active types (throws on unknown type names)
  let activeTypes;
  try {
    activeTypes = resolveScope({ include: parsedInclude, exclude: parsedExclude });
  } catch (err) {
    console.error(chalk.red('Error: ' + err.message));
    process.exitCode = 1;
    return;
  }

  // Determine claude home directory (options.claudeDir allows test override)
  const claudeDir = options.claudeDir ?? path.join(os.homedir(), '.claude');

  // Verify ~/.claude/ exists
  try {
    await fs.access(claudeDir);
  } catch {
    console.error(chalk.red('Claude Code directory not found: ~/.claude/'));
    process.exitCode = 1;
    return;
  }

  console.log('Exporting Claude Code environment...\n');

  // Scan all export targets
  const files = await scanExportTargets(claudeDir, {
    include: parsedInclude,
    exclude: parsedExclude,
  });

  // Group files by type
  const byType = groupBy(files, (f) => f.type);

  // Print per-type summary in DEFAULT_TYPES order, then conversations
  const allDisplayTypes = [...DEFAULT_TYPES, 'conversations'];

  for (const typeName of allDisplayTypes) {
    const label = TYPE_LABELS[typeName] ?? typeName;
    const paddedLabel = label.padEnd(14);

    if (typeName === 'conversations' && !activeTypes.includes('conversations')) {
      // Always-skipped line for conversations
      console.log(
        chalk.dim('  — ') + chalk.dim(paddedLabel) + chalk.dim('(skipped — use --include conversations to export)'),
      );
      continue;
    }

    const typeFiles = byType[typeName];

    if (!activeTypes.includes(typeName)) {
      // Explicitly excluded via --exclude or --include (not in scope)
      console.log(chalk.dim('  — ') + paddedLabel + chalk.dim('(skipped)'));
    } else if (!typeFiles || typeFiles.length === 0) {
      // In scope but not found on disk
      console.log(chalk.dim('  — ') + paddedLabel + chalk.dim('(not found)'));
    } else if (DIRECTORY_TYPES.has(typeName)) {
      // Directory type: show file count
      const count = typeFiles.length;
      console.log(
        chalk.green('  ✓ ') + paddedLabel + chalk.dim(`(${count} ${count === 1 ? 'file' : 'files'})`),
      );
    } else {
      // File type: show 'found'
      console.log(chalk.green('  ✓ ') + paddedLabel + chalk.dim('(found)'));
    }
  }

  // OAuth exclusion notice — always shown (EXP-11)
  console.log('\n  ' + chalk.yellow('⚠') + '  ~/.claude.json excluded (contains OAuth tokens)');

  // SEC-01: Scan settings.json for secrets before archiving
  if (
    !options.skipSecretScan &&
    activeTypes.includes('hooks') &&
    byType.hooks &&
    byType.hooks.length > 0
  ) {
    const settingsFile = byType.hooks.find((f) => f.relativePath === 'settings.json');
    if (settingsFile) {
      try {
        const content = await fs.readFile(settingsFile.absPath, 'utf-8');
        const findings = scanForSecrets(content);
        if (findings.length > 0) {
          console.warn(chalk.yellow('\n  Warning: Potential secrets detected in settings.json\n'));
          for (const { pattern, context } of findings) {
            console.warn(chalk.yellow('  ! ') + `${pattern}: ...${context}...`);
          }
          console.warn(
            chalk.yellow('  Archive creation aborted. Run with --skip-secret-scan to proceed anyway.\n'),
          );
          process.exitCode = 1;
          return;
        }
      } catch {
        // Could not read settings.json — skip secret scan
      }
    }
  }

  // Build manifest and create archive
  const manifest = buildManifest(files, activeTypes);
  await createArchive(files, outputPath, manifest, claudeDir);

  // Print archive summary
  const stat = await fs.stat(outputPath);
  const formattedSize = formatSize(stat.size);
  const displayPath = path.relative(process.cwd(), outputPath);

  console.log(
    '\nArchive: ' +
      chalk.bold(displayPath) +
      chalk.dim(` (${formattedSize}, ${files.length} ${files.length === 1 ? 'file' : 'files'})`),
  );
}
