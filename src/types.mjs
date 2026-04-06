/**
 * @typedef {Object} ScannedFile
 * @property {string} absPath - Absolute filesystem path
 * @property {string} relativePath - Path relative to ~/.claude/
 * @property {number} size - File size in bytes
 * @property {string} checksum - SHA-256 checksum prefixed with 'sha256:'
 * @property {string} type - Data type name (skills, rules, hooks, commands, agents, instructions, keybindings)
 */

/**
 * @typedef {Object} ManifestFile
 * @property {string} path - Relative path in archive
 * @property {number} size - File size in bytes
 * @property {string} checksum - SHA-256 checksum prefixed with 'sha256:'
 */

/**
 * @typedef {Object} Manifest
 * @property {string} version - Tool version
 * @property {string} tool - Always 'claude-sync'
 * @property {string} exported_at - ISO 8601 timestamp
 * @property {string} source_platform - process.platform value
 * @property {string} source_home - Source machine home directory (os.homedir()) recorded at export time; used by import to rewrite hook paths
 * @property {string[]} included_types - Data type names included
 * @property {ManifestFile[]} files - Per-file metadata
 * @property {{ oauth_file: string, runtime_dirs: string[] }} excluded - What was excluded
 */

export {};
