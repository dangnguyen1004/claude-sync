# Phase 1: Export - Research

**Researched:** 2026-04-04
**Domain:** Node.js ESM CLI — filesystem scanner, tar.gz archive creation, manifest injection, npm global publish
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Archive format:** tar.gz using the `tar` npm package (v7.5.13), streaming API (`tar.create()`)
- **Module format:** ESM — `"type": "module"` in package.json; entry point `bin/claude-sync.mjs`
- **CLI framework:** commander v14
- **Colors:** chalk v5 (Phase 1); ora v9 deferred to Phase 3
- **Project structure:** `bin/claude-sync.mjs`, `src/scanner.mjs`, `src/packer.mjs`, `src/exclusions.mjs`
- **Default export scope:** skills, rules, hooks/settings.json, commands, agents, CLAUDE.md, keybindings — NOT conversations by default
- **Always excluded:** `~/.claude.json`, `cache/`, `statsig/`, `debug/`, `file-history/`, `session-env/`, `shell-snapshots/`
- **Flags:** `--include <type>` / `--exclude <type>` with named types (comma-separated)
- **Output naming:** `claude-sync-YYYY-MM-DD.tar.gz` in CWD when no path provided
- **Manifest format:** `manifest.json` at archive root with checksums and `excluded` section
- **SEC-02:** Archive entries MUST be relative paths only — no absolute machine paths

### Claude's Discretion

- Whether to export `settings.json` in full or hooks-section-only (open question from CONTEXT.md)
- Test framework choice (no test infrastructure exists yet)
- Handling of missing/non-existent data type directories (CONTEXT.md: silently skip, no error)
- Whether to write archive to a `.tmp` path first then rename (atomicity — not explicitly decided)

### Deferred Ideas (OUT OF SCOPE)

- Progress spinners (ora) — Phase 3, CLI-05
- Secret detection in settings.json — Phase 3, SEC-01
- Conversation export (projects/) — Phase 3, EXP-08
- `claude-sync import` — Phase 2
- `claude-sync list` — Phase 2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-01 | Installable as global npm package (`npm install -g claude-sync`) | package.json `bin` + `files` fields; `chmod` on entry point |
| CLI-02 | `claude-sync export [output.tar.gz]` exports environment to archive | commander `.command('export')` + optional argument pattern |
| EXP-01 | Export global skills (`~/.claude/skills/`) | scanner.mjs: walk dir, `fs.promises.readdir` recursive |
| EXP-02 | Export global rules (`~/.claude/rules/`) | Same as EXP-01 |
| EXP-03 | Export hooks configuration (settings.json hooks section) | Scan `~/.claude/settings.json`; full-file vs hooks-only decision |
| EXP-04 | Export global commands (`~/.claude/commands/`) | Same as EXP-01 |
| EXP-05 | Export agents (`~/.claude/agents/`) | Same as EXP-01 |
| EXP-06 | Export `CLAUDE.md` (global instructions) | Single-file inclusion, not a directory walk |
| EXP-07 | Export `keybindings.json` | Single-file inclusion |
| EXP-09 | Archive includes manifest (tool version, export date, checksums) | Write manifest to temp file; include as first entry via `tar.create()` |
| EXP-10 | Selective include/exclude via CLI flags | commander `.option('--include <types>', ...)` with comma-split parse |
| EXP-11 | `~/.claude.json` always excluded; user informed | `exclusions.mjs` must check `$HOME/.claude.json` (NOT inside `~/.claude/`) |
| EXP-12 | Runtime/ephemeral dirs always excluded | Exclusion list in `exclusions.mjs`; applied as a filter in scanner |
| EXP-13 | Export uses streaming for large conversation dirs | `tar.create()` streaming API; no `readFileSync` on any scanned file |
| SEC-02 | Archive entries use only relative paths | `tar.create()` with `cwd: os.homedir() + '/.claude'`; never `preservePaths: true` |
</phase_requirements>

---

## Summary

Phase 1 builds a greenfield Node.js ESM CLI. All technology decisions are locked: commander v14, `tar` npm v7.5.13, chalk v5, Node.js built-in `fs/promises` and `crypto`. The project structure is flat (`bin/`, `src/`) with no build step.

The core challenge is the **manifest-first ordering**: `tar.create()` only accepts filesystem paths, so `manifest.json` must be written to a temporary file, included first in the file list, and cleaned up afterward. The two-phase approach (scan → compute checksums → build manifest → pack) is the right architecture because checksums must be known before the manifest can be written.

