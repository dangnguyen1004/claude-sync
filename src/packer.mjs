import * as tar from 'tar';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ALWAYS_EXCLUDED_NAMES } from './exclusions.mjs';

/**
 * Creates a tar.gz archive by streaming files directly from claudeDir —
 * no staging directory copy needed. This avoids doubling disk I/O for
 * large conversation directories (EXP-08).
 *
 * @param {import('./types.mjs').ScannedFile[]} scannedFiles
 * @param {string} outputPath - Destination path for the .tar.gz file
 * @param {import('./types.mjs').Manifest} manifest
 * @param {string} claudeDir - Source claude directory
 * @returns {Promise<void>}
 */
export async function createArchiveStreaming(scannedFiles, outputPath, manifest, claudeDir) {
  const manifestPath = path.join(claudeDir, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  try {
    const relativePaths = scannedFiles.map((f) => f.relativePath);
    await tar.create(
      {
        gzip: true,
        file: outputPath,
        cwd: claudeDir,
        portable: true,
      },
      ['manifest.json', ...relativePaths],
    );
  } finally {
    await fs.unlink(manifestPath).catch(() => {});
  }
}

/**
 * Builds a manifest object from scanned files.
 *
 * @param {import('./types.mjs').ScannedFile[]} scannedFiles
 * @param {string[]} includedTypes - Data type names included in this export
 * @returns {import('./types.mjs').Manifest}
 */
export function buildManifest(scannedFiles, includedTypes) {
  return {
    version: '0.1.0',
    tool: 'claude-sync',
    exported_at: new Date().toISOString(),
    source_platform: process.platform,
    source_home: os.homedir(),
    included_types: includedTypes,
    files: scannedFiles.map((f) => ({
      path: f.relativePath,
      size: f.size,
      checksum: f.checksum,
    })),
    excluded: {
      oauth_file: '~/.claude.json (always excluded — contains OAuth tokens)',
      runtime_dirs: Array.from(ALWAYS_EXCLUDED_NAMES),
    },
  };
}

/**
 * Creates a tar.gz archive at outputPath containing all scanned files and the manifest.
 *
 * Uses a staging directory approach to guarantee relative paths (SEC-02).
 * Uses atomic write (tmp + rename) to ensure no partial archive is left on disk.
 * Streaming only — all file operations use fs/promises or kernel-level copy (EXP-13).
 *
 * @param {import('./types.mjs').ScannedFile[]} scannedFiles
 * @param {string} outputPath - Destination path for the .tar.gz file
 * @param {import('./types.mjs').Manifest} manifest
 * @param {string} _claudeDir - Source claude directory (unused — absPath used directly)
 * @returns {Promise<void>}
 */
export async function createArchive(scannedFiles, outputPath, manifest, _claudeDir) {
  const tmpOutput = outputPath + '.tmp';
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-sync-stage-'));

  try {
    // Write manifest.json into staging root
    await fs.writeFile(
      path.join(stageDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );

    // Copy each scanned file into staging directory preserving relative path
    for (const f of scannedFiles) {
      const destPath = path.join(stageDir, f.relativePath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.copyFile(f.absPath, destPath);
    }

    // Create archive from staging dir — cwd:stageDir + ['.'] guarantees relative paths (SEC-02)
    await tar.create(
      {
        gzip: true,
        file: tmpOutput,
        cwd: stageDir,
        portable: true,
      },
      ['.'],
    );

    // Atomic rename: only visible on disk after success
    await fs.rename(tmpOutput, outputPath);
  } finally {
    // Always clean up staging dir, even on error
    await fs.rm(stageDir, { recursive: true, force: true });
    // Clean up .tmp file if rename didn't happen (error path)
    await fs.rm(tmpOutput, { force: true });
  }
}
