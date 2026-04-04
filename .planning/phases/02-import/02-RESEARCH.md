# Phase 2: Import - Research

**Researched:** 2026-04-05
**Domain:** CLI tool for extracting tar.gz archives into ~/.claude/ with conflict protection, path rewriting, and backup
**Confidence:** HIGH

## Summary

Phase 2 implements the import half of claude-sync: restoring a Claude Code environment from a tar.gz archive. The implementation uses the `tar` npm package (v7.5.13) for extraction, which has built-in protection against symlink-based path traversal (CVE-2026-31802 fixed in v7.5.11). The archive format is the same staging-dir tar created during export, so extraction is straightforward: read the manifest, extract to a staging dir, then move files to ~/.claude/ with per-file conflict prompts.

**Primary recommendation:** Implement a restorer module (`src/restorer.mjs`) that handles all extraction logic, and two new command modules (`src/commands/import.mjs` and `src/commands/list.mjs`). The manifest must be extended with `source_home` to enable hook path rewriting.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Per-file prompts for conflicts only.** When `claude-sync import` encounters an existing file, prompt per-file before overwriting. Silent for new files.
- **`--force` skips all prompts** and overwrites everything.
- **`--dry-run` shows all conflicts** (and new files) without writing anything.
- Hook path rewriting: auto-detect source home from manifest, compare to `os.homedir()`, replace all occurrences of source prefix in settings.json hook commands. Print one-line summary if changes made. If same home dir, skip entirely. settings.json is replaced entirely (no merge), after path rewriting.
- **Backup only files that would be overwritten.** Destination: `~/.claude/backups/YYYY-MM-DDTHH-MM-SS/`. Abort import if any backup copy fails.
- **`list` subcommand mirrors export output format.** Grouped by type, file counts, same TYPE_LABELS. Reads manifest.json only, no extraction.

### Claude's Discretion

- How to structure the internal extraction pipeline (staging dir vs direct-to-dest, error handling strategy)
- How to implement per-file prompts (loop structure, early exit on ctrl-c)
- How to validate archive integrity before extracting

### Deferred Ideas

*(None)*

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-03 | `claude-sync import <archive.tar.gz>` restores environment from archive | Commander subcommand pattern mirrors export.mjs; tar.extract() with staging dir approach |
| CLI-04 | `claude-sync list <archive.tar.gz>` inspects archive without extracting | tar.list() + manifest.json parsing; matches export output format via shared TYPE_LABELS |
| IMP-01 | Import from archive to restore Claude Code environment | tar.extract() to staging dir, then move to ~/.claude/; manifest guides which files to extract |
| IMP-02 | Import does not overwrite existing files without `--force` | Per-file conflict check via `fs.access()` before write; `--force` bypasses all prompts |
| IMP-03 | `--dry-run` mode previews without disk changes | tar.list() reads manifest, diff against ~/.claude/ existing files, print report without extracting |
| IMP-04 | Hook paths rewritten to match current machine's home directory | Read `source_home` from manifest, replace prefix in settings.json content before writing |
| IMP-05 | Timestamped backup of overwritten files before any write | Copy existing conflicting files to `~/.claude/backups/YYYY-MM-DDTHH-MM-SS/` before each write |
| SEC-03 | Import validates archive paths to prevent path traversal (Zip Slip) | tar npm v7.5.11+ patches CVE-2026-31802; additionally validate with `path.resolve()` check |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tar (npm) | 7.5.13 | Extract tar.gz archives | Standard for Node.js tar handling; v7.5.11+ patches CVE-2026-31802 (symlink path traversal) |
| fs/promises | (built-in) | File existence checks, copy, mkdir | Node.js 20+ stdlib; no fs-extra needed |
| @inquirer/prompts | 8.3.2 | Per-file overwrite confirmation prompts | Project standard (ESM, no deps, async) |
| ora | 9.3.0 | Spinner during extraction | Project standard |
| chalk | 5.6.2 | Terminal color output | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| path | (built-in) | `path.resolve()`, `path.relative()` | Path validation for SEC-03 |
| os | (built-in) | `os.homedir()` | Target home dir for IMP-04 |

### Package Versions Verified
```bash
npm view tar version       # 7.5.13
npm view @inquirer/prompts version  # 8.3.2
npm view ora version       # 9.3.0
npm view chalk version     # 5.6.2
```

