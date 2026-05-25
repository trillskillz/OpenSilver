import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditCovenantTool,
  checkKip20ComplianceTool,
  estimateCostsTool,
  getPatternTool,
  getToolCatalog,
  listPatternsTool,
  validateCovenantTool,
} from '../mcp/src/index.js';

const repoRoot = process.cwd();
const silvercBinary = join(repoRoot, 'upstream/silverscript/target/debug/silverc');

describe('OpenSilver MCP tool surface', () => {
  it('lists patterns and filters by category', () => {
    const all = listPatternsTool();
    const core = listPatternsTool('core');

    expect(all.count).toBeGreaterThan(core.count);
    expect(all.compilerPolicy.strategy).toBe('pinned-upstream-bootstrap');
    expect(all.compilerPolicy.zkBootstrapCommand).toBe('npm run patch:silverc:zk');
    expect(core.patterns.every((pattern) => pattern.phase === 'core')).toBe(true);
    expect(all.patterns.some((pattern) => pattern.compiler.requiresPatchedSilverc)).toBe(true);
    expect(core.patterns.every((pattern) => pattern.verification.runtimeValidated)).toBe(true);
  });

  it('returns one pattern by id and null for an unknown id', () => {
    expect(getPatternTool('core.ownable').pattern?.id).toBe('core.ownable');
    expect(getPatternTool('zk-aware.private-asset-transfer').pattern?.contractPath).toBe('contracts/zk/private-asset-transfer.sil');
    expect(getPatternTool('missing.pattern')).toEqual({ pattern: null, notFound: { id: 'missing.pattern' } });
  });

  it('validates a real contract through silverc --ast-only', () => {
    const source = readFileSync(join(repoRoot, 'contracts/core/ownable.sil'), 'utf8');
    const result = validateCovenantTool({
      source,
      filename: 'ownable.sil',
      silvercBinary,
    });

    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it('surfaces OpenSilver audit and KIP-20 findings', () => {
    const source = `
      pubkey constant OWNER = 0x021111111111111111111111111111111111111111111111111111111111111111;
      contract Demo() {
        fn spend(byte[] witnesses, byte[32] expectedTemplateHash) {
          let zero = byte[32](0);
          tx.inputs[witnesses[0]].value;
          validateOutputStateWithTemplate(0, expectedTemplateHash, []);
          let _ = this.activeScriptPubKey;
        }
      }
    `;

    const audit = auditCovenantTool(source);
    const codes = audit.findings.map((finding) => finding.code);
    expect(audit.ok).toBe(false);
    expect(codes).toEqual(expect.arrayContaining(['OS-001', 'OS-002', 'OS-003', 'OS-004', 'OS-005']));

    const kip20 = checkKip20ComplianceTool(`
      #[covenant(spend)]
      contract Demo() {
        fn spend(byte[32] expectedTemplateHash) {
          validateOutputStateWithTemplate(0, expectedTemplateHash, []);
          OpOutpointTxId(0);
          OpTxPayload(0, 1);
        }
      }
    `);
    const violationCodes = kip20.violations.map((finding) => finding.code);
    expect(kip20.compliant).toBe(false);
    expect(violationCodes).toEqual(expect.arrayContaining(['KIP20-001', 'KIP20-002', 'KIP20-003']));
  });

  it('estimates opcode costs and exposes the tool catalog', () => {
    const estimate = estimateCostsTool(`
      fn spend() {
        OpInputCovenantId(0);
        OpZkPrecompile();
        validateOutputStateWithTemplate(0, 0x00, []);
      }
    `);

    expect(estimate.scriptUnitsTotal).toBeGreaterThan(140000);
    expect(estimate.lines.map((line) => line.opcode)).toEqual(
      expect.arrayContaining([
        'OpZkPrecompile (Groth16 worst-case)',
        'OpInputCovenantId',
        'validateOutputStateWithTemplate (lowered)',
      ]),
    );

    const catalog = getToolCatalog();
    expect(catalog.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'list_patterns',
        'get_pattern',
        'validate_covenant',
        'audit_covenant',
        'check_kip20_compliance',
        'estimate_costs',
      ]),
    );
  });
});
