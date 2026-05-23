import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('TimeLock contract hardening', () => {
  it('parses with silverc and preserves payout constraints in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/timelock.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-timelock-'));
    const output = join(tempDir, 'timelock-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('claim');
      expect(printed).toContain('cancel');
      expect(printed).toContain('extend_lock');
      expect(printed).toContain('soft_cancel_enabled');
      expect(printed).toContain('requireExactPayout');
      expect(printed).toContain('ScriptPubKeyP2PK');
      expect(printed).toContain('tx.outputs[0].value == amount');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
