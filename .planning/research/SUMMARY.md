# Project Research Summary

**Project:** claude-sync
**Domain:** CLI backup/export/import tool for developer configuration and conversation history
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

claude-sync is a focused Node.js CLI that packages the entire Claude Code environment — configuration, custom assets, and optionally conversation history — into a single portable archive, then restores it on another machine or after a reset. The tool sits in a well-understood category (dotfile backup tools like chezmoi and shallow-backup), which means the patterns are established and the main risks are domain-specific rather than architectural. The recommended approach is a streaming pipeline: scanner discovers and classifies files under `~/.claude/`, packer streams them into a tar.gz archive with an embedded manifest, and on import unpacker reads the manifest then restorer writes files with full conflict handling. The entire stack — Node.js 20+, commander v14, tar npm package, chalk, ora, and @inquirer/prompts — is pure ESM with zero external runtime requirements beyond Node.js itself.

The highest-risk areas are security and cross-machine portability, not implementation complexity. The `~/.claude.json` file (home root, not inside `~/.claude/`) contains OAuth tokens and MCP credentials and must never be exported — this exclusion must be enforced from day one before any file-collection logic is written. A secondary security concern is that `settings.json` hook commands may embed literal API keys; a pre-export secret scan is required. On the portability side, `settings.json` stores hook paths as absolute paths (breaking on machines with different usernames), and `~/.claude/projects/` folder names encode the source machine's absolute project paths — both require deliberate handling on import.

The scope of `~/.claude/` is larger than initially expected: in addition to `skills/`, `rules/`, and `settings.json`, it contains `commands/` (59+ slash commands), `agents/` (17+ persona files at 40KB+ each), `hooks/` (JS scripts), `CLAUDE.md`, `keybindings.json`, and `history.jsonl`. Conversation history in `projects/` can reach multiple gigabytes in active installations (confirmed reports of 3.8 GB single session files), making streaming mandatory for export and making conversations an opt-in category rather than a default.

## Key Findings

### Recommended Stack

The stack is straightforward and coherent because Claude Code already requires Node.js 18+, so users are guaranteed to have a Node.js runtime. Targeting Node.js 20+ unlocks commander v14 (latest), `fs.promises.cp()` (stable since Node 20.1), and full native ESM support. ESM is the correct module format because chalk v5, ora v9, and @inquirer/prompts v8 are all ESM-only — using CommonJS forces pinning to older versions of all three.

The archive format decision resolves to **tar.gz** (npm `tar` package v7). ARCHITECTURE.md suggested ZIP for double-click inspectability, but PITFALLS.md's Pitfall 11 confirms that tar.gz is superior for this use case: it preserves POSIX permissions and extended attributes, which matters for executable hook scripts in `hooks/`. The `tar` npm package handles streaming natively, which is mandatory given multi-gigabyte conversation files.

**Core technologies:**
- **Node.js 20+**: Runtime — zero additional install burden; Claude Code already requires it
- **commander v14**: CLI framework — zero dependencies, 18ms startup, clean subcommand API for a 2-command tool
- **tar (npm) v7**: Archive creation/extraction — pure JS, streaming, POSIX-correct, handles symlinks
- **fs/promises (built-in)**: File I/O — `fs.promises.cp()` and `fs.promises.mkdir()` cover all needs natively
- **chalk v5**: Terminal color — pure ESM, zero deps, required for success/error/warning distinction
- **ora v9**: Progress spinner — essential for large conversation exports where silence looks like a hang
- **@inquirer/prompts v8**: Conflict prompts — powers the non-destructive import gate and selective export checkboxes

### Expected Features

The `~/.claude/` directory surface area is larger than PROJECT.md anticipated. Direct inspection reveals `commands/` and `agents/` as significant content that must be included in the core export. The classification of `projects/` as opt-in (rather than excluded by default) is the right call given size realities.

**Must have (table stakes):**
- `export` command — bundle settings.json, rules/, skills/, hooks/, commands/, agents/, CLAUDE.md, keybindings.json
- `import` command — extract archive to `~/.claude/` with conflict detection and user prompts
- Single-file tar.gz output — portable, shareable, no directory fragmentation
- `--include`/`--exclude` type flags — at minimum a `--no-history` flag to skip `projects/`
- `--dry-run` on import — preview what would change before any writes
- `--force` on import — bypass prompts for scripted use and CI migration pipelines
- Manifest file inside archive — timestamp, hostname, tool version, file list with checksums
- Hook path rewriting on import — absolute paths in settings.json hooks break on new machines
- Explicit `~/.claude.json` exclusion with documentation — non-negotiable security requirement

