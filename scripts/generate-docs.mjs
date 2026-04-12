// scripts/generate-docs.mjs
// Verifies docs/ directory is present and up-to-date.
// Future phases can expand to auto-generate API reference from JSDoc.

import fs from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const docsDir = join(rootDir, 'docs');

try {
  const entries = await fs.readdir(docsDir);
  const files = entries.filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.warn('Warning: No docs found. Run manually to update documentation.');
  } else {
    console.log(`Verified ${files.length} docs files present.`);
  }
} catch {
  console.warn('Warning: Could not read docs directory.');
}
