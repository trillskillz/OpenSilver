import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('KCC20Ownable controller contract (Pattern 4.2)', () => {
  it('parses with silverc and preserves ownable-controller invariants in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/tokens/kcc20-ownable.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-kcc20-ownable-'));
    const output = join(tempDir, 'kcc20-ownable-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);

      expect(printed).toContain('hasPendingAdmin');
      expect(printed).toContain('pendingAdmin');
      expect(printed).toContain('propose_admin_transfer');
      expect(printed).toContain('accept_admin_transfer');
      expect(printed).toContain('cancel_admin_transfer');
      expect(printed).toContain('mint');
      expect(printed).toContain('validateOutputStateWithTemplate');
      expect(printed).toContain('OpCovOutputCount');
      expect(printed).toContain('OpCovInputCount');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
