# Testing

**Analysis Date:** 2026-04-07

## Test Framework

Tests use [Vitest](https://vitest.dev/) (version 3.x). Vitest is a fast, modern test runner with a Jest-compatible API.

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm test -- --watch

# Run a specific test file
npx vitest run src/commands/export.test.mjs

# Run with verbose output
npm test -- --reporter=verbose
```

## Test Structure

Tests live alongside the code they test with a `.test.mjs` extension:

```
src/
├── commands/
│   ├── export.mjs         # Implementation
│   └── export.test.mjs     # Tests for export
├── packer.mjs             # Implementation
├── packer.test.mjs         # Tests for packer
└── ...
```

## Fixtures

Test fixtures live in `test/fixtures/`. The structure mirrors `~/.claude/` for controlled testing:

```
test/fixtures/claude-home/
├── skills/
│   └── test-skill.md
├── rules/
│   └── test-rule.md
├── commands/
│   └── test-command.md
├── agents/
│   └── test-agent.md
├── CLAUDE.md               # Global instructions fixture
└── settings.json          # Hooks fixture
```

## Writing Tests

### Unit Tests

Test individual functions directly:

```javascript
import { describe, it, expect, vi } from 'vitest';
import { resolveScope } from '../exclusions.mjs';

describe('resolveScope', () => {
  it('returns DEFAULT_TYPES when neither include nor exclude is given', () => {
    expect(resolveScope()).toEqual(['skills', 'rules', 'hooks', 'commands', 'agents', 'instructions', 'keybindings']);
  });

  it('returns exactly the included types', () => {
    expect(resolveScope({ include: ['skills'] })).toEqual(['skills']);
  });
});
```

### Integration Tests

Use a temporary directory to simulate `~/.claude/`:

```javascript
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

it('creates an archive with the expected files', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-sync-test-'));
  // set up fixtures...
  // run the function...
  // verify the output...
  await fs.rm(tmpDir, { recursive: true, force: true });
});
```

### Mocking

Use `vi.mock()` for external dependencies:

```javascript
vi.mock('tar', () => ({
  create: vi.fn(),
}));
```

## Coverage

Run with coverage:

```bash
npm test -- --coverage
```

## Test Patterns Used

- **Pure function tests**: Test `resolveScope`, `isExcluded`, `buildManifest` directly with assertions
- **File system tests**: Use `fs.mkdtemp()` to create isolated temp directories
- **Mocking**: Mock the `tar` module in `packer.test.mjs`; mock `fs` where appropriate
- **Snapshot tests**: Not heavily used — tests verify specific behavior, not output format

## Debugging Failing Tests

```bash
# Run a specific test
npx vitest run src/scanner.test.mjs

# Watch a specific file
npx vitest run src/scanner.test.mjs --watch

# Inspect output
npx vitest run --reporter=verbose
```
