import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  auditCovenantTool,
  checkKip20ComplianceTool,
  type AuditFinding,
} from '@opensilver/mcp';

// Phase 10 Task 10.1 — internal audit review.
//
// Runs the MCP audit_covenant + check_kip20_compliance tools across every
// production .sil source and asserts the findings match a documented
// expected set. This serves two purposes:
//
//   1. **Regression guard.** If a pattern is refactored in a way that
//      introduces a new finding (e.g. someone adds an
//      expectedTemplateHash that comes from a caller arg), this test
//      flags it. If a refactor removes a known finding (e.g. someone
//      bounds-checks witnesses[]), the test forces the expected
//      findings to be updated.
//   2. **Auditor cross-reference.** AUDIT_CHECKLIST.md at the repo root
//      cites these findings per pattern. This test is the
//      single-source-of-truth that keeps that doc honest.

const repoRoot = process.cwd();

interface ExpectedAuditPosture {
  /** OS-### codes from auditCovenantTool we expect to surface. */
  expectedAuditCodes: string[];
  /** KIP20-### codes from checkKip20ComplianceTool we expect. */
  expectedKip20Codes: string[];
  /** True if the contract MUST be compliant (no error-severity findings). */
  mustBeCompliant: boolean;
}

// Per-contract expected posture. The 5.x patterns use OpGroth16Verify
// not raw OpZkPrecompile, so most KIP-20 rules don't apply there.
// The KCC20 controller family centrally uses `validateOutputStateWithTemplate`
// so OS-003 + KIP20-003 fire for those — documented intentional reliance
// on template-hash trust in deploy-time state. The base KCC20 asset contract
// does not currently trip the KIP20 singleton-transition heuristic because it
// uses the broader N:M `#[covenant(binding = cov, ...)]` transfer wrapper.
//
// ZK oracle v1 currently trips the same template-hash heuristic in the MCP
// tools even though the contract comment says the full cross-contract binding
// wrapper is deferred. This test deliberately snapshots the tool output we
// actually ship so docs/tests stay honest.
const EXPECTED: Record<string, ExpectedAuditPosture> = {
  // Phase 3 core patterns — no template/no ZK/no hardcoded pubkeys.
  'contracts/core/ownable.sil':            { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/multisig.sil':           { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/timelock.sil':           { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/vault.sil':              { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/escrow-bilateral.sil':   { expectedAuditCodes: [], expectedKip20Codes: [], mustBeCompliant: true },
  'contracts/core/escrow-milestone.sil':   { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/streaming-payment.sil':  { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/vesting.sil':            { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/dead-man-switch.sil':    { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/social-recovery.sil':    { expectedAuditCodes: [], expectedKip20Codes: ['KIP20-002'], mustBeCompliant: true },
  'contracts/core/atomic-swap-htlc.sil':   { expectedAuditCodes: [], expectedKip20Codes: [], mustBeCompliant: true },
  'contracts/core/freelance-payroll.sil':  { expectedAuditCodes: [], expectedKip20Codes: [], mustBeCompliant: true },

  // Phase 4 KCC20 — controller covenants use *WithTemplate intentionally;
  // OS-003 / KIP20-003 are EXPECTED (not bugs) but call out that the
  // template-hash must come from contract state.
  'contracts/tokens/kcc20.sil':            { expectedAuditCodes: [], expectedKip20Codes: [], mustBeCompliant: true },
  'contracts/tokens/kcc20-ownable.sil':    { expectedAuditCodes: ['OS-003'], expectedKip20Codes: ['KIP20-003'], mustBeCompliant: true },
  'contracts/tokens/kcc20-pausable.sil':   { expectedAuditCodes: ['OS-003'], expectedKip20Codes: ['KIP20-003'], mustBeCompliant: true },
  'contracts/tokens/kcc20-capped.sil':     { expectedAuditCodes: ['OS-003'], expectedKip20Codes: ['KIP20-003'], mustBeCompliant: true },
  'contracts/tokens/kcc20-vesting.sil':    { expectedAuditCodes: ['OS-003'], expectedKip20Codes: ['KIP20-003'], mustBeCompliant: true },

  // Phase 5 ZK patterns. 5.3 uses #[covenant... is gated] heuristic; none
  // currently have validateOutputStateWithTemplate so OS-003/KIP20-003
  // don't fire. None have hardcoded pubkey constants. v1 patterns are
  // stateless (no covenant decl), so KIP20-002 doesn't fire either.
  'contracts/zk/verified-computation.sil':         { expectedAuditCodes: [], expectedKip20Codes: [], mustBeCompliant: true },
  'contracts/zk/private-asset-transfer.sil':       { expectedAuditCodes: [], expectedKip20Codes: [], mustBeCompliant: true },
  'contracts/zk/zk-verified-oracle.sil':           { expectedAuditCodes: ['OS-003'], expectedKip20Codes: ['KIP20-003'], mustBeCompliant: true },
  'contracts/zk/proof-stitched-multi-pattern.sil': { expectedAuditCodes: [], expectedKip20Codes: [], mustBeCompliant: true },
};

function findingsToCodes(findings: AuditFinding[]): string[] {
  return findings.map((finding) => finding.code).sort();
}

describe('Phase 10 Task 10.1 — internal audit review', () => {
  // First sanity check: every production contract in contracts/ has an
  // EXPECTED entry. Catches new patterns landed without audit coverage.
  it('every production .sil source has an expected audit posture', () => {
    const all: string[] = [];
    for (const dir of ['core', 'tokens', 'zk']) {
      const entries = readdirSync(join(repoRoot, 'contracts', dir));
      for (const entry of entries) {
        if (!entry.endsWith('.sil')) continue;
        if (entry.startsWith('opzk') || entry.endsWith('-smoke.sil')) continue; // compiler probes, not patterns
        all.push(`contracts/${dir}/${entry}`);
      }
    }
    all.sort();
    const documented = Object.keys(EXPECTED).sort();
    expect(documented).toEqual(all);
  });

  for (const [path, posture] of Object.entries(EXPECTED)) {
    describe(path, () => {
      const source = readFileSync(join(repoRoot, path), 'utf8');

      it('audit_covenant findings match documented posture', () => {
        const result = auditCovenantTool(source);
        const codes = findingsToCodes(result.findings);
        expect(codes).toEqual([...posture.expectedAuditCodes].sort());
      });

      it('check_kip20_compliance findings match documented posture', () => {
        const result = checkKip20ComplianceTool(source);
        const codes = findingsToCodes(result.violations);
        expect(codes).toEqual([...posture.expectedKip20Codes].sort());
      });

      if (posture.mustBeCompliant) {
        it('contains no error-severity findings (audit + kip20)', () => {
          const audit = auditCovenantTool(source);
          const kip20 = checkKip20ComplianceTool(source);
          const errors = [
            ...audit.findings.filter((f) => f.severity === 'error'),
            ...kip20.violations.filter((v) => v.severity === 'error'),
          ];
          expect(errors).toEqual([]);
        });
      }
    });
  }
});
