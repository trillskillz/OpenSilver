import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Streaming Payment contract scaffold', () => {
  it('parses with silverc and exposes withdraw/cancel entrypoints plus stream state in the AST', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/core/streaming-payment.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-streaming-'));
    const output = join(tempDir, 'streaming-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '-o', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);
      expect(printed).toContain('withdraw');
      expect(printed).toContain('cancel');
      expect(printed).toContain('remaining_allowance');
      expect(printed).toContain('next_release_time');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
