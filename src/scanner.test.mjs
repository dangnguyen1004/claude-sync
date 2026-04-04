import { describe, it, expect, beforeAll } from 'vitest';
import { scanExportTargets } from './scanner.mjs';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, '..', 'test', 'fixtures', 'claude-home');

describe('scanExportTargets', () => {
  it('scans all default data types', async () => {
    const results = await scanExportTargets(FIXTURES);
    const types = results.map((f) => f.type);
    expect(types).toContain('skills');
    expect(types).toContain('rules');
    expect(types).toContain('hooks');
    expect(types).toContain('commands');
    expect(types).toContain('agents');
    expect(types).toContain('instructions');
    expect(types).toContain('keybindings');
    expect(results.length).toBeGreaterThanOrEqual(7);
  });

  it('returns correct relativePath for skills file', async () => {
    const results = await scanExportTargets(FIXTURES);
    const skillsEntry = results.find((f) => f.type === 'skills');
    expect(skillsEntry).toBeDefined();
    expect(skillsEntry.relativePath).toBe('skills/test-skill.md');
  });

  it('returns sha256-prefixed checksum', async () => {
    const results = await scanExportTargets(FIXTURES);
    for (const file of results) {
      expect(file.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    }
  });

  it('returns size > 0 for all files', async () => {
    const results = await scanExportTargets(FIXTURES);
    for (const file of results) {
      expect(file.size).toBeGreaterThan(0);
    }
  });

  it('excludes cache/ and debug/ directories', async () => {
    const results = await scanExportTargets(FIXTURES);
    for (const file of results) {
      expect(file.relativePath).not.toMatch(/^cache\//);
      expect(file.relativePath).not.toMatch(/^debug\//);
      expect(file.type).not.toBe('cache');
      expect(file.type).not.toBe('debug');
    }
  });

  it('respects --include flag', async () => {
    const results = await scanExportTargets(FIXTURES, { include: ['skills', 'rules'] });
    for (const file of results) {
      expect(['skills', 'rules']).toContain(file.type);
    }
    expect(results.length).toBe(2);
  });

  it('respects --exclude flag', async () => {
    const results = await scanExportTargets(FIXTURES, { exclude: ['hooks'] });
    for (const file of results) {
      expect(file.type).not.toBe('hooks');
    }
  });

  it('handles missing directories gracefully', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-sync-test-'));
    try {
      // Create only a CLAUDE.md
      await fs.writeFile(path.join(tmpDir, 'CLAUDE.md'), '# Test Instructions\n');
      const results = await scanExportTargets(tmpDir);
      expect(results.length).toBe(1);
      const instructionsEntry = results.find((f) => f.type === 'instructions');
      expect(instructionsEntry).toBeDefined();
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it('maps settings.json to type "hooks"', async () => {
    const results = await scanExportTargets(FIXTURES);
    const hooksEntry = results.find((f) => f.type === 'hooks');
    expect(hooksEntry).toBeDefined();
    expect(hooksEntry.relativePath).toBe('settings.json');
  });

  it('maps CLAUDE.md to type "instructions"', async () => {
    const results = await scanExportTargets(FIXTURES);
    const instructionsEntry = results.find((f) => f.type === 'instructions');
    expect(instructionsEntry).toBeDefined();
    expect(instructionsEntry.relativePath).toBe('CLAUDE.md');
  });

  it('relativePath never starts with /', async () => {
    const results = await scanExportTargets(FIXTURES);
    for (const file of results) {
      expect(file.relativePath).not.toMatch(/^\//);
    }
  });
});
