import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Freelance / Payroll contract scaffold', () => {
  it('parses with silverc and exposes release/refund/payout/timeout entrypoints in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/freelance-payroll.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-freelance-'));
    const output = join(tempDir, 'freelance-payroll-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('standard_release');
      expect(printed).toContain('arbiter_refund');
      expect(printed).toContain('arbiter_payout');
      expect(printed).toContain('timeout_reclaim');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