**Should have (differentiators):**
- `inspect` subcommand — read and print manifest without extracting archive
- `verify` subcommand — validate checksums to confirm archive integrity
- Pre-export secret scan — warn when hook commands contain patterns matching API keys or Bearer tokens
- Pre-import backup — create `~/.claude/backups/pre-import-TIMESTAMP/` before any write
- Size warning before export — alert user if projects/ would make the archive large
- `--remap-path OLD NEW` flag on import — rename project directories for cross-machine username migration

**Defer to v2+:**
- Per-project conversation filtering (`--projects myapp`)
- Import diff preview (file-by-file delta before prompting)
- Shell completion scripts
- Single binary distribution via Node SEA

**Never build:**
- Cloud sync, encryption, merge mode for conversations, interactive TUI, scheduling, Windows support

### Architecture Approach

The architecture is a linear pipeline with two halves — export (scanner → packer) and import (unpacker → restorer) — connected by a versioned archive format with an embedded manifest. The CLI layer (Commander.js entry point plus per-command modules) delegates entirely to the core layer; commands contain no direct file system operations. A shared utilities layer provides logger, fs-helpers (with path traversal protection), checksum (SHA-256 via Node.js built-in `crypto`), and prompt wrappers. This separation keeps the core testable and the commands thin.

**Major components:**
1. **scanner.js** — walks `~/.claude/`, classifies files by type (skill/rule/settings/hook-script/command/agent/conversation), applies include/exclude filters, computes checksums; returns `ScannedFile[]`
2. **packer.js** — writes manifest.json as first archive entry, streams each `ScannedFile` into tar.gz; never buffers file contents in memory; writes to `.tmp` file and renames atomically on completion
3. **unpacker.js** — reads archive, extracts and validates manifest schema version, returns parsed manifest + file entries
4. **restorer.js** — writes files to disk with four modes (write/overwrite/skip/prompt); validates every extracted path starts with `path.resolve(os.homedir(), '.claude')` before writing; dry-run aware
5. **fs-helpers.js** — atomic writes (temp + rename), mkdir -p, path traversal guard — the only module that touches the filesystem on the import side
6. **manifest (format)** — JSON with `version: 1` schema field; includes tool version, platform, source dir, per-file checksums, and category counts; `version` field enables future schema migration without breaking old archives

### Critical Pitfalls

1. **`~/.claude.json` inclusion (CRITICAL security)** — The file at `$HOME/.claude.json` (not inside `$HOME/.claude/`) contains OAuth tokens, MCP credentials, and account UUIDs. A glob like `~/.claude*` captures it. Prevention: explicitly exclude by filename, not directory prefix; the exclusion list must be established in Phase 1 before any file-collection code is written.

2. **Hook command secrets in settings.json (HIGH security)** — Hook `command` strings in `settings.json` may contain literal API keys (`sk-ant-`, `Bearer `, `Authorization:`). Prevention: scan `command` fields against known secret patterns before archive creation; warn user and require `--skip-secret-scan` to suppress.

3. **Zip Slip / path traversal on import (CRITICAL security)** — Archive entries with `../` sequences can write files outside `~/.claude/`. CVE-2025-3445 confirmed this class recurs actively. Prevention: validate every extracted path via `resolvedPath.startsWith(path.resolve(os.homedir(), '.claude') + path.sep)` in restorer.js before any write; reject and log any entry that fails this check.

