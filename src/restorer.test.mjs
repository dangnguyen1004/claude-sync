import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runRestore } from './restorer.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { runExport } from './commands/export.mjs';

const FIXTURES = path.join(process.cwd(), 'test/fixtures/claude-home');

let tmpDir;
let testArchive;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'restorer-test-'));
  testArchive = path.join(tmpDir, 'test-archive.tar.gz');
  await runExport(testArchive, { claudeDir: FIXTURES });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('runRestore', () => {
  it('extracts files from archive to target directory', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir);

    const result = await runRestore(testArchive, { claudeDir: targetDir, force: true });

    expect(result.success).toBe(true);
    expect(result.restoredCount).toBeGreaterThan(0);

    // Verify a file was actually restored
    const skillFile = path.join(targetDir, 'skills/test-skill.md');
    const content = await fs.readFile(skillFile, 'utf-8');
    expect(content).toContain('Test Skill');
  });

  it('returns conflict when file exists and force is false', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir, { recursive: true });
    // Pre-create a file that will conflict
    await fs.mkdir(path.join(targetDir, 'skills'), { recursive: true });
    await fs.writeFile(path.join(targetDir, 'skills/test-skill.md'), 'existing content');

    const result = await runRestore(testArchive, { claudeDir: targetDir, force: false });

    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.file).toBe('skills/test-skill.md');
    expect(result.existingContent).toBe('existing content');
  });

  it('overwrites without conflict when force is true', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir, { recursive: true });
    await fs.mkdir(path.join(targetDir, 'skills'), { recursive: true });
    await fs.writeFile(path.join(targetDir, 'skills/test-skill.md'), 'existing content');

    const result = await runRestore(testArchive, { claudeDir: targetDir, force: true });

    expect(result.success).toBe(true);
    expect(result.conflict).toBeUndefined();
  });

  it('returns dryRun results without writing files', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir);

    const result = await runRestore(testArchive, { claudeDir: targetDir, dryRun: true });

    expect(result.success).toBe(true);
    expect(result.dryRunResults).toBeDefined();
    expect(result.dryRunResults.length).toBeGreaterThan(0);
    // No files should be written in dry-run mode
    const files = await fs.readdir(path.join(targetDir, 'skills')).catch(() => []);
    expect(files).toHaveLength(0);
  });

  it('marks existing files as CONFLICT and new files as NEW in dry-run', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir, { recursive: true });
    // Create a file that will conflict
    await fs.mkdir(path.join(targetDir, 'skills'), { recursive: true });
    await fs.writeFile(path.join(targetDir, 'skills/test-skill.md'), 'existing');

    const result = await runRestore(testArchive, { claudeDir: targetDir, dryRun: true });

    const conflictEntry = result.dryRunResults.find((r) => r.path === 'skills/test-skill.md');
    const newEntry = result.dryRunResults.find((r) => r.path === 'rules/test-rule.md');

    expect(conflictEntry?.label).toBe('CONFLICT');
    expect(newEntry?.label).toBe('NEW');
  });

  it('creates parent directories as needed', async () => {
    const targetDir = path.join(tmpDir, 'target');
    await fs.mkdir(targetDir);

    const result = await runRestore(testArchive, { claudeDir: targetDir, force: true });

    expect(result.success).toBe(true);
    const agentFile = path.join(targetDir, 'agents/test-agent.md');
    const stat = await fs.stat(agentFile);
    expect(stat.isFile()).toBe(true);
  });
});
