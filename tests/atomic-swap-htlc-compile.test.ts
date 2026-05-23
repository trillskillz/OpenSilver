import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Atomic Swap HTLC contract scaffold', () => {
  it('parses with silverc and exposes claim/refund entrypoints plus hash-lock state in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/atomic-swap-htlc.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-htlc-'));
    const output = join(tempDir, 'atomic-swap-htlc-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('claim');
      expect(printed).toContain('refund');
      expect(printed).toContain('secret_hash');
      expect(printed).toContain('timeout');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
