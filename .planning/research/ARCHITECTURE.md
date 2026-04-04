# Architecture Patterns

**Domain:** CLI backup/export/import tool for Claude Code data
**Researched:** 2026-04-04
**Confidence:** HIGH (Node.js CLI and archive patterns are well-established)

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────┐
│                   CLI Layer                      │
│   bin/claude-sync.js  (Commander.js entrypoint)  │
│   commands/export.js  commands/import.js         │
│   commands/list.js    commands/verify.js         │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│                 Core Layer                       │
│   scanner.js   — discovers ~/.claude/ contents  │
│   packer.js    — builds archive + manifest      │
│   unpacker.js  — reads archive, validates       │
│   restorer.js  — writes files, handles conflicts│
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              Utilities Layer                     │
│   fs-helpers.js  — safe read/write/copy          │
│   prompt.js      — interactive conflict prompts  │
│   logger.js      — stdout/stderr formatting      │
│   checksum.js    — sha256 file hashing           │
└─────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With | Key Constraints |
|-----------|---------------|-------------------|-----------------|
| `bin/claude-sync.js` | Shebang entrypoint; delegates to CLI layer | CLI Layer only | Must be `#!/usr/bin/env node`; set executable bit |
| `commands/export.js` | Parses export flags; orchestrates scan → pack | scanner, packer, logger | No direct fs operations; delegates to core |
| `commands/import.js` | Parses import flags; orchestrates unpack → restore | unpacker, restorer, prompt, logger | Never writes without conflict check |
| `commands/list.js` | Reads manifest from archive; prints contents | unpacker (manifest only) | Read-only; no side effects |
| `commands/verify.js` | Validates archive integrity; checks checksums | unpacker, checksum | Read-only; no side effects |
| `scanner.js` | Walks `~/.claude/` and classifies files by type | fs-helpers | Returns `ScannedFile[]`; knows nothing about archives |
| `packer.js` | Creates archive with manifest; uses `archiver` | scanner output, checksum | Streaming; never loads full archive in memory |
| `unpacker.js` | Reads archive; extracts manifest and file list | adm-zip or archiver-extract | Returns parsed manifest + file entries |
| `restorer.js` | Applies files to disk with conflict resolution | fs-helpers, prompt | Dry-run aware; never skips conflict check |
| `fs-helpers.js` | Atomic file writes; mkdir -p; path safety | Node.js `fs/promises` | Must prevent path traversal attacks |
| `prompt.js` | Interactive y/n/skip/overwrite-all prompts | Node.js readline or enquirer | Falls back to `--force` / `--skip` flags |
| `logger.js` | Structured stdout/stderr; verbose flag; color | — | Quiet when piped (TTY detection) |
| `checksum.js` | SHA-256 of file content | Node.js `crypto` | Pure function; no I/O |

---

## Data Flow: Export

```
User runs: claude-sync export [options]
    │
    ▼
commands/export.js
  - Parse: --include, --exclude, --output, --dry-run flags
  - Resolve output path (default: ./claude-backup-YYYY-MM-DD.zip)
    │
    ▼
scanner.js
  - Walk ~/.claude/ with fs.readdirSync recursive
  - Classify each file by type:
      skills/      → type: "skill"
      rules/       → type: "rule"
      settings.json → type: "settings"
      projects/**  → type: "conversation"
      hooks/**     → type: "hook-script"
  - Apply include/exclude filters
  - Compute SHA-256 for each file
  - Return: ScannedFile[] = { path, relativePath, type, size, checksum }
    │
    ▼
packer.js
  - Build manifest object (see Manifest Structure below)
  - Create archiver instance (zip format)
  - Append manifest.json as first entry (string → buffer)
  - Stream each ScannedFile into archive preserving relative paths
  - Finalize archive
  - Emit: archive written to output path
    │
    ▼
logger.js
  - Print: summary of what was packed
  - Print: output file path + size
```

If `--dry-run`: scanner runs, but packer is skipped. Print what would be included.

---

## Data Flow: Import

```
User runs: claude-sync import <archive-path> [options]
    │
    ▼
commands/import.js
  - Parse: --dry-run, --force, --skip-existing, --only=type flags
  - Validate archive file exists and is readable
    │
    ▼
unpacker.js
  - Open archive (adm-zip for synchronous read, or archiver-extract)
  - Extract and parse manifest.json
  - Validate manifest schema version
  - Return: { manifest, entries: ArchiveEntry[] }
    │
    ▼
restorer.js (per file)
  For each entry in archive:
    1. Compute destination path: ~/.claude/<relativePath>
    2. Security check: destination must be inside ~/.claude/ (prevent path traversal)
    3. Check if file exists at destination
       a. Does not exist → write file
       b. Exists + --force → overwrite
       c. Exists + --skip-existing → skip
       d. Exists + interactive → prompt user (overwrite / skip / overwrite-all / abort)
    4. Create parent directories if needed
    5. Write file (atomic: write to temp, rename)
    6. Verify written checksum matches manifest checksum
    │
    ▼
logger.js
  - Print: per-file status (written / skipped / overwritten / conflict)
  - Print: final summary (N written, N skipped, N errors)
```

