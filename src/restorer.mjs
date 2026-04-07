import * as tar from 'tar';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';

/**
 * Runs the import pipeline: extracts archive to staging dir, then copies files
 * to the target directory with conflict detection and dry-run support.
 *
 * @param {string} archivePath - Path to the .tar.gz archive
 * @param {{ claudeDir?: string, force?: boolean, dryRun?: boolean }} [options]
 * @returns {Promise<{ success: boolean, restoredCount?: number, conflictCount?: number, conflict?: { file: string, existingContent: string }}>}
 */
export async function runRestore(archivePath, options = {}) {
  const targetDir = options.claudeDir ?? path.join(os.homedir(), '.claude');
  const stagingDir = path.join(os.tmpdir(), 'claude-sync-import-' + Date.now());

  // Extract archive to staging dir
  await fs.mkdir(stagingDir, { recursive: true });
  try {
    // SEC-03: validate entry paths during extraction to prevent path traversal
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

    const manifestPath = path.join(stagingDir, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

    let restoredCount = 0;
    let conflictCount = 0;

    // Dry-run results for summary
    const dryRunResults = [];

    for (const file of manifest.files) {
      const destPath = path.join(targetDir, file.path);
      const exists = await fs
        .access(destPath)
        .then(() => true)
        .catch(() => false);

      if (options.dryRun) {
        if (exists) {
          dryRunResults.push({ path: file.path, label: 'CONFLICT' });
        } else {
          dryRunResults.push({ path: file.path, label: 'NEW' });
        }
        continue;
      }

      if (exists && !options.force) {
        // Return first conflict to caller — caller handles prompting
        const existingContent = await fs.readFile(destPath, 'utf-8');
        return {
          success: false,
          conflict: true,
          file: file.path,
          existingContent,
        };
      }

      // Ensure parent directory exists
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      // Copy from staging to destination
      await fs.copyFile(path.join(stagingDir, file.path), destPath);
      restoredCount++;
    }

    if (options.dryRun) {
      return { success: true, dryRunResults, restoredCount: 0, conflictCount: 0 };
    }

    return { success: true, restoredCount, conflictCount };
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
}
