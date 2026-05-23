import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('MultiSig contract scaffold', () => {
  it('parses with silverc and exposes spend/reconfigure entrypoints in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/multisig.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-multisig-'));
    const output = join(tempDir, 'multisig-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('spend');
      expect(printed).toContain('reconfigure');
      expect(printed).toContain('approvalCount');
      expect(printed).toContain('threshold');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
