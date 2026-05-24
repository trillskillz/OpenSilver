import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ZK-Verified Oracle (Pattern 5.3) — patched-compiler scaffold', () => {
  it('parses with the patched silverc and preserves committee + OpGroth16Verify shape', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/zk/zk-verified-oracle.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-zk-oracle-'));
    const output = join(tempDir, 'oracle-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '--output', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);

      // Two-tier auth: committee threshold + Groth16 verification.
      expect(printed).toContain('approvalCount');
      expect(printed).toContain('distinctSigners');
      expect(printed).toContain('OpGroth16Verify');
      expect(printed).toContain('requireExactPayout');

      // Committee + ZK args sourced from contract state, not function args.
      expect(printed).toContain('guardian1');
      expect(printed).toContain('guardian2');
      expect(printed).toContain('guardian3');
      expect(printed).toContain('verifying_key');
      expect(printed).toContain('threshold');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
