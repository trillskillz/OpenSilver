# OpenSilver

The OpenZeppelin of Kaspa. A battle-tested library of standard covenant patterns for SilverScript.

MIT licensed. Public from first commit. Currently in **Phase 0 — Ecosystem Coordination**.

See `PLAN.md` for the full implementation framework. See `ECOSYSTEM_COORDINATION.md` for live status of community outreach, which now runs in parallel with implementation.

## Guiding Principles

1. **Security-by-construction.** Per Michael Sutton: "making it easy to write covenants that correctly validate state transitions and making it difficult to accidentally deploy insecure schemes."
2. **KIP-20 Covenant IDs** are the foundation for every stateful pattern. Recursive lineage proofs are an anti-pattern.
3. **Coordinate, do not compete.** SilverScript Studio, KaspaCom Wallet, kaspacom-defi-mcp are partners.
4. **Every pattern documents its failure modes.** Every doc has a "WHEN NOT TO USE THIS" section.
5. **No marketing claims without audit.** "Battle-tested" requires external audit or 30 days of mainnet usage with no critical findings.

## Status

Phase 2 — Repo Scaffold — IN PROGRESS

Phase 0/1 reconnaissance is largely complete and documented. Outreach to Michael Sutton and Ori Newman remains recommended (drafts in `ECOSYSTEM_COORDINATION.md`), but it no longer blocks implementation. The repo now includes the first monorepo scaffold, baseline TypeScript/Vitest tooling, a shared `silverc` bootstrap path for local dev + CI, and a Docusaurus docs-site seed.

## Map of this repo

| File | What's in it |
| --- | --- |
| `PLAN.md` | The full v2 implementation framework (the source of truth for everything else). |
| `STATUS.md` | Live status line + what's done / blocked / next. |
| `NEXT_SESSION.md` | Autonomous work queue for the next agent run. |
| `ECOSYSTEM_COORDINATION.md` | Phase 0 hard-gate log: reading-list status, outreach drafts and log, live findings. |
| `LANGUAGE_DEEP_DIVE.md` | SilverScript language surface observed at `kaspanet/silverscript` commit `2c46231`, including the `#[covenant(...)]` declaration sugar from `DECL.md`. |
| `KIP_REFERENCE.md` | Pointer + five hard rules carried into pattern code. |
| `references/kips/SUMMARY.md` | Per-KIP extraction (opcodes, architectural patterns, OpenSilver impact) for KIP-16/17/20/21. |
| `references/kips/kip-{0016,0017,0020,0021}.md` | Full text of each KIP, fetched from the open PR branches. |
| `PATTERN_MAPPING.md` | Upstream examples × neighbouring ecosystems × OpenSilver V1 catalogue + DECL.md composition shapes. |
| `KASBONDS_AUDIT.md` | Phase 1 Task 1.3 audit. Identifies promotable patterns. |
| `docs/ecosystem/AWESOME_KASPA_SCAN.md` | Covenant-relevant scan of the broader Kaspa ecosystem from `awesome-kaspa`, with likely downstream integration targets. |
| `contracts/` | SilverScript contract source tree scaffold for core, token, and later zk-aware patterns. |
| `sdk/`, `cli/`, `mcp/`, `wizard/`, `integrations/` | Phase 2 TypeScript workspace scaffold for shared manifest/types, tooling, and integration surfaces. |
| `docs/site/` | Docusaurus docs-site scaffold. |
| `tests/` | Vitest-based compile suite, one test per Phase-3 pattern plus the shared manifest. |
| `runtime-tests/` | Rust crate that compiles each `.sil` via `silverscript-lang` and executes the redeem script in `kaspa-txscript`'s VM. Run via `npm run test:runtime` or `cargo test --manifest-path runtime-tests/Cargo.toml`. |
| `scripts/bootstrap-silverc.sh` | Idempotent bootstrap for the pinned upstream `silverc` compiler (`kaspanet/silverscript` at `2c46231`). Used by CI and local setup. |
| `.github/workflows/ci.yml` | CI: bootstrap pinned `silverc`, install, typecheck, test. |
| `upstream/silverscript/` | Pinned clone of `kaspanet/silverscript` at `2c46231` (gitignored). |
| `upstream/kips/` | Pinned clone of `kaspanet/kips` (gitignored). |

## Pattern catalogue

22 patterns across three groups.

