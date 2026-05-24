import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Proof-Stitched Multi-Pattern (5.4) — patched-compiler scaffold', () => {
  it('parses with the patched silverc and preserves leader/delegate split + cov-context check', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/zk/proof-stitched-multi-pattern.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-zk-psmp-'));
    const output = join(tempDir, 'psmp-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '--output', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);

      // Leader and delegate paths are both present.
      expect(printed).toContain('leader_release');
      expect(printed).toContain('delegate_release');

      // KIP-20 covenant context: cov-id, cov-input-count, cov-input-idx.
      expect(printed).toContain('OpInputCovenantId');
      expect(printed).toContain('OpCovInputCount');
      expect(printed).toContain('OpCovInputIdx');

      // Leader does the expensive verification; delegate does not.
      expect(printed).toContain('OpGroth16Verify');

      // Both paths require the shared cov-context (cov_input_count >= 2).
      expect(printed).toContain('requireSharedCovenantContext');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
