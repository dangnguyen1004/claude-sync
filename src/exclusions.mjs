import os from 'node:os';
import path from 'node:path';

/**
 * Directory names inside ~/.claude/ that are always excluded from exports.
 * These are runtime-generated, ephemeral, or machine-specific directories.
 * @type {Set<string>}
 */
export const ALWAYS_EXCLUDED_NAMES = new Set([
  'cache',
  'statsig',
  'debug',
  'file-history',
  'session-env',
  'shell-snapshots',
  'backups',
  'telemetry',
  'paste-cache',
  'ide',
]);

/**
 * The OAuth token file path. Lives at $HOME/.claude.json (NOT inside ~/.claude/).
 * Must always be excluded from exports for security (EXP-11, SEC-02).
 * @type {string}
 */
export const OAUTH_FILE = path.join(os.homedir(), '.claude.json');

/**
 * Default data types included in an export (opt-in required for conversations).
 * @type {string[]}
 */
export const DEFAULT_TYPES = [
  'skills',
  'rules',
  'hooks',
  'commands',
  'agents',
  'instructions',
  'keybindings',
];

/**
 * All recognized data type names, including conversations (which is opt-in only).
 * @type {string[]}
 */
export const ALL_TYPES = [...DEFAULT_TYPES, 'conversations'];

/**
 * Determines whether an absolute file path should be excluded from exports.
 *
 * A path is excluded if its first segment relative to ~/.claude/ is one of
 * the always-excluded directory names.
 *
 * @param {string} absolutePath - The absolute filesystem path to check
 * @returns {boolean} true if the path should be excluded from exports
 */
export function isExcluded(absolutePath) {
  const claudeHome = path.join(os.homedir(), '.claude');
  const relativePath = path.relative(claudeHome, absolutePath);

  // If the path is outside ~/.claude/, it's not excluded by this function
  if (relativePath.startsWith('..')) {
    return false;
  }

  // Get the first path segment (top-level directory name)
  const segments = relativePath.split(path.sep);
  const topLevel = segments[0];

  return ALWAYS_EXCLUDED_NAMES.has(topLevel);
}

/**
 * Resolves which data types to include in an export operation.
 *
 * Rules:
 * - If `include` is provided, return exactly those types (validates all names)
 * - If `exclude` is provided, return DEFAULT_TYPES minus excluded types (validates all names)
 * - If neither, return DEFAULT_TYPES
 * - 'conversations' is never in DEFAULT_TYPES; must be explicitly included
 *
 * @param {{ include?: string[], exclude?: string[] }} [options]
 * @returns {string[]} Resolved list of type names to include
 * @throws {Error} If any type name is not in ALL_TYPES
 */
export function resolveScope({ include, exclude } = {}) {
  if (include !== undefined) {
    for (const t of include) {
      if (!ALL_TYPES.includes(t)) {
        throw new Error(`Unknown type: "${t}". Valid types are: ${ALL_TYPES.join(', ')}`);
      }
    }
    return include;
  }

  if (exclude !== undefined) {
    for (const t of exclude) {
      if (!ALL_TYPES.includes(t)) {
        throw new Error(`Unknown type: "${t}". Valid types are: ${ALL_TYPES.join(', ')}`);
      }
    }
    return DEFAULT_TYPES.filter((t) => !exclude.includes(t));
  }

  return DEFAULT_TYPES;
}
