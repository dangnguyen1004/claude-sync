# claude-sync

## What This Is

A CLI tool that exports all Claude Code data from the user's local machine into a single portable file — including global skills, rules, hooks, and all conversation history. The exported file can then be imported back into Claude Code to restore or migrate the full environment.

## Core Value

One-command backup and restore of a complete Claude Code environment, making it trivially easy to sync, migrate, or share Claude Code setups across machines.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Export global skills (`~/.claude/skills/`)
- [ ] Export global rules (`~/.claude/rules/`)
- [ ] Export hooks configuration (`~/.claude/settings.json` hooks section)
- [ ] Export all conversation history (`~/.claude/projects/`)
- [ ] Bundle all exported data into a single archive file
- [ ] Import command: load an exported archive back into Claude Code
- [ ] CLI interface with `export` and `import` subcommands
- [ ] Selective export: allow user to choose which data types to include/exclude
- [ ] Dry-run mode for import (preview what would be changed before applying)

### Out of Scope

- Cloud sync / remote storage — complexity without clear v1 need; file-based is sufficient
- GUI — CLI is the right interface for this power-user tool
- Encryption of the archive — user responsibility for now; can add later
- Merging conversations from multiple machines — complex conflict resolution; v1 is replace/restore only

## Context

- Claude Code stores its data in `~/.claude/` on macOS/Linux
- Key directories: `skills/`, `rules/`, `projects/` (conversations), `settings.json` (hooks, config)
- The GSD workflow system (`~/.claude/get-shit-done/`) is a separate concern — may or may not include
- Users need this for: machine migration, backup/restore, sharing setups with teammates
- The tool should be usable without any Claude Code session running

## Constraints

- **Compatibility**: Must support macOS; Linux nice-to-have; Windows out of scope for v1
- **No external dependencies**: Prefer Node.js or shell script so it works without installing packages
- **Non-destructive import**: Never overwrite without user confirmation or `--force` flag

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CLI over GUI | Power users; scriptable; simpler to build | — Pending |
| File archive format | Single file = easy to share, email, store | — Pending |
| Node.js as runtime | Claude Code already requires Node; zero extra deps | — Pending |

---
*Last updated: 2026-04-04 after Phase 1 (export) completion*
