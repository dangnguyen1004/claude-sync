# Domain Pitfalls

**Domain:** CLI tool for exporting/importing Claude Code data from ~/.claude/
**Researched:** 2026-04-04
**Confidence:** HIGH (grounded in actual ~/.claude directory inspection + official Claude Code docs + verified CVEs)

---

## Critical Pitfalls

Mistakes that cause security incidents, data loss, or rewrites.

---

### Pitfall 1: Exporting ~/.claude.json — OAuth Tokens and Account Identity

**What goes wrong:** The export captures `~/.claude.json` (in `$HOME`, NOT inside `~/.claude/`) which contains the user's OAuth account data, including `accountUuid`, `emailAddress`, `organizationUuid`, and importantly `mcpServers[*].headers` — which are MCP authentication tokens. Importing this file on another machine logs the target machine into the source user's account.

**Why it happens:** `~/.claude.json` is the flat config file that Claude Code uses for session state, and it lives one level above `~/.claude/` where most data lives. Tools that naively backup `~HOME/.*` or `$HOME/.claude*` will capture it. Its name is close to the target directory name, making glob mistakes easy.

**Confirmed structure (verified on real machine):**
- `oauthAccount` — email, UUID, org role, billing type
- `mcpServers` — server configs including `headers` (auth tokens)
- `userID` — Anthropic account UUID
- `projects[*].mcpServers` — per-project MCP server configs with potential credentials

**Consequences:**
- Archive contains credentials; if shared with a teammate the recipient can impersonate the exporter
- If archive is committed to a public repo or cloud storage without encryption, tokens are exposed
- Importing on a new machine replaces the user's own OAuth session — they may be logged out or logged into the wrong account

**Prevention:**
- Explicitly exclude `~/.claude.json` from all exports by default; never include it without a `--include-auth` flag that shows a prominent security warning
- Document clearly that `~/.claude.json` is out of scope for v1
- The import side must also refuse to write `~/.claude.json` without an explicit opt-in flag

**Detection (warning signs):**
- Any code path that reads from `$HOME` rather than `$HOME/.claude/` specifically
- Any glob pattern like `~/.claude*` that would match both `~/.claude/` and `~/.claude.json`

**Phase that must address it:** Phase 1 (Export command) — the exclusion list must be defined before any file-collection logic is written.

---

### Pitfall 2: hooks commands in settings.json May Embed Secrets

**What goes wrong:** `~/.claude/settings.json` contains `hooks` with `command` entries. Hook commands are shell strings that may reference environment variable values hardcoded by the user (e.g., `curl -H "Authorization: Bearer sk-ant-xxx" ...`), or reference scripts that contain tokens. The entire `settings.json` is in scope for export per the PROJECT.md requirements.

**Why it happens:** Users who set up HTTP hooks or notification hooks sometimes hardcode credentials in the command string rather than using env var references. Claude Code does not prevent this. The file is a plain JSON file readable by any process with user permissions.

**Confirmed structure (verified):** `settings.json` hooks use `{ "type": "command", "command": "..." }` entries under `PreToolUse`, `PostToolUse`, `Stop`, `Notification`, `SessionStart`.

**Consequences:**
- Exported archive contains literal secret values in a plain JSON file
- No encryption of the archive means secrets are in cleartext in a zip/tar file

**Prevention:**
- Before including `settings.json` in the archive, scan hook `command` fields for patterns matching common secret formats: `sk-ant-`, `Bearer `, `Authorization:`, `token=`, `api_key=`, `password=`
- Warn the user when a potential secret is detected; require `--skip-secret-scan` to suppress
- Consider redacting detected secrets from the export by default (replace with `REDACTED_BY_CLAUDE_SYNC`)
- Document in the README that hooks containing hardcoded secrets are not safe to export without review

**Detection (warning signs):**
- Any export code that reads `settings.json` as a blob without inspecting its contents
- No secret-scanning step before archive creation

