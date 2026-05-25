# OpenSilver

> A standard library of covenant patterns for Kaspa's SilverScript — the OpenZeppelin of Kaspa.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Patterns](https://img.shields.io/badge/patterns-22-blue.svg)](docs/PATTERNS.md)
[![Runtime tests](https://img.shields.io/badge/runtime%20tests-73%2F73-brightgreen.svg)](runtime-tests/)
[![Vitest](https://img.shields.io/badge/vitest-167%2F167-brightgreen.svg)](tests/)
[![KIP-20](https://img.shields.io/badge/KIP--20-covenant_ids-orange.svg)](references/kips/SUMMARY.md)
[![KIP-16](https://img.shields.io/badge/KIP--16-OpZkPrecompile-orange.svg)](references/silverscript-rfc-opzkprecompile.md)

**22 patterns** across three families — core, KRC-20 tokens, ZK-aware — each one compile-validated, runtime-verified through the real `kaspa-txscript` engine, internally audit-checked, and paired with a paste-ready walkthrough. Designed to make secure L1 covenants the path of least resistance for Kaspa builders.

## 60-second tour

```bash
git clone https://github.com/trillskillz/OpenSilver && cd OpenSilver
npm install
npm run bootstrap:silverc           # one-time pinned silverc build
npm run wizard:build                # generate the pattern browser
open wizard/build/index.html        # browse all 22 patterns
```

Or from the CLI:

```bash
npx opensilver list                 # all patterns
npx opensilver get core.vault       # inspect a single pattern
npx opensilver deploy-plan core.ownable --ctor '[…]'   # compile + emit a deploy plan
```

## Where to go next

| If you want to… | Read… |
| --- | --- |
| Pick the right pattern for your problem | [`docs/PATTERNS.md`](docs/PATTERNS.md) — use-case-indexed selection guide |
| See a worked example | [`examples/`](examples/README.md) — 22 paste-ready walkthroughs |
| Deploy end-to-end | [`docs/DEPLOY_GUIDE.md`](docs/DEPLOY_GUIDE.md) |
| Understand the design rationale | [`docs/patterns/`](docs/patterns/) — per-pattern design docs incl. "WHEN NOT TO USE THIS" |
| Check audit posture | [`AUDIT_CHECKLIST.md`](AUDIT_CHECKLIST.md) |
| Contribute a new pattern | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## Status

The autonomous engineering surface is complete. 21/22 patterns are scaffolded + runtime-verified through the real `kaspa-txscript` engine. KCC20Snapshot (4.6) waits on upstream KIP-21 lane stability. No pattern is externally audited yet — see [`AUDIT_CHECKLIST.md`](AUDIT_CHECKLIST.md) for the internal-audit posture and known intentional findings. Detailed live status in [`STATUS.md`](STATUS.md).

## Pattern catalogue at a glance

| Family | Count | Highlights |
| --- | --- | --- |
| **Core (Phase 3)** | 12 | Ownable, MultiSig, TimeLock, Vault, Escrow (bilateral + milestone), Streaming Payment, Vesting, Dead Man's Switch, Social Recovery, Atomic Swap (HTLC), Freelance/Payroll |
| **KRC-20 (Phase 4)** | 5/6 | KCC20 asset reference + Ownable / Pausable / Capped / Vesting controllers. Snapshot deferred to KIP-21. |
| **ZK-aware (Phase 5)** | 4 + v2 ext. | Verified Computation, Private Asset Transfer, ZK-Verified Oracle (+ v2 cross-contract binding), Proof-Stitched Multi-Pattern. Patch lane (`npm run patch:silverc:zk`) required. |

## Design principles

1. **Security-by-construction.** Per Michael Sutton: "making it easy to write covenants that correctly validate state transitions and making it difficult to accidentally deploy insecure schemes."
2. **KIP-20 Covenant IDs** are the foundation for every stateful pattern. Recursive lineage proofs are an anti-pattern.
3. **Coordinate, do not compete.** SilverScript Studio, KaspaCom Wallet, kaspacom-defi-mcp are partners.
4. **Every pattern documents its failure modes.** Every design doc has a "WHEN NOT TO USE THIS" section.
5. **No marketing claims without audit.** "Battle-tested" requires external audit or 30 days of mainnet usage with no critical findings.

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
| `docs/COMPILER_STRATEGY.md` | The chosen long-term `silverc` strategy for v0.x: pinned-upstream bootstrap by default, patched overlay for the current ZK lane. |
| `docs/DEPLOY_GUIDE.md` | End-to-end deployment guide: bootstrap → pick pattern → build deploy plan → derive P2SH address → fund → spend. Walks through the four real CLI tools and includes a known-issues table. |
| `docs/PATTERNS.md` | Use-case-indexed pattern selection guide. Decision tree mapping problems ("I want to lock funds with multisig release", "I want a privacy-preserving payment") to specific patterns. Read this when you know what to build but not which pattern to reach for. |
| `AUDIT_CHECKLIST.md` | Phase 10 Task 10.1 internal audit posture per pattern. Companion to `tests/audit/audit-all-patterns.test.ts`. |
| `CONTRIBUTING.md` | How to add a pattern + the load-bearing conventions every PR follows. |
| `SECURITY.md` | Responsible-disclosure policy for vulnerabilities in shipped patterns or tooling. |
| `CHANGELOG.md` | Catalogue + tooling-level changes worth surfacing. Internal churn lives in `git log`. |
| `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md` | Bug report / new-pattern proposal / feature request templates + a PR checklist that mirrors the contributing guide. |
| `contracts/` | SilverScript contract source tree scaffold for core, token, and later zk-aware patterns. |
| `sdk/`, `cli/`, `mcp/`, `wizard/`, `integrations/` | Phase 2 TypeScript workspace scaffold for shared manifest/types, tooling, and integration surfaces. |
| `wizard/src/{template.html,build.mjs}` → `wizard/build/index.html` | Phase 8.3 Web Wizard. A single self-contained static HTML page (vanilla HTML+CSS+JS, no external deps) that renders the IDE manifest: filter by phase, inspect verification + compiler posture per pattern, and copy ready-to-run `opensilver get` / `opensilver deploy-plan` commands. Build with `npm run wizard:build`. CI drift gate: `npm run wizard:check`. Regression test: `tests/wizard.test.ts`. |
| `docs/site/` | Docusaurus docs-site scaffold. |
| `tests/` | Vitest-based compile suite, one test per Phase-3 pattern plus the shared manifest. |
| `runtime-tests/` | Rust crate that compiles each `.sil` via `silverscript-lang` and executes the redeem script in `kaspa-txscript`'s VM. Run via `npm run test:runtime` or `cargo test --manifest-path runtime-tests/Cargo.toml`. |
| `artifacts/manifests/` | Checked-in machine-readable manifest exports (wallet/IDE/MCP consumers). Regenerated by `npm run manifests:generate`; CI fails if they drift. |
| `scripts/bootstrap-silverc.sh` | Idempotent bootstrap for the pinned upstream `silverc` compiler (`kaspanet/silverscript` at `2c46231`). Used by CI and local setup. |
| `.github/workflows/ci.yml` | CI: bootstrap pinned `silverc`, install, typecheck, test. |
| `upstream/silverscript/` | Pinned clone of `kaspanet/silverscript` at `2c46231` (gitignored). |
| `upstream/kips/` | Pinned clone of `kaspanet/kips` (gitignored). |

## Pattern catalogue (details)

The at-a-glance table is in the hero above. Per-family detail follows.

- **Phase 3 — Core (12):** Ownable, MultiSig, TimeLock, Vault, Escrow (bilateral), Escrow (milestone), Streaming Payment, Vesting, Dead Man's Switch, Social Recovery, Atomic Swap (HTLC), Freelance/Payroll. **All 12 scaffolds runtime-verified end-to-end on every documented entrypoint** (51/51 core runtime tests, see Toolchain below).
- **Phase 4 — KCC20 token (5/6):** Reference (4.1) + Ownable (4.2) + Pausable (4.3) + Capped (4.4) + Vesting (4.5) at `contracts/tokens/`. The controllers all rely on `validateOutputStateWithTemplate` against the asset; the OpenSilver SDK provides `buildKcc20DeploymentBundle` to wire the three-phase deploy (controller genesis → asset genesis + controller init → operations). KCC20Snapshot (4.6) is deferred until upstream KIP-21 lane stability lands.
- **Phase 5 — ZK-aware (4 + v2 ext.):** Verified Computation, Private Asset Transfer, ZK-Verified Oracle, Proof-Stitched Multi-Pattern. **All four + the 5.3 v2 cross-contract output binding extension are scaffolded + runtime-verified locally**: contracts under `contracts/zk/` compile via `npm run patch:silverc:zk` and **15 runtime tests** in `runtime-tests/tests/zk_runtime.rs` prove real Groth16 fixtures verify through `kaspa-txscript`'s engine end-to-end. 5.3 composes 5.1's Groth16 surface with a MultiSig-style M-of-N committee threshold; 5.3 v2 pins the published value into a covenant-bound consumer output via `validateOutputStateWithTemplate` — the first non-KCC20 use of cross-contract output binding in OpenSilver. 5.4 demonstrates the KIP-20 leader/delegate cost-amortisation pattern via multi-input shared cov-context. 5.2 pins commitment-root + recipient from public-input slots (covenant-side only — circuit-half is the deployment author's responsibility, including any on-chain nullifier accumulator). The patch lane carries a stack-order correctness fix that needs folding into upstream PR `kaspanet/silverscript#125` before merge.

## Quick start

```bash
npm install
npm run bootstrap:silverc
npm run verify
npm run test:runtime
```

`npm run bootstrap:silverc` clones or refreshes the pinned upstream `kaspanet/silverscript` checkout under `upstream/silverscript/` and builds `target/debug/silverc` in-place. CI uses the same script, so local and hosted builds now share one bootstrap path. This is also the repo's chosen default compiler strategy for v0.x; see `docs/COMPILER_STRATEGY.md`.

For the current Phase 5 experimental lane, `npm run patch:silverc:zk` applies OpenSilver's checked-in `OpZkPrecompile`/`OpGroth16Verify` patch to that pinned upstream checkout, rebuilds `silverc`, and smoke-tests both tracked contracts:
- `contracts/zk/opzkprecompile-smoke.sil` — minimal builtin recognition
- `contracts/zk/opgroth16verify-smoke.sil` — structured helper shape `OpGroth16Verify(vk, proof, [a, b, c, ...])`

That gives OpenSilver a real local compiler-probing lane while the upstream PR tracked in issue #3 settles on the final authoring surface.

For downstream consumers, `opensilver export-manifest` now emits a stable machine-readable manifest artifact with compiler policy, verification metadata, and per-pattern entries. Example: `opensilver export-manifest --consumer wallet --phase krc20 --out wallet-manifest.json`.

For CI/releases, canonical generated artifacts now live under `artifacts/manifests/` and can be refreshed with:

```bash
npm run manifests:generate
```

GitHub Actions also enforces that those checked-in files stay current:

```bash
npm run manifests:check
```

Tracked outputs:
- `artifacts/manifests/mcp-all.json`
- `artifacts/manifests/ide-all.json`
- `artifacts/manifests/wallet-krc20.json`
- CI drift gate: `npm run manifests:check`

### Web Wizard

The Phase 8.3 web wizard renders the IDE manifest as a single self-contained
HTML page. Build it:

```bash
npm run wizard:build
```

That writes `wizard/build/index.html` — open directly in a browser via
`file://` or serve from any static host. It carries no external
dependencies and inlines the canonical IDE manifest so the page reflects
the same verification + compiler posture surfaced by the SDK and MCP
tools. CI enforces drift with `npm run wizard:check`.

## Contributing

PRs welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening
one — every pattern follows the same conventions (contract + design
doc + compile test + runtime test + audit-checklist entry + example
walkthrough) and PRs that skip pieces get sent back. For bugs and
proposals, see the GitHub issue templates. For security disclosure,
follow [`SECURITY.md`](SECURITY.md) (not the public issue tracker).

## Toolchain

- Upstream: `cargo test -p silverscript-lang` runs **466 tests across 21 suites with 0 failures** at the pinned upstream commit.
- Compile suite: `npm run verify` (= `tsc -b` + `vitest`) is **36/36 files green, 167/167 tests** — one compile test per pattern (Phase 3 + 4 + 5 + 5.3 v2), the shared manifest/audit/generated-artifact tests, SDK/integration tests for KCC20 lifecycle planning, manifest-driven compile planning, manifest export/policy propagation, transaction-shape planning, compile/deploy spec bundles, TS-side `silverc` wrapper, deploy/broadcast assembly, Kaspa-facing transaction packages, RPC UTXO resolution, Generator/PendingTransaction stage execution, `kaspa-wasm` bindings, the MCP tool-surface tests, and a compile-extract-materialize end-to-end test that compiles `contracts/core/ownable.sil` with real silverc and materialises covenant-bound outputs to P2SH-derived addresses via a `P2shAddressDeriver` callback.
- Runtime suite: `npm run test:runtime` (= `cargo test --manifest-path runtime-tests/Cargo.toml`) is **73/73 green, 0 ignored** (51 core + 7 kcc20 + 15 zk; the 15 zk tests require `npm run patch:silverc:zk` first, which the CI matrix runs before cargo). Each test compiles a `.sil` contract via `silverscript-lang` and executes the redeem script in `kaspa-txscript`'s `TxScriptEngine` against a hand-built `MutableTransaction` + `UtxoEntry`. Every Phase-3 pattern now has runtime coverage on **every documented entrypoint**: TimeLock (claim/cancel/extend, including late-cancel rejection), Vault (release/extend/reconfigure/propose+accept owner transfer), BilateralEscrow (release/timeout), milestone Escrow (KIP-20 cov-id continuation), Streaming Payment (withdraw partial+terminal+forged/cancel), Vesting (claim partial+pre-cliff/revoke), HTLC (claim/refund), MultiSig (2-of-3 threshold), DMS (ping/claim via CSV), FreelancePayroll (4 paths), Ownable (propose/accept), SocialRecovery (initiate/cancel/finalize). Phase 4 runtime coverage includes **KCC20Capped**, **KCC20Pausable**, **KCC20Ownable**, and **KCC20Vesting** controllers. The SDK + integrations layer now closes the covenant-output materialization gap: `extractCompiledScript`, `describeCovenantScriptPublicKey`, `encodeConstructorArgsForSilverc` (bridges raw SDK scalars to silverc's ExprKind serde JSON), `materializeCovenantOutput` (covenant-bound outputs derive their address from compiled redeem-script bytes via a `P2shAddressDeriver` callback that the kaspa-wasm consumer wires; non-covenant outputs use the role-label fallback). All previously-tracked Phase 3/4 compiler-contract gaps and the earlier silverc-materialization limitation are now closed.
- Phase 3.1 through 3.12 are underway with compiler-validated `contracts/core/ownable.sil`, `contracts/core/multisig.sil`, `contracts/core/timelock.sil`, `contracts/core/vault.sil`, `contracts/core/escrow-bilateral.sil`, `contracts/core/escrow-milestone.sil`, `contracts/core/streaming-payment.sil`, `contracts/core/vesting.sil`, `contracts/core/dead-man-switch.sil`, `contracts/core/social-recovery.sil`, `contracts/core/atomic-swap-htlc.sil`, and `contracts/core/freelance-payroll.sil` scaffolds, plus matching docs/tests.
