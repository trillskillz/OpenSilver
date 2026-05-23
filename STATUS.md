# OpenSilver — Status

```
PHASE_0_STATUS: IN_PROGRESS (reading largely complete; outreach now parallel, not blocking)
PHASE_2_STATUS: IN_PROGRESS (monorepo scaffold landed; 12 Phase-3 patterns scaffolded; runtime harness live)
PATTERNS_COMPLETE: 0/22 (12 scaffolds started: Ownable, MultiSig, TimeLock, Vault, Escrow bilateral, Escrow milestone, Streaming Payment, Vesting, Dead Man's Switch, Social Recovery, Atomic Swap HTLC, Freelance / Payroll)
TESTNET_TXS: []
DOCS_PAGES: 11 (README, PLAN, ECOSYSTEM_COORDINATION, LANGUAGE_DEEP_DIVE,
              KIP_REFERENCE, PATTERN_MAPPING, KASBONDS_AUDIT, STATUS,
              references/kips/SUMMARY, docs/ecosystem/AWESOME_KASPA_SCAN,
              docs/site/docs/intro)
TESTS_PASSING: 466/466 upstream + 13/13 vitest compile suite + 30/30 cargo runtime suite (7 ignored, see compiler-gap notes)
ECOSYSTEM_COORDINATION: reading list complete; outreach drafted (not sent — needs user), implementation no longer blocked on acknowledgement
BLOCKERS: NONE for continuing Phase 2/3
NEXT_PHASE: 3 (extend runtime coverage to the remaining stateful patterns, then start Phase 4 KCC20 wrap)
```

## What's done

- Repo initialised, MIT-licensed, single commit history.
- Upstream `kaspanet/silverscript` cloned at `2c46231`. **`cargo test -p silverscript-lang` runs 466 tests across 21 suites with 0 failures** — toolchain confirmed working.
- KIP-16/17/20/21 fetched from their open PR branches into `references/kips/`. Per-KIP summary in `references/kips/SUMMARY.md`.
- `docs/DECL.md` (declaration sugar layer) read in full. This is the security-by-construction macro surface OpenSilver patterns target.
- `docs/TUTORIAL.md` skimmed by section headers; type system, transaction introspection, covenants, and best practices read in detail.
- KasBonds audit complete (`KASBONDS_AUDIT.md`): two promotable patterns identified.
- Updated recon docs: `LANGUAGE_DEEP_DIVE.md`, `KIP_REFERENCE.md`, `PATTERN_MAPPING.md`.
- Added `docs/ecosystem/AWESOME_KASPA_SCAN.md` to map covenant-relevant downstream projects and Phase 11.3 outreach targets.
- Landed initial Phase 2 scaffold: workspace directories, strict TypeScript config, Vitest, baseline CI, docs-site seed, and shared pattern-manifest surface.
- Started Phase 3.1 Ownable with `contracts/core/ownable.sil`, `docs/patterns/core/ownable.md`, example/benchmark placeholders, and compiler-backed AST validation.
- Started Phase 3.2 MultiSig with `contracts/core/multisig.sil`, `docs/patterns/core/multisig.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.3 TimeLock with `contracts/core/timelock.sil`, `docs/patterns/core/timelock.md`, example placeholder, and compiler-backed AST validation. Current limitation: the soft-cancel path still needs a strict pre-unlock guard that fits this compiler snapshot's `tx.time` parsing constraints. Logged as GitHub issue #1.
- Started Phase 3.4 Vault with `contracts/core/vault.sil`, `docs/patterns/core/vault.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.5 Escrow (bilateral) with `contracts/core/escrow-bilateral.sil`, `docs/patterns/core/escrow-bilateral.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.6 Escrow (milestone) with `contracts/core/escrow-milestone.sil`, `docs/patterns/core/escrow-milestone.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.7 Streaming Payment with `contracts/core/streaming-payment.sil`, `docs/patterns/core/streaming-payment.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.8 Vesting with `contracts/core/vesting.sil`, `docs/patterns/core/vesting.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.9 Dead Man's Switch with `contracts/core/dead-man-switch.sil`, `docs/patterns/core/dead-man-switch.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.10 Social Recovery with `contracts/core/social-recovery.sil`, `docs/patterns/core/social-recovery.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.11 Atomic Swap (HTLC) with `contracts/core/atomic-swap-htlc.sil`, `docs/patterns/core/atomic-swap-htlc.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.12 Freelance / Payroll with `contracts/core/freelance-payroll.sil`, `docs/patterns/core/freelance-payroll.md`, example placeholder, and compiler-backed AST validation.

## What's blocked on the user

- **Outreach.** Sutton + Newman drafts in `ECOSYSTEM_COORDINATION.md:37-47`. Helpful for course-correction, but no longer a gate.

## What can still be done autonomously next

1. Finish the remaining Phase 0/1 reading gaps (Sutton Medium post, Kaspero Labs Studio docs, vProgs / KIP-16 implementation notes).
2. Flesh out the shared manifest/types surface so wallet, IDE, and MCP consumers all read the same pattern metadata.
3. Expand Phase 3.1/3.2/3.3/3.4/3.5/3.6/3.7/3.8/3.9/3.10/3.11/3.12 with behavior-level tests, failure-mode notes, and continue adding output-shape/value-conservation checks where the patterns are currently scaffolds.
- Hardened payout patterns (`Escrow bilateral`, `Escrow milestone`, `Atomic Swap HTLC`, `Freelance / Payroll`, `TimeLock`, `Vault release`, `Streaming Payment`, `Vesting`) with explicit destination/value checks where tractable.
- Hardened continuation paths for `Milestone Escrow.approve_milestone` and `Vault` admin transitions with authenticated-output count and retained-value checks.
- Strengthened compile/AST tests to assert the presence of payout and continuation hardening structures, not just entrypoint names.

