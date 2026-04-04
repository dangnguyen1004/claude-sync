# Feature Landscape

**Domain:** CLI backup/export/import tool for Claude Code environment
**Researched:** 2026-04-04
**Confidence:** HIGH (based on direct inspection of ~/.claude/ + verified CLI tool patterns)

---

## ~/.claude/ Directory Structure (Source of Truth)

Documented from direct filesystem inspection on the target machine. This defines exactly what the tool exports.

```
~/.claude/
├── settings.json              # Global permissions, hooks, statusLine config
├── history.jsonl              # Global prompt history across all sessions (86 lines observed)
├── CLAUDE.md                  # (may exist) User-level memory, loaded in every session
├── package.json               # {"type":"commonjs"} — minimal, ties to Node CJS
├── keybindings.json           # Custom keyboard shortcuts
├── mcp-needs-auth-cache.json  # MCP server auth cache (runtime, not config)
├── stats-cache.json           # Usage metrics (runtime state)
├── gsd-file-manifest.json     # GSD workflow manifest (user-installed system)
│
├── skills/                    # Global skills (each in own subdir with SKILL.md)
│   └── context7-mcp/
│       └── context7.md
│
├── rules/                     # Global rules (markdown files, per-library/context)
│   └── context7.md
│
├── hooks/                     # Hook scripts referenced by settings.json
│   ├── gsd-check-update.js
│   ├── gsd-context-monitor.js
│   ├── gsd-prompt-guard.js
│   ├── gsd-statusline.js
│   └── gsd-workflow-guard.js
│
├── commands/                  # Global slash commands
│   └── gsd/                   # Namespaced command subdirs
│       ├── do.md
│       ├── execute-phase.md
│       └── ... (59+ commands)
│
├── agents/                    # Global subagent persona definitions
│   └── gsd/                   # Namespaced agent subdirs
│       ├── gsd-executor.md    # 40KB+ files
│       ├── gsd-debugger.md
│       └── ... (17+ agents)
│
├── projects/                  # Conversation history per project
│   └── -Users-dangnguyen-Projects-myapp/   # Path-encoded project dir
│       ├── {session-uuid}.jsonl             # Full conversation transcript
│       ├── {session-uuid}/                  # Subdir for sessions with subagents
│       │   └── subagents/
│       │       ├── agent-{id}.jsonl         # Subagent transcript
│       │       └── agent-{id}.meta.json     # {"agentType":"...","description":"..."}
│       └── memory/
│           └── MEMORY.md                    # Auto-generated project memory
│
├── file-history/              # Versioned file backups for undo/rollback (360KB)
├── todos/                     # Session task lists as JSON
├── plans/                     # Plan mode markdown documents
├── debug/                     # Debug logs per session
├── session-env/               # Per-session environment variable storage
├── shell-snapshots/           # Shell environment captures
├── cache/                     # General cache
├── paste-cache/               # Paste clipboard cache
├── plugins/                   # Plugin system files
├── ide/                       # IDE integration locks
├── statsig/                   # Feature flag cache
├── telemetry/                 # Usage telemetry
├── downloads/                 # Downloads cache
└── get-shit-done/             # User-installed workflow system (separate concern)
    ├── VERSION
    ├── bin/
    ├── commands/
    ├── references/
    ├── templates/
    └── workflows/
```

**~/.claude.json** (at home root, separate from ~/.claude/ dir):
- OAuth session, MCP server credentials, per-project state, feature flags
- System-managed runtime state — NOT appropriate to export (contains auth tokens)

### Data Size Reality Check

| Data Type | Observed Size | Notes |
|-----------|--------------|-------|
| projects/ total | 5 MB | Grows with use; large sessions = 1-2 MB each |
| Single conversation | 2-2.4 MB max | JSONL, grows with tokens |
| hooks/ | ~20 KB | Scripts referenced in settings.json |
| commands/ | varies | Markdown files, small |
| agents/ | ~300 KB | Large markdown prompt files |
| skills/ | ~2 KB each | Small markdown |
| rules/ | ~2 KB each | Small markdown |
| settings.json | ~2 KB | JSON, small |