- **Phase 3 — Core (12):** Ownable, MultiSig, TimeLock, Vault, Escrow (bilateral), Escrow (milestone), Streaming Payment, Vesting, Dead Man's Switch, Social Recovery, Atomic Swap (HTLC), Freelance/Payroll. **All 12 scaffolds runtime-verified end-to-end on every documented entrypoint** (51/51 core runtime tests, see Toolchain below).
- **Phase 4 — KCC20 token (6):** Reference, Ownable, Pausable, Capped, Vesting, Snapshot. **Asset contract (4.1) scaffolded** at `contracts/tokens/kcc20.sil`; **KCC20Ownable (4.2)**, **KCC20Pausable (4.3)**, **KCC20Capped (4.4)**, and **KCC20Vesting (4.5)** controller covenants are scaffolded at `contracts/tokens/`; 4.6 is deferred until KIP-21 lane stability lands.
- **Phase 5 — ZK-aware (4):** Verified Computation, Private Asset Transfer, ZK-Verified Oracle, Proof-Stitched Multi-Pattern. **Design-only**: four pattern designs landed in `docs/patterns/zk/`, each carrying state layout, intended `.sil` shape, public-inputs schema, cost amortisation table (5.4), and "WHEN NOT TO USE THIS" section. Compilation blocked on silverscript-lang exposing `OpZkPrecompile` as a callable builtin — the engine-side opcode (`0xa6`) is fully shipped via `kaspanet/rusty-kaspa#775` but the SilverScript front-end at our pinned commit `2c46231` has no builtin wired through. Unblock paths documented in `docs/patterns/zk/README.md`.

## Quick start

```bash
npm install
npm run bootstrap:silverc
npm run verify
npm run test:runtime
```

`npm run bootstrap:silverc` clones or refreshes the pinned upstream `kaspanet/silverscript` checkout under `upstream/silverscript/` and builds `target/debug/silverc` in-place. CI uses the same script, so local and hosted builds now share one bootstrap path.

## Toolchain

- Upstream: `cargo test -p silverscript-lang` runs **466 tests across 21 suites with 0 failures** at the pinned upstream commit.
- Compile suite: `npm run verify` (= `tsc -b` + `vitest`) is **26/26 files green, 68/68 tests** — one compile test per Phase-3 pattern, token scaffolds for 4.1 + 4.2 + 4.3 + 4.4 + 4.5, the shared manifest test, SDK/integration tests for KCC20 lifecycle planning, transaction-shape planning, compile/deploy spec bundles, TS-side `silverc` wrapper, deploy/broadcast assembly, Kaspa-facing transaction packages, RPC UTXO resolution, Generator/PendingTransaction stage execution, `kaspa-wasm` bindings, the MCP tool-surface tests, a missing-compiler bootstrap-hint test, AND a compile-extract-materialize end-to-end test that compiles `contracts/core/ownable.sil` with real silverc, extracts the redeem-script bytes, and materialises covenant-bound outputs to P2SH-derived addresses via a `P2shAddressDeriver` callback.
- Runtime suite: `npm run test:runtime` (= `cargo test --manifest-path runtime-tests/Cargo.toml`) is **58/58 green, 0 ignored** (51 core + 7 kcc20). Each test compiles a `.sil` contract via `silverscript-lang` and executes the redeem script in `kaspa-txscript`'s `TxScriptEngine` against a hand-built `MutableTransaction` + `UtxoEntry`. Every Phase-3 pattern now has runtime coverage on **every documented entrypoint**: TimeLock (claim/cancel/extend, including late-cancel rejection), Vault (release/extend/reconfigure/propose+accept owner transfer), BilateralEscrow (release/timeout), milestone Escrow (KIP-20 cov-id continuation), Streaming Payment (withdraw partial+terminal+forged/cancel), Vesting (claim partial+pre-cliff/revoke), HTLC (claim/refund), MultiSig (2-of-3 threshold), DMS (ping/claim via CSV), FreelancePayroll (4 paths), Ownable (propose/accept), SocialRecovery (initiate/cancel/finalize). Phase 4 runtime coverage includes **KCC20Capped**, **KCC20Pausable**, **KCC20Ownable**, and **KCC20Vesting** controllers. The SDK + integrations layer now closes the covenant-output materialization gap: `extractCompiledScript`, `describeCovenantScriptPublicKey`, `encodeConstructorArgsForSilverc` (bridges raw SDK scalars to silverc's ExprKind serde JSON), `materializeCovenantOutput` (covenant-bound outputs derive their address from compiled redeem-script bytes via a `P2shAddressDeriver` callback that the kaspa-wasm consumer wires; non-covenant outputs use the role-label fallback). All previously-tracked Phase 3/4 compiler-contract gaps and the earlier silverc-materialization limitation are now closed.
- Phase 3.1 through 3.12 are underway with compiler-validated `contracts/core/ownable.sil`, `contracts/core/multisig.sil`, `contracts/core/timelock.sil`, `contracts/core/vault.sil`, `contracts/core/escrow-bilateral.sil`, `contracts/core/escrow-milestone.sil`, `contracts/core/streaming-payment.sil`, `contracts/core/vesting.sil`, `contracts/core/dead-man-switch.sil`, `contracts/core/social-recovery.sil`, `contracts/core/atomic-swap-htlc.sil`, and `contracts/core/freelance-payroll.sil` scaffolds, plus matching docs/tests.
