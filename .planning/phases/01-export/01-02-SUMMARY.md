---
phase: 01-export
plan: 02
subsystem: scanner
tags: [node, crypto, sha256, streaming, filesystem, vitest]

requires:
  - phase: 01-export plan 01
    provides: exclusions.mjs with isExcluded, resolveScope, ALWAYS_EXCLUDED_NAMES, DEFAULT_TYPES

provides:
  - src/scanner.mjs exporting scanExportTargets(claudeDir, options) returning ScannedFile[]
  - Streaming SHA-256 checksums via createReadStream + createHash
  - DATA_TYPE_MAP mapping 8 type names to filesystem targets in ~/.claude/
  - Include/exclude flag support via resolveScope integration

affects:
  - 01-export plan 03 (packer): consumes ScannedFile[] from scanExportTargets
  - 01-export plan 04 (CLI): calls scanExportTargets as first phase of export pipeline

tech-stack:
  added: []
  patterns:
    - "Two-phase scan-then-pack export pipeline: scanner produces ScannedFile[], packer consumes it"
    - "Streaming file hashing: createReadStream piped through createHash — never readFileSync"
    - "DATA_TYPE_MAP: single source of truth mapping type name to {kind, subpath} for filesystem resolution"
    - "Silent skip pattern: pathExists() check before processing, no error thrown on missing dirs"

key-files:
  created:
    - src/scanner.mjs
    - src/scanner.test.mjs
  modified: []

key-decisions:
  - "DATA_TYPE_MAP maps 'hooks' to settings.json (single file) and 'conversations' to projects/ (directory)"
  - "dirent.parentPath used for Node 20+ Dirent.parentPath with fallback to dirent.path for compatibility"
  - "hashFile() returns Promise and uses event-driven streaming — avoids readFileSync per EXP-13"
  - "pathExists() helper encapsulates fs.access try/catch for clean silent-skip pattern"

patterns-established:
  - "Streaming hash: createReadStream -> createHash('sha256') -> 'sha256:' + hex digest"
  - "Fixture-based testing: test/fixtures/claude-home/ directory used for integration-style unit tests"
  - "TDD Red-Green: test file committed separately before implementation"

requirements-completed: [EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06, EXP-07, EXP-10]

duration: 1min
completed: 2026-04-04
---

# Phase 01 Plan 02: Scanner Module Summary

**File scanner with streaming SHA-256 checksums that discovers all 7 default Claude Code data types from ~/.claude/ and respects --include/--exclude scope flags**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-04T08:05:24Z
- **Completed:** 2026-04-04T08:06:26Z
- **Tasks:** 1 (TDD: red + green)
- **Files modified:** 2

## Accomplishments
- Implemented `scanExportTargets(claudeDir, options)` returning typed `ScannedFile[]` for all 7 default data types
- Streaming SHA-256 checksums via `createReadStream` + `createHash` — never reads entire file into memory
- `DATA_TYPE_MAP` maps all 8 type names (including opt-in `conversations`) to filesystem targets
- Include/exclude filtering via `resolveScope` from exclusions.mjs; missing dirs silently skipped
- 11 tests covering all 8 data types, checksum format, relativePath correctness, include/exclude, missing dirs

## Task Commits

Each task was committed atomically:

1. **TDD RED — scanner.test.mjs** - `23bf122` (test)
2. **TDD GREEN — scanner.mjs** - `c0144c3` (feat)

**Plan metadata:** _(committed after summary)_

_Note: TDD tasks have multiple commits (test RED → implementation GREEN)_

## Files Created/Modified
- `src/scanner.mjs` - Main scanner module; exports `scanExportTargets`; uses `DATA_TYPE_MAP`, streaming hash, `resolveScope`
- `src/scanner.test.mjs` - 11 vitest tests covering all data types, include/exclude, checksums, relativePaths, missing dirs

## Decisions Made
- `DATA_TYPE_MAP` maps `hooks` to `settings.json` (file) and `conversations` to `projects/` (directory)
- Used `dirent.parentPath` (Node 20+) with fallback to `dirent.path` for forward compatibility
- `hashFile()` is Promise-based and streams; never buffers entire file — satisfies EXP-13

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- `scanExportTargets` ready for Plan 03 (packer) to consume `ScannedFile[]`
- `ScannedFile.absPath` and `relativePath` are the canonical inputs for archive creation
- No blockers

---
*Phase: 01-export*
*Completed: 2026-04-04*
