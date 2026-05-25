# Internal audit checklist

This file is the human-readable companion to `tests/audit/audit-all-patterns.test.ts`.

## Purpose

- Snapshot the current `audit_covenant` and `check_kip20_compliance` posture for every production pattern.
- Make intentional findings explicit so future refactors do not silently add new risk or hide known tradeoffs.
- Keep docs aligned with the actual MCP audit-tool output shipped in this repo.

## Current posture

### Clean patterns

The following currently produce **no error-severity findings** and no expected warning-level findings from the internal MCP audit tools:

- Phase 3 core: Ownable, MultiSig, TimeLock, Vault, Bilateral Escrow, Milestone Escrow, Streaming Payment, Vesting, Dead Man's Switch, Social Recovery, HTLC, Freelance/Payroll
- Phase 5 ZK: Verified Computation, Private Asset Transfer, Proof-Stitched Multi-Pattern

### Intentional / documented findings

#### KCC20 controller family

Expected findings on:

- `contracts/tokens/kcc20-ownable.sil`
- `contracts/tokens/kcc20-pausable.sil`
- `contracts/tokens/kcc20-capped.sil`
- `contracts/tokens/kcc20-vesting.sil`

Expected codes:

- `OS-003`
- `KIP20-003`

Reason: these controller covenants intentionally rely on template-hash-based foreign-output validation (`validateOutputStateWithTemplate`). That trust boundary must stay deploy-time/static, not caller-controlled.

#### ZK Verified Oracle v1

Expected findings on:

- `contracts/zk/zk-verified-oracle.sil`

Expected codes:

- `OS-003`
- `KIP20-003`

Reason: the current MCP audit heuristics classify the v1 oracle in the same template-hash-trust bucket. Treat that tool output as part of the shipped posture unless/until the heuristic or the contract shape changes.

## Regression gate

Run:

```bash
npm test -- --run tests/audit/audit-all-patterns.test.ts
```

If a finding changes:

1. decide whether the contract improved, regressed, or the heuristic changed,
2. update this file and any affected pattern docs,
3. update `tests/audit/audit-all-patterns.test.ts` to match the new intentional posture,
4. do not normalize new error-severity findings without a written reason.
