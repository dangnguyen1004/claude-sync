# Technology Stack

**Project:** claude-sync
**Researched:** 2026-04-04
**Scope:** CLI backup/export/import tool for Claude Code data on macOS/Linux

---

## Recommended Stack

### Runtime

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | >=18.x (target >=20 preferred) | Runtime | Claude Code already requires Node.js 18+. Zero additional install burden. Native installer path may ship without Node.js, but npm-installed Claude Code still requires it — safe to assume presence. |

**Node.js version note:** Claude Code's npm-based installation requires Node.js 18+. Commander.js v14 (latest) requires Node.js 20+. Commander.js v12 still receives security updates until May 2027 and supports Node.js 18+. Set `engines: { "node": ">=18" }` and use commander v12 to maximize compatibility, OR target Node.js 20+ and use commander v14. Given this tool is for power users who are already running Claude Code, targeting Node.js 20+ is safe and gives access to a cleaner API.

**Recommendation:** Target Node.js 20+, use commander v14. If compatibility reports arise, downgrade commander to v12 at no API cost.

---

### CLI Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| commander | 14.0.3 | Subcommand routing, option parsing, help generation | Zero dependencies. 500M+ weekly downloads. 18ms startup time vs 35ms (yargs) vs 85ms (oclif). This tool has exactly two subcommands (export, import) — commander's flat, explicit API is a perfect fit. No plugin system needed, no scaffolding needed. |

**What NOT to use:**
- **yargs**: ~7 dependencies, slower startup. Its declarative chain syntax is elegant for complex CLIs, but it's overkill here. The flexibility it adds over commander is not needed for a 2-command tool.
- **oclif**: ~30 dependencies, 85-135ms startup. Built for enterprise CLIs with plugin systems and auto-generated docs. Far too heavy for a focused backup tool. Also requires specific project structure that imposes friction.
- **minimist / parseArgs**: Node.js built-in `util.parseArgs` is available since Node 18.3 and requires zero dependencies, but it lacks help text generation, subcommand routing, and argument validation that commander provides out of the box. Commander's ergonomics are worth the single dependency.

---

### Archive Format

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tar (npm) | 7.5.13 | Creating and extracting `.claude-sync.tar.gz` archives | The `tar` npm package is the gold standard: pure JavaScript, cross-platform, handles symlinks correctly, supports streaming for large conversation histories. Uses Node.js built-in `zlib` internally. Requires Node.js 18+, matching our target. |

**Archive format choice — tar.gz over zip:**

- **tar.gz wins** for this use case. The `~/.claude/` directory is a tree of text files and JSON. tar preserves directory structure, symlinks, and file permissions natively. gzip compression is built into Node.js `zlib`. The `tar` npm package wraps both cleanly.
- **zip loses** because: the npm ecosystem has two viable zip packages (`archiver` at 7.0.1 and `jszip`). `archiver` has 6+ dependencies and is optimized for streaming large files to disk — useful for audio/video, unnecessary here. `jszip` is primarily browser-targeted. Neither has a compelling advantage over `tar` for a filesystem-based backup.
- **Single-file archive** named with a timestamp (e.g., `claude-sync-2026-04-04.tar.gz`) satisfies the "easy to share, email, store" requirement from PROJECT.md.

**What NOT to do:**
- Do not use Node.js built-in `zlib` + manual tar construction. The `tar` npm package is 72k downloads/week, mature, and handles edge cases (special characters in paths, nested directories) correctly. Rolling your own tar is a pitfall.
- Do not use `archiver` unless zip format is required. It has more surface area than needed and does not simplify the API for directory-based exports.

---

### File System Operations

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js built-in `fs/promises` | (built-in) | Reading, copying, and writing files | `fs.promises.cp()` (stable since Node 20.1) handles recursive directory copy with one call. `fs.promises.mkdir({ recursive: true })` creates nested directories. No external package needed. |

**What NOT to use:**
- **fs-extra**: A popular polyfill for `fs.promises.cp()` that predates Node.js adding it natively. As of Node.js 20+, it is unnecessary. Zero reason to add a dependency for functionality the runtime provides.
- **glob / fast-glob**: Not needed. The export paths are known and fixed (`~/.claude/skills/`, `~/.claude/rules/`, etc.). No dynamic globbing required in v1.

---

### User Experience (UX) Libraries

These are optional but high-value for a polished v1 experience.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chalk | 5.6.2 | Terminal color output | Color-code success (green), errors (red), warnings (yellow), info (dim). Pure ESM, lightweight, no deps. |
| ora | 9.3.0 | Spinner for async operations | Show progress during archive creation/extraction. Especially useful during large conversation history export. |
| @inquirer/prompts | 8.3.2 | Interactive confirmation prompts | Non-destructive import gate: "This will overwrite 47 files. Continue? [y/N]". Also used for selective export checkboxes. |

**Note on module format:** chalk v5+ and ora v9+ are ESM-only. If the project uses CJS (`"type"` not set in package.json), pin chalk to v4.x and ora to v5.x, which ship both CJS and ESM. The cleaner path is to use ESM throughout (`.mjs` entry point or `"type": "module"` in package.json). See Module Format section below.

**What NOT to use:**
- **@clack/prompts** (v1.2.0): Newer, prettier alternative to inquirer. However, it is opinionated about its styling and provides less control over prompt logic. Inquirer v9+ (`@inquirer/prompts`) has a cleaner async API, more prompt types, and better TypeScript types. Use inquirer.
- **colors / color**: Both have had supply chain incidents. chalk is the correct choice.
- **listr2**: Task list runners are useful for multi-step pipelines with rollback, but they add complexity. For this tool's linear export/import flow, sequential ora spinners are sufficient.

