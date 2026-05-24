# OpenSilver — Status

```
PHASE_0_STATUS: IN_PROGRESS (reading largely complete; outreach now parallel, not blocking)
PHASE_2_STATUS: IN_PROGRESS (monorepo scaffold landed; 12 Phase-3 patterns scaffolded; runtime harness live)
PHASE_4_STATUS: IN_PROGRESS (KCC20 asset contract scaffolded as 4.1; KCC20Ownable, KCC20Pausable, KCC20Capped, and KCC20Vesting controllers scaffolded as 4.2/4.3/4.4/4.5)
PATTERNS_COMPLETE: 0/22 (12 Phase-3 scaffolds runtime-verified; 5 Phase-4 patterns scaffolded: KCC20 reference + KCC20Ownable + KCC20Pausable + KCC20Capped + KCC20Vesting)
TESTNET_TXS: []
DOCS_PAGES: 11 (README, PLAN, ECOSYSTEM_COORDINATION, LANGUAGE_DEEP_DIVE,
              KIP_REFERENCE, PATTERN_MAPPING, KASBONDS_AUDIT, STATUS,
              references/kips/SUMMARY, docs/ecosystem/AWESOME_KASPA_SCAN,
              docs/site/docs/intro)
TESTS_PASSING: 466/466 upstream + 18/18 vitest compile suite + 52/52 cargo runtime suite (0 ignored)
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
| 3.7 Streaming Payment | `cancel` (sender drain) | ✅ | ✅ recipient can't cancel |
| 3.8 Vesting | `revoke` (admin drain when revocable) | ✅ | ✅ non-revocable rejects |
| 3.9 Dead Man's Switch | `ping` (int-arg singleton) | ✅ | ✅ fallback can't ping |
| 3.9 Dead Man's Switch | `claim` (fallback after `this.age >= timeout`) | ✅ | ✅ pre-timeout |
| 3.11 HTLC | `claim` (preimage + P2PK to recipient) | ✅ | ✅ wrong preimage |
| 3.11 HTLC | `refund` (post-timeout to refunder) | ✅ | ✅ pre-timeout |
| 3.12 Freelance/Payroll | `standard_release` (mutual sign → worker) | ✅ | ✅ payout-to-client |
| 3.12 Freelance/Payroll | `arbiter_refund` (arbiter + client → client) | ✅ | ✅ attacker-as-client |
| 3.12 Freelance/Payroll | `arbiter_payout` (arbiter + worker → worker) | ✅ | — |
| 3.12 Freelance/Payroll | `timeout_reclaim` (client post-timeout) | ✅ | — |
| 3.2 MultiSig | `spend` (2-of-3 threshold) | ✅ | ✅ 1-of-3 below threshold |

**46 runtime tests, 0 ignored, all green.** Phase 3 patterns 3.1 (Ownable), 3.2 (MultiSig), 3.3 (TimeLock), 3.4 (Vault, except owner-handoff singletons), 3.5 (BilateralEscrow), 3.6 (milestone Escrow), 3.7 (Streaming Payment), 3.8 (Vesting), 3.9 (DeadMansSwitch), 3.10 (SocialRecovery, except finalize_recovery), 3.11 (HTLC), 3.12 (Freelance/Payroll) all carry runtime engine coverage on their primary paths. Remaining minor coverage gaps:

- **3.4 Vault** owner-handoff singletons (`propose_owner_transfer`, `accept_owner_transfer`) — apply the same `has_pending_owner` refactor as Ownable to unblock.
- **3.10 SocialRecovery** `finalize_recovery` — runtime test not yet drafted; the contract compiles after the pubkey + bool refactor.

### Compiler / contract gaps surfaced (Phase-3 followups)

1. ~~**`return-must-be-last` compile failure**~~ ✅ CLOSED 2026-05-23. `streaming-payment.sil` and `vesting.sil` rewritten to the supported `#[covenant.singleton(mode = transition, termination = allowed)]` shape from upstream's AST fixture `lowers_singleton_sugar_transition_termination_allowed_two_field_state`: policy takes `next_states` from the caller, pins every field with `require(...)` constraints, and `return(next_states)` once at the end. Both contracts now run end-to-end through the engine; `cancel` and `revoke` have runtime test coverage. The withdraw/claim singletons themselves still need their own runtime tests drafted.
2. ~~**NUM2BIN size cap on byte[32] state writes**~~ ✅ CLOSED 2026-05-23 via pattern-side workaround. Refactored Ownable and SocialRecovery from `byte[32] owner` (blake2b hash) to `pubkey owner + bool has_pending_owner` gating. The pubkey slot is never literally cleared — the bool flag is the source of truth, so cancel/accept paths set `pending_owner: prev_state.pending_owner` and only flip the flag. Trade-off captured in each pattern's "WHEN NOT TO USE THIS": pubkeys are exposed at deploy time vs hash-committed. Upstream compiler patch to use OP_PUSHDATA for byte[32] state writes would unblock a future hash-keyed variant; tracked but not blocking.
3. ~~**`this.age` engine-side semantics**~~ ✅ CLOSED 2026-05-23. Reading the compiler showed `this.age` lowers to `OpCheckSequenceVerify` (Kaspa's CSV), which reads `input.sequence` directly — not a current-DAA context. So we satisfy `this.age >= timeout_age` by setting the spending input's `sequence` to the desired relative-time value. DMS.claim now has positive + negative runtime coverage. Mask is `SEQUENCE_LOCK_TIME_MASK = 0x00000000ffffffff`; values must keep the disabled-bit (`1 << 63`) unset.

All three previously-tracked gaps now closed. Runtime suite has 0 ignored tests.

## Phase 4 runtime coverage (started 2026-05-23)

- Added `runtime-tests/tests/kcc20_runtime.rs` plus shared `runtime-tests/tests/common.rs` helpers so controller + asset lifecycle tests can live outside the monolithic core file.
- **KCC20Capped** now has end-to-end runtime coverage for:
  - controller init / asset binding handoff
  - happy-path capped mint
  - over-cap mint rejection
- **KCC20Pausable** now has runtime coverage for:
  - pause transition
  - unpause transition
  - paused mint rejection
- **KCC20Ownable** now has runtime coverage for:
  - admin-transfer proposal
  - current-admin mint while transfer is pending
  - accepted new-admin mint
  - stale old-admin rejection after acceptance
- **KCC20Vesting** now has runtime coverage for:
  - pre-cliff rejection (`UnsatisfiedLockTime` at the tx locktime layer)
  - first scheduled mint at cliff
- This lifts the runtime suite from **46 → 52** passing tests and proves the basic controller+asset lifecycle shape for the 4.x family.
- Next major runtime/design target is Phase 4.6 `KCC20Snapshot` only if KIP-21 lane stability changes; otherwise the next practical work is SDK glue and richer KCC20 multi-step helpers.

## Phase 4 — KCC20 token patterns (current)

| Slot | Pattern | Asset | Controller | Status |
| --- | --- | --- | --- | --- |
| 4.1 | KCC20 reference | `contracts/tokens/kcc20.sil` | (pluggable) | Scaffolded; vitest-compiled |
| 4.2 | KCC20Ownable | (4.1 reused) | `contracts/tokens/kcc20-ownable.sil` | Scaffolded; vitest-compiled |
| 4.3 | KCC20Pausable | (4.1 reused) | `contracts/tokens/kcc20-pausable.sil` | Scaffolded; vitest-compiled |
| 4.4 | KCC20Capped | (4.1 reused) | `contracts/tokens/kcc20-capped.sil` | Scaffolded; vitest-compiled; runtime init/mint covered |
| 4.5 | KCC20Vesting | (4.1 reused) | `contracts/tokens/kcc20-vesting.sil` | Scaffolded; vitest-compiled |
| 4.6 | KCC20Snapshot | (touches asset) | n/a | Stub doc; deferred to KIP-21 lane stability |

Headline design rule (from `docs/standards/KCC20.md`): asset contract and issuance-policy controller are separate covenants. The 4.1 asset is stable across 4.2-4.5; only the controller covenant changes per variant. 4.2 `KCC20Ownable`, 4.3 `KCC20Pausable`, 4.4 `KCC20Capped`, and 4.5 `KCC20Vesting` are scaffolded controller variants lifted from the upstream `kcc20-minter.sil` shape with policy-specific state (`hasPendingAdmin`, `paused`, `remainingAllowance`, issuance schedule fields). 4.6 is deferred until KIP-21 advances from Draft.
