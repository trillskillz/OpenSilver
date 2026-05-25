# OpenSilver — Status

```
PHASE_0_STATUS: IN_PROGRESS (reading complete; outreach drafted, not gating)
PHASE_2_STATUS: COMPLETE (monorepo + manifest pipeline + deploy-plan CLI + Web Wizard + pattern selection guide all landed; CI drift gates enforced)
PHASE_3_STATUS: COMPLETE (12/12 core patterns scaffolded + runtime-verified + paste-ready example walkthroughs)
PHASE_4_STATUS: 5/6 COMPLETE (KCC20 asset 4.1 + Ownable 4.2 + Pausable 4.3 + Capped 4.4 + Vesting 4.5 all scaffolded + runtime-verified + walkthroughs; 4.6 KCC20Snapshot waits on upstream KIP-21 lane stability)
PHASE_5_STATUS: ALL FOUR + v2 EXTENSION LIVE LOCALLY (5.1 verified-computation + 5.2 private-asset-transfer + 5.3 zk-verified-oracle + 5.4 proof-stitched-multi-pattern + 5.3 v2 cross-contract output binding all compile via npm run patch:silverc:zk and runtime-verify real Groth16 proofs through kaspa-txscript. 5.2 covenant-side only; circuit-half remains the deployment author's responsibility. Upstream PR kaspanet/silverscript#125 still OPEN — local patch lane carries a stack-order correctness fix that needs folding back before merge.)
PHASE_8_STATUS: 8.3 COMPLETE (Web Wizard live; npm run wizard:build / wizard:check; CI drift gate enforced). 8.1 SilverScript Studio + 8.2 KaspaCom Wallet still depend on upstream roadmaps.
PHASE_10_STATUS: TASK 10.1 DONE 2026-05-24 (tests/audit/audit-all-patterns.test.ts + AUDIT_CHECKLIST.md). 10.2 external audit + 10.3 bug bounty pool are user-gated.
PATTERNS_COMPLETE: 0/22 audited externally; 21/22 scaffolded + runtime-verified (12 core + 5 KCC20 controllers + 4 Phase-5 + 5.3 v2 extension); 1/22 (KCC20Snapshot 4.6) waits on KIP-21.
TESTNET_TXS: []
DOCS_PAGES: 22+ (README, PLAN, ECOSYSTEM_COORDINATION, LANGUAGE_DEEP_DIVE,
              KIP_REFERENCE, PATTERN_MAPPING, KASBONDS_AUDIT, STATUS,
              AUDIT_CHECKLIST, NEXT_SESSION, docs/COMPILER_STRATEGY,
              docs/DEPLOY_GUIDE, docs/PATTERNS, references/kips/SUMMARY,
              docs/ecosystem/AWESOME_KASPA_SCAN, docs/site/docs/intro,
              docs/patterns/zk/README + 6 ZK pattern designs incl. v2 oracle + consumer,
              examples/README + 12 core + 5 KCC20 + 5 ZK walkthroughs)
TESTS_PASSING: 466/466 upstream + 36/36 vitest files (167/167 tests) + 73/73 cargo runtime suite (51 core + 7 kcc20 + 15 zk, 0 ignored). CI drift gates: manifests:check + wizard:check.
ECOSYSTEM_COORDINATION: reading list complete; outreach drafted (not sent — needs user), implementation no longer blocked on acknowledgement
BLOCKERS: NONE for autonomous continuation. Phase 5 authoring-surface upstream PR kaspanet/silverscript#125 is OPEN — local patch lane works around it via npm run patch:silverc:zk. KCC20Snapshot (4.6) waits on KIP-21 lane stability. External audit (10.2), bug bounty pool (10.3), Toccata launch (Phase 11) are user-gated.
NEXT_PHASE: The autonomous engineering surface is complete. Remaining work is user-gated (audit engagement, outreach send, mainnet launch coordination) or external-circuit-author scope (real Groth16 circuits for 5.2/5.4).
```

## What's done

