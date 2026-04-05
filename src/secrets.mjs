/**
 * Secret scanning for API keys and bearer tokens.
 *
 * @module secrets
 * @priority SEC-01
 */

import chalk from 'chalk';

/**
 * Regular expression patterns for detecting sensitive credentials.
 * Each pattern is labeled for user-facing output.
 * @type {Array<{ name: string, pattern: RegExp }>}
 */
export const SECRET_PATTERNS = [
  {
    name: 'OpenAI/Stripe API key',
    pattern: /\b(sk-|skp-|skrd-)[a-zA-Z0-9]{20,}/,
  },
  {
    name: 'Bearer token',
    pattern: /"bearer"\s*:\s*["'][a-zA-Z0-9_\-]{20,}["']/i,
  },
  {
    name: 'GitHub personal access token',
    pattern: /\b(ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9_]{36,}/,
  },
  {
    name: 'Generic API key',
    pattern: /"api[_-]?key"\s*:\s*["'][a-zA-Z0-9_\-]{20,}["']/i,
  },
  {
    name: 'AWS access key ID',
    pattern: /\b(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16,}/,
  },
  {
    name: 'Anthropic API key',
    pattern: /\bsk-ant-[a-zA-Z0-9_\-]{50,}/i,
  },
];

/**
 * Extracts "command": "<value>" entries from settings.json content.
 * Uses a simple state machine to correctly handle JSON escape sequences (\", \\, \n, etc.)
 * so that embedded quotes in command strings don't break extraction.
 *
 * @param {string} content - settings.json file content
 * @returns {string[]} Array of command values found
 */
function extractHookCommands(content) {
  const commands = [];
  // State machine: find "command": "<value>" while respecting JSON escape sequences
  let i = 0;
  const len = content.length;

  while (i < len) {
    // Look for "command" key
    const keyIdx = content.indexOf('"command"', i);
    if (keyIdx === -1) break;

    // Find the opening " of the value (skip "command", find colon + opening quote)
    let valStart = keyIdx + 8; // past "command"
    while (valStart < len && content[valStart] !== ':') valStart++;
    valStart++; // past ':'
    while (valStart < len && (content[valStart] === ' ' || content[valStart] === '\t' || content[valStart] === '\n' || content[valStart] === '\r')) valStart++;

    if (valStart >= len || content[valStart] !== '"') {
      i = keyIdx + 1;
      continue;
    }

    valStart++; // past opening '"

    // Extract value while respecting JSON escape sequences
    let valEnd = valStart;
    let escaped = false;
    while (valEnd < len) {
      if (escaped) {
        // Any character after \ is part of the escape sequence
        escaped = false;
      } else if (content[valEnd] === '\\') {
        escaped = true;
      } else if (content[valEnd] === '"') {
        break; // End of string
      }
      valEnd++;
    }

    // Decode JSON escape sequences to get the actual command string
    const encoded = content.slice(valStart, valEnd);
    const decoded = decodeJsonEscapes(encoded);
    commands.push(decoded);

    i = valEnd + 1;
  }

  return commands;
}

/**
 * Decodes common JSON escape sequences in a string.
 * Handles: \" \\ \/ \b \f \n \r \t \uXXXX
 *
 * @param {string} s - JSON-encoded string (raw escape sequences)
 * @returns {string} Decoded string
 */
function decodeJsonEscapes(s) {
  // Decode JSON escape sequences. Note: using new RegExp to avoid regex-literal
  // escaping issues when a forward-slash / appears in the pattern.
  return s
    .replace(new RegExp('\\\\"', 'g'), '"')
    .replace(new RegExp('\\\\\\\\', 'g'), '\\')
    .replace(new RegExp('\\\\n', 'g'), '\n')
    .replace(new RegExp('\\\\r', 'g'), '\r')
    .replace(new RegExp('\\\\t', 'g'), '\t')
    .replace(new RegExp('\\\\b', 'g'), '\b')
    .replace(new RegExp('\\\\f', 'g'), '\f')
    .replace(new RegExp('\\\\/', 'g'), '/')
    .replace(new RegExp('\\\\u[0-9a-fA-F]{4}', 'g'), (m) =>
      String.fromCharCode(parseInt(m.slice(2), 16)),
    );
}

/**
 * Scans settings.json content for secrets embedded in hook command values.
 *
 * Scans ONLY within "command": "<value>" patterns (not key names or other JSON fields)
 * to avoid false positives from variable names or path segments that look like keys.
 *
 * @param {string} content - settings.json file content as a string
 * @returns {Array<{ pattern: string, match: string, context: string }>} Findings; empty if none
 */
export function scanForSecrets(content) {
  if (typeof content !== 'string') {
    return [];
  }

  const findings = [];

  // Extract only the command value strings from settings.json
  const hookCommands = extractHookCommands(content);

  for (const command of hookCommands) {
    for (const { name, pattern } of SECRET_PATTERNS) {
      const match = command.match(pattern);
      if (match) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(command.length, match.index + match[0].length + 50);
        const context = command.slice(start, end);
        findings.push({
          pattern: name,
          match: match[0],
          context,
        });
      }
    }
  }

  return findings;
}

/**
 * Prints a warning header and each secret finding to stdout.
 * Intended for use in export.mjs before archive creation is aborted.
 *
 * @param {Array<{ pattern: string, match: string, context: string }>} findings
 * @returns {void}
 */
export function printSecretWarning(findings) {
  console.warn(chalk.yellow('\n  Warning: Potential secrets detected in settings.json\n'));
  for (const { pattern, match, context } of findings) {
    console.warn(chalk.yellow('  ! ') + `${pattern}: ...${context}...`);
  }
  console.warn(
    chalk.yellow('  Archive creation aborted. Run with --skip-secret-scan to proceed anyway.\n'),
  );
}