---

## Module Format Decision

**Use ESM (`"type": "module"` in package.json).**

Rationale:
- chalk v5, ora v9, and @inquirer/prompts v8 are all ESM-only. Using CJS forces downgrading to older versions of all three.
- Node.js 20+ has full, stable ESM support.
- The shebang `#!/usr/bin/env node` works correctly with ESM entry points.
- ESM enables top-level `await`, which simplifies async CLI flow significantly (no need to wrap everything in an `async main()` shell).

Entry point: `bin/claude-sync.mjs` with `#!/usr/bin/env node` on line 1.

---

## Packaging and Distribution

### Package Structure

```
claude-sync/
  bin/
    claude-sync.mjs        # Entry point with shebang
  src/
    commands/
      export.mjs
      import.mjs
    lib/
      archive.mjs          # tar.gz create/extract wrappers
      paths.mjs            # ~/.claude/ path constants
      confirm.mjs          # @inquirer/prompts wrappers
  package.json
```

### package.json bin field

```json
{
  "name": "claude-sync",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": {
    "claude-sync": "./bin/claude-sync.mjs"
  },
  "files": ["bin/", "src/"]
}
```

### Installation Methods

| Method | Command | Use Case |
|--------|---------|---------|
| Global install | `npm install -g claude-sync` | Primary. Registers `claude-sync` as a system command. |
| npx (no install) | `npx claude-sync export` | One-off usage, CI pipelines. |
| Local dev | `npm link` | Development workflow — creates global symlink to local checkout. |

**What NOT to do:**
- Do not use Node.js SEA (Single Executable Application). As of Node.js 25.5, `--build-sea` is a one-step process, but it still requires a build pipeline and produces platform-specific binaries. SEA is appropriate when targeting environments without Node.js — this tool's users are guaranteed to have Node.js. SEA adds complexity without benefit here.
- Do not publish to Homebrew or standalone binary formats in v1. npm global install is sufficient and consistent with how Claude Code itself is installed.
- Do not use TypeScript + build step in v1. The tool is small enough that plain JavaScript with JSDoc type annotations provides adequate editor support without requiring a compilation step. This keeps the project structure simple and contributes to zero-build distribution.

### Publishing

Publish to npm public registry. Users install with `npm install -g claude-sync`. The `files` field in package.json excludes tests, docs, and planning files from the published package, keeping it lean.

---

## Dependency Budget

This tool must stay lean. The target install footprint:

| Category | Package | Direct deps it brings |
|----------|---------|----------------------|
| CLI framework | commander | 0 |
| Archive | tar | ~5 (minipass, minizlib, etc.) |
| Colors | chalk | 0 |
| Spinner | ora | ~3 |
| Prompts | @inquirer/prompts | ~8 |
| **Total** | 5 direct | ~16 transitive |

This is acceptable for a developer tool. Claude Code itself installs far more. The constraint from PROJECT.md says "prefer Node.js or shell script so it works without installing packages" — interpreted as "don't require a separate runtime," not "install nothing." The above stack satisfies that intent.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CLI framework | commander v14 | yargs | 7 deps vs 0, slower startup, overkill for 2 commands |
| CLI framework | commander v14 | oclif | 30 deps, 85ms startup, enterprise-scale overhead |
| CLI framework | commander v14 | util.parseArgs (built-in) | No help generation, no subcommand routing, too raw |
| Archive | tar (npm) | archiver | 6+ deps, zip-optimized, no advantage for fs backup |
| Archive | tar (npm) | jszip | Browser-targeted, poor streaming, not idiomatic for fs |
| Archive | tar (npm) | manual zlib | Error-prone, edge cases in path handling, reinventing the wheel |
| File ops | fs/promises (built-in) | fs-extra | Polyfill for features now in Node.js 20 stdlib |
| Prompts | @inquirer/prompts | @clack/prompts | Less control, fewer prompt types, less mature TypeScript |
| Module format | ESM | CJS | Forces older versions of chalk, ora; ESM is forward path |
| Distribution | npm global | SEA binary | Users have Node.js; binary build adds CI complexity with no benefit |

---

## Installation

```bash
# Production dependencies
npm install commander tar chalk ora @inquirer/prompts

# No dev dependencies needed for v1 plain JavaScript approach
# (Add eslint/prettier if team grows)
```

---

## Sources

- commander downloads/comparison: [npm trends: commander vs oclif vs yargs](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- commander v14 release notes: [commander.js Releases - GitHub](https://github.com/tj/commander.js/releases)
- tar npm package: [tar - npm](https://www.npmjs.com/package/tar)
- Node.js fs.promises.cp(): [Working with folders in Node.js](https://nodejs.org/learn/manipulating-files/working-with-folders-in-nodejs)
- Node.js zlib built-in: [Zlib - Node.js v25.9.0 Documentation](https://nodejs.org/api/zlib.html)
- Claude Code Node.js requirement: [GitHub issue #8757](https://github.com/anthropics/claude-code/issues/8757)
- Node.js SEA: [Single executable applications - Node.js v25.9.0 Documentation](https://nodejs.org/api/single-executable-applications.html)
- npm CLI packaging patterns: [Building Your Own NPX CLI Tool](https://johnsedlak.com/blog/2025/03/building-an-npx-cli-tool)
- CLI framework comparison: [Grizzly Peak Software - CLI Framework Comparison](https://www.grizzlypeaksoftware.com/library/cli-framework-comparison-commander-vs-yargs-vs-oclif-utxlf9v9)
- ESM in npm packages 2024: [Building an npm package compatible with ESM and CJS](https://dev.to/snyk/building-an-npm-package-compatible-with-esm-and-cjs-in-2024-88m)
