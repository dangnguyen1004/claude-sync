# Development

**Analysis Date:** 2026-04-07

## Prerequisites

- Node.js 20 or later
- npm

## Setup

Clone the repository and install dependencies:

```bash
git clone <repository>
cd claude-sync
npm install
```

## Running Tests

```bash
npm test
```

Tests use Vitest. Run in watch mode during development:

```bash
npm test -- --watch
```

## Project Structure

```
claude-sync/
├── bin/
│   └── claude-sync.mjs        # CLI entry point (shebang + ESM)
├── src/
│   ├── commands/
│   │   ├── export.mjs         # Export command handler
│   │   ├── import.mjs         # Import command handler
│   │   ├── list.mjs           # List command handler
│   │   └── *.test.mjs         # Tests for commands
│   ├── packer.mjs             # Archive creation
│   ├── unpacker.mjs           # Archive reading
│   ├── restorer.mjs           # File restoration
│   ├── scanner.mjs            # Filesystem scanning
│   ├── secrets.mjs            # Secret detection
│   ├── exclusions.mjs          # Include/exclude logic
│   └── types.mjs              # Shared TypeScript-like types
├── docs/                       # Generated documentation
├── package.json
└── README.md
```

## Adding a New Data Type

1. Add the type name to `ALL_TYPES` in `src/exclusions.mjs`
2. Add the type mapping to `DATA_TYPE_MAP` in `src/scanner.mjs`
3. If the type is a directory, ensure it's scanned recursively in `scanExportTargets`
4. If the type requires special handling during import, update `src/restorer.mjs`
5. Add a test fixture in `test/fixtures/claude-home/`
6. Update tests in `src/commands/*.test.mjs`

## Adding a New CLI Flag

1. Add the flag definition in the appropriate command file in `src/commands/`
2. Destructure the flag in the command handler function signature
3. Pass the flag value to the underlying function as part of the options object
4. Add a test case covering the new flag behavior

## Code Style

- ESM (`.mjs` extension, `"type": "module"` in `package.json`)
- JSDoc type annotations on all exported functions
- No TypeScript build step — plain JavaScript with types in comments
- No external dependencies beyond the ones in `package.json`

## Architecture Notes

- **Export flow**: `scanner.mjs` → `secrets.mjs` (optional) → `packer.mjs` → archive file
- **Import flow**: `unpacker.mjs` → tar extract to staging → `restorer.mjs` → target directory
- **No staging for export**: Files are streamed directly from `~/.claude/` to the archive
- **Staging for import**: Archive is extracted to a temp directory first, then files are copied to target

## Debugging

Add `console.log` statements and run commands directly:

```bash
node bin/claude-sync.mjs export --include skills
```

For test debugging:

```bash
npm test -- --reporter=verbose
```

## Releasing

1. Update `version` in `package.json` following semver
2. Run tests: `npm test`
3. Publish: `npm publish`
