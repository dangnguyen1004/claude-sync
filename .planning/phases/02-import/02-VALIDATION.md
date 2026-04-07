---
phase: 02
slug: import
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
completed: 2026-04-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.1.1 |
| **Config file** | vitest.config.js (root) |
| **Quick run command** | `npm test -- src/commands/import.test.mjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/commands/import.test.mjs`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | IMP-01 | unit | `npm test -- src/unpacker.test.mjs` | ✅ src/unpacker.test.mjs | ✅ green |
| 02-01-02 | 01 | 1 | CLI-03 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ✅ green |
| 02-01-03 | 01 | 1 | IMP-03 | unit | `npm test -- src/restorer.test.mjs` | ✅ src/restorer.test.mjs | ✅ green |
| 02-01-04 | 01 | 1 | IMP-05 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ✅ green |
| 02-02-01 | 02 | 2 | IMP-02 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ✅ green |
| 02-02-02 | 02 | 2 | SEC-03 | unit | `npm test -- src/restorer.test.mjs` | ✅ src/restorer.test.mjs | ✅ green |
| 02-03-01 | 02 | 2 | CLI-04 | unit | `npm test -- src/commands/list.test.mjs` | ✅ src/commands/list.test.mjs | ✅ green |
| 02-03-02 | 02 | 2 | IMP-04 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ✅ green |

*Status: ✅ all green · 97 tests passing*

---

## Wave 0 Requirements

- [x] `src/commands/import.test.mjs` — stubs for all import behaviors (dry-run, force, per-file prompt, backup, path rewrite, list)
- [x] `vitest.config.js` already exists at root — no additional config needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-file interactive prompt (inquirer) | IMP-02 | Requires TTY/stubbing inquirer | Stub `inquirer.prompt` to return conflicts or non-conflicts, verify correct write/skip behavior — covered by `force mode imports without prompting` test |
| CLI flag `--force` skips all prompts | IMP-02 | Confirmed via code path, not TTY | Test that `runImport` with `force: true` calls no prompts — verified with mock |
| `list` subcommand output format matches export style | CLI-04 | Visual format verification | Output verified via test output matching export format exactly |
| Backup directory timestamp format `YYYY-MM-DDTHH-MM-SS` | IMP-05 | File system naming | Verified by `creates backup directory when overwriting files in force mode` test |
| Path rewriting summary line printed | IMP-04 | Console output | Verified by `prints hook rewrite summary when source_home differs` test |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] All 8 test files passing

**Approval:** ✅ Phase 2 complete

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.1.1 |
| **Config file** | vitest.config.js (root) |
| **Quick run command** | `npm test -- src/commands/import.test.mjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- src/commands/import.test.mjs`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | IMP-01 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ⬜ pending |
| 02-01-02 | 01 | 1 | CLI-03 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ⬜ pending |
| 02-01-03 | 01 | 1 | IMP-03 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ⬜ pending |
| 02-01-04 | 01 | 1 | IMP-05 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ⬜ pending |
| 02-02-01 | 02 | 2 | IMP-02 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ⬜ pending |
| 02-02-02 | 02 | 2 | SEC-03 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ⬜ pending |
| 02-03-01 | 03 | 2 | CLI-04 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ⬜ pending |
| 02-03-02 | 03 | 2 | IMP-04 | unit | `npm test -- src/commands/import.test.mjs` | ✅ src/commands/import.test.mjs | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/commands/import.test.mjs` — stubs for all import behaviors (dry-run, force, per-file prompt, backup, path rewrite, list)
- [ ] `vitest.config.js` already exists at root — no additional config needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-file interactive prompt (inquirer) | IMP-02 | Requires TTY/stubbing inquirer | Stub `inquirer.prompt` to return conflicts or non-conflicts, verify correct write/skip behavior |
| CLI flag `--force` skips all prompts | IMP-02 | Confirmed via code path, not TTY | Test that `runImport` with `force: true` calls no prompts |
| `list` subcommand output format matches export style | CLI-04 | Visual format verification | Compare output structure to `src/exclusions.mjs` TYPE_LABELS and exported format |
| Backup directory timestamp format `YYYY-MM-DDTHH-MM-SS` | IMP-05 | File system naming | Verify backup dir created with correct ISO timestamp format |
| Path rewriting summary line printed | IMP-04 | Console output | Stub `console.log`, call import with mismatched source_home, verify summary line |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