- Repo initialised, MIT-licensed, single commit history.
- Shared compiler bootstrap landed at `scripts/bootstrap-silverc.sh`; CI and local setup now use the same pinned `silverc` acquisition/build path.
- Local Phase-5 experimental unblock landed: `patches/silverscript-opzkprecompile.patch` + `scripts/apply-silverscript-opzkprecompile-patch.sh` (`npm run patch:silverc:zk`) apply the RFC patch to the pinned upstream checkout, rebuild `silverc`, and smoke-test the tracked contracts `contracts/zk/opzkprecompile-smoke.sil` and `contracts/zk/opgroth16verify-smoke.sil`.
- SDK safety rail landed: `buildGroth16WitnessPlan()` in `sdk/src/index.ts` returns canonical push-order + invocation stack views for Groth16 precompile operands, so Phase-5 callers do not hand-roll the verifier stack order.
- Runtime-test prep landed: `references/fixtures/groth16-opzkprecompile-fixture.json` vendors the Groth16 VK/proof/public-input vector from `kaspanet/rusty-kaspa`'s engine-side KIP-16 tests, ready for the first OpenSilver Phase-5 runtime test.
- New compiler-surface finding: patched `silverc` accepts `require(OpZkPrecompile())`, but rejects raw operand-push statements like `a; b; 2; proof; vk;`, so the current 0-arg builtin exposure does not yet enable a real Phase-5 contract source.
- Positive prototype result: `compile_opcode_call()` does lower builtin args in source order, so a higher-arity surface is mechanically viable. A local 9-arg experiment for a fixed 5-public-input Groth16 shape compiled successfully; the remaining problem is API design for variable `n_public_inputs`, not opcode lowering.
- Additional narrowing result: `compile_array_expr()` lowers arrays as encoded/concatenated blob data on the stack, not as separate items. So a plain `publicInputs[]` argument would still require custom lowering; array syntax alone does not solve the verifier stack-shaping problem.
- New positive prototype result: a local `OpGroth16Verify(vk, proof, [a, b, c, ...])` helper that custom-flattens an array literal into verifier operands compiled successfully, and the upstream `silverscript-lang` `examples_tests` suite still passed (`27/27`).
- Follow-on local-tooling result: OpenSilver's checked-in patch lane now reproduces that helper surface on the pinned compiler ref and AST-compiles both smoke contracts successfully via `npm run patch:silverc:zk`.
- Upstream `kaspanet/silverscript` cloned at `2c46231`. **`cargo test -p silverscript-lang` runs 466 tests across 21 suites with 0 failures** — toolchain confirmed working.
- KIP-16/17/20/21 fetched from their open PR branches into `references/kips/`. Per-KIP summary in `references/kips/SUMMARY.md`.
- `docs/DECL.md` (declaration sugar layer) read in full. This is the security-by-construction macro surface OpenSilver patterns target.
- `docs/TUTORIAL.md` skimmed by section headers; type system, transaction introspection, covenants, and best practices read in detail.
- KasBonds audit complete (`KASBONDS_AUDIT.md`): two promotable patterns identified.
- Updated recon docs: `LANGUAGE_DEEP_DIVE.md`, `KIP_REFERENCE.md`, `PATTERN_MAPPING.md`.
- Added `docs/ecosystem/AWESOME_KASPA_SCAN.md` to map covenant-relevant downstream projects and Phase 11.3 outreach targets.
- Landed initial Phase 2 scaffold: workspace directories, strict TypeScript config, Vitest, baseline CI, docs-site seed, and shared pattern-manifest surface.
- Expanded the shared pattern manifest so CLI/MCP/integrations now expose verification metadata (compile/runtime/audit), compiler requirements (patched silverc vs pinned upstream), bootstrap commands, and test-path pointers. Also corrected `zk-aware.private-asset-transfer` from stale `planned` metadata to its actual scaffolded/runtime-covered state.
- Added a generic manifest-driven compile hook: `buildPatternCompilePlan()` in the SDK plus CLI support via `opensilver compile-pattern <pattern-id>`, so patterns can now compile by manifest identity rather than only by raw file path.
- Resolved the repo's v0.x compiler-strategy decision in favor of the pinned-upstream bootstrap path rather than vendoring compiler source/binaries. Decision + rationale are documented at `docs/COMPILER_STRATEGY.md`.
- Pushed compiler-policy metadata to downstream-facing surfaces: MCP `list_patterns` now returns the shared bootstrap/patch policy, and `buildIntegrationManifest()` now includes compiler-policy + summary counts so wallet/IDE/MCP consumers can reason about setup requirements without hardcoding them.
- Added a downstream export path: `opensilver export-manifest` now emits a stable machine-readable manifest artifact (stdout or `--out <path>`) for wallet/IDE/MCP consumers, including compiler policy and filtered pattern sets.
- Added canonical checked-in manifest artifacts for CI/release consumers under `artifacts/manifests/` plus `npm run manifests:generate` to refresh them; regression coverage now fails if those tracked JSON artifacts drift from the SDK/integration source of truth.
- CI now runs `npm run manifests:check`, which regenerates the canonical JSON artifacts and fails on any diff under `artifacts/manifests/`, so release-facing machine-readable exports cannot silently go stale.
- Started Phase 3.1 Ownable with `contracts/core/ownable.sil`, `docs/patterns/core/ownable.md`, example/benchmark placeholders, and compiler-backed AST validation.
- Started Phase 3.2 MultiSig with `contracts/core/multisig.sil`, `docs/patterns/core/multisig.md`, example placeholder, and compiler-backed AST validation.
- TimeLock (`contracts/core/timelock.sil`) now enforces strict pre-unlock soft-cancel behavior via `tx.locktime < unlock_time`, which works around the pinned compiler snapshot's `require(tx.time >= ...)`-only grammar special-case while preserving the intended semantics.
- Started Phase 3.4 Vault with `contracts/core/vault.sil`, `docs/patterns/core/vault.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.5 Escrow (bilateral) with `contracts/core/escrow-bilateral.sil`, `docs/patterns/core/escrow-bilateral.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.6 Escrow (milestone) with `contracts/core/escrow-milestone.sil`, `docs/patterns/core/escrow-milestone.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.7 Streaming Payment with `contracts/core/streaming-payment.sil`, `docs/patterns/core/streaming-payment.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.8 Vesting with `contracts/core/vesting.sil`, `docs/patterns/core/vesting.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.9 Dead Man's Switch with `contracts/core/dead-man-switch.sil`, `docs/patterns/core/dead-man-switch.md`, example placeholder, and compiler-backed AST validation.
- Hardened Phase 3.9 Dead Man's Switch to store direct `pubkey` owner/fallback state instead of hashed `byte[32]` slots, removing the internal-audit/compiler hazard already eliminated from Ownable v1 / SocialRecovery.
- Started Phase 3.10 Social Recovery with `contracts/core/social-recovery.sil`, `docs/patterns/core/social-recovery.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.11 Atomic Swap (HTLC) with `contracts/core/atomic-swap-htlc.sil`, `docs/patterns/core/atomic-swap-htlc.md`, example placeholder, and compiler-backed AST validation.
- Started Phase 3.12 Freelance / Payroll with `contracts/core/freelance-payroll.sil`, `docs/patterns/core/freelance-payroll.md`, example placeholder, and compiler-backed AST validation.
- Landed `opensilver deploy-plan <pattern-id>` CLI + SDK helper (`buildPatternDeployPlan`) on 2026-05-24 — compiles the contract, derives the P2SH commitment, lists discovered entrypoints, and emits a wallet-ready JSON plan. End-to-end walkthrough lives in `docs/DEPLOY_GUIDE.md`.
- Landed Phase 8.3 Web Wizard on 2026-05-24 — single self-contained `wizard/build/index.html` page (vanilla HTML+CSS+JS, no external deps) that renders the IDE manifest with phase filtering, per-pattern verification posture, and copy-ready CLI snippets. `npm run wizard:build` rebuilds; `npm run wizard:check` is the CI drift gate.
- Landed `examples/ownable/` canonical worked example on 2026-05-24 — full wizard → deploy-plan → fund → spend walkthrough that paste-runs against the shipped tooling.
- Landed 11 additional core pattern walkthroughs on 2026-05-24/25 (MultiSig, Vault, TimeLock, BilateralEscrow, AtomicSwap, StreamingPayment, Vesting, DMS, SocialRecovery, MilestoneEscrow, FreelancePayroll). All 12 core examples paste-ready and consistent in shape.
- Landed 5 KCC20 walkthroughs on 2026-05-25 under `examples/tokens/` — asset reference (4.1) plus four controller variants (Ownable, Pausable, Capped, Vesting). Each leads with the three-phase deploy lifecycle and the SDK helper map.
- Landed 4 ZK walkthroughs on 2026-05-25 under `examples/zk/` — Verified Computation, Private Asset Transfer, ZK-Verified Oracle, Proof-Stitched Multi-Pattern. Each leads with the patch-lane prerequisite and the "covenant is a verifier, not a prover" boundary.
- Landed `docs/PATTERNS.md` on 2026-05-25 — use-case-indexed pattern selection guide. Eight top-level use cases mapping problems ("I want to control who can spend") to specific patterns.
- Landed Pattern 5.3 v2 cross-contract output binding on 2026-05-25 — first non-KCC20 use of `validateOutputStateWithTemplate` in OpenSilver. Two new contracts (`contracts/zk/zk-verified-oracle-v2.sil`, `contracts/zk/oracle-consumer.sil`) compile cleanly, three runtime tests in `runtime-tests/tests/zk_runtime.rs` exercise positive + wrong-recipient + tampered-proof paths through the real `kaspa-txscript` engine. SDK manifest carries a `compileOnly` flag on seed entries (false for v2 now that runtime is live). Two new ZK example walkthroughs landed too.

