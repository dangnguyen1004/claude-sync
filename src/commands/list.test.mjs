import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runList } from './list.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runExport } from './export.mjs';

const FIXTURES = path.join(process.cwd(), 'test/fixtures/claude-home');

let tmpDir;
let testArchive;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'list-test-'));
  testArchive = path.join(tmpDir, 'test-archive.tar.gz');
  await runExport(testArchive, { claudeDir: FIXTURES });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  process.exitCode = 0;
});

describe('runList', () => {
  it('prints archive filename and export date', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    await runList(testArchive, {});

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allOutput).toContain('Archive: test-archive.tar.gz');
    expect(allOutput).toContain('Exported:');
  });

  it('prints included types with file counts', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    await runList(testArchive, {});

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    // Skills should show a count
    expect(allOutput).toContain('skills/');
    // All default types should appear
    expect(allOutput).toContain('rules/');
    expect(allOutput).toContain('commands/');
    expect(allOutput).toContain('agents/');
    expect(allOutput).toContain('CLAUDE.md');
    expect(allOutput).toContain('keybindings');
    expect(allOutput).toContain('hooks');
  });

  it('shows (not included) for conversations when not in included_types', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    await runList(testArchive, {});

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allOutput).toContain('projects/');
    expect(allOutput).toContain('not included');
  });

  it('prints error when archive path is not provided', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    await runList(undefined, {});

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('archive path required'),
    );
  });

  it('prints error when archive does not exist', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    await runList('/nonexistent/archive.tar.gz', {});

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Archive not found'),
    );
  });

  it('prints error when archive is invalid (missing manifest)', async () => {
    // Create an archive with no manifest
    const emptyArchive = path.join(tmpDir, 'no-manifest.tar.gz');
    const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'no-manifest-'));
    await fs.writeFile(path.join(stageDir, 'some-file.txt'), 'content');
    const { create } = await import('tar');
    await create({ gzip: true, file: emptyArchive, cwd: stageDir, portable: true }, ['.']);
    await fs.rm(stageDir, { recursive: true, force: true });

    const consoleErrorSpy = vi.spyOn(console, 'error');
    await runList(emptyArchive, {});

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid archive'),
    );
  });

  it('shows file counts for directory types', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    await runList(testArchive, {});

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    // Skills is a directory type — should show "(N files)"
    expect(allOutput).toMatch(/\(\d+ files?\)/);
  });

  it('shows (found) for single-file types', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    await runList(testArchive, {});

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    // hooks/settings is a file type — should show "(found)"
    expect(allOutput).toContain('(found)');
  });
});
