import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runExport } from './export.mjs';
import * as tar from 'tar';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const FIXTURES = path.join(process.cwd(), 'test/fixtures/claude-home');

let tmpDir;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'export-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

/**
 * Lists all entries in a tar.gz archive, normalizing leading './' prefixes.
 */
async function listArchiveEntries(archivePath) {
  const entries = [];
  await tar.list({
    file: archivePath,
    onReadEntry: (entry) => entries.push(entry.path.replace(/^\.\//, '')),
  });
  return entries;
}

/**
 * Extracts manifest.json from a tar.gz archive and parses it.
 */
async function readManifestFromArchive(archivePath) {
  const extractDir = path.join(os.tmpdir(), 'manifest-extract-' + Date.now());
  await fs.mkdir(extractDir, { recursive: true });
  try {
    await tar.extract({ file: archivePath, cwd: extractDir, strip: 0 });
    const content = await fs.readFile(path.join(extractDir, 'manifest.json'), 'utf-8');
    return JSON.parse(content);
  } finally {
    await fs.rm(extractDir, { recursive: true, force: true });
  }
}

describe('runExport — full pipeline integration', () => {
  it('produces a valid tar.gz archive', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    await runExport(outputPath, { claudeDir: FIXTURES });
    const stat = await fs.stat(outputPath);
    expect(stat.isFile()).toBe(true);
    expect(outputPath.endsWith('.tar.gz')).toBe(true);
  });

  it('archive contains manifest.json', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    await runExport(outputPath, { claudeDir: FIXTURES });
    const entries = await listArchiveEntries(outputPath);
    expect(entries).toContain('manifest.json');
  });

  it('archive contains all default data type files', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    await runExport(outputPath, { claudeDir: FIXTURES });
    const entries = await listArchiveEntries(outputPath);

    // All 7 default types should be present from fixtures
    expect(entries).toContain('skills/test-skill.md');
    expect(entries).toContain('rules/test-rule.md');
    expect(entries).toContain('commands/test-command.md');
    expect(entries).toContain('agents/test-agent.md');
    expect(entries).toContain('CLAUDE.md');
    expect(entries).toContain('keybindings.json');
    expect(entries).toContain('settings.json');
  });

  it('archive does NOT contain excluded runtime directories', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    await runExport(outputPath, { claudeDir: FIXTURES });
    const entries = await listArchiveEntries(outputPath);

    // Verify excluded runtime dirs are absent
    const excluded = entries.filter(
      (e) =>
        e.startsWith('cache/') ||
        e.startsWith('debug/') ||
        e.startsWith('statsig/') ||
        e.startsWith('file-history/') ||
        e.startsWith('session-env/') ||
        e.startsWith('shell-snapshots/'),
    );
    expect(excluded).toHaveLength(0);
  });

  it('no archive entry starts with / (SEC-02)', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    await runExport(outputPath, { claudeDir: FIXTURES });
    const rawEntries = [];
    await tar.list({
      file: outputPath,
      onReadEntry: (entry) => rawEntries.push(entry.path),
    });
    for (const entry of rawEntries) {
      expect(entry.startsWith('/')).toBe(false);
    }
  });

  it('manifest.json has correct structure', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    await runExport(outputPath, { claudeDir: FIXTURES });
    const manifest = await readManifestFromArchive(outputPath);

    expect(manifest.tool).toBe('claude-sync');
    expect(manifest.version).toBe('0.1.0');
    expect(Array.isArray(manifest.files)).toBe(true);
    expect(manifest.files.length).toBeGreaterThanOrEqual(7);
    expect(manifest.excluded.oauth_file).toContain('.claude.json');
  });

  it('respects --include flag (only exports specified types)', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    await runExport(outputPath, { include: 'skills', claudeDir: FIXTURES });
    const entries = await listArchiveEntries(outputPath);

    // Only manifest.json and skills/test-skill.md should be present (excluding directory entries)
    const contentEntries = entries.filter(
      (e) => e !== 'manifest.json' && e !== '' && !e.endsWith('/'),
    );
    expect(contentEntries).toHaveLength(1);
    expect(entries).toContain('skills/test-skill.md');
    expect(entries).not.toContain('rules/test-rule.md');
    expect(entries).not.toContain('settings.json');
  });

  it('respects --exclude flag (omits specified types)', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    await runExport(outputPath, { exclude: 'hooks', claudeDir: FIXTURES });
    const entries = await listArchiveEntries(outputPath);

    // hooks maps to settings.json — must NOT be in archive
    expect(entries).not.toContain('settings.json');
    // Other types should still be present
    expect(entries).toContain('skills/test-skill.md');
    expect(entries).toContain('rules/test-rule.md');
  });

  it('default output filename matches date pattern when no output arg given', async () => {
    // Change CWD to tmpDir so the default output lands there
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      await runExport(undefined, { claudeDir: FIXTURES });
    } finally {
      process.chdir(originalCwd);
    }

    const files = await fs.readdir(tmpDir);
    const archiveFile = files.find((f) => f.endsWith('.tar.gz'));
    expect(archiveFile).toBeDefined();
    expect(archiveFile).toMatch(/^claude-sync-\d{4}-\d{2}-\d{2}\.tar\.gz$/);
  });

  it('prints OAuth exclusion notice to console', async () => {
    const outputPath = path.join(tmpDir, 'test-output.tar.gz');
    const consoleSpy = vi.spyOn(console, 'log');
    await runExport(outputPath, { claudeDir: FIXTURES });
    const allOutput = consoleSpy.mock.calls.flat().join('\n');
    expect(allOutput).toContain('~/.claude.json excluded');
  });
});
