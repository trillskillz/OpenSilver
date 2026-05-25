import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ZK-Verified Oracle v2 (Pattern 5.3) — cross-contract output binding', () => {
  const repoRoot = process.cwd();
  const binary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');

  // v2 needs the OpenSilver Phase-5 patch lane for OpGroth16Verify just
  // like the rest of the zk-aware contracts. Skip if the patched binary
  // isn't present rather than fail — local dev without the patch is a
  // supported workflow for everything except the Phase-5 lane.
  const patchPresent = existsSync(binary);

  it.skipIf(!patchPresent)(
    'OracleConsumer parses with vanilla silverc and exposes the release entrypoint',
    () => {
      // OracleConsumer has NO ZK primitives — vanilla silverc should
      // accept it too. We use the same patched binary for convenience
      // (it's a superset of upstream's surface), but the contract
      // would also build against the pinned upstream snapshot.
      const source = join(repoRoot, 'contracts/zk/oracle-consumer.sil');
      const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-oracle-consumer-'));
      const output = join(tempDir, 'consumer-ast.json');

      try {
        execFileSync(binary, ['--ast-only', source, '--output', output], { stdio: 'pipe' });
        const ast = JSON.parse(readFileSync(output, 'utf8'));
        const printed = JSON.stringify(ast);

        // State shape: published_value + recipient.
        expect(printed).toContain('published_value');
        expect(printed).toContain('recipient');

        // Single terminal entrypoint that pays out the input.
        expect(printed).toContain('release');
        expect(printed).toContain('requireExactPayout');
        expect(printed).toContain('checkSig');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!patchPresent)(
    'ZkVerifiedOracleV2 parses with the patched silverc and exposes the binding shape',
    () => {
      const source = join(repoRoot, 'contracts/zk/zk-verified-oracle-v2.sil');
      const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-zk-oracle-v2-'));
      const output = join(tempDir, 'oracle-v2-ast.json');

      try {
        execFileSync(binary, ['--ast-only', source, '--output', output], { stdio: 'pipe' });
        const ast = JSON.parse(readFileSync(output, 'utf8'));
        const printed = JSON.stringify(ast);

        // Carries over v1's two-tier auth surface.
        expect(printed).toContain('approvalCount');
        expect(printed).toContain('distinctSigners');
        expect(printed).toContain('OpGroth16Verify');
        expect(printed).toContain('guardian1');
        expect(printed).toContain('guardian2');
        expect(printed).toContain('guardian3');

        // The v2-specific surface: cross-contract output binding via
        // validateOutputStateWithTemplate against an OracleConsumer
        // state struct.
        expect(printed).toContain('validateOutputStateWithTemplate');
        expect(printed).toContain('OracleConsumerState');
        expect(printed).toContain('bindConsumerOutput');
        expect(printed).toContain('consumerTemplatePrefix');
        expect(printed).toContain('consumerTemplateSuffix');
        expect(printed).toContain('consumerExpectedTemplateHash');

        // The consumer recipient is contract state, not witness — caller
        // cannot substitute the consumer covenant they bind into.
        expect(printed).toContain('consumer_recipient');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    },
  );
});
