import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe("Dead Man's Switch contract scaffold", () => {
  it('parses with silverc and exposes claim/ping/update_fallback entrypoints in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/dead-man-switch.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-dms-'));
    const output = join(tempDir, 'dead-man-switch-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('claim');
      expect(printed).toContain('ping');
      expect(printed).toContain('update_fallback');
      expect(printed).toContain('timeout_age');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
