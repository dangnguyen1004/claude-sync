# Getting Started

**Analysis Date:** 2026-04-07

## Prerequisites

- Node.js 20 or later
- npm or npx

## Installation

### Option 1: Global Install

```bash
npm install -g claude-sync
```

This registers `claude-sync` as a system command.

### Option 2: No Install (npx)

```bash
npx claude-sync export
```

### Option 3: Local Development

```bash
git clone <repository>
cd claude-sync
npm link
```

`npm link` creates a global symlink pointing to your local checkout.

## Quick Start

### Export Your Environment

```bash
claude-sync export
```

This creates `./claude-sync-2026-04-07.tar.gz` containing all your skills, rules, hooks, commands, agents, instructions, and keybindings.

To include conversation history:

```bash
claude-sync export --include conversations
```

### Restore on a New Machine

Copy the archive to your new machine, then:

```bash
claude-sync import ./claude-sync-2026-04-07.tar.gz
```

You'll be prompted before overwriting any existing files. Existing files are backed up to `~/.claude/backups/<timestamp>/`.

### Preview Import Without Writing

```bash
claude-sync import ./backup.tar.gz --dry-run
```

### Selective Export

Include only specific types:

```bash
claude-sync export --include skills,rules
```

Exclude specific types:

```bash
claude-sync export --exclude conversations
```

## First-Time Setup

`claude-sync` requires no configuration. It reads and writes directly to `~/.claude/`.

Before exporting, ensure your `~/.claude/` directory exists and contains the data you want to back up. Claude Code creates this directory automatically on first run.

## Verifying the Installation

Check the installed version:

```bash
claude-sync --version
```

List available data types:

```bash
claude-sync list
```

## Troubleshooting

### "Claude Code directory not found"

Claude Code hasn't been run yet, or the `~/.claude/` directory doesn't exist. Run Claude Code at least once to create the directory.

### "Archive creation failed"

Check that you have write permissions in the current directory, and that `~/.claude/` exists and is readable.

### Secret scan aborts export

API keys or tokens were detected in `settings.json`. If you know the content is safe (e.g., it's not a real key), you can skip the scan:

```bash
claude-sync export --skip-secret-scan
```