**Phase that must address it:** Phase 1 (Export command) — add a secret-scan pass before finalizing archive contents.

---

### Pitfall 3: Archive Path Traversal (Zip Slip) on Import

**What goes wrong:** When building the archive on export, if file paths are stored as absolute paths (e.g., `/Users/alice/.claude/rules/my-rule.md`), the import step either (a) hardwires paths to the original machine's username, breaking on different machines, or (b) a malicious or corrupted archive with relative path traversal sequences like `../../.ssh/authorized_keys` writes files outside `~/.claude/`.

**Why it happens:** Node.js archiving libraries historically did not sanitize entry paths. The Zip Slip class of vulnerabilities (CVE-2021-23484, CVE-2025-3445) affects multiple archive libraries. Even without malicious intent, absolute-path archives silently fail on machines with different usernames.

**Verified active issue:** CVE-2025-3445 (April 2025) in Go's `mholt/archiver`. Node.js `zip-local` CVE-2021-23484 (arbitrary file write via unsanitized paths). These recur regularly.

**Consequences:**
- Import silently writes files to wrong location (absolute path with different username)
- Malicious archive writes files to arbitrary filesystem locations
- User data is silently corrupted without error

**Prevention:**
- Store all paths in the archive as relative paths from a virtual root (`claude-sync-export/`) — never absolute
- On import, validate every extracted path: resolve the full path and assert it starts with the target directory (`path.resolve(targetDir) + path.sep`)
- Reject any entry whose resolved path escapes the target directory
- Use the `tar` package's `strip` option or manually strip leading path components

**Detection (warning signs):**
- Any code using `fs.createWriteStream(entryPath)` without first validating `entryPath` against the target root
- Archive entries with `/` or `../` at the start of their stored path names

**Phase that must address it:** Phase 1 (Archive format decision) and Phase 2 (Import command).

---

### Pitfall 4: Import Silently Overwrites Active Work

**What goes wrong:** The import command overwrites `~/.claude/projects/` which contains active conversation JSONL files. If Claude Code is running during import, partial writes corrupt the session files. Even without a running session, the user loses all conversations created since their last export with no warning.

**Why it happens:** A naive "extract archive to destination" approach does not check for existing files or running processes. The PROJECT.md explicitly requires non-destructive import, but implementing it requires more than just an `--force` flag.

