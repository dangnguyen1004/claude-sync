# claude-sync

Backup and restore your complete Claude Code environment — skills, rules, hooks, commands, agents, and conversation history — into a single portable archive.

## Features

- **One-command export**: Package all your Claude Code data into a timestamped `.tar.gz` archive
- **Selective export**: Include or exclude specific data types (`--include`, `--exclude`)
- **Secret scanning**: Warns before archiving if your `settings.json` contains API keys or tokens
- **Non-destructive import**: Prompts before overwriting any existing files; backs up originals
- **Cross-machine restore**: Archives are plain `.tar.gz` files — easy to share, email, or store
- **Hook path rewriting**: Automatically updates hook paths in `settings.json` when restoring to a different machine

## Installation

```bash
npm install -g claude-sync
```

Or use without installing:

```bash
npx claude-sync export
```

For local development:

```bash
npm link
```

## Usage

### Export

Export your Claude Code environment to a `.tar.gz` archive:

```bash
claude-sync export
# Creates: ./claude-sync-YYYY-MM-DD.tar.gz
```

Export to a custom path:

```bash
claude-sync export ./my-backup.tar.gz
```

Include specific data types:

```bash
claude-sync export --include skills,rules,hooks
```

Exclude specific data types:

```bash
claude-sync export --exclude conversations
```

Skip the secret scan:

```bash
claude-sync export --skip-secret-scan
```

### Import

Restore from an archive:

```bash
claude-sync import ./claude-sync-YYYY-MM-DD.tar.gz
```

Preview what would be restored without writing files:

```bash
claude-sync import ./backup.tar.gz --dry-run
```

Force overwrite existing files without prompting:

```bash
claude-sync import ./backup.tar.gz --force
```

### List Available Data

Show what data types are available for export:

```bash
claude-sync list
```

## Data Types

| Type | Description |
|------|-------------|
| `skills` | Global skills (directory) |
| `rules` | Global rules (directory) |
| `hooks` | Claude Code hooks via `settings.json` (file) |
| `commands` | Custom slash commands (directory) |
| `agents` | Custom agents (directory) |
| `instructions` | Global `CLAUDE.md` instructions (file) |
| `keybindings` | Keybinding configuration (file) |
| `conversations` | All conversation history (directory, opt-in) |

## Excluded Files

The following are **never** exported:

- `~/.claude.json` — Contains OAuth tokens; always excluded for security
- Runtime directories: `cache/`, `statsig/`, `debug/`, `file-history/`, `session-env/`, `shell-snapshots/`, `backups/`, `telemetry/`, `paste-cache/`, `ide/`

## Requirements

- Node.js 20 or later
- macOS (Linux support is nice-to-have; Windows is out of scope for v1)

## License

MIT
