import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runImport } from './import.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runExport } from './export.mjs';

const FIXTURES = path.join(process.cwd(), 'test/fixtures/claude-home');

let tmpDir;
let testArchive;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'import-test-'));
  testArchive = path.join(tmpDir, 'test-archive.tar.gz');
  await runExport(testArchive, { claudeDir: FIXTURES });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  process.exitCode = 0;
});

describe('runImport', () => {
  it('prints error when archive path is not provided', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    await runImport(undefined, { claudeDir: tmpDir });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('archive path required'),
    );
  });

  it('prints error when archive does not exist', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error');
    await runImport('/nonexistent/archive.tar.gz', { claudeDir: tmpDir });

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
    await runImport(emptyArchive, { claudeDir: tmpDir });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Invalid archive'),
    );
  });

  it('dry-run shows files without writing them', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir);

    const result = await runImport(testArchive, { claudeDir: targetDir, dryRun: true });

    // Should complete without error (exit code not set)
    expect(process.exitCode).toBeFalsy();
    // No files should be written
    const skillFile = path.join(targetDir, 'skills/test-skill.md');
    await expect(fs.access(skillFile)).rejects.toThrow();
  });

  it('dry-run labels existing files as CONFLICT and new files as NEW', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir, { recursive: true });
    await fs.mkdir(path.join(targetDir, 'skills'), { recursive: true });
    await fs.writeFile(path.join(targetDir, 'skills/test-skill.md'), 'existing');

    const consoleLogSpy = vi.spyOn(console, 'log');
    await runImport(testArchive, { claudeDir: targetDir, dryRun: true });

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allOutput).toContain('conflict — would overwrite');
    expect(allOutput).toContain('(new)');
  });

  it('force mode imports without prompting', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir);

    // Mock confirm to verify it's NOT called in force mode
    const confirmMock = vi.fn().mockResolvedValue(true);
    const { confirm } = await import('@inquirer/prompts');
    vi.spyOn({ confirm }, 'confirm', 'get').mockReturnValue(confirmMock);

    await runImport(testArchive, { claudeDir: targetDir, force: true });

    expect(confirmMock).not.toHaveBeenCalled();
    // Files should be written
    const skillFile = path.join(targetDir, 'skills/test-skill.md');
    const content = await fs.readFile(skillFile, 'utf-8');
    expect(content).toContain('Test Skill');
  });

  it('sets exit code on error', async () => {
    await runImport('/nonexistent/archive.tar.gz', { claudeDir: tmpDir });
    expect(process.exitCode).toBe(1);
    // Reset
    process.exitCode = 0;
  });

  it('creates backup directory when overwriting files in force mode', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir, { recursive: true });
    // Create a conflicting file
    await fs.mkdir(path.join(targetDir, 'skills'), { recursive: true });
    await fs.writeFile(path.join(targetDir, 'skills/test-skill.md'), 'original content');

    await runImport(testArchive, { claudeDir: targetDir, force: true });

    // Verify backup directory was created under backups/
    const backupsRoot = path.join(targetDir, 'backups');
    const backupDirs = await fs.readdir(backupsRoot);
    expect(backupDirs.length).toBeGreaterThan(0);
    const backupPath = path.join(backupsRoot, backupDirs[0], 'skills/test-skill.md');
    const backedUpContent = await fs.readFile(backupPath, 'utf-8');
    expect(backedUpContent).toBe('original content');
  });

  it('prints hook rewrite summary when source_home differs', async () => {
    // Create an archive with a different source_home and absolute hook paths
    const customFixturesDir = path.join(tmpDir, 'custom-fixtures');
    await fs.mkdir(path.join(customFixturesDir, 'skills'), { recursive: true });
    await fs.writeFile(
      path.join(customFixturesDir, 'skills/test-skill.md'),
      'Test Skill Content',
    );
    await fs.mkdir(path.join(customFixturesDir, 'rules'), { recursive: true });
    await fs.writeFile(
      path.join(customFixturesDir, 'rules/test-rule.md'),
      'Test Rule Content',
    );
    // settings.json with an absolute hook path pointing to a DIFFERENT home
    await fs.writeFile(
      path.join(customFixturesDir, 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'command', command: '/Users/oldsource/scripts/my-hook.sh' },
              ],
            },
          ],
        },
        disableAllHooks: false,
      }),
    );
    await fs.writeFile(
      path.join(customFixturesDir, 'CLAUDE.md'),
      '# Instructions\n',
    );
    await fs.writeFile(
      path.join(customFixturesDir, 'keybindings.json'),
      '{}',
    );

    // Create a custom archive with source_home = /Users/oldsource
    const customArchive = path.join(tmpDir, 'custom-archive.tar.gz');
    const manifest = {
      version: '0.1.0',
      tool: 'claude-sync',
      exported_at: new Date().toISOString(),
      source_platform: process.platform,
      source_home: '/Users/oldsource',
      included_types: ['skills', 'rules', 'hooks', 'instructions', 'keybindings'],
      files: [
        { path: 'skills/test-skill.md', size: 16, checksum: 'sha256:abc' },
        { path: 'rules/test-rule.md', size: 15, checksum: 'sha256:def' },
        { path: 'settings.json', size: 100, checksum: 'sha256:ghi' },
        { path: 'CLAUDE.md', size: 15, checksum: 'sha256:jkl' },
        { path: 'keybindings.json', size: 2, checksum: 'sha256:mno' },
      ],
      excluded: { oauth_file: '', runtime_dirs: [] },
    };
    const stageDir = path.join(tmpDir, 'custom-stage');
    await fs.mkdir(stageDir, { recursive: true });
    await fs.writeFile(
      path.join(stageDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
    // Write files directly to stageDir (no need for intermediate customFixturesDir)
    await fs.mkdir(path.join(stageDir, 'skills'), { recursive: true });
    await fs.mkdir(path.join(stageDir, 'rules'), { recursive: true });
    await fs.writeFile(path.join(stageDir, 'skills/test-skill.md'), 'Test Skill Content');
    await fs.writeFile(path.join(stageDir, 'rules/test-rule.md'), 'Test Rule Content');
    await fs.writeFile(path.join(stageDir, 'settings.json'), JSON.stringify({
      hooks: {
        PreToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: '/Users/oldsource/scripts/my-hook.sh' }],
          },
        ],
      },
      disableAllHooks: false,
    }));
    await fs.writeFile(path.join(stageDir, 'CLAUDE.md'), '# Instructions\n');
    await fs.writeFile(path.join(stageDir, 'keybindings.json'), '{}');

    const { create } = await import('tar');
    await create({
      gzip: true,
      file: customArchive,
      cwd: stageDir,
      portable: true,
    }, ['.']);

    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir);

    const consoleLogSpy = vi.spyOn(console, 'log');
    await runImport(customArchive, { claudeDir: targetDir, force: true });

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    // Should print rewrite summary since source_home differs from current homedir
    expect(allOutput).toContain('Rewrote 1 hook paths');
    expect(allOutput).toContain('/Users/oldsource');
    expect(allOutput).toContain(os.homedir());
  });

  it('skips hook rewrite summary when source_home matches target home', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir);

    // Archive has source_home equal to current home — no rewriting needed
    const consoleLogSpy = vi.spyOn(console, 'log');
    await runImport(testArchive, { claudeDir: targetDir, force: true });

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    // Should NOT contain rewrite summary when source_home matches
    expect(allOutput).not.toContain('Rewrote');
    expect(allOutput).not.toContain('hook paths');
  });

  it('skips hook rewrite when archive has no source_home', async () => {
    // Create archive with no source_home field (old archive format)
    const oldArchive = path.join(tmpDir, 'old-archive.tar.gz');
    const stageDir = path.join(tmpDir, 'old-stage');
    await fs.mkdir(stageDir, { recursive: true });
    const manifest = {
      version: '0.1.0',
      tool: 'claude-sync',
      exported_at: new Date().toISOString(),
      source_platform: process.platform,
      // NO source_home field
      included_types: ['skills'],
      files: [{ path: 'skills/test-skill.md', size: 16, checksum: 'sha256:abc' }],
      excluded: { oauth_file: '', runtime_dirs: [] },
    };
    await fs.writeFile(
      path.join(stageDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
    await fs.mkdir(path.join(stageDir, 'skills'), { recursive: true });
    await fs.writeFile(
      path.join(stageDir, 'skills/test-skill.md'),
      'Test Skill Content',
    );
    const { create } = await import('tar');
    await create({
      gzip: true,
      file: oldArchive,
      cwd: stageDir,
      portable: true,
    }, ['.']);

    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir);

    const consoleLogSpy = vi.spyOn(console, 'log');
    // Should not throw even though source_home is missing
    await runImport(oldArchive, { claudeDir: targetDir, force: true });

    const allOutput = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allOutput).not.toContain('Rewrote');
  });
});
