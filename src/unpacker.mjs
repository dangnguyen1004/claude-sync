import * as tar from 'tar';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Reads and parses manifest.json from a claude-sync archive without performing a full extraction.
 *
 * @param {string} archivePath - Path to the .tar.gz archive
 * @returns {Promise<import('./types.mjs').Manifest>}
 */
export async function readManifestFromArchive(archivePath) {
  const extractDir = path.join(os.tmpdir(), 'claude-sync-manifest-' + Date.now());
  await fs.mkdir(extractDir, { recursive: true });
  try {
    await tar.extract({ file: archivePath, cwd: extractDir });
    const manifestPath = path.join(extractDir, 'manifest.json');
    try {
      await fs.access(manifestPath);
    } catch {
      throw new Error('Invalid archive: manifest.json not found');
    }
    const content = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(content);
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true });
  }
}

/**
 * Lists all file entries in a claude-sync archive without extracting any files.
 *
 * @param {string} archivePath - Path to the .tar.gz archive
 * @returns {Promise<string[]>}
 */
export async function listArchiveEntries(archivePath) {
  const entries = [];
  await tar.list({
    file: archivePath,
    onReadEntry: (entry) => {
      entries.push(entry.path.replace(/^\.\//, ''));
    },
  });
  return entries;
}