The most critical security invariant is `~/.claude.json` exclusion. This file lives at `$HOME/.claude.json` (NOT inside `~/.claude/`), which means a naive "walk `~/.claude/` directory" approach will NOT accidentally include it — but the exclusion list must explicitly guard against any `--include` flag that might try to add it, and the CLI output must confirm the exclusion on every run (SEC-02 and EXP-11).

**Primary recommendation:** Implement in five discrete modules — `exclusions.mjs` first (defines the contract), then `scanner.mjs` (returns file list with metadata), then `packer.mjs` (takes file list, produces archive), then `bin/claude-sync.mjs` (wires commander to the pipeline). This ordering ensures each module can be unit-tested independently.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 1 |
|-----------|-------------------|
| Must support macOS; Linux nice-to-have | Use `os.homedir()` not hardcoded `/Users/`; POSIX paths only |
| No external dependencies (interpreted as: no extra runtime, npm packages are fine) | Stack already decided; no additional libraries |
| Non-destructive import (not this phase) | No impact on Phase 1; noted for Phase 2 |
| GSD workflow enforcement — use `/gsd:execute-phase` for planned work | Follow GSD workflow; no direct edits outside a plan |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 24.11.1 (dev); target >=20 | Runtime | Verified on this machine; ESM fully stable; `fs.promises.cp()` stable |
| commander | 14.0.3 | Subcommand routing, option parsing | Verified latest; zero deps; 18ms startup |
| tar (npm) | 7.5.13 | tar.gz archive creation (streaming) | Verified latest; handles POSIX perms; cwd-relative paths built-in |
| chalk | 5.6.2 | Terminal colors for output | Verified latest; ESM-only; zero deps |
| node:crypto | built-in | SHA-256 checksums | `createHash('sha256')` stable since Node 10; no install |
| node:fs/promises | built-in | All file I/O | `fs.promises.readdir({recursive:true})` stable since Node 18.17 |
| node:os | built-in | `os.homedir()` for `~` expansion | Prevents tilde-in-path bug |
| node:path | built-in | Path joins and resolution | `path.relative()` for relative archive paths |

### Supporting (Phase 1 only — ora deferred to Phase 3)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chalk | 5.6.2 | Colorize summary output lines | Every output line — use chalk.green for ✓, chalk.yellow for warnings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tar (npm) | tar-stream + tar-fs | tar-stream gives more control for in-memory entry injection but adds two packages; `tar` npm is sufficient with the temp-file manifest pattern |
| temp file for manifest | tar.Pack low-level class | Pack class is underdocumented; temp-file pattern is simpler and testable |
| node:crypto | hasha | hasha is a convenience wrapper but ESM-only and adds a dep for one function |

**Installation:**
```bash
npm install commander tar chalk
```

**Version verification (confirmed 2026-04-04):**
- `commander`: 14.0.3 (npm view confirmed)
- `tar`: 7.5.13 (npm view confirmed)
- `chalk`: 5.6.2 (npm view confirmed)

---

## Architecture Patterns

### Recommended Project Structure
```
claude-sync/
├── bin/
│   └── claude-sync.mjs      # #!/usr/bin/env node — commander setup only
├── src/
│   ├── exclusions.mjs        # ALWAYS_EXCLUDED and NEVER_DEFAULT lists
│   ├── scanner.mjs           # walks ~/.claude/, returns ScannedFile[]
│   └── packer.mjs            # creates tar.gz with manifest
├── package.json
└── README.md
```

Note: The CONTEXT.md decided on this exact structure. ARCHITECTURE.md had a more layered structure with `commands/` and `lib/` subdirectories — that is a Phase 2+ evolution. Phase 1 uses the simpler flat `src/` layout.

### Pattern 1: Two-Phase Export Pipeline
**What:** Separate scanning (collect + checksum) from packing (create archive).
**When to use:** Always — the manifest must contain checksums of all files, so scanning must complete before the archive can be created.

```javascript
// src/scanner.mjs — Phase 1 only exports files in default scope
export async function scanExportTargets(claudeDir, { include, exclude }) {
  const results = [];
  for (const dataType of resolveScope({ include, exclude })) {
    const paths = await collectPaths(claudeDir, dataType);
    for (const absPath of paths) {
      const content = await fs.readFile(absPath);
      const checksum = 'sha256:' + createHash('sha256').update(content).digest('hex');
      results.push({
        absPath,
        relativePath: path.relative(claudeDir, absPath),
        size: content.length,
        checksum,
        type: dataType,
      });
    }
  }
  return results;
}
```

