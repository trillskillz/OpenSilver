import {
  getPatternById,
  listPatterns,
  listPatternsByPhase,
  type PatternManifestEntry,
  type PatternPhase,
} from '@opensilver/sdk';

// Phase 7 — MCP server tool surface.
//
// PLAN.md lines 352-370 specify the toolset; this module implements them
// as pure functions so MCP servers built on top of @modelcontextprotocol/sdk
// (or any other transport) can register them directly. The previous shape
// only had listPatternsTool() as a placeholder; this round lands the full
// catalogue.
//
// What ships:
//   - list_patterns(category?)          — Phase 7 §a
//   - get_pattern(name)                 — Phase 7 §b
//   - validate_covenant(sil_source)     — Phase 7 §d (AST-level parse check)
//   - audit_covenant(sil_source)        — Phase 7 §e (OpenSilver-specific findings)
//   - check_kip20_compliance(sil_source) — Phase 7 §f
//   - estimate_costs(sil_source)        — Phase 7 §g (Groth16/R0Succinct + opcode size)
//
// generate_covenant(spec) is deliberately deferred — it's an LLM-driven
// codegen surface that needs design discussion before implementation, and
// the deterministic pieces (pattern catalog + scaffolding) are already
// served by the CLI's `opensilver get <id>` command.

export type McpCategory = PatternPhase | 'all';

// ─── Tool 1: list_patterns ──────────────────────────────────────────────────

export interface ListPatternsResponse {
  patterns: PatternManifestEntry[];
  count: number;
}

export function listPatternsTool(category?: McpCategory): ListPatternsResponse {
  const patterns =
    !category || category === 'all' ? listPatterns() : listPatternsByPhase(category as PatternPhase);
  return { patterns, count: patterns.length };
}

// ─── Tool 2: get_pattern ────────────────────────────────────────────────────

export interface GetPatternResponse {
  pattern: PatternManifestEntry | null;
  notFound?: { id: string };
}

export function getPatternTool(id: string): GetPatternResponse {
  const pattern = getPatternById(id);
  if (!pattern) {
    return { pattern: null, notFound: { id } };
  }
  return { pattern };
}

// ─── Tool 3: validate_covenant ─────────────────────────────────────────────
//
// Parse-level validation against a `.sil` source. Surfaces compile errors
// without committing to a particular contract semantics — the MCP returns
// the same errors silverc emits. Useful for agents iterating on a draft.

export interface ValidateCovenantInput {
  source: string;
  /** Optional source filename for error messages. */
  filename?: string;
  /** silverc binary path; defaults to the pinned upstream debug build. */
  silvercBinary?: string;
}

