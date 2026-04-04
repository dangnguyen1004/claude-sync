# Roadmap: claude-sync

## Overview

claude-sync starts with a working export command that produces a safe, portable tar.gz archive, then adds a complete import command with conflict handling and hook path rewriting, then finishes with the UX layer — progress feedback, secret scanning, and conversation support — that makes the tool trustworthy for daily use. Security requirements (token exclusion, path traversal prevention) are enforced from Phase 1; nothing is retrofitted.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Export** - CLI scaffold, scanner, packer, manifest, and all exclusions — produces a valid portable archive
- [ ] **Phase 2: Import** - Unpacker, restorer, conflict handling, dry-run, Zip Slip guard, and hook path rewriting — safely restores an environment
- [ ] **Phase 3: Polish** - Progress indicators, secret detection, conversation history support, and inspect subcommand

## Phase Details

### Phase 1: Export
**Goal**: Users can export their complete Claude Code environment to a single portable archive
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-02, EXP-01, EXP-02, EXP-03, EXP-04, EXP-05, EXP-06, EXP-07, EXP-09, EXP-10, EXP-11, EXP-12, EXP-13, SEC-02
**Success Criteria** (what must be TRUE):
  1. User can run `npm install -g claude-sync` and invoke `claude-sync` from any terminal
  2. User can run `claude-sync export claude.tar.gz` and receive a valid tar.gz archive containing their skills, rules, hooks, commands, agents, CLAUDE.md, and keybindings
  3. Archive contains a manifest.json with tool version, export date, and per-file checksums
  4. `~/.claude.json` (OAuth tokens) is never present in the archive, and the CLI prints a message confirming the exclusion
  5. Archive entries use only relative paths — no absolute machine paths embedded in the archive
**Plans:** 3/4 plans executed

Plans:
- [x] 01-01-PLAN.md — Project scaffold, test fixtures, exclusions module, and shared type contracts
- [x] 01-02-PLAN.md — Scanner module: discover and checksum exportable files
- [x] 01-03-PLAN.md — Packer module: create tar.gz archive with manifest
- [ ] 01-04-PLAN.md — Export command: wire scanner + packer into CLI with integration tests

**UI hint**: no

### Phase 2: Import
**Goal**: Users can safely restore a Claude Code environment from an archive with full conflict protection
**Depends on**: Phase 1
**Requirements**: CLI-03, CLI-04, IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, SEC-03
**Success Criteria** (what must be TRUE):
  1. User can run `claude-sync import claude.tar.gz` and have their environment restored to `~/.claude/`
  2. Import refuses to overwrite any existing file without `--force` and prompts the user per-file by default
  3. User can run `claude-sync import --dry-run` and see every file that would be written or overwritten without any disk changes occurring
  4. A timestamped backup of all files that would be overwritten is created in `~/.claude/backups/` before any write occurs
  5. Hook paths in settings.json are rewritten to the target machine's home directory, replacing the source machine prefix recorded in the manifest
  6. User can run `claude-sync list claude.tar.gz` and see the archive manifest contents without extracting any files
**Plans**: TBD
**UI hint**: no

### Phase 3: Polish
**Goal**: Users can trust the tool with large conversation exports and receive actionable warnings before risky operations
**Depends on**: Phase 2
**Requirements**: EXP-08, CLI-05, SEC-01
**Success Criteria** (what must be TRUE):
  1. User can run `claude-sync export --include conversations` to include `~/.claude/projects/` in the archive without the process crashing or exhausting memory on multi-gigabyte directories
  2. Tool displays a progress spinner or indicator during both export and import so silence is never mistaken for a hang
  3. If settings.json hook commands contain patterns matching API keys or bearer tokens, the CLI warns the user before writing the archive and requires `--skip-secret-scan` to proceed
**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Export | 2/4 | In Progress|  |
| 2. Import | 0/? | Not started | - |
| 3. Polish | 0/? | Not started | - |
