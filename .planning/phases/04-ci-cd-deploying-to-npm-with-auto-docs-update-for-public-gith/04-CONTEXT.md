# Phase 4: CI/CD deploying to npm with auto docs update for public GitHub release

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Automate testing on pull requests, publishing to npm on successful merges to main, generating GitHub Releases with changelog and docs. This phase covers the release automation end-to-end — not the contents of the docs themselves, but the pipeline that keeps them in sync when shipping.

</domain>

<decisions>
## Implementation Decisions

### CI/CD Pipeline Triggers
- **D-01:** Test on every push to open pull requests
- **D-02:** Publish to npm and create GitHub Release on merge to `main`
- **D-03:** No automatic publishing on every push — version bumps are commit-based

### Version Strategy
- **D-04:** Use conventional commits (conventionalcommits.org) to determine version bumps
- **D-05:** feat: → minor version bump, fix: → patch version bump, feat! or fix! with BREAKING CHANGE → major bump
- **D-06:** Semantic version is computed by the release workflow, not manually maintained

### Auto Docs Update
- **D-07:** Full `docs/` directory regenerates on each publish
- **D-08:** Changelog is generated from conventional commits (using a tool like `release-please` or `standard-version`)
- **D-09:** API reference docs in `docs/` are regenerated from source code annotations or inline docs

### Release Artifacts
- **D-10:** npm package is published to the npm registry via `npm publish`
- **D-11:** GitHub Release is created with the `tar.gz` archive as a downloadable asset
- **D-12:** GitHub Release includes auto-generated changelog from conventional commits

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `package.json` — current version, dependencies, scripts, npm publish config
- `docs/ARCHITECTURE.md` — project architecture for docs generation context
- `docs/CONFIGURATION.md` — configuration reference
- `docs/DEVELOPMENT.md` — development guide
- `docs/GETTING-STARTED.md` — getting started guide
- `docs/TESTING.md` — testing guide
- `.github/` (if exists) — existing GitHub Actions workflows
- `.planning/REQUIREMENTS.md` — all v1 requirements

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `package.json` scripts section — can add `npm publish` and docs generation scripts
- `docs/` directory — existing structured docs that can be regenerated

### Established Patterns
- ESM modules throughout — any new CI scripts should use Node.js 20+
- Version is currently `0.1.0` in package.json — first npm publish will need `npm adduser` or npm token setup

### Integration Points
- `.github/workflows/` — new workflow files go here
- npm token secret — needs to be configured in GitHub repo settings (`NPM_TOKEN`)
- GitHub token — `GITHUB_TOKEN` is automatically available in GitHub Actions

</code_context>

<specifics>
## Specific Ideas

- Release workflow should feel standard — GitHub Actions with `release-please` or `standard-version` for conventional commits
- Auto-generated changelog should list all feat/fix/breaking entries since last release
- docs/ regeneration should run `npm run docs` or similar script if one exists, or a dedicated doc generation tool

</specifics>

<deferred>
## Deferred Ideas

- None — all four areas discussed and captured

</deferred>

---

*Phase: 04-ci-cd-deploying-to-npm-with-auto-docs-update-for-public-gith*
*Context gathered: 2026-04-07*