If `--dry-run`: unpacker runs, conflict detection runs, but file writes are skipped. All actions are printed as "would write" / "would overwrite" / "would skip".

---

## Archive Format

Use ZIP (`.zip`) not tar.gz. Reason: ZIP is extractable on macOS without CLI tools (double-click), making the archive inspectable and recoverable without the tool itself. This is important for a backup tool — if the tool breaks, the data must still be accessible.

### Directory layout inside the ZIP

```
claude-backup-2026-04-04.zip
├── manifest.json          ← always first entry
├── skills/
│   ├── skill-name.md
│   └── another-skill.md
├── rules/
│   ├── rule-file.md
│   └── context7.md
├── settings.json          ← global settings (hooks section included)
├── hooks/
│   └── script.sh
└── projects/
    ├── project-hash-1/
    │   └── conversation.jsonl
    └── project-hash-2/
        └── conversation.jsonl
```

### Manifest Structure

```json
{
  "version": 1,
  "tool": "claude-sync",
  "toolVersion": "1.0.0",
  "createdAt": "2026-04-04T12:00:00.000Z",
  "platform": "darwin",
  "sourceDir": "/Users/username/.claude",
  "totalFiles": 42,
  "totalBytes": 1048576,
  "checksumAlgo": "sha256",
  "files": [
    {
      "path": "skills/my-skill.md",
      "type": "skill",
      "size": 1024,
      "checksum": "abc123...",
      "mtime": "2026-03-01T10:00:00.000Z"
    },
    {
      "path": "settings.json",
      "type": "settings",
      "size": 512,
      "checksum": "def456...",
      "mtime": "2026-04-01T08:00:00.000Z"
    },
    {
      "path": "projects/abc123/conversation.jsonl",
      "type": "conversation",
      "size": 204800,
      "checksum": "ghi789...",
      "mtime": "2026-04-04T09:00:00.000Z"
    }
  ],
  "categories": {
    "skill": 5,
    "rule": 3,
    "settings": 1,
    "hook-script": 2,
    "conversation": 31
  }
}
```

The `version: 1` field is critical — it allows future manifest schema changes without breaking old archives. The importer must reject archives with unknown `version` values and print a clear upgrade message.

---

## Discovery: What Is in ~/.claude/

The scanner must be aware of these known paths and classify them:

| Path Pattern | Type | Notes |
|---|---|---|
| `~/.claude/skills/*.md` | `skill` | Markdown skill files |
| `~/.claude/rules/*.md` | `rule` | Markdown rule files |
| `~/.claude/settings.json` | `settings` | Global config with hooks |
| `~/.claude/hooks/**` | `hook-script` | Shell scripts referenced by settings.json |
| `~/.claude/projects/**` | `conversation` | Nested; preserve full relative path |
| `~/.claude/get-shit-done/**` | `gsd` (excluded by default) | Optional workflow system; user opts-in |
| `~/.claude/commands/**` | `command` | Custom slash commands |

Discovery strategy: walk the directory, classify by path prefix. Unknown paths under `~/.claude/` should be classified as `unknown` — include them but mark clearly in manifest. This is safer than silently dropping unknown files.

Settings.json structure (confirmed from official Claude Code docs):
- `hooks` key: contains hook event handlers (PreToolUse, PostToolUse, Stop, etc.)
- `disableAllHooks` key: boolean
- Other permission and behavior settings

When exporting settings.json, export the entire file. When importing, perform a merge on the `hooks` key rather than a full overwrite — the existing machine may have hooks that were not in the backup.

---

## Conflict Resolution Matrix

| Scenario | Default Behavior | --force | --skip-existing | Interactive |
|---|---|---|---|---|
| File does not exist | Write | Write | Write | Write |
| File exists, identical checksum | Skip (no-op) | Skip | Skip | Skip |
| File exists, different content | Prompt | Overwrite | Skip | Prompt: overwrite/skip/abort |
| settings.json hooks merge | Merge (hooks) | Full overwrite | Skip | Prompt: merge/overwrite/skip |

"Identical checksum" shortcut avoids unnecessary writes and makes imports idempotent when run twice.

---

## CLI Command Hierarchy

```
claude-sync
├── export [output-path]           # default: ./claude-backup-YYYY-MM-DD.zip
│   ├── --include <types>          # comma-separated: skills,rules,settings,conversations,hooks
│   ├── --exclude <types>          # inverse
│   ├── --dry-run                  # print what would be exported without writing
│   └── --verbose                  # show each file as it is packed
│
├── import <archive-path>
│   ├── --dry-run                  # print what would change without writing
│   ├── --force                    # overwrite all existing without prompting
│   ├── --skip-existing            # skip all existing files without prompting
│   ├── --only <types>             # import only certain types
│   └── --verbose                  # show each file as it is restored
│
├── list <archive-path>            # print contents of an archive (reads manifest)
│   ├── --type <type>              # filter by type
│   └── --json                     # output as JSON for scripting
│
└── verify <archive-path>          # validate checksums; confirm archive is intact
    └── --verbose                  # show per-file result
```

