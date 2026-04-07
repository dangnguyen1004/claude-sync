# Phase 02-02 Summary — Import Polish: list, Backup, Hook Rewriting

**Completed:** 2026-04-05
**Wave:** 2
**Files created/modified:** src/commands/list.mjs, src/commands/list.test.mjs, src/commands/import.mjs, src/commands/import.test.mjs

## Artifacts Delivered

### src/commands/list.mjs
- `runList(archiveArg, options)` — reads archive manifest WITHOUT extracting files
- Mirrors export output format exactly per CLI-04 spec
- Prints: `Archive: <filename>`, `Exported: <date> | Source: <platform>`
- Groups output by type with file counts for directories, `(found)` for single files
- Shows `(not included)` for types not in `manifest.included_types`
- Uses same `TYPE_LABELS` and `DIRECTORY_TYPES` constants as export

### src/commands/list.test.mjs
- 8 tests covering: archive metadata display, type grouping, file counts, single-file types, error handling for missing/invalid archives

### src/commands/import.mjs (updated)
- **Hook path rewriting (IMP-04):** `rewriteHookPaths()` rewrites `"command": "<path>"` values in settings.json where path starts with `manifest.source_home`, replacing prefix with `os.homedir()`. Prints summary line: `Rewrote N hook paths: /old/home → /new/home`. Skips silently when `source_home` absent or matches target.
- **Backup before write (IMP-05):** Creates `~/.claude/backups/YYYY-MM-DDTHH-MM-SS/` timestamped directory. Copies all existing (conflicting) files to backup dir before any writes. Aborts if any backup copy fails. Backup only for files that actually exist at destination.

### src/commands/import.test.mjs (updated)
- Added 4 tests: backup directory creation with correct content, hook rewrite summary when `source_home` differs, skips rewrite when `source_home` matches, skips rewrite when `source_home` absent

## Test Results
```
npm test -- --run
Test Files  8 passed (8)
     Tests  97 passed (97)
```

## Success Criteria ✓
- [x] list command shows manifest contents matching export output format exactly
- [x] Backup directory created with timestamp before any file is overwritten
- [x] Hook paths rewritten in settings.json when source_home differs from os.homedir()
- [x] All tests pass