### Pattern 2: Manifest-First Archive with tar.create()
**What:** Write `manifest.json` to a temp file, include it as the first entry, then all scanned files from `~/.claude/` with `cwd` set to the Claude dir.
**When to use:** Every export — EXP-09 requires manifest at archive root.

```javascript
// src/packer.mjs
import * as tar from 'tar';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

export async function createArchive(scannedFiles, outputPath, manifest) {
  const claudeDir = path.join(os.homedir(), '.claude');
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-sync-'));
  const manifestPath = path.join(tmpDir, 'manifest.json');

  try {
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Write to .tmp first, then atomic rename
    const tmpOutput = outputPath + '.tmp';

    await tar.create(
      {
        gzip: true,
        file: tmpOutput,
        cwd: claudeDir,       // All relative paths resolve from here
        portable: true,       // Strip uid/gid/ctime for portability
        // manifest.json comes from tmpDir, NOT claudeDir, so use prefix trick:
      },
      // Note: manifest must be added separately — see Pattern 3
      scannedFiles.map(f => f.relativePath)
    );

    await fs.rename(tmpOutput, outputPath);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
```

### Pattern 3: Manifest Injection — Temp File Approach
**What:** `tar.create()` only accepts filesystem paths. To prepend `manifest.json`, write it to a temp directory adjacent to the real files, or use a two-pass approach.
**When to use:** Required for EXP-09 (manifest at archive root).

The cleanest approach confirmed by the tar npm README: create the archive in two tar calls combined with `@` syntax to concatenate, OR write manifest to temp dir and pass it as the first entry with `cwd` pointing to the temp dir for that one entry.

**Recommended pattern — single-pass with separate cwd per entry group:**

```javascript
// Two separate tar.create() calls piped together is complex.
// Simplest correct approach: copy manifest to a staging dir that mirrors
// the final archive layout, then tar the staging dir.

export async function createArchive(scannedFiles, outputPath, manifest) {
  const claudeDir = path.join(os.homedir(), '.claude');
  const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-sync-stage-'));

  try {
    // Write manifest at stage root
    await fs.writeFile(
      path.join(stageDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // Symlink or copy each scanned file into staging dir preserving relative paths
    for (const f of scannedFiles) {
      const dest = path.join(stageDir, f.relativePath);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.copyFile(f.absPath, dest);
    }

    const tmpOutput = outputPath + '.tmp';
    await tar.create({ gzip: true, file: tmpOutput, cwd: stageDir, portable: true }, ['.']);
    await fs.rename(tmpOutput, outputPath);
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true });
  }
}
```

**Trade-off:** Staging dir doubles disk I/O for large exports, but conversations are opt-in by default, so Phase 1 scope (config files only, typically <10 MB) makes this negligible. Phase 3 can optimize with streaming if conversations are added.

### Pattern 4: commander v14 Subcommand with Optional Argument
**What:** Define `export` as a subcommand accepting an optional output path and `--include`/`--exclude` options.
**When to use:** CLI-02.

```javascript
// bin/claude-sync.mjs
#!/usr/bin/env node
import { program } from 'commander';
import { runExport } from '../src/commands/export.mjs';

program
  .name('claude-sync')
  .description('Backup and restore your Claude Code environment')
  .version('0.1.0');

program
  .command('export')
  .description('Export Claude Code environment to a portable archive')
  .argument('[output]', 'Output file path (default: ./claude-sync-YYYY-MM-DD.tar.gz)')
  .option('--include <types>', 'Comma-separated data types to include (overrides defaults)')
  .option('--exclude <types>', 'Comma-separated data types to exclude from defaults')
  .action(async (output, options) => {
    try {
      await runExport(output, options);
    } catch (err) {
      console.error(chalk.red('Export failed: ' + err.message));
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
```

**Key detail:** Use `program.parseAsync()` (not `program.parse()`) when the action handler is async — this is required in commander v14 to propagate errors correctly.

### Pattern 5: Exclusion List Module
**What:** Centralize all exclusion logic in `exclusions.mjs` so scanner and any future command can share it.
**When to use:** EXP-11, EXP-12, SEC-02.