## What's blocked on the user

- **Outreach.** Sutton + Newman drafts in `ECOSYSTEM_COORDINATION.md:37-47`. Helpful for course-correction, but no longer a gate.
- **External audit engagement (Phase 10.2).** Needs user to engage an audit firm.
- **Bug bounty pool funding (Phase 10.3).**
- **Toccata-activation-day launch coordination (Phase 11).**
- **Upstream PR `kaspanet/silverscript#125` stack-order fold-back.** Patch lane carries the local correction; needs review/merge upstream before mainnet.

## What can still be done autonomously next

The autonomous engineering surface is genuinely complete. The remaining work is either user-gated (above) or external-circuit-author scope:

- **Real circuits for Pattern 5.2 + 5.4.** Covenant halves are runtime-verified against the placeholder Groth16 fixture; production deployments need per-pattern circuits (5.2: commitment+nullifier transfer-validity; 5.4: per-recipient batch). These are CIRCUIT-AUTHOR deliverables.
- **KCC20Snapshot (4.6).** Waits on upstream KIP-21 `OpChainblockSeqCommit` lane stability.

If a substantial new autonomous slice is wanted, candidates not yet explored:

- A combined KCC20 controller (Capped + Pausable + Ownable) as a Phase-4.7 variant.
- A v2 nullifier-accumulator variant for 5.2 (assumes a real circuit lands first).
- A v3 multi-output binding variant for 5.3 (pins N consumer outputs).
- A v3 per-recipient public-input decoding variant for 5.4 (assumes a real per-recipient circuit).
- Deeper MCP tooling — additional audit heuristics, pattern-specific lint rules.
- A docs-site build that surfaces the pattern catalogue + examples + selection guide as a unified site (Docusaurus scaffold is already seeded at `docs/site/`).

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

