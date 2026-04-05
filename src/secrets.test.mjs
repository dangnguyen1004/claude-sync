import { describe, it, expect } from 'vitest';
import { scanForSecrets, SECRET_PATTERNS } from '../src/secrets.mjs';

describe('scanForSecrets', () => {
  it('detects OpenAI-style API key in command value', () => {
    const settingsJson = JSON.stringify({
      hooks: {
        PreTask: [
          {
            command: 'node /scripts/pre-task.js',
            description: 'Pre-task hook',
          },
          {
            command: 'echo "sk-abc123def456hij789klm012nop345qrs678tuv"',
            description: 'test key',
          },
        ],
      },
    });
    const findings = scanForSecrets(settingsJson);
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe('OpenAI/Stripe API key');
    expect(findings[0].match).toBe('sk-abc123def456hij789klm012nop345qrs678tuv');
  });

  it('detects Bearer token in command value', () => {
    // Bearer token in a JSON-like format inside a command string
    const settingsJson = JSON.stringify({
      hooks: {
        PreTask: [
          {
            command: 'curl -d "{\"bearer\": \"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghijklmnopqrstuvwxyz123456\"}" https://api.example.com',
            description: 'API call',
          },
        ],
      },
    });
    const findings = scanForSecrets(settingsJson);
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe('Bearer token');
  });

  it('detects GitHub token in command value', () => {
    const settingsJson = JSON.stringify({
      hooks: {
        PreTask: [
          {
            command: 'gh api repos --header "Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd"',
            description: 'GitHub API',
          },
        ],
      },
    });
    const findings = scanForSecrets(settingsJson);
    expect(findings).toHaveLength(1);
    expect(findings[0].pattern).toBe('GitHub personal access token');
  });

  it('returns empty array for clean settings.json', () => {
    const settingsJson = JSON.stringify({
      hooks: {
        PreTask: [
          {
            command: 'echo "hello world"',
            description: 'Simple hook',
          },
        ],
      },
    });
    const findings = scanForSecrets(settingsJson);
    expect(findings).toHaveLength(0);
  });

  it('only scans inside "command": values — not key names', () => {
    // The word "api_key" appears as a JSON key name, not as a secret value
    const settingsJson = JSON.stringify({
      hooks: {
        PreTask: [
          {
            api_key: 'not_a_secret_key_here_123456789012',
            command: 'echo "hello"',
          },
        ],
      },
    });
    const findings = scanForSecrets(settingsJson);
    // Should not flag the api_key field name itself, only values
    expect(findings).toHaveLength(0);
  });

  it('handles malformed JSON gracefully — returns empty array', () => {
    const malformed = '{ "hooks": { "PreTask": [ { "command": "echo }';
    const findings = scanForSecrets(malformed);
    expect(findings).toHaveLength(0);
  });

  it('detects multiple secrets in same command value', () => {
    const settingsJson = JSON.stringify({
      hooks: {
        PreTask: [
          {
            command: 'node /scripts/run.js --key=sk-ant-api03-testabcdefghijklmnopqrstuvwxyz0123456789abcdef',
            description: 'multi-secret hook',
          },
        ],
      },
    });
    const findings = scanForSecrets(settingsJson);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for empty content', () => {
    expect(scanForSecrets('')).toHaveLength(0);
    expect(scanForSecrets(null)).toHaveLength(0);
    expect(scanForSecrets(undefined)).toHaveLength(0);
  });
});