```javascript
// src/exclusions.mjs
import os from 'node:os';
import path from 'node:path';

// These paths are NEVER included regardless of flags
export const ALWAYS_EXCLUDED_NAMES = new Set([
  'cache',
  'statsig',
  'debug',
  'file-history',
  'session-env',
  'shell-snapshots',
  'backups',        // avoid backup-of-backups
  'telemetry',
  'paste-cache',
  'ide',
]);

// ~/.claude.json lives at $HOME level, NOT inside ~/.claude/
// The scanner walks ~/.claude/ so this won't be picked up naturally,
// but we guard it explicitly in case of future --include-auth flags.
export const OAUTH_FILE = path.join(os.homedir(), '.claude.json');

export function isExcluded(absolutePath) {
  const claudeDir = path.join(os.homedir(), '.claude');
  const rel = path.relative(claudeDir, absolutePath);
  const topLevel = rel.split(path.sep)[0];
  return ALWAYS_EXCLUDED_NAMES.has(topLevel);
}
```

### Pattern 6: SHA-256 Checksum with Streaming
**What:** Hash file content using Node built-in `crypto.createHash` without loading large files into memory.
**When to use:** Every file in the manifest — EXP-09.

```javascript
// src/checksum.mjs (or inline in scanner.mjs)
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve('sha256:' + hash.digest('hex')));
    stream.on('error', reject);
  });
}
```

### Pattern 7: package.json for Global Install (CLI-01)
**What:** Correct `bin`, `type`, `engines`, and `files` configuration for `npm install -g`.

```json
{
  "name": "claude-sync",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": {
    "claude-sync": "./bin/claude-sync.mjs"
  },
  "files": ["bin/", "src/"],
  "dependencies": {
    "commander": "^14.0.3",
    "tar": "^7.5.13",
    "chalk": "^5.6.2"
  }
}
```

**Critical:** The `bin` entry point file MUST have `#!/usr/bin/env node` as its first line AND have executable permissions (`chmod 755`). npm sets the executable bit automatically on `npm install -g`, but it must be present for `npm link` (local dev) to work. Set it once with:
```bash
chmod 755 bin/claude-sync.mjs
```

