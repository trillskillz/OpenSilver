import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Vesting contract hardening', () => {
  it('parses with silverc and preserves payout/accounting constraints in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/vesting.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-vesting-'));
    const output = join(tempDir, 'vesting-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('claim');
      expect(printed).toContain('revoke');
      expect(printed).toContain('claimed_amount');
      expect(printed).toContain('release_per_period');
      expect(printed).toContain('requireExactPayout');
      expect(printed).toContain('remaining > prev_state.release_per_period');
      expect(printed).toContain('tx.outputs[0].value == amount');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
