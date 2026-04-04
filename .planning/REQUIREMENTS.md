# Requirements: claude-sync

**Defined:** 2026-04-04
**Core Value:** One-command backup and restore of a complete Claude Code environment, making it trivially easy to sync, migrate, or share Claude Code setups across machines.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Export

- [x] **EXP-01**: User can export global skills (`~/.claude/skills/`) into a portable archive
- [x] **EXP-02**: User can export global rules (`~/.claude/rules/`) into a portable archive
- [x] **EXP-03**: User can export hooks configuration (settings.json hooks section) into a portable archive
- [x] **EXP-04**: User can export global commands (`~/.claude/commands/`) into a portable archive
- [x] **EXP-05**: User can export agents (`~/.claude/agents/`) into a portable archive
- [x] **EXP-06**: User can export `CLAUDE.md` (global instructions) into a portable archive
- [x] **EXP-07**: User can export `keybindings.json` into a portable archive
- [ ] **EXP-08**: User can export conversation history (`~/.claude/projects/`) into the archive (opt-in — excluded by default due to size)
- [ ] **EXP-09**: Archive includes a manifest (tool version, export date, Claude Code version, content inventory with checksums)
- [x] **EXP-10**: User can selectively include or exclude data types during export via CLI flags
- [x] **EXP-11**: `~/.claude.json` (OAuth tokens, MCP credentials) is always excluded and user is informed
- [x] **EXP-12**: Runtime and ephemeral directories (`cache/`, `statsig/`, `debug/`, etc.) are always excluded
- [ ] **EXP-13**: Export uses streaming to handle large conversation directories (up to 3.8 GB)

### Import

- [ ] **IMP-01**: User can import from an archive file to restore their Claude Code environment
- [ ] **IMP-02**: Import does not overwrite existing files without explicit `--force` flag
- [ ] **IMP-03**: User can preview what would change before importing (`--dry-run` mode)
- [ ] **IMP-04**: Import rewrites absolute paths in hooks configuration to match the current machine's home directory
- [ ] **IMP-05**: Import creates a timestamped backup of any files it would overwrite before proceeding

### CLI Interface

- [x] **CLI-01**: Tool is installable as a global npm package (`npm install -g claude-sync`)
- [ ] **CLI-02**: `claude-sync export [output.tar.gz]` exports Claude Code environment to archive
- [ ] **CLI-03**: `claude-sync import <archive.tar.gz>` restores environment from archive
- [ ] **CLI-04**: `claude-sync list <archive.tar.gz>` inspects archive contents without extracting
- [ ] **CLI-05**: Tool shows progress during export and import operations

### Security

- [ ] **SEC-01**: Tool warns user if settings.json contains potential secrets (API keys, tokens) before exporting
- [ ] **SEC-02**: Archive contains only relative paths — no absolute machine paths embedded in archive entries
- [ ] **SEC-03**: Import validates all archive entry paths to prevent path traversal attacks (Zip Slip)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Portability

- **PORT-01**: User can remap conversation project directory names to match a new machine's username/home path (`--remap-path old:new`)
- **PORT-02**: Import rewrites absolute paths inside JSONL conversation files (requires stable JSONL schema documentation)

### Distribution

- **DIST-01**: Tool ships as a standalone binary (no Node.js installation required)

### Advanced Export

- **ADV-01**: Export supports a `--diff` mode showing what changed since the last export
- **ADV-02**: Export supports profile names to maintain multiple named environment snapshots

### Security

- **SEC-V2-01**: Archive can be encrypted with a passphrase

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud sync / remote storage | Adds infrastructure complexity; file-based is sufficient for v1 |
| GUI | Power-user tool; CLI is the right interface |
| Merging conversations from multiple machines | Complex conflict resolution; v1 is replace/restore only |
| Windows support | Claude Code's primary platforms are macOS and Linux |
| GSD workflow directory (`~/.claude/get-shit-done/`) | Separate concern; users who want it can include it via `--include` flag |
| Encrypting archives | User's responsibility for v1; add in v2 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1 | Complete |
| CLI-02 | Phase 1 | Pending |
| EXP-01 | Phase 1 | Complete |
| EXP-02 | Phase 1 | Complete |
| EXP-03 | Phase 1 | Complete |
| EXP-04 | Phase 1 | Complete |
| EXP-05 | Phase 1 | Complete |
| EXP-06 | Phase 1 | Complete |
| EXP-07 | Phase 1 | Complete |
| EXP-09 | Phase 1 | Pending |
| EXP-10 | Phase 1 | Complete |
| EXP-11 | Phase 1 | Complete |
| EXP-12 | Phase 1 | Complete |
| EXP-13 | Phase 1 | Pending |
| SEC-02 | Phase 1 | Pending |
| CLI-03 | Phase 2 | Pending |
| CLI-04 | Phase 2 | Pending |
| IMP-01 | Phase 2 | Pending |
| IMP-02 | Phase 2 | Pending |
| IMP-03 | Phase 2 | Pending |
| IMP-04 | Phase 2 | Pending |
| IMP-05 | Phase 2 | Pending |
| SEC-03 | Phase 2 | Pending |
| EXP-08 | Phase 3 | Pending |
| CLI-05 | Phase 3 | Pending |
| SEC-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation*
