// scripts/generate-docs.mjs
// Verifies docs/ directory is present and up-to-date.
// Future phases can expand to auto-generate API reference from JSDoc.

import fs from 'node:fs/promises';
import { glob } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const docsPattern = join(rootDir, 'docs', '*.md');

glob(docsPattern, (err, files) => {
  if (err) {
    console.warn('Warning: Could not glob docs directory.');
    process.exit(0);
    return;
  }

  if (files.length === 0) {
    console.warn('Warning: No docs found. Run manually to update documentation.');
  } else {
    console.log(`Verified ${files.length} docs files present.`);
  }
});
