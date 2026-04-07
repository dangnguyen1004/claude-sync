# Architecture

**Analysis Date:** 2026-04-07

## Pattern Overview

**Overall:** CLI Application with Two Subcommands (export, import)

**Key Characteristics:**
- Single-file archive output (`.tar.gz`)
- Streaming archive creation (no staging directory for export)
- Non-destructive import with per-file conflict prompts
- Hook path rewriting for cross-machine restore

## Layers

**CLI Layer:**
- Purpose: Parse user input, route to appropriate command handler
- Contains: Commander command definitions in `src/commands/`
- Depends on: Core modules for business logic
- Used by: CLI entry point (`bin/claude-sync.mjs`)

**Core Logic Layer:**
- Purpose: Business logic for export/import operations
- Contains: `scanner.mjs`, `packer.mjs`, `unpacker.mjs`, `restorer.mjs`
- Depends on: Node.js built-ins, tar package
- Used by: CLI command handlers

**Secret Detection Layer:**
- Purpose: Scan for API keys/tokens before archiving
- Contains: `secrets.mjs`
- Depends on: chalk (for output)
- Used by: `export.mjs` (before archive creation)

**Exclusion Logic Layer:**
- Purpose: Determine which files to include/exclude from export
- Contains: `exclusions.mjs`
- Depends on: Node.js built-ins only
- Used by: `scanner.mjs`, `packer.mjs`

## Data Flow

**Export Pipeline:**

1. User runs `claude-sync export [output.tar.gz]`
2. Commander parses `--include` / `--exclude` / `--skip-secret-scan`
3. `scanner.mjs` scans `~/.claude/` for matching data types
4. `secrets.mjs` scans `settings.json` for embedded API keys (if hooks included)
5. If secrets found: abort with warning (unless `--skip-secret-scan`)
6. `packer.mjs` builds manifest and streams archive directly to disk
7. Summary printed with file count and archive size

**Import Pipeline:**

1. User runs `claude-sync import <archive.tar.gz> [--force] [--dry-run]`
2. Commander validates archive path exists
3. `unpacker.mjs` reads and validates manifest from archive header
4. Archive extracted to a temporary staging directory
5. Hook path rewriting applied to `settings.json` if migrating between machines
6. For each file in manifest:
   - If `--dry-run`: report conflict vs. new status
   - If `--force`: restore all files
   - If neither: prompt per-file for conflicts
7. Existing files backed up to `~/.claude/backups/<timestamp>/`
8. Files restored from staging to `~/.claude/`
9. Staging directory cleaned up

**State Management:**
- No persistent in-memory state
- Each command execution is independent
- Archives carry metadata via `manifest.json` inside the archive

## Key Abstractions

**Scanner:**
- Purpose: Enumerate exportable files in `~/.claude/`
- Examples: `src/scanner.mjs`
- Pattern: Generator (returns array of `ScannedFile` objects)

**Packer:**
- Purpose: Create `.tar.gz` archive from scanned files
- Examples: `src/packer.mjs`
- Pattern: Uses streaming tar creation; writes manifest into archive then removes temp file

**Unpacker:**
- Purpose: Read manifest from archive without full extraction
- Examples: `src/unpacker.mjs`
- Pattern: Uses tar header parsing to extract manifest from archive stream

**Restorer:**
- Purpose: Validate and restore files from staging to target
- Examples: `src/restorer.mjs`
- Pattern: Handles per-file conflict prompts, backups, and atomic writes

**Exclusions:**
- Purpose: Determine scope of export (include/exclude types)
- Examples: `src/exclusions.mjs`
- Pattern: Pure function with no side effects

## Entry Points

**CLI Entry:**
- Location: `bin/claude-sync.mjs`
- Triggers: User runs `claude-sync <command>`
- Responsibilities: Register Commander commands, parse args, call command handlers

**Export Command:**
- Location: `src/commands/export.mjs`
- Triggers: `claude-sync export [output] [--include] [--exclude] [--skip-secret-scan]`
- Responsibilities: Orchestrate scan → secret scan → archive creation pipeline

**Import Command:**
- Location: `src/commands/import.mjs`
- Triggers: `claude-sync import <archive> [--force] [--dry-run]`
- Responsibilities: Orchestrate validate → extract → rewrite → backup → restore pipeline

**List Command:**
- Location: `src/commands/list.mjs`
- Triggers: `claude-sync list`
- Responsibilities: Enumerate available data types and export targets

## Error Handling

**Strategy:** Throw exceptions with descriptive messages; catch at command level and exit with code 1

**Patterns:**
- File not found: `process.exitCode = 1` with error message
- Secret detected: Abort archive creation with warning
- Invalid archive: `process.exitCode = 1` with error message
- Extraction failure: Catch, clean up staging, `process.exitCode = 1`

## Security

**SEC-01:** Secret scanning before archive creation — blocks if API keys detected in `settings.json`
**SEC-02:** Streaming tar creation with `cwd:` set — prevents path traversal via archive entries
**SEC-03:** Path traversal validation on extract — rejects entries resolving outside staging dir
**SEC-04:** OAuth file (`~/.claude.json`) always excluded from exports
**SEC-05:** Hook path rewriting rewrites only `"command"` fields, not arbitrary JSON

## Cross-Cutting Concerns

**Output:**
- Chalk for colored terminal output (green=success, red=error, yellow=warning, dim=info)
- Ora for animated spinners during async operations

**Validation:**
- Type names validated via `resolveScope()` in `exclusions.mjs`
- Archive path validated via `fs.access()` before processing
- `manifest.json` validated before extraction

**File Operations:**
- Streaming for archive creation (memory-efficient for large exports)
- Atomic writes via `tmp + rename` in `packer.mjs`
- Recursive directory creation via `fs.mkdir({ recursive: true })`
