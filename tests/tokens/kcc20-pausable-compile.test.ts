import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('KCC20Pausable controller contract (Pattern 4.3)', () => {
  it('parses with silverc and preserves pause-gated mint invariants in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/tokens/kcc20-pausable.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-kcc20-pausable-'));
    const output = join(tempDir, 'kcc20-pausable-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);

      expect(printed).toContain('paused');
      expect(printed).toContain('pause');
      expect(printed).toContain('unpause');
      expect(printed).toContain('mint');
      expect(printed).toContain('require(!prevState.paused)');
      expect(printed).toContain('validateOutputStateWithTemplate');
      expect(printed).toContain('OpCovOutputCount');
      expect(printed).toContain('OpCovInputCount');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
