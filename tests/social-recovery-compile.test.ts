import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Social Recovery contract scaffold', () => {
  it('parses with silverc and exposes recovery-init/finalize/cancel entrypoints in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/social-recovery.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-social-recovery-'));
    const output = join(tempDir, 'social-recovery-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('initiate_recovery');
      expect(printed).toContain('finalize_recovery');
      expect(printed).toContain('cancel_recovery');
      expect(printed).toContain('guardian_threshold');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
