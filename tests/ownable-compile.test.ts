import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Ownable contract scaffold', () => {
  it('parses with silverc and exposes the two-step ownership entrypoints in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/ownable.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-ownable-'));
    const output = join(tempDir, 'ownable-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('propose_transfer');
      expect(printed).toContain('accept_transfer');
      expect(printed).toContain('cancel_transfer');
      expect(printed).toContain('pending_owner');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