**Consequences:**
- Conversation history irreversibly destroyed
- Corrupted JSONL files that Claude Code cannot parse, causing it to hang (known issue: GitHub issue #22365)
- User trust destroyed in the tool

**Prevention:**
- Default behavior: refuse to write any file that already exists; require explicit `--overwrite` flag for each category (conversations, rules, skills, settings)
- Before any write, create a timestamped backup of the destination: `~/.claude/backups/pre-import-YYYYMMDD-HHmmss/`
- Implement dry-run mode (`--dry-run`) that lists every file that would be created/overwritten without touching the filesystem — this is already in PROJECT.md requirements
- Detect if Claude Code is currently running (check for lockfiles or process name) and warn before proceeding

**Detection (warning signs):**
- Import code that uses `fs.cp(src, dest, { recursive: true })` without file-existence checks
- No backup step before any write operation

**Phase that must address it:** Phase 2 (Import command) — dry-run and backup must be implemented before any real write logic.

---

## Moderate Pitfalls

---

### Pitfall 5: Large Conversation History Causes Out-of-Memory or Timeout

**What goes wrong:** Conversation JSONL files can grow to multiple gigabytes. GitHub issue #18905 confirms session files reaching 3.8 GB from complex multi-agent sessions. Naively reading entire JSONL files into memory to add to an archive crashes the Node.js process.

**Why it happens:** `fs.readFileSync` and many archive libraries buffer entire file contents in memory. Conversation directories with hundreds of projects and thousands of sessions multiply the problem.

**Real-world data (verified on local machine):** Largest JSONL file in a small project is 2.3 MB; GitHub reports files of 3–4 GB in heavy usage. Total `~/.claude/projects/` size can easily reach 10+ GB for active users.

**Consequences:**
- Export crashes with `ENOMEM` on large installations
- Slow exports (minutes) with no progress feedback — user thinks the tool is broken
- Archive creation appears to succeed but produces a truncated file

**Prevention:**
- Use streaming APIs throughout: `fs.createReadStream` → archive entry stream; never `readFileSync` for files that could be large
- Use `node-archiver` or `tar` (npm) with their streaming interfaces; avoid loading file content into memory
- Add a pre-export size estimate: warn the user if total export size exceeds a threshold (e.g., 500 MB) and show a progress indicator
- Allow `--exclude-conversations` flag to skip the `projects/` directory for users who only want to sync configuration

**Detection (warning signs):**
- Any `readFileSync` or `JSON.parse(fs.readFileSync(...))` on files from `~/.claude/projects/`
- Archive creation loop that collects all file buffers before writing

**Phase that must address it:** Phase 1 (Export command) — streaming must be baked in from the start; retrofitting is expensive.

---

### Pitfall 6: Project Folder Names Encode Absolute Source Paths

**What goes wrong:** `~/.claude/projects/` uses folder names that are the project's absolute path with `/` replaced by `-`. For example, `/Users/alice/Projects/my-app` becomes `-Users-alice-Projects-my-app`. On import to a machine where the user's home is `/home/bob`, the folder names in the archive reference `alice`'s username.

**Why it happens:** Claude Code uses the encoded path as a project identifier. If the restored folder names don't match the current machine's paths, Claude Code cannot associate them with the right project when the user opens that project again.

**Consequences:**
- Imported conversations appear in Claude Code but are never surfaced when the user opens the corresponding project (because the directory name doesn't match the current path)
- Confusion: user sees empty conversation history for their migrated project

**Prevention:**
- Document this limitation explicitly — v1 (replace/restore) cannot fix path encoding without rewriting JSONL internals
- Provide a `--remap-path OLD_PREFIX NEW_PREFIX` flag on import (e.g., `--remap-path /Users/alice /home/bob`) that renames project directories during extraction
- When remapping, also scan JSONL files for the old path string and replace it (since `~/.claude.json` embeds `projects` keys as absolute paths — confirmed by structure inspection)
- Flag for deeper research before implementing the remap feature

**Detection (warning signs):**
- The import silently succeeds but the user cannot see their restored conversations in Claude Code
- No path-remapping logic in the import command

**Phase that must address it:** Phase 2 (Import command) — document the limitation clearly; implement `--remap-path` as a follow-on in a later phase.

---

### Pitfall 7: Partial Export Leaves a Corrupt Archive

**What goes wrong:** If the export process is interrupted (Ctrl-C, disk full, process killed), the archive file is left in a partial state. A user who does not notice this might store or share the partial archive and discover the corruption only at restore time — likely during an emergency migration.

**Why it happens:** Streaming archive creation writes to the output file incrementally. If the process exits before the archive is finalized, the central directory (in zip) or end-of-archive marker (in tar) is never written. Many decompression tools silently extract partial content.

**Consequences:**
- User believes they have a valid backup; it fails at restore time
- Silent data loss on restore (partial extraction, no error)

**Prevention:**
- Write the archive to a temp file (`export-TIMESTAMP.tmp`) and rename it to the final name only after successful completion — atomic swap pattern
- After archive creation, verify integrity: for tar.gz, run a test-read pass; for zip, verify the central directory
- Output a clear completion message with a checksum (SHA-256) of the archive file; document how to verify it before restore

**Detection (warning signs):**
- Export writes directly to the final output filename without a `.tmp` intermediate
- No post-creation integrity check

**Phase that must address it:** Phase 1 (Export command).

---

### Pitfall 8: Versioning — Claude Code Adds or Removes Files Without Notice

**What goes wrong:** Claude Code has no public API stability guarantee for its data format. The directory structure (e.g., `skills/`, `rules/`, `agents/`, `sessions/`, `shell-snapshots/`) and JSON schemas can change between releases. An export created with one Claude Code version may not import correctly into a future version.

**Why it happens:** Claude Code is actively developed and the `~/.claude/` layout has already grown considerably. New directories (`agents/`, `sessions/`, `shell-snapshots/`) appeared without changelog entries visible to third-party tools.

**Confirmed evolving structure:** The `~/.claude/` directory currently contains 32 entries including `agents/`, `backups/`, `cache/`, `commands/`, `debug/`, `file-history/`, `hooks/`, `ide/`, `paste-cache/`, `plans/`, `plugins/`, `rules/`, `session-env/`, `sessions/`, `shell-snapshots/`, `skills/`, `statsig/`, `tasks/`, `telemetry/`, `todos/`. Not all of these existed in earlier Claude Code versions.

**Consequences:**
- Import of an old archive silently omits new data types that the current version uses
- Import of a new-format archive onto an older Claude Code version may write files the tool cannot interpret

**Prevention:**
- Embed a manifest file inside every archive: `claude-sync-manifest.json` containing the schema version, Claude Code version detected at export time, list of included data categories, and export timestamp
- On import, read the manifest and warn if the schema version doesn't match the current tool's expected version
- Design the import as additive: only write known data categories; skip unknown directories in the archive rather than failing
- Flag the manifest format for deeper research before finalizing — this is the primary forward-compatibility mechanism

**Detection (warning signs):**
- Archives contain no metadata about what version of Claude Code generated them
- Import code that fails hard on unexpected archive entries

**Phase that must address it:** Phase 1 (Archive format) — the manifest must be designed before the first archive is created.

---

## Minor Pitfalls

---

### Pitfall 9: Tilde and Relative Path Confusion in Node.js

**What goes wrong:** Node.js does not expand `~` in paths. `fs.readdir("~/.claude")` fails with ENOENT. Code that accepts a `--output ~/backups/export.tar.gz` argument and passes it directly to `fs.createWriteStream` writes a file named literally `~` in the current directory.

**Prevention:**
- Always resolve paths via `path.resolve(outputPath.replace(/^~/, os.homedir()))` before any file operation
- Add a test for this with a path that starts with `~`

**Phase that must address it:** Phase 1 (CLI argument parsing).

---

### Pitfall 10: Symlinks Inside ~/.claude/ Are Followed or Broken

**What goes wrong:** If the user has symlinked any file or directory inside `~/.claude/` (e.g., `~/.claude/rules -> ~/dotfiles/claude-rules`), the tool must decide whether to follow the symlink (exporting the real files) or to archive the symlink itself (which breaks portability). Following symlinks without a depth limit can also accidentally pull in large external directories.

**Prevention:**
- Use `fs.lstat` to detect symlinks before archiving; follow them by default (archive real content) but cap recursion depth
- Log a warning when a symlink is encountered so the user is aware
- Do not archive broken symlinks — check that the symlink target exists before following

**Phase that must address it:** Phase 1 (Export file collection).

---

### Pitfall 11: File Permissions Are Not Preserved on macOS Extended Attributes

**What goes wrong:** `~/.claude/` contains files with macOS extended attributes (`@` suffix in `ls -la` output — visible on many files in the directory). Standard `tar` preserves these; Node.js zip libraries typically do not. On restore, missing extended attributes are usually harmless but can affect macOS Gatekeeper quarantine flags on executable scripts.

**Prevention:**
- Use `tar.gz` format rather than `.zip` for the archive — tar preserves POSIX permissions and can preserve xattrs with `--xattrs` flag
- Document that extended attributes are not guaranteed to survive an export/import cycle
- For the `hooks/` directory which may contain executable scripts, explicitly set `chmod +x` during import

**Phase that must address it:** Phase 1 (Archive format decision).

---

### Pitfall 12: debug/ and telemetry/ Directories Bloat the Archive with No Value

**What goes wrong:** `~/.claude/debug/` and `~/.claude/telemetry/` contain runtime debug logs and telemetry data. These are ephemeral, machine-specific, and potentially large. Including them in an export adds archive size without any restore value.

**Prevention:**
- Maintain an explicit exclusion list of directories that are never exported regardless of user flags:
  - `debug/` — runtime logs
  - `telemetry/` — telemetry data
  - `statsig/` — feature flag cache
  - `cache/` — local cache
  - `paste-cache/` — clipboard paste cache
  - `shell-snapshots/` — machine-specific shell state
  - `session-env/` — machine-specific session env snapshots
  - `ide/` — IDE integration state
  - `backups/` — existing backups (avoid recursive backup-of-backups)
- Document which directories ARE included vs excluded in the README

**Phase that must address it:** Phase 1 (Export command) — the exclusion list must be codified before the first release.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Export file collection | Capturing `~/.claude.json` (OAuth tokens) | Explicit exclusion by filename, not just directory prefix |
| Export file collection | Symlinks pointing to large external trees | `lstat` detection + depth cap |
| Archive format decision | Absolute paths in archive entries | Enforce relative-path-only storage from day one |
| Archive format decision | No version manifest | Embed `claude-sync-manifest.json` in every archive |
| Archive creation | Large JSONL files crashing on `readFileSync` | Streaming API only; no buffering |
| CLI argument parsing | Tilde `~` not expanded by Node.js | Explicit `os.homedir()` expansion before all path operations |
| Import command | Zip Slip path traversal | Validate every extracted path resolves inside target dir |
| Import command | Overwriting active conversations | Pre-import backup + dry-run + `--overwrite` flag per category |
| Import command | Hardcoded source username in project folder names | Document limitation; provide `--remap-path` flag |
| Secret scanning | Hook commands containing literal API keys | Scan `command` strings before archive creation |
| Secret scanning | MCP server headers in `~/.claude.json` | Exclude the file entirely; document the exclusion |

---

## Sources

- Claude Code settings documentation (official): https://code.claude.com/docs/en/settings
- Claude Code conversation history structure: https://gist.github.com/samkeen/dc6a9771a78d1ecee7eb9ec1307f1b52
- Large JSONL session files bug report (GitHub #22365): https://github.com/anthropics/claude-code/issues/22365
- Session JSONL multi-GB size bug (GitHub #18905): https://github.com/anthropics/claude-code/issues/18905
- Zip Slip vulnerability research (Snyk): https://security.snyk.io/research/zip-slip-vulnerability
- CVE-2025-3445 (mholt/archiver Zip Slip, April 2025): https://linuxsecurity.com/news/security-vulnerabilities/linux-tar-async-tar-vulnerability-tarmageddon
- Protecting Node.js from Zip Slip: https://medium.com/intrinsic-blog/protecting-node-js-applications-from-zip-slip-b24a37811c10
- GNU tar security documentation: https://www.gnu.org/software/tar/manual/html_section/Security.html
- shallow-backup (dotfile backup tool with secret scanning): https://github.com/alichtman/shallow-backup
- Secret management for dotfiles: https://dotfiles.io/en/guides/secret-management/
- Claude Code auto-loads .env secrets: https://www.knostic.ai/blog/claude-loads-secrets-without-permission
- Stop hardcoding secrets in Claude Code: https://dev.to/myougatheaxo/stop-claude-code-from-hardcoding-secrets-environment-variables-done-right-h7e
- node-archiver memory issues with large files: https://github.com/archiverjs/node-archiver/issues/422
- Conversation history management guide: https://kentgigger.com/posts/claude-code-conversation-history
- Claude Code migration after directory move: https://gist.github.com/gwpl/e0b78a711b4a6b2fc4b594c9b9fa2c4c
