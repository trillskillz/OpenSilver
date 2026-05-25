# Changelog

All notable changes that affect the catalogue surface, tooling, or
external-facing APIs. Internal refactors and doc-only churn aren't
listed here — see `git log` for the full history.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/).
The project is pre-1.0; expect breaking changes between sessions until
external audit + a tagged release land.

## [Unreleased]

### Added

- **Pattern 5.3 v2** — first non-KCC20 use of `validateOutputStateWithTemplate`
  in OpenSilver. The v2 oracle pins a covenant-bound consumer output
  carrying `(published_value, recipient)` as state instead of emitting
  a terminal payout. Three runtime tests prove the binding through the
  real `kaspa-txscript` engine (positive + wrong-recipient + tampered-proof).
  Companion `OracleConsumer` covenant locks the published-value receipt.
  Downstream patterns gate logic on the published value via
  `readInputStateWithTemplate`.
- **`docs/PATTERNS.md`** — use-case-indexed pattern selection guide.
  Eight top-level use cases mapping problems ("I want to lock funds
  with multisig release") to specific patterns plus selection
  rationale.
- **`examples/` tree completion** — 22 paste-ready per-pattern
  walkthroughs (12 core + 5 KCC20 + 4 ZK + v2 oracle + consumer).
  Every walkthrough carries prerequisites, deploy-plan invocation,
  per-entrypoint sigscript shape pointer, runtime-test cross-reference,
  and verification posture.
- **Phase 8.3 Web Wizard** — single self-contained HTML page
  (vanilla HTML+CSS+JS, no deps) that renders the IDE manifest:
  phase filtering, per-pattern verification badges, copy-ready CLI
  snippets. Build with `npm run wizard:build`. CI drift gate via
  `npm run wizard:check`.
- **`opensilver deploy-plan <pattern-id>`** CLI command — compiles
  the contract, derives the P2SH commitment, lists discovered
  entrypoints, emits a wallet-ready JSON plan.
- **`compileOnly?: boolean`** flag on SDK manifest seeds so
  contracts with compile but no runtime tests don't overclaim
  `runtimeValidated` / `auditChecked`.
- **`CONTRIBUTING.md`** — concrete "how to add a pattern" checklist.
- **`SECURITY.md`** — responsible-disclosure path.
- **GitHub issue + PR templates** under `.github/`.

### Changed

- README hero rewritten — badges, 60-second tour, "where to go next"
  table. Status block reflects the actual catalogue completeness
  (21/22 scaffolded + runtime-verified, 0/22 externally audited).
- AUDIT_CHECKLIST extended with the 5.3 v2 family-wide template-hash
  posture entry.

### Compiler / patch lane

- ZK lane patch (`patches/silverscript-opzkprecompile.patch`) carries
  a local stack-order correctness fix (`.rev()` on public-input
  pushes) that needs folding into upstream PR
  `kaspanet/silverscript#125` before merge.

### Tests

- vitest: 36/36 files, 167/167 tests green (was 33/33, 146/146 at
  catalogue checkpoint).
- cargo runtime: 73/73 tests, 0 ignored (was 70/70; gained 3 for
  5.3 v2). 51 core + 7 kcc20 + 15 zk.
- CI drift gates: `manifests:check`, `wizard:check`.

## Catalogue snapshot at this changelog cut

| Family | Implemented | Notes |
| --- | --- | --- |
| Core (Phase 3) | 12/12 | All runtime-verified |
| KRC-20 (Phase 4) | 5/6 | 4.6 Snapshot waits on KIP-21 |
| ZK-aware (Phase 5) | 4 + v2 | Requires `npm run patch:silverc:zk` |

External audit (Phase 10.2), bug bounty (Phase 10.3), and Toccata-day
mainnet launch (Phase 11) are user-gated and not yet started.

## Earlier history

For changes prior to this changelog landing, see `git log`. Key
landmarks (most recent first):

- `eda9bc2` STATUS + NEXT_SESSION refresh — autonomous-engineering-complete state
- `dfb27b2` Pattern 5.3 v2 runtime tests
- `ad2876e` Pattern 5.3 v2 contracts + audit + docs
- `b2eecfd` Pattern selection guide
- `73e1736` ZK examples (5 walkthroughs)
- `f9883e2` KCC20 examples (5 walkthroughs)
- `0ac8e95` Final 6 core walkthroughs
- `d770d6d` 5 more core walkthroughs
- `dfe4fa5` Ownable canonical walkthrough + examples index
- `8ad1b4e` CI `wizard:check` drift gate
- `dde94bc` Phase 8.3 Web Wizard
- `2ca4d77` `opensilver deploy-plan` + DEPLOY_GUIDE
- `4b8c452` Phase 10 Task 10.1 — internal audit review
- `b01b13f` Compiler-strategy decision + machine-readable manifest pipeline
- `efa43aa` Pattern 5.1 — first end-to-end Groth16 verification through `kaspa-txscript`
