import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readManifestFromArchive, listArchiveEntries } from './unpacker.mjs';
import * as tar from 'tar';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runExport } from './commands/export.mjs';

const FIXTURES = path.join(process.cwd(), 'test/fixtures/claude-home');

let tmpDir;
let testArchive;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unpacker-test-'));
  // Build a test archive from fixtures
  testArchive = path.join(tmpDir, 'test-archive.tar.gz');
  await runExport(testArchive, { claudeDir: FIXTURES });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('readManifestFromArchive', () => {
  it('reads and parses manifest.json from an archive', async () => {
    const manifest = await readManifestFromArchive(testArchive);

    expect(manifest.tool).toBe('claude-sync');
    expect(manifest.version).toBe('0.1.0');
    expect(Array.isArray(manifest.files)).toBe(true);
    expect(Array.isArray(manifest.included_types)).toBe(true);
    expect(manifest.excluded).toBeDefined();
  });

  it('includes source_home in the manifest', async () => {
    const manifest = await readManifestFromArchive(testArchive);

    expect(typeof manifest.source_home).toBe('string');
    expect(manifest.source_home.length).toBeGreaterThan(0);
  });

  it('throws when archive does not contain manifest.json', async () => {
    // Create an archive with no manifest.json
    const emptyArchive = path.join(tmpDir, 'no-manifest.tar.gz');
    const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-manifest-stage-'));
    await tar.create(
      { gzip: true, file: emptyArchive, cwd: stageDir, portable: true },
      ['.'],
    );
    await fs.rm(stageDir, { recursive: true, force: true });

    await expect(readManifestFromArchive(emptyArchive)).rejects.toThrow(
      'Invalid archive: manifest.json not found',
    );
  });

  it('throws when archive file does not exist', async () => {
    await expect(readManifestFromArchive('/nonexistent/archive.tar.gz')).rejects.toThrow();
  });
});

describe('listArchiveEntries', () => {
  it('returns an array of entry paths', async () => {
    const entries = await listArchiveEntries(testArchive);

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('strips leading ./ from entry paths', async () => {
    const entries = await listArchiveEntries(testArchive);

    for (const entry of entries) {
      expect(entry.startsWith('./')).toBe(false);
    }
  });

  it('includes manifest.json in entries', async () => {
    const entries = await listArchiveEntries(testArchive);

    expect(entries).toContain('manifest.json');
  });

  it('includes all exported files in entries', async () => {
    const entries = await listArchiveEntries(testArchive);

    expect(entries).toContain('skills/test-skill.md');
    expect(entries).toContain('rules/test-rule.md');
    expect(entries).toContain('commands/test-command.md');
    expect(entries).toContain('agents/test-agent.md');
  });
});
