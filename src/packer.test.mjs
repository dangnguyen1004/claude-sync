import { describe, it, expect, afterEach } from 'vitest';
import { createArchive, buildManifest } from './packer.mjs';
import * as tar from 'tar';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const FIXTURES = path.join(process.cwd(), 'test/fixtures/claude-home');
const mockFiles = [
  {
    absPath: path.join(FIXTURES, 'skills/test-skill.md'),
    relativePath: 'skills/test-skill.md',
    size: 50,
    checksum: 'sha256:abc123',
    type: 'skills',
  },
  {
    absPath: path.join(FIXTURES, 'CLAUDE.md'),
    relativePath: 'CLAUDE.md',
    size: 45,
    checksum: 'sha256:def456',
    type: 'instructions',
  },
];

const tmpDir = path.join(os.tmpdir(), 'packer-test-' + Date.now());

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('buildManifest', () => {
  it('returns correct structure', () => {
    const manifest = buildManifest(mockFiles, ['skills', 'instructions']);
    expect(typeof manifest.version).toBe('string');
    expect(manifest.tool).toBe('claude-sync');
    expect(manifest.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(typeof manifest.source_platform).toBe('string');
    expect(manifest.included_types).toEqual(['skills', 'instructions']);
    expect(Array.isArray(manifest.files)).toBe(true);
    expect(manifest.files).toHaveLength(2);
    expect(manifest.excluded.oauth_file).toContain('.claude.json');
    expect(Array.isArray(manifest.excluded.runtime_dirs)).toBe(true);
    expect(manifest.excluded.runtime_dirs.length).toBeGreaterThanOrEqual(10);
  });

  it('manifest files have correct fields', () => {
    const manifest = buildManifest(mockFiles, ['skills', 'instructions']);
    for (const file of manifest.files) {
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('size');
      expect(file).toHaveProperty('checksum');
    }
  });
});

describe('createArchive', () => {
  it('produces a .tar.gz file', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.tar.gz');
    const manifest = buildManifest(mockFiles, ['skills', 'instructions']);
    await createArchive(mockFiles, outputPath, manifest, FIXTURES);
    const stat = await fs.stat(outputPath);
    expect(stat.isFile()).toBe(true);
  });

  it('archive contains manifest.json', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.tar.gz');
    const manifest = buildManifest(mockFiles, ['skills', 'instructions']);
    await createArchive(mockFiles, outputPath, manifest, FIXTURES);
    const entries = [];
    await tar.list({
      file: outputPath,
      onReadEntry: (entry) => entries.push(entry.path),
    });
    expect(entries.some((e) => e === 'manifest.json' || e.endsWith('/manifest.json'))).toBe(true);
  });

  it('archive contains all scanned files', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.tar.gz');
    const manifest = buildManifest(mockFiles, ['skills', 'instructions']);
    await createArchive(mockFiles, outputPath, manifest, FIXTURES);
    const entries = [];
    await tar.list({
      file: outputPath,
      onReadEntry: (entry) => entries.push(entry.path),
    });
    const normalized = entries.map((e) => e.replace(/^\.\//, ''));
    expect(normalized).toContain('skills/test-skill.md');
    expect(normalized).toContain('CLAUDE.md');
  });

  it('no archive entry starts with / (SEC-02)', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.tar.gz');
    const manifest = buildManifest(mockFiles, ['skills', 'instructions']);
    await createArchive(mockFiles, outputPath, manifest, FIXTURES);
    const entries = [];
    await tar.list({
      file: outputPath,
      onReadEntry: (entry) => entries.push(entry.path),
    });
    for (const entry of entries) {
      expect(entry.startsWith('/')).toBe(false);
    }
  });

  it('manifest.json in archive is valid JSON with tool: claude-sync', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.tar.gz');
    const manifest = buildManifest(mockFiles, ['skills', 'instructions']);
    await createArchive(mockFiles, outputPath, manifest, FIXTURES);
    const extractDir = path.join(tmpDir, 'extracted');
    await fs.mkdir(extractDir, { recursive: true });
    await tar.extract({ file: outputPath, cwd: extractDir, strip: 0 });
    const manifestContent = await fs.readFile(path.join(extractDir, 'manifest.json'), 'utf-8');
    const parsed = JSON.parse(manifestContent);
    expect(parsed.tool).toBe('claude-sync');
  });

  it('archive file is not .tmp after successful creation', async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    const outputPath = path.join(tmpDir, 'output.tar.gz');
    const manifest = buildManifest(mockFiles, ['skills', 'instructions']);
    await createArchive(mockFiles, outputPath, manifest, FIXTURES);
    await expect(fs.stat(outputPath)).resolves.toBeTruthy();
    await expect(fs.stat(outputPath + '.tmp')).rejects.toThrow();
  });

  it('no readFileSync in packer source (EXP-13)', async () => {
    const source = await fs.readFile(new URL('./packer.mjs', import.meta.url), 'utf-8');
    expect(source).not.toContain('readFileSync');
  });
});
