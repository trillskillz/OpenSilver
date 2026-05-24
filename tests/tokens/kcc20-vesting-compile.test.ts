import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('KCC20Vesting controller contract (Pattern 4.5)', () => {
  it('parses with silverc and preserves schedule-gated mint invariants in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/tokens/kcc20-vesting.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-kcc20-vesting-'));
    const output = join(tempDir, 'kcc20-vesting-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);

      expect(printed).toContain('mintedAmount');
      expect(printed).toContain('releasePerPeriod');
      expect(printed).toContain('cliffTime');
      expect(printed).toContain('mint');
      expect(printed).toContain('tx.time >= prevState.cliffTime');
      expect(printed).toContain('validateOutputStateWithTemplate');
      expect(printed).toContain('mintedDelta == claimAmount');
      expect(printed).toContain('newState.mintedAmount == prevState.mintedAmount + claimAmount');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