### Anti-Patterns to Avoid
- **`readFileSync` in scanner or packer:** Crashes on large files. Use `createReadStream` for checksums and let `tar.create()` handle file streaming.
- **Walking `$HOME` or `$HOME/.claude*` globs:** Will capture `~/.claude.json` (OAuth tokens). Walk `$HOME/.claude/` only.
- **Absolute paths in tar entries:** Never pass absolute paths to `tar.create()`'s file list. Always use paths relative to `cwd`. Verify by checking that no entry in the resulting archive starts with `/`.
- **`tar.create()` without `portable: true`:** Will embed uid/gid from the source machine; breaks across users. Always set `portable: true`.
- **Direct write to final output path:** If export is interrupted, leaves a corrupt archive. Always write to `output.tmp` first, then `fs.rename()` atomically.
- **Passing `~` paths directly to Node.js `fs` calls:** Node does not expand tilde. Always call `absPath.replace(/^~/, os.homedir())` before any `fs.*` call.
- **`program.parse()` with async action:** Will not await the handler; errors will be swallowed. Use `program.parseAsync()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| tar.gz creation | Manual zlib + tar header construction | `tar` npm package | Handles special chars in paths, symlinks, directory recursion, POSIX permissions |
| SHA-256 hashing | Custom hash loop | `node:crypto createHash('sha256')` | Built-in; streaming-capable; no dep |
| CLI argument parsing | Manual `process.argv` parsing | `commander` | Help text, error messages, type coercion, subcommand routing — all free |
| Path traversal safety | Custom path prefix check | `tar` npm with `cwd` + never `preservePaths: true` | Library strips absolute prefixes by default |
| Tilde expansion | Regex replace string | `os.homedir()` + `path.join()` | Correct on all platforms; handles edge cases |
| Recursive directory walk | `fs.readdirSync` loop | `fs.promises.readdir(dir, { recursive: true })` | Built-in since Node 18.17; returns relative paths |

**Key insight:** The `tar` npm package's `cwd` option is the central security mechanism for SEC-02. Setting `cwd` to `~/.claude/` means every file path passed to `tar.create()` is resolved relative to that directory, and entries in the archive are stored with those relative paths automatically. No manual path stripping needed.

---

## Open Questions

1. **Should `settings.json` be exported as full file or hooks-section only?**
   - What we know: CONTEXT.md says "hooks section only" in the named types table, but the manifest structure example in CONTEXT.md shows the `included_types` list with `"hooks"` (not `"settings"`). The decision is internally consistent — export the full `settings.json` file but call the data type `"hooks"` in manifest and flags.
   - What's unclear: If `settings.json` contains model preferences or permission settings that are machine-specific, exporting the full file may silently transfer settings the user did not intend to share. CONTEXT.md open question #3 asks this explicitly.
   - Recommendation: Export the **full `settings.json` file** (simpler, no JSON surgery needed) but document clearly that it contains more than just hooks. This matches what the manifest structure in CONTEXT.md shows (`settings.json` as a file path, not a subset). Hooks-section-only extraction would require JSON parse + serialize, adding complexity with no Phase 1 requirement.

2. **File locking — what if Claude Code is running during export?**
   - What we know: PITFALLS.md flags this as a concern for import (active JSONL writes). For export, Phase 1 scope is config files (`settings.json`, skills, rules, etc.) — these are not written by Claude Code while a session is active.
   - What's unclear: Whether `settings.json` could be written mid-export. On macOS, Node.js `fs.readFile` on a file being written by another process will either get a complete snapshot or fail — it does not produce partial reads on JSON files of this size (<100 KB).
   - Recommendation: No file locking needed in Phase 1. The files being exported are all small config files that are only written when the user changes settings. Document this assumption. Phase 3 (conversation export) will need to revisit.

3. **Temp file staging approach vs. two-pass tar concatenation for manifest-first ordering:**
   - Staging dir approach (recommended): copies all files to a temp dir with manifest at root, then tars the staging dir. Simple, testable, correct. Downside: doubles disk I/O. For Phase 1 scope (config files, <10 MB total), this is irrelevant.
   - Two-pass approach: Create archive without manifest, then use `tar.replace()` to inject manifest as first entry. Problem: `tar.replace()` appends to the end, not the beginning — ordering is not guaranteed.
   - Recommendation: Use staging dir approach for Phase 1. Add streaming optimization only if conversations become in-scope.

---

## Common Pitfalls

### Pitfall 1: `~/.claude.json` Is Not Inside `~/.claude/`
**What goes wrong:** Developer walks `~/.claude/` directory and assumes that's everything. The OAuth token file is `~/.claude.json` (with `.json` suffix, in `$HOME`). A naive glob like `~/.claude*` would capture both.
**Why it happens:** File names are visually similar; easy to overlook the directory vs file distinction.
**How to avoid:** Scanner only walks `path.join(os.homedir(), '.claude')` as a directory. The exclusion list in `exclusions.mjs` explicitly names `OAUTH_FILE = path.join(os.homedir(), '.claude.json')` and the CLI always prints the exclusion notice (EXP-11).
**Warning signs:** Any `readdir` or `glob` call that operates on `os.homedir()` rather than `os.homedir() + '/.claude'`.

### Pitfall 2: Archive Contains Absolute Paths
**What goes wrong:** Passing absolute file paths to `tar.create()`'s file list results in archive entries with absolute paths (e.g., `/Users/alice/.claude/skills/my-skill.md`). Violates SEC-02 and breaks cross-machine restore.
**Why it happens:** `tar` npm's default behavior when `cwd` is not set: it archives exactly what you give it.
**How to avoid:** Always set `cwd: path.join(os.homedir(), '.claude')` in `tar.create()` options. Pass only relative paths in the file list. Verify with a post-creation check: list archive entries and assert none start with `/`.
**Warning signs:** Any `tar.create()` call without an explicit `cwd` option.

### Pitfall 3: Tilde Not Expanded
**What goes wrong:** `fs.readdir('~/.claude')` fails with `ENOENT`. `~/backups/export.tar.gz` as the output path creates a file named literally `~` in CWD.
**Why it happens:** Node.js `fs` does not expand tilde; that's the shell's job.
**How to avoid:** Every path from user input or config must be processed: `p.replace(/^~/, os.homedir())` before any `fs.*` call. `path.resolve()` will NOT expand `~`.
**Warning signs:** Any `fs.*` call where the path argument came from CLI input without tilde expansion.

### Pitfall 4: `program.parse()` Swallows Async Errors
**What goes wrong:** Using `program.parse()` instead of `program.parseAsync()` when action handlers are async — the Promise returned by the action is not awaited, errors are not caught, and the process exits 0 even on failure.
**Why it happens:** commander v12 docs showed `parse()` as the standard example; v14 added `parseAsync()` for async actions.
**How to avoid:** Always `await program.parseAsync(process.argv)` at the top level. Use `process.exitCode = 1` (not `process.exit(1)`) inside error handlers so cleanup runs.
**Warning signs:** `program.parse()` with any `async` action handler.

### Pitfall 5: `tar.create()` Without `portable: true` Embeds uid/gid
**What goes wrong:** Archive entries include numeric uid/gid from the source machine. On a machine with a different user ID, `tar.x()` may fail to set correct ownership or emit warnings.
**Why it happens:** Default tar behavior includes all metadata.
**How to avoid:** Always pass `portable: true` to `tar.create()`. This strips uid, gid, atime, ctime.
**Warning signs:** Omitting `portable: true`; tar entries showing `uid=501` or similar.

### Pitfall 6: Writing Archive Directly to Final Path
**What goes wrong:** If the process is killed mid-export (Ctrl-C, disk full), the output file is a partial archive. The user stores it as a backup and discovers corruption only during a real restore.
**Why it happens:** Streaming writes are incremental — the file is "open" until `tar.create()` resolves.
**How to avoid:** Write to `outputPath + '.tmp'` then `fs.rename(tmp, outputPath)` only on success. This is atomic on macOS/Linux (same filesystem). Clean up `.tmp` in a `finally` block.
**Warning signs:** `tar.create({ file: outputPath })` without a temp→rename pattern.

### Pitfall 7: `fs.promises.readdir({ recursive: true })` Returns Relative Paths
**What goes wrong:** Developer expects absolute paths and calls `fs.stat(result)` directly — this fails if CWD has changed or if `path.join(dir, result)` is not used.
**Why it happens:** `readdir({ recursive: true })` returns paths relative to the input directory, not absolute.
**How to avoid:** Always reconstruct absolute paths: `path.join(claudeDir, relPath)`.
**Warning signs:** `fs.stat(readdirResult)` without a `path.join(baseDir, ...)` wrapping.

---

## Code Examples

Verified patterns from official sources and local Node.js 24 runtime:

### Commander v14 — Subcommand with Optional Argument and Async Action
```javascript
// Source: commander v14 README (WebFetch 2026-04-04)
import { program } from 'commander';

