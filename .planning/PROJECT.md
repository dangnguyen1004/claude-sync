# claude-sync

## What This Is

A CLI tool that exports all Claude Code data from the user's local machine into a single portable file — including global skills, rules, hooks, and all conversation history. The exported file can then be imported back into Claude Code to restore or migrate the full environment.

## Core Value

One-command backup and restore of a complete Claude Code environment, making it trivially easy to sync, migrate, or share Claude Code setups across machines.

## Requirements

### Validated

- [x] Export global skills (`~/.claude/skills/`)
- [x] Export global rules (`~/.claude/rules/`)
- [x] Export hooks configuration (`~/.claude/settings.json` hooks section)
- [x] Export all conversation history (`~/.claude/projects/`)
- [x] Bundle all exported data into a single archive file
- [x] Import command: load an exported archive back into Claude Code
- [x] CLI interface with `export` and `import` subcommands
- [x] Selective export: allow user to choose which data types to include/exclude
- [x] Dry-run mode for import (preview what would be changed before applying)

Validated in Phase 01 (export), Phase 02 (import), Phase 03 (polish).

### Active

(None — all v1 requirements validated)

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
| CLI over GUI | Power users; scriptable; simpler to build | Shipped: commander.js CLI with export/import subcommands |
| File archive format | Single file = easy to share, email, store | Shipped: tar.gz format with manifest.json at root |
| Node.js as runtime | Claude Code already requires Node; zero extra deps | Shipped: ESM modules, Node 18+ required |

---
*Last updated: 2026-04-06 after Phase 03 (polish) completion — all v1 requirements validated*
