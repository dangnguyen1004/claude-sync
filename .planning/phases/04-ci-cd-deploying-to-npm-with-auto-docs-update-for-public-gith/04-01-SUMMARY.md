---
phase: "04"
plan: "01"
subsystem: ci-cd
tags:
  - npm
  - github-actions
  - release-please
  - commitlint
  - conventional-commits
dependency-graph:
  requires:
    - phase: "03"
      plan: "01"
      reason: Polish phase must be complete before CI/CD setup
  provides:
    - Test automation on PRs and main pushes
    - Automated npm publishing
    - GitHub Release creation with changelog
tech-stack:
  added:
    - "@commitlint/cli@^19.0.0"
    - "@commitlint/config-conventional@^19.0.0"
    - "vitest@^3.1.1"
  patterns:
    - Conventional commits for changelog generation
    - release-please for version management
    - GitHub Actions for CI/CD
key-files:
  created:
    - ".github/workflows/ci.yml"
    - ".github/workflows/release.yml"
    - "scripts/generate-docs.mjs"
    - "commitlint.config.cjs"
    - ".release-please-manifest.json"
    - ".node-version"
  modified:
    - "package.json"
decisions:
  - "release-please chosen over standard-version for its PR-based review workflow"
  - "commitlint only runs on PRs, not main merges, to avoid blocking initial commits"
  - "CI runs on both ubuntu-latest and macos-latest for macOS target users"
  - "Archive built using the CLI itself in release workflow (end-to-end validation)"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-07"
---

# Phase 04 Plan 01: CI/CD Pipeline for npm and GitHub Releases

## One-liner

CI/CD pipeline with release-please, commitlint, GitHub Actions on ubuntu/macOS, npm publish, and GitHub Releases with auto-generated changelog from conventional commits.

## What Was Built

Configured the complete CI/CD pipeline for publishing claude-sync to npm and GitHub Releases. The pipeline enforces conventional commits via commitlint on PRs, runs tests on ubuntu and macOS, and uses release-please to manage versioning and changelog generation.

### Task 1: package.json configuration

- Added `scripts.docs` and `scripts.lint-commits` for release automation
- Added `publishConfig` with public access and npm registry
- Added commitlint devDependencies (`@commitlint/cli`, `@commitlint/config-conventional`)
- vitest was already present

### Task 2: docs generation script

- Created `scripts/generate-docs.mjs` that verifies docs/ directory presence
- Current implementation is minimal (docs already well-maintained manually)
- Future phases can expand to auto-generate API docs from JSDoc

### Task 3: CI workflow

- Created `.github/workflows/ci.yml` with triggers on push to main and PRs
- Matrix builds on ubuntu-latest and macos-latest (macOS target users)
- Runs `npm ci`, `npm test`, and `npm run lint-commits` (PRs only)
- Concurrency group cancels in-progress runs on new commits

### Task 4: Release workflow

- Created `.github/workflows/release.yml` with release-please on main push
- release-please creates a PR with version bump + changelog
- On PR merge, publish job runs: docs verification, npm test, archive build using CLI, npm publish, GitHub Release with archive attachment
- Uses `softprops/action-gh-release@v2` for release creation

## Deviations from Plan

None — plan executed exactly as written.

## Deviations Auto-Fixed

None.

## Auth Gates

None.

## Verification Results

| Check | Result |
|-------|--------|
| CI workflow YAML valid | PASS |
| Release workflow YAML valid | PASS |
| `node scripts/generate-docs.mjs` runs | PASS (Verified 5 docs files present) |
| package.json has publishConfig | PASS |
| package.json has docs script | PASS |
| package.json has lint-commits script | PASS |

## Files Changed

```
M package.json
A .github/workflows/ci.yml
A .github/workflows/release.yml
A .release-please-manifest.json
A .node-version
A commitlint.config.cjs
A scripts/generate-docs.mjs
```

## Self-Check

All files created exist on disk and commit was successful.

## Threat Flags

None.

## Known Stubs

None.