**58 runtime tests, 0 ignored, all green.** Phase 3 patterns 3.1 (Ownable), 3.2 (MultiSig), 3.3 (TimeLock), 3.4 (Vault), 3.5 (BilateralEscrow), 3.6 (milestone Escrow), 3.7 (Streaming Payment), 3.8 (Vesting), 3.9 (DeadMansSwitch), 3.10 (SocialRecovery), 3.11 (HTLC), 3.12 (Freelance/Payroll) all carry runtime engine coverage on their documented primary paths; Phase 4 runtime coverage includes the current KCC20 controller family. No remaining Phase-3 runtime coverage gaps are tracked in this file.

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
  - second-period scheduled mint
  - final-drain mint where the remaining allocation is less than `releasePerPeriod`
- This lifts the runtime suite from **46 → 53** passing tests and proves the basic controller+asset lifecycle shape for the 4.x family, including vesting continuation across multiple periods and terminal controller drain behavior.
- Added first-pass SDK glue in `sdk/src/index.ts` plus `tests/kcc20-sdk.test.ts` covering:
  - KCC20 controller contract/doc path selection
  - normalized controller-state builders for Ownable/Pausable/Capped/Vesting
  - asset/controller constructor-arg builders
  - three-phase lifecycle planning (controller genesis → asset genesis → issuance)
  - concrete transaction-shape plans for controller genesis, asset genesis, and mint flows
  - compile/deploy spec bundles for controller pre-init, asset genesis, initialized controller state, and mint continuations against the pinned `upstream/silverscript/target/debug/silverc`
  - a real TS-side `silverc` wrapper (`buildSilvercCommandPlan` + `runSilvercCompileSpec`) that writes ctor-args JSON, executes the compiler, and parses the emitted JSON artifact
  - deploy-ready compiled flow assembly (`buildKcc20DeployFlow`) that combines lifecycle planning, transaction shapes, compile specs, and wrapper-produced artifacts into one object
  - broadcast-ready transaction assembly inputs (`buildKcc20BroadcastReadyFlow`) that map compiled stages into named input/output/signer payloads for future Kaspa transaction builders