program
  .command('export')
  .argument('[output]', 'output file path')
  .option('--include <types>', 'data types to include')
  .option('--exclude <types>', 'data types to exclude')
  .action(async (output, options) => {
    // options.include is a string like "skills,rules" — split it:
    const includeTypes = options.include?.split(',').map(s => s.trim()) ?? [];
    const excludeTypes = options.exclude?.split(',').map(s => s.trim()) ?? [];
    // ...
  });

await program.parseAsync(process.argv); // NOT program.parse()
```

### tar.create() — Streaming with cwd and gzip
```javascript
// Source: tar npm README (WebFetch 2026-04-04), verified against tar@7.5.13
import * as tar from 'tar';

await tar.create({
  gzip: true,
  file: '/tmp/output.tmp',
  cwd: '/Users/alice/.claude',   // all entries stored relative to this
  portable: true,                 // strip uid/gid/atime/ctime
  filter: (entryPath, stat) => {  // called with relative path from cwd
    // exclude any top-level dir in ALWAYS_EXCLUDED_NAMES
    const topLevel = entryPath.split('/')[0];
    return !ALWAYS_EXCLUDED_NAMES.has(topLevel);
  },
}, relativePathList);  // ['skills/', 'rules/my-rule.md', ...]
```

### fs.promises.readdir — Recursive Directory Walk
```javascript
// Source: Node.js 18.17+ built-in (stable)
import fs from 'node:fs/promises';
import path from 'node:path';

const claudeDir = path.join(os.homedir(), '.claude');
const entries = await fs.readdir(path.join(claudeDir, 'skills'), {
  recursive: true,
  withFileTypes: true,
});
// entries is Dirent[]; use entry.isFile() to filter
const files = entries
  .filter(e => e.isFile())
  .map(e => path.join(e.parentPath, e.name));
```

### SHA-256 Streaming Hash
```javascript
// Source: Node.js built-in crypto, verified locally
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(filePath)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve('sha256:' + hash.digest('hex')))
      .on('error', reject);
  });
}
```

### Tilde Expansion
```javascript
// Source: Node.js built-in os.homedir(), local verification
import os from 'node:os';
import path from 'node:path';