**Installation:** No new packages needed. All required packages are already in package.json.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── commands/
│   ├── export.mjs     # Phase 1 — export command
│   ├── import.mjs     # Phase 2 — import command (new)
│   └── list.mjs       # Phase 2 — list command (new)
├── restorer.mjs       # Phase 2 — extraction logic (new)
├── unpacker.mjs       # Phase 2 — archive reading/manifest parsing (new)
├── types.mjs          # Extended with source_home in Manifest
├── scanner.mjs        # Phase 1 — file scanning
├── packer.mjs         # Extended with source_home in buildManifest
├── exclusions.mjs     # TYPE_LABELS, DEFAULT_TYPES shared with list
└── commands/
```

### Pattern 1: tar extraction with staging directory

**What:** Extract archive to a temp staging dir first, then copy/move files to final destination. This prevents partial writes on error and enables atomic backup+write semantics.

**When to use:** For every file that needs to be written to ~/.claude/.

**Example:**
```javascript
// Source: tar npm package — tar.extract() API
import tar from 'tar';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const stageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-sync-import-'));
try {
  // Extract entire archive to staging dir (no path traversal risk with patched tar)
  await tar.extract({ file: archivePath, cwd: stageDir });

  // Read manifest
  const manifest = JSON.parse(await fs.readFile(path.join(stageDir, 'manifest.json'), 'utf-8'));

  // For each file in manifest:
  for (const entry of manifest.files) {
    const srcPath = path.join(stageDir, entry.path);
    const destPath = path.join(claudeDir, entry.path);

    // Check destination exists → conflict
    const exists = await fs.access(destPath).then(() => true).catch(() => false);
    if (exists && !force) {
      const overwrite = await confirm({ message: `Overwrite ${entry.path}?` });
      if (!overwrite) continue;
    }

    // Backup if exists
    if (exists) {
      await fs.mkdir(backupDir, { recursive: true });
      await fs.copyFile(destPath, path.join(backupDir, entry.path));
    }

    // Write
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(srcPath, destPath);
  }
} finally {
  await fs.rm(stageDir, { recursive: true, force: true });
}
```

### Pattern 2: Per-file conflict detection before write

**What:** Use `fs.access()` (or `fs.open()`) to check if destination file exists before attempting any write. This separates "does it exist" from "can I write it" concerns.

**Example:**
```javascript
async function fileExists(p) {
  return await fs.access(p).then(() => true).catch(() => false);
}
```

### Pattern 3: settings.json hook path rewriting

**What:** After extracting settings.json to staging, read it, replace source home prefix in all hook command strings, then write to destination.

**Example:**
```javascript
const SETTINGS_HOOK_PATTERN = /"command"\s*:\s*"([^"]*)"/g;

