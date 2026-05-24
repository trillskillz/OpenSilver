import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('KCC20 asset contract (Pattern 4.1)', () => {
  it('parses with silverc and preserves the three-mode ownership + supply-conservation invariants', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/tokens/kcc20.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-kcc20-'));
    const output = join(tempDir, 'kcc20-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);

      // Three ownership modes
      expect(printed).toContain('IDENTIFIER_PUBKEY');
      expect(printed).toContain('IDENTIFIER_SCRIPT_HASH');
      expect(printed).toContain('IDENTIFIER_COVENANT_ID');

      // Supply rules
      expect(printed).toContain('checkAmounts');
      expect(printed).toContain('checkMintingTransfer');
      expect(printed).toContain('totalIn == totalOut');

      // Three primitive ops backing the three modes
      expect(printed).toContain('checkSig');
      expect(printed).toContain('ScriptPubKeyP2SH');
      expect(printed).toContain('OpInputCovenantId');

      // The N:M covenant-binding entrypoint
      expect(printed).toContain('transfer');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