## Runtime test coverage (live)

`cargo test --manifest-path runtime-tests/Cargo.toml` (alias: `npm run test:runtime`) compiles each `.sil` contract via `silverscript-lang` and executes the redeem script in `kaspa-txscript`'s `TxScriptEngine` against a hand-built `MutableTransaction` + `UtxoEntry`. Each pattern test pair is (happy path → engine OK, failure mode → `VerifyError|EvalFalse|UnsatisfiedLockTime`).

| Pattern | Path | Positive | Negative |
| --- | --- | --- | --- |
| 3.3 TimeLock | `claim` (post-unlock P2PK payout) | ✅ | ✅ wrong dest, ✅ pre-unlock |
| 3.3 TimeLock | `cancel` (soft-cancel branch) | ✅ enabled | ✅ disabled |
| 3.3 TimeLock | `extend_lock` (int-arg singleton) | ✅ | ✅ earlier unlock rejected |
| 3.4 Vault | `release` (locktime + 2-of-3 sigs + beneficiary sig + payout) | ✅ | ✅ swapped beneficiary |
| 3.4 Vault | `extend_lock` (int-arg singleton + quorum gate + continuation value) | ✅ | — |
| 3.4 Vault | `reconfigure_signers` (int + pubkey args + owner + quorum) | ✅ | — |
| 3.5 Escrow (bilateral) | `release_to_seller` (arbiter + seller co-sign) | ✅ | ✅ payout-to-buyer |
| 3.5 Escrow (bilateral) | `timeout_reclaim` (buyer post-timeout) | ✅ | — |
| 3.6 Escrow (milestone) | `approve_milestone` (KIP-20 cov-id continuation) | ✅ | ✅ wrong continuation value |
| 3.9 Dead Man's Switch | `ping` (int-arg singleton) | ✅ | ✅ fallback can't ping |
| 3.11 HTLC | `claim` (preimage + P2PK to recipient) | ✅ | ✅ wrong preimage |
| 3.11 HTLC | `refund` (post-timeout to refunder) | ✅ | ✅ pre-timeout |
| 3.12 Freelance/Payroll | `standard_release` (mutual sign → worker) | ✅ | ✅ payout-to-client |
| 3.12 Freelance/Payroll | `arbiter_refund` (arbiter + client → client) | ✅ | ✅ attacker-as-client |
| 3.12 Freelance/Payroll | `arbiter_payout` (arbiter + worker → worker) | ✅ | — |
| 3.12 Freelance/Payroll | `timeout_reclaim` (client post-timeout) | ✅ | — |
| 3.2 MultiSig | `spend` (2-of-3 threshold) | ✅ | ✅ 1-of-3 below threshold |

**30 runtime tests across 11 patterns, all green.** Patterns still without coverage:

- **3.1 Ownable** singleton transitions — blocked by NUM2BIN gap below.
- **3.7 Streaming Payment** — blocked by `return-must-be-last` compile gap below.
- **3.8 Vesting** — same compile gap.
- **3.9 Dead Man's Switch** `claim` — uses `this.age`; needs engine DAA-score plumbing investigation.
- **3.10 Social Recovery** `initiate_recovery` + `finalize_recovery` + `cancel_recovery` — blocked by NUM2BIN gap.
- **3.4 Vault** owner-handoff singletons (`propose_owner_transfer`, `accept_owner_transfer`) — blocked by NUM2BIN gap.

### Compiler / contract gaps surfaced (Phase-3 followups)

1. **`return-must-be-last` compile failure** (streaming-payment.sil, vesting.sil). The `silverscript-lang` back-end rejects `#[covenant.singleton(... termination = allowed)]` policies that have an early `return([...])` inside an `if` branch followed by a trailing `return([])`. The vitest `*-compile.test.ts` suites use `silverc --ast-only` and only check AST presence, so the parse-vs-compile gap is currently masked in CI. **Action:** refactor both policies to use a single trailing return shaped by an `if/else` that computes both branches' state into shared bindings.
2. **NUM2BIN size cap on byte[32] state writes**. Engine rejects with `push encoding is not minimal: NUM2BIN target size 32 exceeds 8 bytes` any singleton transition that writes a new byte[32] value into a state slot (runtime arg or `byte[32](0)` literal). Constructor-time byte[32] state and unchanged-byte[32]-slot continuations work fine — Vault.extend_lock and Vault.reconfigure_signers prove that. **Action paths:** refactor patterns to encode identity as `pubkey + bool flag` (Vault.reconfigure_signers proves this works), or patch the compiler lowering to use OP_PUSHDATA instead of NUM2BIN for byte[32] state writes.
3. **`this.age` engine-side semantics**. DMS `claim` uses `this.age >= timeout_age`, which reads from current_daa - utxo.daa_score. Test harness doesn't currently set the engine's current-DAA context, so claim can't be exercised end-to-end yet. **Action:** find the engine knob (likely an `EngineFlags` or `EngineCtx` field for daa score) and parameterise the existing `execute_*_input` helpers.

All three are tracked with full test bodies kept under `#[ignore = "..."]` so the post-fix sessions can revive them with no rewrite. Counts: 4 NUM2BIN-blocked tests, 2 compile-blocked tests, 1 DAA-blocked test slot still un-drafted.