Framework recommendation: **Commander.js** over Yargs. Commander has cleaner declarative syntax for a tool with this shape (flat subcommands, no deep nesting). Yargs middleware is overkill here. Commander v12+ has full TypeScript types and async action support.

---

## Packaging: npx-Runnable

No compilation step required. The tool ships as pure Node.js with:

```json
{
  "name": "claude-sync",
  "bin": {
    "claude-sync": "./bin/claude-sync.js"
  },
  "type": "module"
}
```

`bin/claude-sync.js` begins with `#!/usr/bin/env node`.

Runnable as:
- `npx claude-sync export` — no install needed
- `npm install -g claude-sync && claude-sync export` — global install

For a single-binary distribution (ship to teammates without npm), use Node.js SEA (Single Executable Application, stable in Node 20+): bundle with esbuild into one file, inject into node binary using `postject`. This is a Phase 2+ concern — v1 ships as npx only.

---

## Dependencies

| Package | Role | Why This One |
|---|---|---|
| `commander` | CLI argument parsing, subcommands | Most widely used, lowest overhead, clean subcommand API |
| `archiver` | Streaming ZIP creation (export) | Stream-based (memory efficient for large conversation dirs) |
| `adm-zip` | Synchronous ZIP reading (import, list, verify) | Simpler API for reading; archiver is write-only |
| Node.js `crypto` | SHA-256 checksums | Built-in; no dependency |
| Node.js `fs/promises` | All file I/O | Built-in; async |
| Node.js `path` | Path manipulation | Built-in |
| `enquirer` (optional) | Interactive conflict prompts | Better UX than raw readline; only needed if interactive mode is in v1 |

The constraint from PROJECT.md says "no external dependencies" but this refers to the runtime environment (no requirement for Python, Rust, etc.), not npm packages. Node.js is already present because Claude Code requires it.

---

## Suggested Build Order

Phase ordering is driven by dependency: you cannot import what you cannot export; you cannot verify what has no manifest.

### Phase 1: Foundation
1. `logger.js` — needed by everything
2. `fs-helpers.js` — needed by scanner and restorer
3. `checksum.js` — needed by scanner and packer
4. `scanner.js` — core discovery logic
5. `bin/claude-sync.js` + `commands/export.js` skeleton

**Milestone:** `claude-sync export` produces a valid ZIP with manifest.

### Phase 2: Import
6. `unpacker.js` — reads manifest from archive
7. `restorer.js` — writes files with --force only (no interactive yet)
8. `commands/import.js`

**Milestone:** `claude-sync import --force archive.zip` fully restores.

### Phase 3: Safety and UX
9. `prompt.js` — interactive conflict resolution
10. Dry-run mode in both export and import
11. `commands/list.js`
12. `commands/verify.js`
13. `--skip-existing` flag; settings.json merge logic

**Milestone:** Full feature parity with spec; all flags work.

### Phase 4: Polish (optional, v2)
- Selective export by type (`--include skills,rules`)
- Single binary packaging (Node SEA or pkg)
- Shell completion scripts

---

## Security Considerations

### Path Traversal Prevention
Archive entries with paths like `../../.ssh/authorized_keys` must be rejected. Before writing any file during import, verify:

```
resolvedPath.startsWith(path.resolve(os.homedir(), '.claude'))
```

If not, reject and log an error. This is a mandatory safety check in `restorer.js`.

### Settings.json Merge Safety
When importing settings.json, do not blindly overwrite. The hooks section may reference scripts (by path) that exist on the source machine but not the destination. Flag these in the import output as "referenced script not found in archive".

---

## Scalability Considerations

| Concern | At typical use | At large conversation history |
|---|---|---|
| Memory during export | Streaming via archiver; low | Still streaming; no issue |
| Memory during import | adm-zip loads full zip; OK for <1GB | May need switch to streaming extractor for very large backups |
| Speed | Fast (local disk I/O) | Bottleneck is projects/ directory with many large JSONL files; consider --exclude conversations flag |
| Archive size | Typically 10-100MB | Conversations can be GBs; ZIP compression helps JSONL (text) significantly |

---

## Sources

- Commander.js official: https://github.com/tj/commander.js
- Archiver npm: https://www.npmjs.com/package/archiver
- adm-zip comparison: https://www.pkgpulse.com/blog/archiver-vs-adm-zip-vs-jszip-zip-archive-creation-2026
- Node.js SEA docs: https://nodejs.org/api/single-executable-applications.html
- Claude Code hooks structure: https://code.claude.com/docs/en/hooks
- Claude Code settings guide: https://www.eesel.ai/blog/settings-json-claude-code
- npx CLI packaging: https://www.sheshbabu.com/posts/publishing-npx-command-to-npm/
- Node.js recursive readdir: https://nodejs.org/learn/manipulating-files/working-with-folders-in-nodejs