---

## Table Stakes

Features users expect. Missing any of these = the tool feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `export` command | Core purpose | Low | Bundle data into archive |
| `import` command | Core purpose | Medium | Extract + place files correctly |
| Single-file output | Portability — easy to email/store/share | Low | .tar.gz or .zip |
| Selective export by type | Different use cases (settings-only vs full) | Medium | `--include skills,rules,hooks` style flags |
| `--dry-run` on import | Safety — preview before destructive change | Low-Med | Show what would be written/overwritten |
| Conflict detection on import | Non-destructive is table stakes for any restore tool | Medium | Check if files exist; prompt or `--force` |
| `--force` flag for import | Scripted/automated use; power users need it | Low | Bypass confirmation for CI/migration scripts |
| Output metadata in archive | Know when it was created, from which machine | Low | manifest.json inside archive |
| Human-readable progress output | Users expect to see what's happening | Low | "Exporting skills... done" style |
| Non-zero exit code on error | Scriptability — required for shell pipelines | Low | Standard CLI contract |
| Help text (`--help`) | Discoverability | Low | Auto-generated by CLI framework |
| Version flag (`--version`) | Debugging support requests | Low | Trivial |

## Differentiators

Features that set this tool apart. Not expected, but clearly valuable once seen.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `--include`/`--exclude` filtering | Surgical exports: "give me just rules and hooks" | Medium | Flag-based type selection |
| Export summary report | Show what was included + sizes + count | Low | Print after export, also written to manifest |
| Import preview diff | Show "X files would change, Y new, Z conflicts" before asking | Medium | File-by-file delta |
| Per-project conversation export | Export history for a single project only, not all | Medium | `--projects myapp` filter |
| Archive inspection (`inspect` subcommand) | See what's inside an archive before importing | Low | Read and print manifest.json |
| Portable hooks path rewriting | Hooks in settings.json contain absolute paths; rewrite on import to new machine | Medium | Critical for cross-machine restore |
| Manifest with content hash | Detect archive corruption, verify integrity | Low | sha256 of each file in manifest |
| Size warning before export | Warn if projects/ is large (e.g. >50 MB) before bundling | Low | UX safety net |

## Anti-Features

Things to deliberately NOT build in v1. These add complexity without proportionate v1 value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Cloud sync / remote push | Network deps, auth complexity, security surface | Export to file; user handles where to put it |
| Encryption of archive | Key management complexity; user owns file system security | Document that archive contains sensitive data (hook scripts, potential API keys in history); user encrypts if needed |
| Incremental / diff-based backup | Complex state tracking; overkill for config files | Full export each time; fast enough for this data size |
| Merge mode for conversations | Multi-machine conversation merging is a hard problem (UUID collisions, ordering) | v1 is replace/restore only; document this clearly |
| Interactive TUI | ncurses/ink complexity; wrong abstraction for a backup tool | Flags + confirmation prompts is sufficient |
| Plugin system / hooks for the backup tool itself | Meta-complexity | Hardcode the data types; they change rarely |
| Automatic scheduled backups | Daemon/cron management is out of scope | Document how to add to crontab; don't own the scheduler |
| `.claude.json` export (home root file) | Contains OAuth tokens, MCP credentials — security risk | Explicitly exclude; document why in help text |
| Compression format choice | Unnecessary option; pick one and ship | Use .tar.gz; widely supported, good ratio |
| Backup versioning / rotation | Adds state management (which backup is "current"?) | One output file per run; user manages versions with filenames |
| Windows support | Path encoding, shell differences, different Claude Code behavior | macOS first; Linux nice-to-have; Windows explicitly out of scope |

---

## Feature Dependencies

```
export (core)
  └── selective export (--include/--exclude)
        └── per-project conversation filter

import (core)
  ├── dry-run (--dry-run) — no dep on other features
  ├── conflict detection → prompts or --force
  └── hooks path rewriting — depends on import working first
        └── portable export (path-stripped archive) — coordinated with export

inspect subcommand — depends only on archive format being defined
```

