# Phase 1 Context: Export

**Phase:** 1 — Export
**Goal:** Users can export their complete Claude Code environment to a single portable archive
**Created:** 2026-04-04 (auto mode)

---

## Canonical Refs

- `.planning/PROJECT.md` — project vision and constraints
- `.planning/REQUIREMENTS.md` — v1 requirements (EXP-01..13, CLI-01, CLI-02, SEC-02)
- `.planning/research/STACK.md` — technology choices with versions
- `.planning/research/ARCHITECTURE.md` — scanner→packer pipeline, manifest structure
- `.planning/research/PITFALLS.md` — security pitfalls, streaming requirements, exclusion list

---

## Decisions

### Archive Format

**Decision:** tar.gz (`.tar.gz`)

**Rationale:** Preserves POSIX file permissions — hook scripts in `~/.claude/` may be executable (`chmod +x`), and tar preserves this natively. gzip compression is built into Node.js `zlib`. The `tar` npm package (v7.5.13) handles all edge cases. Already documented in STATE.md.

**Implementation note:** Use the `tar` npm package. Use streaming API (`tar.create()`) for memory efficiency with large exports.

---

### Default Export Scope

**Decision:** All data types are exported by default **except** conversation history (`projects/`)

**Default includes:**
- `skills/` — global skills
- `rules/` — global rules
- `settings.json` (hooks section only, not the full settings) — hooks configuration
- `commands/` — global slash commands
- `agents/` — global agent definitions
- `CLAUDE.md` — global instructions file
- `keybindings.json` — key bindings

**Excluded by default (opt-in):**
- `projects/` — conversation history (can reach 3.8 GB; user must explicitly opt in)

**Always excluded (never exported, regardless of flags):**
- `~/.claude.json` — contains OAuth tokens, MCP credentials, account identity (security)
- `file-history/`, `debug/`, `session-env/`, `shell-snapshots/`, `statsig/`, `cache/` — runtime/ephemeral directories

**[auto] Rationale:** Conversations are opt-in because they can be enormous and are machine-specific (project folder names encode absolute source paths, so they don't transfer cleanly to other machines without Phase 2+ work).

---

### Selective Export Flag Design

**Decision:** `--include <type>` and `--exclude <type>` flags, accepting named data types

**Named data types:**
| Flag name | Maps to |
|-----------|---------|
| `skills` | `~/.claude/skills/` |
| `rules` | `~/.claude/rules/` |
| `hooks` | `settings.json` (hooks section) |
| `commands` | `~/.claude/commands/` |
| `agents` | `~/.claude/agents/` |
| `instructions` | `~/.claude/CLAUDE.md` |
| `keybindings` | `~/.claude/keybindings.json` |
| `conversations` | `~/.claude/projects/` |

**Usage examples:**
```
claude-sync export                              # default scope (no conversations)
claude-sync export --include conversations      # default scope + conversations
claude-sync export --exclude hooks              # default scope minus hooks
claude-sync export --include skills,rules       # only skills and rules
```

**[auto] Rationale:** Named types are explicit and human-readable. Comma-separated values in a single flag keep the CLI surface minimal. `--include`/`--exclude` are standard conventions (curl, rsync, etc.).

---

### Output File Naming

**Decision:** When no output path is provided, default to `claude-sync-YYYY-MM-DD.tar.gz` in the current working directory

**Examples:**
```
claude-sync export                          → ./claude-sync-2026-04-04.tar.gz
claude-sync export backup.tar.gz           → ./backup.tar.gz
claude-sync export ~/backups/work.tar.gz   → ~/backups/work.tar.gz
```

**[auto] Rationale:** Date-based default makes files sortable and prevents accidental overwrites when run multiple times.

---

### CLI Output Verbosity

**Decision:** Concise default output — show what was scanned, then a final summary. No verbose mode needed in Phase 1 (Phase 3 adds progress spinners).

**Output format (export):**
```
Exporting Claude Code environment...

  ✓ skills/        (3 files)
  ✓ rules/         (5 files)
  ✓ hooks          (found in settings.json)
  ✓ commands/      (2 files)
  ✓ agents/        (1 file)
  ✓ CLAUDE.md      (found)
  ✓ keybindings    (found)
  — projects/      (skipped — use --include conversations to export)

  ⚠ ~/.claude.json excluded (contains OAuth tokens)

Archive: ./claude-sync-2026-04-04.tar.gz (142 KB, 12 files)
```

**[auto] Rationale:** Each included data type gets a line so the user can see what was found. The exclusion notice for `~/.claude.json` appears every time as a security reminder. If a directory doesn't exist, it's silently skipped (no error — user may not have all data types populated).

---

### Manifest Structure

**Decision:** Include `manifest.json` at the archive root with the following structure:

```json
{
  "version": "1.0.0",
  "tool": "claude-sync",
  "exported_at": "2026-04-04T10:30:00Z",
  "source_platform": "darwin",
  "included_types": ["skills", "rules", "hooks", "commands", "agents", "instructions", "keybindings"],
  "files": [
    {
      "path": "skills/my-skill.md",
      "size": 1234,
      "checksum": "sha256:abc123..."
    }
  ],
  "excluded": {
    "oauth_file": "~/.claude.json (always excluded — contains credentials)",
    "runtime_dirs": ["cache/", "statsig/", "debug/"]
  }
}
```

**[auto] Rationale:** Manifest enables `claude-sync list` (Phase 2) to inspect the archive without extracting. Per-file checksums enable integrity verification. The `excluded` section makes it explicit what was deliberately left out.

---

### Project Structure

**Decision:** Standard Node.js ESM package with a simple flat structure

```
claude-sync/
  bin/
    claude-sync.mjs       ← entry point (shebang + commander setup)
  src/
    scanner.mjs           ← discovers ~/.claude/ data types
    packer.mjs            ← creates tar.gz archive with manifest
    exclusions.mjs        ← defines always-excluded paths
  package.json
  README.md
```

**[auto] Rationale:** Flat src/ structure matches the linear scanner→packer pipeline. No build step — `.mjs` files run directly in Node.js. ESM because chalk v5, ora v9, and @inquirer/prompts v8 are ESM-only.

---

## Deferred Ideas

*(Ideas mentioned that are out of Phase 1 scope — captured for backlog)*

- Progress spinners during export — Phase 3 (CLI-05)
- Secret detection in settings.json — Phase 3 (SEC-01)
- Conversation export — Phase 3 (EXP-08)
- `claude-sync import` — Phase 2
- `claude-sync list` — Phase 2

---

## Open Questions for Researcher/Planner

1. Does `~/.claude/settings.json` contain fields other than `hooks` and `disableAllHooks` that might be useful to include? (e.g., model preferences, permission settings) — researcher should check.
2. Are there any file locking concerns if Claude Code is running during export? (pitfalls research noted this as unconfirmed) — researcher should investigate.
3. Should `settings.json` be exported as-is (full file) or only the `hooks` section? If cross-machine portability matters, exporting the full file is simpler but means machine-specific settings travel along.

---

*Created: 2026-04-04 — auto mode, all decisions auto-selected with recommended defaults*
