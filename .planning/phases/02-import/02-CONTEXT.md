# Phase 2: Import — Context

**Phase goal:** Users can safely restore a Claude Code environment from an archive with full conflict protection
**Requirements:** CLI-03, CLI-04, IMP-01, IMP-02, IMP-03, IMP-04, IMP-05, SEC-03
**Discussed:** 2026-04-04

---

## Decisions

### Conflict handling UX
- **Per-file prompts, conflicts only.** When `claude-sync import` encounters a file that already exists at the destination, prompt the user for that file before overwriting. Files that do not exist at the destination write silently (no prompt).
- **`--force` skips all prompts** and overwrites everything without asking.
- **`--dry-run` shows all conflicts** (and new files) without writing anything.
- Prompt format per conflict: show the file path and ask overwrite/skip.

### Hook path rewriting (IMP-04)
- **Auto-detect and rewrite silently.** Read the source home directory from the manifest (to be added to manifest in this phase), compare to `os.homedir()` on the target machine. Replace all occurrences of the source prefix in settings.json hook command strings.
- **Print a one-line summary** after the import: `Rewrote 3 hook paths: /Users/oldhome/ → /Users/newhome/`
- If source and target home dirs match (same machine or same username), no rewriting needed — no summary line printed.
- **Overwrite semantics for settings.json:** The archive's settings.json replaces the target's entirely (after path rewriting). No merging of hook sections. The archive represents the desired restore state.

### Backup granularity (IMP-05)
- **Back up only files that will be overwritten** (i.e., files where a conflict was detected). New files that don't exist at the destination are not backed up.
- Backup destination: `~/.claude/backups/YYYY-MM-DDTHH-MM-SS/` (timestamped directory).
- Backup happens before any write occurs — if a single backup copy fails, abort the import.

### `list` subcommand output (CLI-04)
- **Mirrored export format.** Display grouped by type with file counts, matching the export output style exactly. Show manifest metadata at the top (archive filename, export date, source platform).
- Example output:
  ```
  Archive: claude-sync-2026-04-04.tar.gz
  Exported: 2026-04-04  |  Source: darwin

    ✓ skills/          (3 files)
    ✓ rules/           (5 files)
    ✓ hooks            (found)
    ✓ commands/        (2 files)
    ✓ agents/          (1 file)
    ✓ CLAUDE.md        (found)
    ✓ keybindings      (found)
    — projects/        (not included)
  ```
- Does not extract any files — reads manifest.json from the archive only.

---

## Manifest changes required in Phase 2

The manifest (built in Phase 1) needs to record the source machine's home directory so IMP-04 can detect the prefix to rewrite. Add `source_home` field to the Manifest type in `src/types.mjs` and populate it in `buildManifest()` in `src/packer.mjs`.

---

## Canonical refs

- `src/types.mjs` — Manifest and ScannedFile type definitions (extend with `source_home`)
- `src/packer.mjs` — `buildManifest()` (add `source_home: os.homedir()`)
- `src/commands/export.mjs` — Pattern for command module structure; import command mirrors this
- `src/exclusions.mjs` — `DEFAULT_TYPES`, `TYPE_LABELS` needed for `list` output
- `.planning/REQUIREMENTS.md` — IMP-01 through IMP-05, CLI-03, CLI-04, SEC-03

---

## Deferred ideas

*(None raised during discussion)*
