import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import {
  ALWAYS_EXCLUDED_NAMES,
  OAUTH_FILE,
  isExcluded,
  DEFAULT_TYPES,
  ALL_TYPES,
  resolveScope,
} from './exclusions.mjs';

const claudeHome = path.join(os.homedir(), '.claude');

describe('ALWAYS_EXCLUDED_NAMES', () => {
  it('has exactly 10 entries', () => {
    expect(ALWAYS_EXCLUDED_NAMES.size).toBe(10);
  });

  it('contains all expected excluded directory names', () => {
    const expected = [
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
    ];
    for (const name of expected) {
      expect(ALWAYS_EXCLUDED_NAMES.has(name)).toBe(true);
    }
  });
});

describe('OAUTH_FILE', () => {
  it('equals path.join(os.homedir(), ".claude.json")', () => {
    expect(OAUTH_FILE).toBe(path.join(os.homedir(), '.claude.json'));
  });

  it('contains .claude.json in the path', () => {
    expect(OAUTH_FILE).toContain('.claude.json');
  });
});

describe('isExcluded', () => {
  it('returns true for files inside cache/', () => {
    expect(isExcluded(path.join(claudeHome, 'cache', 'somefile.json'))).toBe(true);
  });

  it('returns true for files inside statsig/', () => {
    expect(isExcluded(path.join(claudeHome, 'statsig', 'somefile.json'))).toBe(true);
  });

  it('returns true for files inside debug/', () => {
    expect(isExcluded(path.join(claudeHome, 'debug', 'somefile.log'))).toBe(true);
  });

  it('returns true for files inside file-history/', () => {
    expect(isExcluded(path.join(claudeHome, 'file-history', 'somefile.json'))).toBe(true);
  });

  it('returns true for files inside session-env/', () => {
    expect(isExcluded(path.join(claudeHome, 'session-env', 'somefile.json'))).toBe(true);
  });

  it('returns true for files inside shell-snapshots/', () => {
    expect(isExcluded(path.join(claudeHome, 'shell-snapshots', 'somefile.json'))).toBe(true);
  });

  it('returns true for files inside backups/', () => {
    expect(isExcluded(path.join(claudeHome, 'backups', 'somefile.tar.gz'))).toBe(true);
  });

  it('returns true for files inside telemetry/', () => {
    expect(isExcluded(path.join(claudeHome, 'telemetry', 'somefile.json'))).toBe(true);
  });

  it('returns true for files inside paste-cache/', () => {
    expect(isExcluded(path.join(claudeHome, 'paste-cache', 'somefile.json'))).toBe(true);
  });

  it('returns true for files inside ide/', () => {
    expect(isExcluded(path.join(claudeHome, 'ide', 'somefile.json'))).toBe(true);
  });

  it('returns false for files inside skills/', () => {
    expect(isExcluded(path.join(claudeHome, 'skills', 'my-skill.md'))).toBe(false);
  });

  it('returns false for files inside rules/', () => {
    expect(isExcluded(path.join(claudeHome, 'rules', 'my-rule.md'))).toBe(false);
  });

  it('returns false for files inside commands/', () => {
    expect(isExcluded(path.join(claudeHome, 'commands', 'my-command.md'))).toBe(false);
  });

  it('returns false for files inside agents/', () => {
    expect(isExcluded(path.join(claudeHome, 'agents', 'my-agent.md'))).toBe(false);
  });

  it('returns false for CLAUDE.md at root of .claude/', () => {
    expect(isExcluded(path.join(claudeHome, 'CLAUDE.md'))).toBe(false);
  });

  it('returns false for keybindings.json', () => {
    expect(isExcluded(path.join(claudeHome, 'keybindings.json'))).toBe(false);
  });

  it('returns false for settings.json', () => {
    expect(isExcluded(path.join(claudeHome, 'settings.json'))).toBe(false);
  });
});

describe('DEFAULT_TYPES', () => {
  it('does NOT contain "conversations"', () => {
    expect(DEFAULT_TYPES).not.toContain('conversations');
  });

  it('has exactly 7 elements', () => {
    expect(DEFAULT_TYPES).toHaveLength(7);
  });

  it('contains expected type names', () => {
    const expected = ['skills', 'rules', 'hooks', 'commands', 'agents', 'instructions', 'keybindings'];
    for (const t of expected) {
      expect(DEFAULT_TYPES).toContain(t);
    }
  });
});

describe('ALL_TYPES', () => {
  it('has exactly 8 elements', () => {
    expect(ALL_TYPES).toHaveLength(8);
  });

  it('contains "conversations"', () => {
    expect(ALL_TYPES).toContain('conversations');
  });

  it('contains all DEFAULT_TYPES', () => {
    for (const t of DEFAULT_TYPES) {
      expect(ALL_TYPES).toContain(t);
    }
  });
});

describe('resolveScope', () => {
  it('returns DEFAULT_TYPES when called with no args', () => {
    const result = resolveScope();
    expect(result).toEqual(DEFAULT_TYPES);
  });

  it('returns DEFAULT_TYPES when called with empty object', () => {
    const result = resolveScope({});
    expect(result).toEqual(DEFAULT_TYPES);
  });

  it('returns only specified types when include is provided', () => {
    const result = resolveScope({ include: ['skills', 'rules'] });
    expect(result).toEqual(['skills', 'rules']);
  });

  it('returns DEFAULT_TYPES minus excluded type when exclude is provided', () => {
    const result = resolveScope({ exclude: ['hooks'] });
    expect(result).toEqual(DEFAULT_TYPES.filter((t) => t !== 'hooks'));
    expect(result).not.toContain('hooks');
  });

  it('throws Error for unknown type in include', () => {
    expect(() => resolveScope({ include: ['invalidtype'] })).toThrow(Error);
  });

  it('throws Error for unknown type in exclude', () => {
    expect(() => resolveScope({ exclude: ['notatype'] })).toThrow(Error);
  });

  it('allows conversations when explicitly included', () => {
    const result = resolveScope({ include: ['conversations', 'skills'] });
    expect(result).toContain('conversations');
  });
});