4. **Large JSONL files crashing with readFileSync (HIGH reliability)** — Conversation files can reach 3.8 GB (confirmed GitHub issue #18905). Prevention: streaming API throughout — `fs.createReadStream` → tar entry stream; never `readFileSync` on anything from `projects/`; conversations are opt-in by default.

5. **Project folder names encode source absolute paths (MEDIUM portability)** — `~/.claude/projects/-Users-alice-Projects-myapp/` restores to the wrong directory on a machine with a different username. Prevention: document the limitation in v1; implement `--remap-path OLD NEW` flag that renames directories and rewrites embedded path strings in JSONL files during extraction.

6. **Hook paths in settings.json are absolute (HIGH portability)** — `/Users/alice/.claude/hooks/script.js` is embedded in settings.json and breaks on any other machine. Prevention: on import, rewrite hook paths by replacing the source `sourceDir` prefix (from manifest) with the target machine's `~/.claude/` path.

## Implications for Roadmap

Based on research, the dependency chain is clear: you cannot import what you cannot export; you cannot safely import without conflict handling; you cannot trust an archive without a manifest. Security requirements (exclusion list, path validation) must be baked into the first phase, not retrofitted.

### Phase 1: Foundation and Export

**Rationale:** Export must exist before import; the manifest format and exclusion list must be defined before any file-collection code is written; streaming must be baked in from the start since retrofitting it to large files is expensive. Security exclusions belong here because they define the boundary of what the tool touches.

**Delivers:** `claude-sync export` produces a valid tar.gz archive with a versioned manifest, correct exclusions, and streaming file collection.

**Addresses:**
- Core export command
- Single-file tar.gz output with manifest
- Explicit `~/.claude.json` exclusion and directory exclusion list (debug/, telemetry/, statsig/, cache/, etc.)
- Streaming file collection via `fs.createReadStream`
- Atomic write (temp file + rename) to prevent partial archives
- Tilde expansion for all CLI path arguments
- Symlink detection via `fs.lstat`
- Pre-export secret scan on settings.json hook commands

**Avoids:** Pitfalls 1 (OAuth tokens), 2 (hook secrets), 7 (partial archives), 9 (tilde paths), 12 (bloat from runtime dirs)

### Phase 2: Import with Safety Guarantees

**Rationale:** Import depends on a working export with a stable manifest format. Conflict handling and the path traversal guard must be present before any real write logic ships — importing without them risks data loss and security incidents.

**Delivers:** `claude-sync import --force` and `claude-sync import` (interactive) with pre-import backup, dry-run, conflict resolution, and path rewriting for hooks.

**Addresses:**
- Unpacker reads manifest and validates schema version
- Restorer with four conflict modes (write/overwrite/skip/prompt)
- Path traversal guard in fs-helpers.js (Zip Slip prevention)
- Pre-import backup to `~/.claude/backups/pre-import-TIMESTAMP/`
- `--dry-run` mode (conflict detection runs; no writes)
- `--force` flag (bypasses prompts)
- `--skip-existing` flag
- Hook path rewriting: replace source prefix with target `~/.claude/` on import
- Settings.json merge logic for hooks key (merge vs full overwrite)
- Detection of Claude Code running (warn before write)

**Avoids:** Pitfalls 3 (Zip Slip), 4 (silent overwrite), 6 (hook paths broken)

### Phase 3: Safety, UX, and Inspect Commands

**Rationale:** Once export and import work correctly, add the UX layer that makes the tool trustworthy and inspectable. These features do not unblock core functionality but significantly reduce user error.

**Delivers:** `inspect`, `verify`, interactive conflict prompts, progress feedback, and `--include`/`--exclude` filtering.

**Addresses:**
- `inspect` subcommand (reads manifest, prints contents)
- `verify` subcommand (validates checksums)
- `@inquirer/prompts` interactive prompts for conflict resolution
- `ora` spinners for export/import progress
- `--include`/`--exclude` type flags for surgical exports
- Size warning before exporting large `projects/` directories
- Per-file status logging in restorer

**Uses:** chalk, ora, @inquirer/prompts from STACK.md

### Phase 4: Cross-Machine Portability

**Rationale:** Path remapping for conversation history is more complex than the other portability work (it requires scanning inside JSONL files, not just renaming directories) and carries higher risk of introducing bugs in conversation data. Defer until the core is stable and tested.

**Delivers:** `--remap-path OLD NEW` flag on import; project directory renaming and JSONL content path rewriting.

**Addresses:** Pitfall 6 (project folder absolute path encoding)

**Flag for deeper research:** The JSONL schema for conversation files is not officially documented. Before implementing JSONL path rewriting, inspect the actual format to understand how paths are embedded and whether string replacement is safe or requires structural parsing.

### Phase Ordering Rationale

- Security exclusions (Phase 1) cannot be retrofitted — they define the tool's trust boundary from the first release
- Streaming (Phase 1) cannot be retrofitted — memory architecture must be correct from the first file write
- Import (Phase 2) depends on a stable archive format from Phase 1
- Conflict handling (Phase 2) must ship before interactive prompts (Phase 3) — you need the logic before the UX
- Path remapping (Phase 4) deferred because it requires understanding undocumented JSONL internals

### Research Flags

Phases needing deeper research during planning:

- **Phase 4 (path remapping):** The JSONL conversation file schema is not publicly documented. Before implementing `--remap-path`, inspect actual JSONL files to determine how absolute paths appear and whether simple string replacement is safe. Flag for `/gsd:research-phase`.
- **Phase 2 (settings.json merge):** The exact semantics of merging vs overwriting the hooks section need a concrete decision. Merging is safer but may produce duplicate hooks if the same hook exists on both machines. Needs a defined merge strategy (union by hook type? by command string?).

Phases with standard patterns (skip research-phase):

- **Phase 1 (export):** tar npm package streaming API, commander subcommand setup, and atomic file writes are all well-documented with high-quality official sources.
- **Phase 3 (UX layer):** chalk, ora, and @inquirer/prompts all have stable, well-documented APIs. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified against npm, official docs, and version compatibility confirmed. ESM decision is unambiguous. |
| Features | HIGH | Based on direct filesystem inspection of `~/.claude/` on target machine; not inferred from docs alone. |
| Architecture | HIGH | Pipeline pattern is established; component boundaries match shallow-backup and chezmoi patterns. ZIP vs tar.gz resolved in favor of tar.gz based on pitfalls analysis. |
| Pitfalls | HIGH | Grounded in actual CVEs (CVE-2025-3445), GitHub issue reports with real file sizes, and verified `~/.claude.json` structure inspection. |

**Overall confidence:** HIGH

### Gaps to Address

- **JSONL conversation file schema:** No official documentation exists. Before Phase 4, directly inspect several `.jsonl` files from `~/.claude/projects/` to understand path embedding. Cannot implement safe path remapping without this.
- **Settings.json hooks merge semantics:** The correct behavior when both source and destination have hooks configured is not defined. Needs a product decision: merge (union), prefer-source, or prefer-destination. Document the chosen strategy in import help text.
- **`commands/` and `agents/` directory depth:** The scanner needs to handle namespaced subdirectories (e.g., `commands/gsd/do.md`). Confirmed from filesystem inspection that nesting exists; scanner must preserve full relative paths, not flatten.
- **Archive size in practice for active users:** Current data shows `projects/` at 5 MB locally, but reports of 3.8 GB JSONL files suggest heavy users may see archives of 10+ GB. The size warning threshold (suggested 500 MB) and the default opt-out for conversations should be validated with real users after v1 ships.

## Sources

### Primary (HIGH confidence)

- Direct filesystem inspection of `~/.claude/` on target machine — directory structure, file sizes, actual content
- Official Claude Code settings docs — hooks structure, settings.json schema
- npm package pages for commander, tar, chalk, ora, @inquirer/prompts — version numbers, dependency counts
- GitHub issue #18905 (3.8 GB session files) — conversation size reality check
- GitHub issue #22365 (JSONL corruption) — import safety requirements
- CVE-2025-3445 (Zip Slip, April 2025) — path traversal threat confirmation

### Secondary (MEDIUM confidence)

- [Anatomy of the .claude/ Folder — Daily Dose of DS](https://blog.dailydoseofds.com/p/anatomy-of-the-claude-folder) — corroborates directory structure
- [~/.claude directory structure gist](https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52) — additional directory entries
- [CLI Framework Comparison — Grizzly Peak Software](https://www.grizzlypeaksoftware.com/library/cli-framework-comparison-commander-vs-yargs-vs-oclif-utxlf9v9) — startup time benchmarks
- [Command Line Interface Guidelines — clig.dev](https://clig.dev/) — UX standards
- [chezmoi import docs](https://www.chezmoi.io/reference/commands/import/) — archive import patterns
- [shallow-backup README](https://github.com/alichtman/shallow-backup) — dotfile backup tool patterns, secret scanning patterns

### Tertiary (LOW confidence)

- npm trends data for commander vs yargs vs oclif — download counts may not reflect startup time claims precisely; test in practice

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
