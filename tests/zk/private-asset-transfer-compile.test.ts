import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Private Asset Transfer (5.2) — patched-compiler scaffold', () => {
  it('parses with the patched silverc and preserves all 5 public-input slots', () => {
    const repoRoot = process.cwd();
    const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');
    const source = join(repoRoot, 'contracts/zk/private-asset-transfer.sil');
    const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-zk-pat-'));
    const output = join(tempDir, 'pat-ast.json');

    try {
      execFileSync(binary, ['--ast-only', source, '--output', output], { stdio: 'pipe' });
      const ast = JSON.parse(readFileSync(output, 'utf8'));
      const printed = JSON.stringify(ast);

      // Five public-input slots present in the entrypoint.
      expect(printed).toContain('pi_commitment_root');
      expect(printed).toContain('pi_nullifier');
      expect(printed).toContain('pi_recipient');
      expect(printed).toContain('pi_padding1');
      expect(printed).toContain('pi_padding2');

      // The two enforcement points:
      // (1) commitment_root pinned to state, (2) payout pinned to pi_recipient.
      expect(printed).toContain('commitment_root');
      expect(printed).toContain('requirePayoutToPiRecipient');
      expect(printed).toContain('OpGroth16Verify');

      // Recipient comes from public input, NOT a function arg or constant.
      expect(printed).toContain('ScriptPubKeyP2PK');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