function rewriteHookPaths(content, sourceHome, targetHome) {
  return content.replace(SETTINGS_HOOK_PATTERN, (_, cmd) => {
    if (cmd.startsWith(sourceHome)) {
      return `"command": "${targetHome}${cmd.slice(sourceHome.length)}"`;
    }
    return `"command": "${cmd}"`;
  });
}
```

Note from CONTEXT.md: source_home comes from manifest, which is `os.homedir()` recorded at export time. Use `String.prototype.replaceAll()` for replacing all occurrences of the source prefix.

### Pattern 4: Dry-run mode with no disk writes

**What:** In dry-run mode, use `tar.list()` to read the archive's entry names, then diff against what exists in ~/.claude/. Print every file that would be written or overwritten without creating any files or directories.

**Example:**
```javascript
// Source: tar npm — tar.list() API (used in export.test.mjs)
const entries = [];
await tar.list({
  file: archivePath,
  onReadEntry: (entry) => entries.push(entry.path.replace(/^\.\//, '')),
});
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path traversal prevention | Manual path validation (e.g., checking for `..` in paths) | `tar` npm v7.5.11+ (patches CVE-2026-31802) | The tar package's extraction has been audited and patched for symlink traversal; manual checks miss edge cases |
| Archive listing | Parse tar.gz manually | `tar.list()` with `onReadEntry` | Built-in streaming parser, no memory overhead |
| Confirmation prompts | `readline` or manual yes/no parsing | `@inquirer/prompts` confirm | Project standard; handles ctrl-c, cursor positioning |
| Spinner for long operations | Manual terminal animation | `ora` | Project standard |

---

## Common Pitfalls

### Pitfall 1: Writing files directly to ~/.claude during extraction

**What goes wrong:** If extraction fails midway, ~/.claude/ is left in a partially-updated state with no rollback possible.

**Why it happens:** Extracting tar directly into ~/.claude/ with `tar.extract({ cwd: claudeDir })` writes files as they are extracted, with no atomicity.

**How to avoid:** Always extract to a staging directory first. Only move/copy files to ~/.claude/ after the full archive is validated. If any step fails, `finally` block cleans up staging dir and ~/.claude/ is untouched.

### Pitfall 2: Not checking file existence before copy

**What goes wrong:** `fs.copyFile()` silently overwrites existing files. The backup (IMP-05) would capture the overwritten content, but the overwrite happens before the backup if code order is wrong.

**Why it happens:** `copyFile` does not fail on existing files.

**How to avoid:** Check existence with `fs.access()` before deciding to copy. Always backup BEFORE the copy (not after). The CONTEXT.md says backup happens "before any write occurs" — code must explicitly copy existing file to backup dir before calling copyFile.

### Pitfall 3: settings.json path rewriting breaking JSON structure

**What goes wrong:** Doing a naive string replacement of home directory paths can break JSON escaping or produce invalid JSON if paths contain regex-special characters.

**Why it happens:** Source home (e.g., `/Users/john`) might appear in contexts other than hook commands. Replacement must be scoped to `"command":` value strings only.

**How to avoid:** Use a regex that specifically matches `"command": "<path>"` patterns and only replaces the path portion within those strings.

### Pitfall 4: Assuming tar.extract() strips path prefixes

**What goes wrong:** `tar.extract({ cwd: destDir })` places files relative to destDir, but tar entries may have `./` prefixes. Without `strip` option or proper handling, files could land at `./.claude/skills/` instead of `skills/`.

**Why it happens:** tar entries commonly have `./` prefixes (e.g., `./skills/foo.md`).

**How to avoid:** Normalize entry paths by stripping leading `./` before joining with destination. The staging dir approach sidesteps this because entries are extracted relative to stageDir root, and manifest paths are already stripped.

### Pitfall 5: Running out of temp disk space for large archives

**What goes wrong:** Extracting a large archive (up to 3.8 GB per EXP-13) to a temp staging dir requires free space equal to the archive size plus extracted size.

**Why it happens:** Staging dir stores entire extracted contents before copying to ~/.claude/.

**How to avoid:** For now, document this limitation. The staging dir is cleaned up promptly in a `finally` block. A streaming approach (extracting and writing one file at a time) would be more memory-efficient but more complex to implement — defer to future work.

---

## Code Examples

### Reading manifest from archive (no full extraction)

```javascript
// Source: src/commands/export.test.mjs — listArchiveEntries()
import tar from 'tar';
import fs from 'node:fs/promises';
import path from 'node:path';

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
```

### Listing archive entries (for list subcommand)

```javascript
// Source: src/commands/export.test.mjs — listArchiveEntries()
import tar from 'tar';

async function listArchiveEntries(archivePath) {
  const entries = [];
  await tar.list({
    file: archivePath,
    onReadEntry: (entry) => entries.push(entry.path.replace(/^\.\//, '')),
  });
  return entries;
}
```

### Inquirer confirm prompt

```javascript
// Source: @inquirer/prompts npm page
import { confirm } from '@inquirer/prompts';

const overwrite = await confirm({ message: `Overwrite ${filePath}?` });
if (!overwrite) continue;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manually check for `..` in tar entry paths | tar npm v7.5.11+ with patched symlink traversal | v7.5.11 (CVE-2026-31802) | No longer need to validate paths manually |
| Extract directly to destination | Staging dir approach | Standard practice | Atomic, rollback-safe, enables backup-before-write |

**Deprecated/outdated:**
- `fs.copyFile()` without pre-existence check: old approach assumed overwrite semantics; new code must check existence and prompt/backup first.
- Not recording source_home in manifest: exports from Phase 1 won't have source_home field; import must handle gracefully (skip rewriting if field absent).

---

## Open Questions

1. **Should import verify checksums from manifest against extracted files?**
   - What we know: manifest contains SHA-256 checksums for all archived files (EXP-09). The Phase 1 packer calculates them during export.
   - What's unclear: Is checksum verification needed for integrity, or does tar's built-in checksum (POSIX tar header) suffice? The tar package validates header checksums during extraction.
   - Recommendation: Skip for v1. Tar's header checksum validation is sufficient. Add explicit content verification in v2 if needed.

2. **How to handle import when source archive is from a newer tool version?**
   - What we know: manifest records `version` field (e.g., "0.1.0").
   - What's unclear: Should we reject importing into an older tool?
   - Recommendation: Warn but proceed. The archive format is just files + manifest; version differences don't affect restore semantics.

3. **What happens if ~/.claude/backups/ directory itself already exists with content?**
   - What we know: CONTEXT.md says backup destination is `~/.claude/backups/YYYY-MM-DDTHH-MM-SS/` — a timestamped subdirectory, not `backups/` directly.
   - What's unclear: Is there any conflict with an existing `backups/` directory?
   - Recommendation: `fs.mkdir({ recursive: true })` creates the timestamped subdirectory safely. The parent `backups/` directory may already exist from previous imports — this is fine.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond Node.js and already-listed npm packages)

All dependencies are available via existing package.json:
- Node.js >=20: required (package.json engines)
- chalk, ora, @inquirer/prompts, tar, commander: all in package.json
- fs/promises, path, os: Node.js built-ins

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.1.1 (already installed) |
| Config file | vitest.config.js or vitest.workspace.js (not yet created) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test -- --run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-03 | `import <archive>` restores environment to ~/.claude/ | integration | `npm test -- --run src/commands/import.test.mjs` | no |
| CLI-04 | `list <archive>` shows manifest without extracting | integration | `npm test -- --run src/commands/list.test.mjs` | no |
| IMP-01 | Files extracted to correct locations in ~/.claude/ | unit/integration | `npm test -- --run src/restorer.test.mjs` | no |
| IMP-02 | Existing files not overwritten without --force | unit | `npm test -- --run src/restorer.test.mjs` | no |
| IMP-03 | --dry-run shows changes without writing | unit | `npm test -- --run src/restorer.test.mjs` | no |
| IMP-04 | Hook paths rewritten to target home dir | unit | `npm test -- --run src/restorer.test.mjs` | no |
| IMP-05 | Backup created for overwritten files | unit | `npm test -- --run src/restorer.test.mjs` | no |
| SEC-03 | Path traversal entries rejected | unit | `npm test -- --run src/restorer.test.mjs` | no |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test -- --run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.js` — root vitest config (can use default with `npm test`)
- [ ] `src/restorer.test.mjs` — unit tests for extraction, backup, path rewriting, conflict detection
- [ ] `src/restorer.mjs` — core extraction logic
- [ ] `src/commands/import.mjs` — import command module
- [ ] `src/commands/import.test.mjs` — integration tests for import command
- [ ] `src/commands/list.mjs` — list command module
- [ ] `src/commands/list.test.mjs` — integration tests for list command
- [ ] `src/unpacker.mjs` — archive reading and manifest parsing (shared between import and list)
- [ ] `src/unpacker.test.mjs` — tests for unpacker

---

## Sources

### Primary (HIGH confidence)
- [tar npm package](https://www.npmjs.com/package/tar) - extract/list API, v7.5.13 verified
- [tar v7.5.11 security advisory (CVE-2026-31802)](https://github.com/isaacs/node-tar/security/advisories/GHSA-9ppj-qmqm-q256) - symlink path traversal patched in v7.5.11
- [@inquirer/prompts npm page](https://www.npmjs.com/package/@inquirer/prompts) - confirm prompt API
- [src/commands/export.test.mjs](/Users/dangnguyen/Projects/claude-sync/src/commands/export.test.mjs) - listArchiveEntries() and readManifestFromArchive() patterns verified
- [src/packer.mjs](/Users/dangnguyen/Projects/claude-sync/src/packer.mjs) - buildManifest() pattern, source_home needs adding
- [src/types.mjs](/Users/dangnguyen/Projects/claude-sync/src/types.mjs) - Manifest and ScannedFile types

### Secondary (MEDIUM confidence)
- [node-tar GitHub security advisories](https://github.com/isaacs/node-tar/security/advisories) - CVE-2026-31802 details

### Tertiary (LOW confidence)
- [WebSearch: tar npm path traversal zip slip 2024](https://github.com/isaacs/node-tar/security/advisories/GHSA-9ppj-qmqm-q256) - confirmed tar v7.5.11+ fixes symlink traversal

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages already in use, versions verified against npm
- Architecture: HIGH - staging-dir pattern is standard, tar API verified in export.test.mjs
- Pitfalls: HIGH - all pitfalls identified from known edge cases in tar and fs operations

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (30 days — package versions are stable)
