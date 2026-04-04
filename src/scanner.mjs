import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { isExcluded, resolveScope } from './exclusions.mjs';

/**
 * Maps each data type name to its filesystem target within ~/.claude/.
 * @type {Record<string, { kind: 'file' | 'directory', subpath: string }>}
 */
const DATA_TYPE_MAP = {
  skills: { kind: 'directory', subpath: 'skills' },
  rules: { kind: 'directory', subpath: 'rules' },
  hooks: { kind: 'file', subpath: 'settings.json' },
  commands: { kind: 'directory', subpath: 'commands' },
  agents: { kind: 'directory', subpath: 'agents' },
  instructions: { kind: 'file', subpath: 'CLAUDE.md' },
  keybindings: { kind: 'file', subpath: 'keybindings.json' },
  conversations: { kind: 'directory', subpath: 'projects' },
};

/**
 * Computes a SHA-256 checksum for a file using streaming (never readFileSync).
 *
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} SHA-256 checksum prefixed with 'sha256:'
 */
async function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve('sha256:' + hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Checks whether a path exists on the filesystem.
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Scans the given Claude home directory and returns metadata for all
 * exportable files matching the requested scope.
 *
 * @param {string} claudeDir - Absolute path to the Claude home directory (e.g. ~/.claude/)
 * @param {{ include?: string[], exclude?: string[] }} [options]
 * @returns {Promise<import('./types.mjs').ScannedFile[]>}
 */
export async function scanExportTargets(claudeDir, { include, exclude } = {}) {
  const activeTypes = resolveScope({ include, exclude });
  /** @type {import('./types.mjs').ScannedFile[]} */
  const results = [];

  for (const type of activeTypes) {
    const entry = DATA_TYPE_MAP[type];
    if (!entry) continue;

    const fullPath = path.join(claudeDir, entry.subpath);

    if (entry.kind === 'file') {
      if (!(await pathExists(fullPath))) continue;
      const stat = await fs.stat(fullPath);
      const checksum = await hashFile(fullPath);
      results.push({
        absPath: fullPath,
        relativePath: path.relative(claudeDir, fullPath),
        size: stat.size,
        checksum,
        type,
      });
    } else {
      // kind === 'directory'
      if (!(await pathExists(fullPath))) continue;
      const dirents = await fs.readdir(fullPath, { recursive: true, withFileTypes: true });
      for (const dirent of dirents) {
        if (!dirent.isFile()) continue;
        // Node 20+ provides dirent.parentPath; fall back to dirent.path for older Node
        const parentDir = dirent.parentPath ?? dirent.path;
        const absPath = path.join(parentDir, dirent.name);
        if (isExcluded(absPath)) continue;
        const stat = await fs.stat(absPath);
        const checksum = await hashFile(absPath);
        results.push({
          absPath,
          relativePath: path.relative(claudeDir, absPath),
          size: stat.size,
          checksum,
          type,
        });
      }
    }
  }

  return results;
}
