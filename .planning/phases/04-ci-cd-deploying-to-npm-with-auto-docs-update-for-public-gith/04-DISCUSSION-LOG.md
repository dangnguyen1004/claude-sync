# Phase 4: CI/CD deploying to npm with auto docs update for public GitHub release - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 04-ci-cd-deploying-to-npm-with-auto-docs-update-for-public-gith
**Areas discussed:** CI/CD Pipeline Triggers, Version Strategy, Auto Docs Update, Release Artifacts

---

## CI/CD Pipeline Triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Every push to main + PRs; publish on tags | Full test coverage; manual tag step for publish | |
| Merge to main only | Test on PRs; publish on merge | ✓ |
| Tags only | Test on push; publish when you explicitly tag | |

**User's choice:** Merge to main only
**Notes:** Tests run on all open PRs; publishing happens automatically on successful merge to main.

---

## Version Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Manual versioning | You edit package.json version before merging; workflow reads it | |
| Auto versioning (package.json) | Workflow reads version from package.json; you manage it manually | |
| Conventional commits | feat: = minor, fix: = patch, feat! or BREAKING CHANGE = major; auto-generated | ✓ |

**User's choice:** Conventional commits
**Notes:** Semantic version bumps computed automatically from conventional commit messages by the release workflow.

---

## Auto Docs Update

| Option | Description | Selected |
|--------|-------------|----------|
| README only | Version badge, install count, quick refresh | |
| Full docs/ regeneration | API docs, changelog from conventional commits | ✓ |
| Skip auto docs | Update manually | |

**User's choice:** Full docs/ regeneration
**Notes:** Changelog generated from conventional commits. API reference docs regenerated from source annotations.

---

## Release Artifacts

| Option | Description | Selected |
|--------|-------------|----------|
| npm only | npm publish to the npm registry | |
| npm + GitHub Release | npm package + tar.gz archive as a Release asset | ✓ |
| GitHub Release only | Archive published as GitHub Release, no npm | |

**User's choice:** npm + GitHub Release
**Notes:** Both npm package and GitHub Release with archive asset. GitHub Release includes auto-generated changelog.

---

*Discussion completed: 2026-04-07*
