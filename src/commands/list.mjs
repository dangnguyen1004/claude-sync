import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readManifestFromArchive } from '../unpacker.mjs';
import { DEFAULT_TYPES } from '../exclusions.mjs';

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
 * Lists the contents of a claude-sync archive by reading the manifest
 * WITHOUT extracting any files from the archive.
 *
 * @param {string | undefined} archiveArg - Path to the .tar.gz archive
 * @param {{}} [_options]
 * @returns {Promise<void>}
 */
export async function runList(archiveArg, _options = {}) {
  // Validate archiveArg
  if (!archiveArg) {
    console.error(chalk.red('Error: archive path required'));
    console.error(chalk.dim('Usage: claude-sync list <archive.tar.gz>'));
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

  // Read manifest without extracting
  let manifest;
  try {
    manifest = await readManifestFromArchive(archivePath);
  } catch (err) {
    console.error(chalk.red(`Invalid archive: ${err.message}`));
    process.exitCode = 1;
    return;
  }

  const archiveName = path.basename(archivePath);
  const exportedDate = manifest.exported_at ? manifest.exported_at.slice(0, 10) : 'unknown';

  console.log(`Archive: ${archiveName}`);
  console.log(`Exported: ${exportedDate}  |  Source: ${manifest.source_platform || 'unknown'}`);
  console.log();

  // Group manifest.files by type based on path prefix
  const filesByType = {};
  for (const file of manifest.files) {
    let type = null;
    for (const t of [...DEFAULT_TYPES, 'conversations']) {
      const prefix = TYPE_LABELS[t]?.replace(/\/$/, '');
      if (prefix && (file.path === prefix || file.path.startsWith(prefix + '/') || file.path.startsWith(prefix))) {
        type = t;
        break;
      }
    }
    // Special cases
    if (file.path === 'CLAUDE.md') type = 'instructions';
    if (file.path === 'settings.json') type = 'hooks';
    if (file.path === 'keybindings.json') type = 'keybindings';

    if (type) {
      if (!filesByType[type]) filesByType[type] = [];
      filesByType[type].push(file);
    }
  }

  // Print each type in order
  for (const typeName of [...DEFAULT_TYPES, 'conversations']) {
    const label = TYPE_LABELS[typeName] ?? typeName;
    const paddedLabel = label.padEnd(14);

    if (typeName === 'conversations' && !manifest.included_types?.includes('conversations')) {
      console.log(
        chalk.dim('  — ') + chalk.dim(paddedLabel) + chalk.dim('(not included)'),
      );
      continue;
    }

    const typeFiles = filesByType[typeName];

    if (!manifest.included_types?.includes(typeName)) {
      // Not included in this export
      console.log(
        chalk.dim('  — ') + paddedLabel + chalk.dim('(not included)'),
      );
    } else if (!typeFiles || typeFiles.length === 0) {
      // Included but no files found
      console.log(
        chalk.dim('  — ') + paddedLabel + chalk.dim('(not found)'),
      );
    } else if (DIRECTORY_TYPES.has(typeName)) {
      const count = typeFiles.length;
      console.log(
        chalk.green('  ✓ ') + paddedLabel + chalk.dim(`(${count} ${count === 1 ? 'file' : 'files'})`),
      );
    } else {
      // File type: show 'found'
      console.log(
        chalk.green('  ✓ ') + paddedLabel + chalk.dim('(found)'),
      );
    }
  }
}
