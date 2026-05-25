import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIntegrationManifest } from '../integrations/src/index.js';
import { listPatterns, listPatternsByPhase } from '../sdk/src/index.js';

const repoRoot = process.cwd();

describe('generated manifest artifacts', () => {
  it('match the canonical integration manifest outputs', () => {
    const cases = [
      {
        path: 'artifacts/manifests/mcp-all.json',
        expected: buildIntegrationManifest('mcp', listPatterns()),
      },
      {
        path: 'artifacts/manifests/ide-all.json',
        expected: buildIntegrationManifest('ide', listPatterns()),
      },
      {
        path: 'artifacts/manifests/wallet-krc20.json',
        expected: buildIntegrationManifest('wallet', listPatternsByPhase('krc20')),
      },
    ];

    for (const testCase of cases) {
      const parsed = JSON.parse(readFileSync(join(repoRoot, testCase.path), 'utf8'));
      expect(parsed).toEqual(testCase.expected);
    }
  });
});