**Critical dependency:** The hooks path rewriting problem.
`settings.json` contains absolute paths like `"/Users/dangnguyen/.claude/hooks/gsd-context-monitor.js"`. On a new machine with username `alice`, this path breaks. The export must either:
1. Store paths relative to `~/.claude/` and rewrite on import (correct approach), or
2. Warn the user that hook paths will need updating (acceptable v1 fallback)

This is the #1 cross-machine portability issue and must be decided before building import.

---

## Data Type Classification for Export

| Data Type | Path | Export Priority | Notes |
|-----------|------|----------------|-------|
| Global settings/hooks config | `settings.json` | Core | Contains absolute hook paths — needs rewriting |
| Global rules | `rules/` | Core | Markdown files, small, safe |
| Global skills | `skills/` | Core | Markdown + supporting files |
| Hook scripts | `hooks/` | Core | JS scripts; referenced by settings.json |
| Global commands | `commands/` | Core | Slash command markdown files |
| Global agents | `agents/` | Core | Large markdown persona files |
| Project conversations | `projects/*/` | Optional (large) | Can be hundreds of MB; opt-in |
| Project memories | `projects/*/memory/MEMORY.md` | Optional | Small but useful for context |
| CLAUDE.md | `CLAUDE.md` | Core | User-level global memory |
| history.jsonl | `history.jsonl` | Optional | Prompt history, moderate size |
| keybindings.json | `keybindings.json` | Optional | Custom shortcuts |
| get-shit-done/ | `get-shit-done/` | Out of scope | Separate installed system; has own versioning |
| file-history/ | `file-history/` | Exclude | Runtime undo state, session-specific, not portable |
| debug/, session-env/, shell-snapshots/ | various | Exclude | Pure runtime/ephemeral state |
| statsig/, telemetry/, cache/ | various | Exclude | Runtime/feature flags, not config |
| .claude.json (home root) | `~/.claude.json` | Exclude | Contains OAuth tokens, credentials |

---

## MVP Recommendation

**Must have in v1:**
1. `export` — bundle settings.json, rules/, skills/, hooks/, commands/, agents/, CLAUDE.md into .tar.gz
2. `import` — extract archive, place files in ~/.claude/, with conflict detection + prompts
3. `--include`/`--exclude` flags — at minimum a `--no-history` flag to skip projects/
4. `--dry-run` on import — show what would change
5. `--force` on import — bypass prompts for scripted use
6. Manifest file inside archive — timestamp, hostname, claude-sync version, file list
7. Hook path rewriting — at minimum warn user; ideally rewrite on import

**Defer to v2:**
- `inspect` subcommand (useful but not blocking)
- Per-project conversation filtering (add when users ask)
- Import diff preview (nice-to-have; prompts cover it adequately)
- Size warnings (add after seeing real user data sizes)

**Never build (anti-features above):**
- Cloud sync, encryption, merge mode, TUI, scheduling

---

## Sources

- Direct filesystem inspection of `~/.claude/` on target machine (HIGH confidence)
- [Anatomy of the .claude/ Folder - Daily Dose of DS](https://blog.dailydoseofds.com/p/anatomy-of-the-claude-folder) (MEDIUM confidence — corroborates inspection)
- [~/.claude directory structure gist](https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52) (MEDIUM confidence)
- [shallow-backup README](https://github.com/alichtman/shallow-backup/blob/main/README.md) — CLI patterns reference (HIGH confidence)
- [dbkp dotfiles backup tool](https://github.com/acristoffers/dbkp) — CLI patterns reference (MEDIUM confidence)
- [Command Line Interface Guidelines — clig.dev](https://clig.dev/) — UX standards (HIGH confidence)
- [chezmoi import docs](https://www.chezmoi.io/reference/commands/import/) — archive import patterns (HIGH confidence)
