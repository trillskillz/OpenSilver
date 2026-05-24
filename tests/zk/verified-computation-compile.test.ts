import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Verified Computation (Pattern 5.1) — patched-compiler scaffold', () => {
  it('parses with the patched silverc and preserves OpGroth16Verify call shape', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/zk/verified-computation.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-zk-vc-'));
    const output = join(tempDir, 'vc-ast.json');

    // This test requires the patched silverc (npm run patch:silverc:zk).
    // CI applies the patch via the same script before vitest runs.
    try {
      execFileSync(binary, ['--ast-only', source, '--output', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);

      // The verifier call: structured OpGroth16Verify(vk, proof, [pi0..pi4])
      expect(printed).toContain('OpGroth16Verify');

      // Both auth layers must be present in the source:
      expect(printed).toContain('requireProver');
      expect(printed).toContain('requireExactPayout');

      // Verifier args read from contract state, not function-level args:
      expect(printed).toContain('verifying_key');
      expect(printed).toContain('recipient');
      expect(printed).toContain('prover');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