function expandTilde(p) {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}
// Usage: expandTilde('~/backups/export.tar.gz') → '/Users/alice/backups/export.tar.gz'
```

### Default Output Path Generation
```javascript
const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
const defaultOutput = path.join(process.cwd(), `claude-sync-${today}.tar.gz`);
```

### Manifest Structure
```javascript
const manifest = {
  version: '1.0.0',
  tool: 'claude-sync',
  exported_at: new Date().toISOString(),
  source_platform: process.platform,  // 'darwin', 'linux'
  included_types: includedTypes,       // ['skills', 'rules', ...]
  files: scannedFiles.map(f => ({
    path: f.relativePath,             // relative to archive root, NO leading /
    size: f.size,
    checksum: f.checksum,             // 'sha256:abc123...'
  })),
  excluded: {
    oauth_file: '~/.claude.json (always excluded — contains OAuth tokens)',
    runtime_dirs: Array.from(ALWAYS_EXCLUDED_NAMES),
  },
};
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js >=20 | Runtime | ✓ | 24.11.1 | — |
| npm | CLI-01 (global install) | ✓ | (with Node.js) | — |
| `~/.claude/` directory | EXP-01..07 | Not checked (user's machine) | — | Skip missing dirs gracefully |

**Missing dependencies with no fallback:** None — this is a greenfield tool; all dependencies are npm packages that will be installed.

**Note on `~/.claude/` contents:** The scanner must handle the case where individual data type directories do not exist (e.g., a user who has never set up agents). Silently skip with a `—` output line (per CONTEXT.md output format).

---

## Validation Architecture

`nyquist_validation` is `true` in `.planning/config.json`. This section is required.

### Test Framework

No test infrastructure exists yet. This phase must establish it.

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (available since Node 18; no install) |
| Config file | None needed — `node --test` discovers `**/*.test.mjs` |
| Quick run command | `node --test src/*.test.mjs` |
| Full suite command | `node --test` |
| Alternative | `vitest` — better DX, watch mode, coverage; requires `npm install -D vitest` |

**Recommendation:** Use `vitest` for its better snapshot testing and coverage reporting. It is ESM-native and requires zero config for a flat `src/` project. Add to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```
Install: `npm install -D vitest`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-01 | `bin` field registered, file is executable | smoke | `ls -l bin/claude-sync.mjs \| grep '^-rwx'` | ❌ Wave 0 |
| CLI-02 | `claude-sync export` produces a `.tar.gz` | integration | `node --test src/commands/export.test.mjs` | ❌ Wave 0 |
| EXP-01 | `skills/` directory contents appear in archive | unit | `node --test src/scanner.test.mjs` | ❌ Wave 0 |
| EXP-02 | `rules/` directory contents appear in archive | unit | `node --test src/scanner.test.mjs` | ❌ Wave 0 |
| EXP-03 | `settings.json` appears in archive | unit | `node --test src/scanner.test.mjs` | ❌ Wave 0 |
| EXP-04 | `commands/` directory contents appear in archive | unit | `node --test src/scanner.test.mjs` | ❌ Wave 0 |
| EXP-05 | `agents/` directory contents appear in archive | unit | `node --test src/scanner.test.mjs` | ❌ Wave 0 |
| EXP-06 | `CLAUDE.md` appears in archive | unit | `node --test src/scanner.test.mjs` | ❌ Wave 0 |
| EXP-07 | `keybindings.json` appears in archive | unit | `node --test src/scanner.test.mjs` | ❌ Wave 0 |
| EXP-09 | `manifest.json` at archive root with correct structure | unit | `node --test src/packer.test.mjs` | ❌ Wave 0 |
| EXP-10 | `--include skills` exports only skills; `--exclude rules` skips rules | unit | `node --test src/scanner.test.mjs` | ❌ Wave 0 |
| EXP-11 | `~/.claude.json` NEVER in archive; exclusion message printed | unit | `node --test src/exclusions.test.mjs` | ❌ Wave 0 |
| EXP-12 | `cache/`, `statsig/`, `debug/`, etc. never in archive | unit | `node --test src/exclusions.test.mjs` | ❌ Wave 0 |
| EXP-13 | No `readFileSync` used in hot path; large file test passes | unit | `node --test src/packer.test.mjs` | ❌ Wave 0 |
| SEC-02 | No archive entry path starts with `/` | unit | `node --test src/packer.test.mjs` | ❌ Wave 0 |

### Key Test Strategies per Requirement

**EXP-11 and EXP-12 (exclusions):** Use a fixture `~/.claude/` directory in `test/fixtures/` populated with known files including an `oauth` file and `cache/` dir. Assert exclusions.mjs returns false for those paths.

**SEC-02 (relative paths):** After `packer.mjs` creates an archive, extract the entry list using `tar.list({ file: outputPath })` and assert every entry path does NOT start with `/`. This is the primary SEC-02 automated check.

**EXP-09 (manifest):** After creating a test archive, extract and parse `manifest.json`. Assert it has `version`, `exported_at`, `files` array with correct `path`/`checksum` fields, and `excluded.oauth_file` present.

**EXP-13 (streaming):** Create a 50 MB test file in fixtures. Run export. Assert process memory stays below 200 MB (or simply assert no `ENOMEM` error). This is a smoke test — full streaming correctness is guaranteed by the `tar` package itself.

### Test Fixtures Needed
Create `test/fixtures/claude-home/` that mirrors the `~/.claude/` structure:
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
├── CLAUDE.md
├── keybindings.json
├── settings.json
├── cache/           ← must be excluded
│   └── dummy.json
└── debug/           ← must be excluded
    └── dummy.log
```
Plus `test/fixtures/oauth-home/.claude.json` — a fixture simulating the OAuth token file.

### Sampling Rate
- **Per task commit:** `npm test -- --reporter=verbose src/exclusions.test.mjs src/scanner.test.mjs`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `test/fixtures/claude-home/` — fixture directory structure
- [ ] `src/exclusions.test.mjs` — covers EXP-11, EXP-12
- [ ] `src/scanner.test.mjs` — covers EXP-01..07, EXP-10
- [ ] `src/packer.test.mjs` — covers EXP-09, EXP-13, SEC-02
- [ ] `src/commands/export.test.mjs` — covers CLI-02 (integration)
- [ ] `vitest` install: `npm install -D vitest`
- [ ] `package.json` `test` script: `"test": "vitest run"`

---

## Runtime State Inventory

> Greenfield phase — no rename/refactor. This section is included for completeness.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — project does not exist yet | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — first build | None |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.readdir` + manual recursion | `fs.promises.readdir({ recursive: true })` | Node.js 18.17 | Eliminates recursive helper function |
| `fs.promises.cp` polyfill (fs-extra) | Built-in `fs.promises.cp()` | Node.js 20.1 | Removes fs-extra dependency |
| CJS `require()` + chalk v4 | ESM `import` + chalk v5 | chalk v5 (2022), stable 2023+ | Native ESM; no CJS wrapper needed |
| `program.parse()` for all CLIs | `program.parseAsync()` for async actions | commander v8+ | Required for correct async error propagation |

**Deprecated/outdated:**
- `fs-extra`: Superseded by Node.js 20 built-ins; do not use.
- chalk v4: ESM-only chalk v5 is current; use v5.
- `JSON.parse(fs.readFileSync(...))` for large files: Always use streams.

---

## Sources

### Primary (HIGH confidence)
- tar npm v7.5.13 README — `tar.create()` API, `cwd`/`gzip`/`portable`/`filter` options, streaming patterns (WebFetch 2026-04-04, raw.githubusercontent.com/isaacs/node-tar/main/README.md)
- commander v14.0.3 GitHub README — subcommand API, `parseAsync()`, option definitions (WebFetch 2026-04-04)
- Node.js 24 built-ins verified locally — `crypto.createHash`, `fs.promises.readdir({ recursive })`, `os.homedir()` (Bash 2026-04-04)
- npm view package versions — commander@14.0.3, tar@7.5.13, chalk@5.6.2, ora@9.3.0, @inquirer/prompts@8.3.2 (Bash 2026-04-04)

### Secondary (MEDIUM confidence)
- PITFALLS.md (project research, 2026-04-04) — Pitfall 1 (OAuth token file location), Pitfall 3 (Zip Slip), Pitfall 7 (partial archive), Pitfall 9 (tilde expansion) — grounded in CVE references and real machine verification
- STACK.md (project research, 2026-04-04) — final technology decisions with rationale
- ARCHITECTURE.md (project research, 2026-04-04) — scanner→packer pipeline, manifest structure

### Tertiary (LOW confidence)
- WebSearch results for tar manifest injection patterns — confirmed temp-file approach is the standard workaround; low confidence because no authoritative single source directly addresses the `tar` npm package manifest-first pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified with `npm view` today
- Architecture: HIGH — pattern is well-established Node.js CLI; tar streaming is documented
- Manifest injection: MEDIUM — temp-file approach is correct but the exact low-level Pack API is underdocumented; temp-file approach avoids this ambiguity
- Pitfalls: HIGH — grounded in PITFALLS.md which cites CVEs and real machine verification

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable ecosystem; tar and commander rarely break APIs)
