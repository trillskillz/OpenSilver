import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Vault contract hardening', () => {
  it('parses with silverc and preserves payout plus continuation constraints in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/vault.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-vault-'));
    const output = join(tempDir, 'vault-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('release');
      expect(printed).toContain('extend_lock');
      expect(printed).toContain('reconfigure_signers');
      expect(printed).toContain('propose_owner_transfer');
      expect(printed).toContain('accept_owner_transfer');
      expect(printed).toContain('requireExactPayout');
      expect(printed).toContain('requireExactContinuationValue');
      expect(printed).toContain('OpAuthOutputCount');
      expect(printed).toContain('OpAuthOutputIdx');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
