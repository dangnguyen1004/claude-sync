# Configuration

**Analysis Date:** 2026-04-07

## Overview

`claude-sync` requires no configuration file. All behavior is controlled via CLI flags and environment. This document describes what you can configure and how.

## CLI Flags

### Export Flags

| Flag | Description | Default |
|------|-------------|---------|
| `output` | Output archive path | `./claude-sync-YYYY-MM-DD.tar.gz` |
| `--include <types>` | Comma-separated list of data types to include | All types except `conversations` |
| `--exclude <types>` | Comma-separated list of data types to exclude | `conversations` only |
| `--skip-secret-scan` | Skip the secret scan on `settings.json` | `false` (scanning enabled) |

### Import Flags

| Flag | Description | Default |
|------|-------------|---------|
| `archive` | Path to the `.tar.gz` archive to restore | Required |
| `--force` | Overwrite existing files without prompting | `false` (prompt first) |
| `--dry-run` | Preview what would be restored without writing | `false` (actually restore) |
| `--claude-dir <path>` | Override the Claude home directory | `~/.claude/` |

### Export Target Types

| Type | Kind | Path in `~/.claude/` | Notes |
|------|------|---------------------|-------|
| `skills` | Directory | `skills/` | Global skills |
| `rules` | Directory | `rules/` | Global rules |
| `hooks` | File | `settings.json` | Claude Code hooks |
| `commands` | Directory | `commands/` | Custom slash commands |
| `agents` | Directory | `agents/` | Custom agents |
| `instructions` | File | `CLAUDE.md` | Global instructions |
| `keybindings` | File | `keybindings.json` | Keybinding config |
| `conversations` | Directory | `projects/` | All conversation history |

## Environment Variables

No environment variables are used or required.

## Always-Excluded Paths

These are **never** exported regardless of include/exclude flags:

| Path | Reason |
|------|--------|
| `~/.claude.json` | OAuth tokens (security) |
| `~/.claude/cache/` | Runtime cache |
| `~/.claude/statsig/` | Statsig telemetry |
| `~/.claude/debug/` | Debug files |
| `~/.claude/file-history/` | File history |
| `~/.claude/session-env/` | Session environment |
| `~/.claude/shell-snapshots/` | Shell snapshots |
| `~/.claude/backups/` | Import backups |
| `~/.claude/telemetry/` | Telemetry data |
| `~/.claude/paste-cache/` | Paste cache |
| `~/.claude/ide/` | IDE integration |

## Archive Format

Archives are standard `.tar.gz` files containing:

- `manifest.json` — Metadata about the export (version, included types, file list with checksums)
- All scanned files preserving relative paths from `~/.claude/`

### manifest.json Structure

```json
{
  "version": "0.1.0",
  "tool": "claude-sync",
  "exported_at": "2026-04-07T12:00:00.000Z",
  "source_platform": "darwin",
  "source_home": "/Users/user/",
  "included_types": ["skills", "rules", "hooks"],
  "files": [
    {
      "path": "skills/my-skill.md",
      "size": 1234,
      "checksum": "sha256:abc..."
    }
  ],
  "excluded": {
    "oauth_file": "~/.claude.json (always excluded — contains OAuth tokens)",
    "runtime_dirs": ["cache", "statsig", "debug", ...]
  }
}
```

## Platform Notes

### macOS

- Requires Node.js 20+
- `~/.claude/` is the default Claude home directory

### Linux

- Supported as a nice-to-have for v1
- Same directory structure as macOS

### Windows

- Out of scope for v1