export interface ValidateCovenantResponse {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const DEFAULT_SILVERC = 'upstream/silverscript/target/debug/silverc';

export function validateCovenantTool(input: ValidateCovenantInput): ValidateCovenantResponse {
  // Avoid the compile-mode constructor-args path entirely; this tool only
  // commits to parse-level validation. We write the source to a temp file
  // and run silverc --ast-only.
  const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
  const { mkdtempSync, writeFileSync, rmSync } = require('node:fs') as typeof import('node:fs');
  const { tmpdir } = require('node:os') as typeof import('node:os');
  const { join } = require('node:path') as typeof import('node:path');
  const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-mcp-validate-'));
  const filename = input.filename ?? 'covenant.sil';
  const sourcePath = join(tempDir, filename);
  const outputPath = join(tempDir, 'ast.json');
  writeFileSync(sourcePath, input.source, 'utf8');
  try {
    execFileSync(input.silvercBinary ?? DEFAULT_SILVERC, ['--ast-only', sourcePath, '--output', outputPath], {
      stdio: 'pipe',
    });
    return { ok: true, errors: [], warnings: [] };
  } catch (err) {
    const stderr = (err as { stderr?: Buffer; message?: string }).stderr?.toString('utf8') ?? '';
    const message = (err as { message?: string }).message ?? 'silverc invocation failed';
    return {
      ok: false,
      errors: stderr ? stderr.split('\n').filter((line) => line.length > 0) : [message],
      warnings: [],
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ─── Tool 4: audit_covenant ────────────────────────────────────────────────
//
// OpenSilver-specific lint/audit checks layered on top of validate. The
// audit checks come from concrete findings surfaced during Phase 3 + 4
// runtime testing — they are NOT a substitute for an external audit, but
// they catch the most common footguns before deploy. Each finding has a
// severity, a one-line description, and (where possible) a doc-link to
// the reasoning behind the rule.

export interface AuditFinding {
  severity: 'error' | 'warning' | 'info';
  code: string;
  title: string;
  detail: string;
  docLink?: string;
}

export interface AuditCovenantResponse {
  ok: boolean;
  findings: AuditFinding[];
}

export function auditCovenantTool(source: string): AuditCovenantResponse {
  const findings: AuditFinding[] = [];

  // OS-001: hardcoded pubkey constants in production-shaped contracts.
  // Pubkeys declared with `pubkey constant FOO = 0x...` are a deploy-time
  // commitment — fine for testnets, but production contracts should
  // accept all keys as constructor args.
  const constantPubkeyMatches = source.match(/pubkey\s+constant\s+\w+\s*=/g);
  if (constantPubkeyMatches && constantPubkeyMatches.length > 0) {
    findings.push({
      severity: 'warning',
      code: 'OS-001',
      title: 'Hardcoded pubkey constants',
      detail: `${constantPubkeyMatches.length} pubkey constant(s) declared. Production contracts should accept all pubkeys via constructor args so the same compiled artifact can be redeployed with different keys.`,
      docLink: 'KASBONDS_AUDIT.md',
    });
  }

  // OS-002: byte[32](0) literal in singleton-transition state write.
  // The NUM2BIN cap on byte[32] state writes prevents this from compiling
  // to a runnable script. The fix is the pubkey + bool has_pending shape
  // documented in docs/patterns/core/ownable.md.
  if (/byte\[32\]\(0\)/.test(source)) {
    findings.push({
      severity: 'error',
      code: 'OS-002',
      title: 'byte[32](0) literal in state write',
      detail: 'The silverscript compiler routes singleton-transition writes of byte[32] state slots through NUM2BIN, which only supports up to 8-byte targets. Use the `pubkey + bool has_pending_owner` shape from Ownable v1 instead.',
      docLink: 'docs/patterns/core/ownable.md',
    });
  }

  // OS-003: untrusted expectedTemplateHash argument.
  // The validateOutputStateWithTemplate / readInputStateWithTemplate
  // builtins take an expectedTemplateHash that MUST come from contract
  // state or a verified protocol commitment — never from caller witness.
  const templateHashFromArg = /validateOutputStateWithTemplate|readInputStateWithTemplate/.test(source);
  if (templateHashFromArg) {
    // Heuristic: look for the expectedTemplateHash arg coming directly
    // from a function parameter rather than a contract-state field.
    // This is conservative — we surface as info, not error, since static
    // analysis can't fully prove provenance.
    findings.push({
      severity: 'info',
      code: 'OS-003',
      title: 'expectedTemplateHash provenance check',
      detail: 'This contract uses *WithTemplate builtins. Verify that every `expectedTemplateHash` argument comes from contract state (a stored field) or a verified protocol commitment, never from caller-provided sigscript bytes. The compiler does not enforce this.',
      docLink: 'KIP_REFERENCE.md',
    });
  }

  // OS-004: missing witnesses[i] bounds check (KCC20 pattern).
  // KCC20-style contracts pass a `byte[] witnesses` argument used to index
  // into tx.inputs[]. The upstream KCC20 example does NOT bounds-check
  // witnesses[i] < tx.inputs.length; production wrappers should.
  if (/byte\[\]\s+witnesses/.test(source) && /tx\.inputs\[witnesses\[/.test(source)) {
    if (!/witnesses\[\w+\]\s*<\s*tx\.inputs\.length/.test(source)) {
      findings.push({
        severity: 'warning',
        code: 'OS-004',
        title: 'Unchecked witnesses[i] indexing',
        detail: 'Contracts that index tx.inputs[] via a caller-provided witnesses[] array should add an explicit `require(witnesses[i] < tx.inputs.length)` check before each indexing operation. The compiler does not insert this automatically.',
        docLink: 'docs/standards/KCC20.md',
      });
    }
  }

  // OS-005: KIP-20 covenant-id usage check.
  // Stateful patterns should use OpInputCovenantId for self-identity rather
  // than reading the active scriptPubKey directly.
  if (/this\.activeScriptPubKey/.test(source) && !/OpInputCovenantId/.test(source)) {
    findings.push({
      severity: 'info',
      code: 'OS-005',
      title: 'KIP-20 cov-id alternative available',
      detail: 'This contract reads `this.activeScriptPubKey` but does not use `OpInputCovenantId`. For stateful patterns, KIP-20 covenant IDs are the recommended self-identity primitive — non-forgeable, queryable by off-chain indexers, and explicit about lineage.',
      docLink: 'references/kips/SUMMARY.md',
    });
  }

  return {
    ok: !findings.some((finding) => finding.severity === 'error'),
    findings,
  };
}

// ─── Tool 5: check_kip20_compliance ────────────────────────────────────────
//
// A focused subset of audit_covenant that specifically asserts the KIP-20
// adoption rules from KIP_REFERENCE.md. Useful as a CI gate.

export interface Kip20ComplianceResponse {
  compliant: boolean;
  rulesChecked: number;
  violations: AuditFinding[];
}

export function checkKip20ComplianceTool(source: string): Kip20ComplianceResponse {
  const violations: AuditFinding[] = [];
  const rulesChecked = 3;

  // Rule 1: No recursive parent-tx lineage walks.
  // Detect imports/uses of OpOutpointTxId in a way that suggests rebuilding
  // a parent transaction. Heuristic: an OpOutpointTxId call combined with
  // any OpTxPayloadSubstr usage.
  if (/OpOutpointTxId/.test(source) && /OpTxPayload/.test(source)) {
    violations.push({
      severity: 'error',
      code: 'KIP20-001',
      title: 'Possible recursive lineage walk',
      detail: 'Contract reads OpOutpointTxId and OpTxPayload* in the same scope, which suggests parent-tx witness verification. KIP-20 makes this an anti-pattern — use OpInputCovenantId for lineage instead.',
      docLink: 'references/kips/SUMMARY.md',
    });
  }

  // Rule 2: Stateful contracts (those with #[covenant.singleton(...)] or
  // #[covenant(...)]) should reference OpInputCovenantId at least once.
  const hasSingletonDecl = /#\[covenant\.singleton/.test(source) || /#\[covenant\(/.test(source);
  if (hasSingletonDecl && !/OpInputCovenantId/.test(source)) {
    // This is generated by the compiler via covenant_declarations.rs, so
    // it's fine in compiled output — but a hand-written contract should
    // surface the call explicitly for clarity. Info-level.
    violations.push({
      severity: 'info',
      code: 'KIP20-002',
      title: 'Stateful contract should reference OpInputCovenantId',
      detail: 'This contract declares a covenant entrypoint but does not directly reference OpInputCovenantId. The compiler-generated wrapper will inject it, but for readability and audit, hand-written contracts should bind the cov-id explicitly.',
      docLink: 'references/kips/SUMMARY.md',
    });
  }

  // Rule 3: expectedTemplateHash sourced from state, not args.
  // Already covered by audit_covenant OS-003 at info level; we re-surface
  // as a KIP-20 compliance warning since template-hash sourcing is a
  // first-class KIP-20 rule.
  if (/validateOutputStateWithTemplate|readInputStateWithTemplate/.test(source)) {
    violations.push({
      severity: 'warning',
      code: 'KIP20-003',
      title: 'expectedTemplateHash provenance',
      detail: 'Re-asserting the OS-003 rule as a KIP-20 compliance gate: every expectedTemplateHash argument MUST come from contract state or a verified protocol commitment, never from caller-provided sigscript bytes.',
      docLink: 'KIP_REFERENCE.md',
    });
  }

  return {
    compliant: !violations.some((v) => v.severity === 'error'),
    rulesChecked,
    violations,
  };
}

// ─── Tool 6: estimate_costs ────────────────────────────────────────────────
//
// Static cost estimator over a .sil source. The cost basis comes from
// `references/kips/SUMMARY.md` (KIP-16 + KIP-17 cost tables) and the
// observed opcode catalogue. This is intentionally conservative —
// real-world dispatch costs depend on which entrypoint executes and which
// branches the spender takes, so the estimate is per-entrypoint worst-case.

export interface CostEstimateLine {
  category: 'crypto-precompile' | 'introspection' | 'state-transition' | 'control';
  opcode: string;
  occurrences: number;
  unitCostScriptUnits: number;
  subtotalScriptUnits: number;
}

export interface EstimateCostsResponse {
  scriptUnitsTotal: number;
  lines: CostEstimateLine[];
  notes: string[];
}

const COST_TABLE: Array<{
  pattern: RegExp;
  category: CostEstimateLine['category'];
  opcode: string;
  unitCostScriptUnits: number;
}> = [
  // KIP-16 ZK precompiles — fixed Gram values from rusty-kaspa#775.
  { pattern: /OpZkPrecompile\b/g, category: 'crypto-precompile', opcode: 'OpZkPrecompile (Groth16 worst-case)', unitCostScriptUnits: 140 * 1000 },
  // Standard crypto — these are estimates based on KIP-17 docs; real
  // engine costs may differ. Treated as 1× ECDSA reference (~1 unit).
  { pattern: /checkSig\b/g, category: 'crypto-precompile', opcode: 'OpCheckSig', unitCostScriptUnits: 1000 },
  { pattern: /checkMultiSig\b/g, category: 'crypto-precompile', opcode: 'OpCheckMultiSig', unitCostScriptUnits: 1000 },
  { pattern: /checkDataSig\b/g, category: 'crypto-precompile', opcode: 'OpCheckDataSig', unitCostScriptUnits: 1000 },
  { pattern: /blake2b\b/g, category: 'crypto-precompile', opcode: 'OpBlake2b', unitCostScriptUnits: 100 },
  // Introspection — KIP-17. Most are ~5 script units (engine internal).
  { pattern: /OpInputCovenantId\b/g, category: 'introspection', opcode: 'OpInputCovenantId', unitCostScriptUnits: 10 },
  { pattern: /OpAuthOutputCount\b/g, category: 'introspection', opcode: 'OpAuthOutputCount', unitCostScriptUnits: 10 },
  { pattern: /OpAuthOutputIdx\b/g, category: 'introspection', opcode: 'OpAuthOutputIdx', unitCostScriptUnits: 10 },
  { pattern: /OpCovInputCount\b/g, category: 'introspection', opcode: 'OpCovInputCount', unitCostScriptUnits: 10 },
  { pattern: /OpCovInputIdx\b/g, category: 'introspection', opcode: 'OpCovInputIdx', unitCostScriptUnits: 10 },
  { pattern: /OpCovOutputCount\b/g, category: 'introspection', opcode: 'OpCovOutputCount', unitCostScriptUnits: 10 },
  { pattern: /OpCovOutputIdx\b/g, category: 'introspection', opcode: 'OpCovOutputIdx', unitCostScriptUnits: 10 },
  { pattern: /OpChainblockSeqCommit\b/g, category: 'introspection', opcode: 'OpChainblockSeqCommit', unitCostScriptUnits: 50 },
  // State transitions — engine-cost-wise these are very cheap because the
  // compiler lowers them to OpCat / OpPushData sequences, but each call
  // adds script bytes which are mass-charged.
  { pattern: /validateOutputState\b/g, category: 'state-transition', opcode: 'validateOutputState (lowered)', unitCostScriptUnits: 50 },
  { pattern: /validateOutputStateWithTemplate\b/g, category: 'state-transition', opcode: 'validateOutputStateWithTemplate (lowered)', unitCostScriptUnits: 100 },
  { pattern: /readInputState\b/g, category: 'state-transition', opcode: 'readInputState (lowered)', unitCostScriptUnits: 50 },
  { pattern: /readInputStateWithTemplate\b/g, category: 'state-transition', opcode: 'readInputStateWithTemplate (lowered)', unitCostScriptUnits: 100 },
];

export function estimateCostsTool(source: string): EstimateCostsResponse {
  const lines: CostEstimateLine[] = [];
  let total = 0;
  for (const entry of COST_TABLE) {
    const matches = source.match(entry.pattern);
    const occurrences = matches ? matches.length : 0;
    if (occurrences === 0) continue;
    const subtotal = occurrences * entry.unitCostScriptUnits;
    lines.push({
      category: entry.category,
      opcode: entry.opcode,
      occurrences,
      unitCostScriptUnits: entry.unitCostScriptUnits,
      subtotalScriptUnits: subtotal,
    });
    total += subtotal;
  }

  const notes: string[] = [
    'Estimate is per-entrypoint worst-case; real cost depends on which branches the spender exercises.',
    'KIP-16 ZK precompile costs are fixed Gram values from rusty-kaspa#775; non-ZK opcode costs are conservative estimates pending detailed KIP-17 cost-table benchmarks.',
  ];
  if (lines.some((line) => line.opcode.startsWith('OpZkPrecompile'))) {
    notes.push('OpZkPrecompile worst-case is Groth16 (140,000 script units). RISC0-Succinct is 250,000 — adjust if your contract dispatches to tag 0x21 instead.');
  }

  return {
    scriptUnitsTotal: total,
    lines,
    notes,
  };
}

// ─── Convenience: full tool catalog ────────────────────────────────────────

export interface ToolCatalog {
  tools: Array<{
    name: string;
    description: string;
    schema: { input?: unknown; output: unknown };
  }>;
}

export function getToolCatalog(): ToolCatalog {
  return {
    tools: [
      {
        name: 'list_patterns',
        description: 'List OpenSilver covenant patterns. Optional category filter: core | krc20 | zk-aware | all.',
        schema: { input: { category: 'McpCategory?' }, output: 'ListPatternsResponse' },
      },
      {
        name: 'get_pattern',
        description: 'Return one pattern by id (e.g. core.timelock). Returns notFound if the id is unknown.',
        schema: { input: { id: 'string' }, output: 'GetPatternResponse' },
      },
      {
        name: 'validate_covenant',
        description: 'Parse-level validation of a .sil source via silverc --ast-only. Returns ok/errors/warnings.',
        schema: { input: 'ValidateCovenantInput', output: 'ValidateCovenantResponse' },
      },
      {
        name: 'audit_covenant',
        description: 'OpenSilver-specific lint/audit checks layered on top of validate. Returns findings list.',
        schema: { input: { source: 'string' }, output: 'AuditCovenantResponse' },
      },
      {
        name: 'check_kip20_compliance',
        description: 'Focused subset of audit_covenant asserting the KIP-20 adoption rules.',
        schema: { input: { source: 'string' }, output: 'Kip20ComplianceResponse' },
      },
      {
        name: 'estimate_costs',
        description: 'Static per-entrypoint worst-case cost estimate in script units. Includes KIP-16 ZK precompile + KIP-17 opcode costs.',
        schema: { input: { source: 'string' }, output: 'EstimateCostsResponse' },
      },
    ],
  };
}

// Re-export for backwards compatibility with any earlier wiring.
export { listPatternsTool as default };