- Added a Kaspa-facing integration layer in `integrations/src/index.ts` plus `tests/kcc20-integrations.test.ts` covering:
  - `buildKaspaKcc20TransactionPackage`, which converts broadcast-ready KCC20 assemblies into package objects for downstream wallet/builder/broadcaster code
- Extended that integration layer with RPC-backed preflight resolution plus `tests/kcc20-rpc-integration.test.ts` covering:
  - `resolveKaspaKcc20TransactionPackage`, which uses the documented direct-node `getUtxosByAddresses` + UTXO subscription surface to resolve package inputs against concrete Kaspa addresses
  - `buildKaspaKcc20DeploymentRequests`, which converts resolved packages into builder-ready stage requests for controller genesis, asset genesis, and initialized-controller continuation
- Added concrete builder/signing execution in `integrations/src/index.ts` plus `tests/kcc20-builder-integration.test.ts` covering:
  - `buildKaspaStageExecutionPlan`, which resolves stage outputs into real Generator settings (`utxoEntries`, `outputs`, `changeAddress`, optional `priorityFee`)
  - `executeKaspaStageBuild`, which consumes `Generator.next()`, signs each `PendingTransaction`, optionally submits it, and serializes captured artifacts
  - `executeKaspaKcc20Deployment`, which runs the full three-stage controller-genesis → asset-genesis → initialized-controller flow with stage-specific signer payloads and amount overrides
- Bound that adapter surface to the real `kaspa-wasm` npm package (added to `integrations/package.json`) plus `tests/kcc20-kaspa-wasm.test.ts` covering:
  - `loadKaspaWasmModule`
  - `createKaspaWasmSignerPayload`
  - `buildKaspaWasmPaymentOutputs`
  - `buildKaspaWasmStageExecutionPlan`
  - `createKaspaWasmGeneratorFactory`
- Internal audit regression gate landed at `tests/audit/audit-all-patterns.test.ts`, with the companion human-readable posture file `AUDIT_CHECKLIST.md`. It snapshots MCP `audit_covenant` + `check_kip20_compliance` output across every production `.sil` contract and fails on unexpected drift.
- Next major runtime/design target is Phase 4.6 `KCC20Snapshot` only if KIP-21 lane stability changes; otherwise the next practical work is deepening audit/tooling posture and SDK surfaces around the already-runtime-covered controller family.

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
