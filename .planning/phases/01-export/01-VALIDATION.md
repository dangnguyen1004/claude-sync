---
phase: 1
slug: export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (ESM-native, zero config for .mjs files) |
| **Config file** | none — Wave 0 installs vitest and adds test script to package.json |
| **Quick run command** | `npm test -- --reporter=verbose src/exclusions.test.mjs src/scanner.test.mjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose src/exclusions.test.mjs src/scanner.test.mjs`
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| setup-package | 01 | 0 | CLI-01 | manual | `node bin/claude-sync.mjs --help` exits 0 | ❌ W0 | ⬜ pending |
| exclusions-module | 01 | 1 | EXP-11, EXP-12 | unit | `npm test -- src/exclusions.test.mjs` | ❌ W0 | ⬜ pending |
| scanner-module | 01 | 1 | EXP-01..07, EXP-10 | unit | `npm test -- src/scanner.test.mjs` | ❌ W0 | ⬜ pending |
| packer-module | 01 | 2 | EXP-09, EXP-13, SEC-02 | unit | `npm test -- src/packer.test.mjs` | ❌ W0 | ⬜ pending |
| export-command | 01 | 3 | CLI-02 | integration | `npm test -- src/commands/export.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/fixtures/claude-home/` — fixture directory with skills/, rules/, commands/, agents/, CLAUDE.md, keybindings.json, settings.json, cache/ (excluded), debug/ (excluded)
- [ ] `test/fixtures/oauth-home/.claude.json` — simulated OAuth token file (must never appear in archive)
- [ ] `src/exclusions.test.mjs` — test stubs covering EXP-11, EXP-12 (exclusion list behavior)
- [ ] `src/scanner.test.mjs` — test stubs covering EXP-01..07, EXP-10 (scanner discovers correct data types)
- [ ] `src/packer.test.mjs` — test stubs covering EXP-09, EXP-13, SEC-02 (manifest, streaming, relative paths)
- [ ] `src/commands/export.test.mjs` — test stubs covering CLI-02 (integration: export produces valid archive)
- [ ] `npm install -D vitest` — install test framework
- [ ] `package.json` `test` script: `"test": "vitest run"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `npm install -g claude-sync` works from a fresh directory | CLI-01 | Requires npm publish or `npm link` to test global install | Run `npm link` in project root, then `claude-sync --help` from any directory |
| Default output filename is `claude-sync-YYYY-MM-DD.tar.gz` | CLI-02 | Requires inspecting filesystem after run | Run `claude-sync export` with no args, verify file name matches date pattern |
| `~/.claude.json` exclusion notice printed | EXP-11 | Requires real `~/.claude.json` or mocked home | Run export with a home dir that has `.claude.json`, check stdout for exclusion message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
