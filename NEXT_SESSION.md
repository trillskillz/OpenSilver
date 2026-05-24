# Next-session queue

Autonomous work picked up by the next agent run. Coordination continues, but implementation can proceed. This queue now tracks the remaining recon work plus active Phase 2 scaffolding.

## Queue (in order)

### 0. Phase 2 scaffold follow-through ✅ PARTIALLY DONE 2026-05-23
- Created monorepo directories for `contracts`, `sdk`, `cli`, `mcp`, `wizard`, `integrations`, `docs`, `examples`, `tests`, and `benchmarks`.
- Added strict TypeScript + Vitest tooling, workspace config, baseline CI, and a Docusaurus docs-site seed.
- Added a first shared pattern-manifest/types surface in `sdk/` and wired basic consumers in CLI/MCP/Wizard/Integrations.
- Remaining: expand the manifest schema, add contract-compilation hooks, and resolve the long-term compiler strategy tracked in GitHub issue #2 (vendor vs keep the pinned-upstream bootstrap flow from `scripts/bootstrap-silverc.sh`).
- Phase 3.1 has started with an `Ownable` covenant scaffold; compiler validation is in place, and next work is behavior-level tests plus deciding whether the two-step handoff is the default variant.
- Phase 3.2 has started with a `MultiSig` scaffold over three explicit signers with a reconfiguration path; next work is behavior validation and deciding how far to push toward true N-of-M in v1.
- Phase 3.3 has started with a `TimeLock` scaffold supporting hard/soft modes plus a forward-only extension path. Strict pre-unlock soft-cancel behavior is now enforced via `tx.locktime < unlock_time`; next work is deciding whether hashed-owner identifiers should replace raw pubkeys in state.
- Phase 3.4 has started with a `Vault` scaffold combining owner rotation, signer quorum, and timelocked release; next work is behavior validation and output-shape constraints.
- Phase 3.5 has started with a bilateral `Escrow` scaffold exposing release/refund/timeout paths; next work is output-shape constraints and value-conservation checks.
- Phase 3.6 has started with a stateful milestone `Escrow` scaffold exposing monotonic milestone progression, final release, dispute refund, and timeout reclaim; next work is payout accounting and output constraints.
- Phase 3.7 has started with a stateful `Streaming Payment` scaffold exposing recipient withdrawals, remaining-allowance tracking, and sender cancellation; next work is payout accounting and output constraints.
- Phase 3.8 has started with a stateful `Vesting` scaffold exposing cliff-gated claims, claimed-amount tracking, and optional revocation; next work is revocation accounting and output constraints.
- Phase 3.9 has started with a stateful `Dead Man's Switch` scaffold exposing owner keepalive, fallback claim, and fallback rotation; next work is timer semantics and output constraints.
- Phase 3.10 has started with a stateful `Social Recovery` scaffold exposing guardian-quorum initiation, delayed finalization, and owner cancellation; next work is guardian rotation and activation-delay derivation.
- Phase 3.11 has started with an `Atomic Swap (HTLC)` scaffold exposing recipient claim by secret preimage and timeout refund; next work is secret-format tightening and output constraints.
- Phase 3.12 has started with a `Freelance / Payroll` scaffold exposing mutual release, arbiter refund/payout, and timeout reclaim; terminal output/value constraints are now in place, and next work is broader amount/accounting checks.
- Remaining hardening work is concentrated in richer runtime behavior coverage and split-output accounting for stateful transitions, since AST-level hardening checks are now in place for the main constrained patterns.

### 1. KCC20 book — Pattern 4.1 dependency ✅ DONE 2026-05-23
- Read introduction, overview, kcc20-contract, what-the-tests-demonstrate.
- Output: `docs/standards/KCC20.md` covering identifier types, supply rules, security checklist, three-phase lifecycle, and revised 4.x slot mapping (5 of 6 variants are controller-side, leaving asset contract stable).
- KCC20 ↔ KRC-20 naming is open; raised as outreach question #2 to Newman.
- Remaining: read `kcc20-minter-contract.md` and `scenarios.md` for deep-dive on controller covenant + worked happy/sad paths (deferred to Phase 3 when actually building the pattern).

### 2. `kaspacom-defi-mcp` scope-boundary scan ✅ DONE 2026-05-23
- Cloned `KASPACOM/kaspacom-defi-mcp` master (found via `gh search repos`).
- Enumerated 15 tools (DEX 5, Lending 5, Launchpad 3, Portfolio/Info 2).
- Output: `docs/integrations/KASPACOM_MCP_BOUNDARY.md`. Key finding: their MCP is **L2 DeFi-specific** (Igra/Kasplex EVM, Solidity); ours is **L1 covenant-specific** (TN12/Toccata, SilverScript). Adjacent layers, no overlap, no federation required.
- Three open questions raised for outreach (KASPACOM L1 covenant plans, wallet-as-integration-target, MCP hosting infra).

### 3. KaspaCom wallet covenant templates ✅ DONE 2026-05-23
- Surveyed all KASPACOM org repos via `gh search repos --owner KASPACOM`.
- **Headline finding:** the KaspaCom web wallet does not currently embed L1 covenant templates. Phase 8.2 is greenfield, not extension.
- Only L1 covenant code in the org is `KASPACOM/x402-KAS/contracts/silverscript/` (4 channel SIL files; v4-locked already audited in `KASBONDS_AUDIT.md`).
- Output: `docs/integrations/KASPACOM_WALLET.md` with the full repo map, the x402 covenant analysis, and a proposed JSON pattern-manifest shape that doubles as the OpenSilver MCP `list_patterns` payload.
- Raised a fourth outreach question for KASPACOM about wallet roadmap and manifest preference.

### 4. SilverScript Studio (Kaspero Labs) ✅ DONE 2026-05-23
- Surveyed Kaspero Labs' six public repos. **Studio doesn't exist publicly yet** — `kasperolabs/silverscript-ext` is an empty README placeholder.
- Manyfest's `Manyfestation/silver-lab` is an empty name stake-out and is the more likely Studio home given Manyfest is a SilverScript co-author.
- Adjacent goldmine found: `silverscript-lang/tests/covenant_declaration_security_tests.rs` is the canonical security-test suite for the `#[covenant(...)]` macro. Catalogued in `STUDIO_LIBRARY_FORMAT.md`; this is the seed checklist for the Phase 7 `audit_covenant` MCP tool.
- Output: `docs/integrations/STUDIO_LIBRARY_FORMAT.md` with a proposed three-consumer JSON manifest (wallet + MCP + IDE share one source of truth).
- Added a fifth outreach question for Kaspero Labs and one for Manyfest.

### 5. Neighbouring-ecosystem stdlibs (fill in `PATTERN_MAPPING.md`) ✅ DONE 2026-05-23
- Cloned `cashscript/cashscript` and `aiken-lang/stdlib`.
- **Correction surfaced:** neither CashScript nor Aiken ships a *standardised patterns library* (à la OpenZeppelin). CashScript = language + 5 curated examples; Aiken stdlib = low-level building blocks; the patterns-library equivalent for Cardano is third-party (Anastasia Labs Design Patterns).
- Replaced "implied" cells in `PATTERN_MAPPING.md` with concrete paths into the upstream clones (OZ file names, CashScript `.cash` examples, Aiken `.ak` modules).
- **Quantitative finding:** 10 of 22 V1 patterns have prior art (5 base OZ + 5 KRC-20 derivations); 5 have a CashScript example; 12 are genuine net-new for L1 UTXO covenant systems. This is the quantitative basis for the OpenSilver thesis.

### 6. Saefstroem Groth16 PR + Hans Moog vProgs PRs ✅ DONE 2026-05-23
- Read `rusty-kaspa#775` (merged 2026-02-05, +2430/-121 across 56 files). Read `crypto/txscript/src/zk_precompiles/{mod,tags,error,groth16/mod,risc0/mod}.rs` and the `OpZkPrecompile` dispatch in `opcodes/mod.rs:889`.
- vProgs is no longer a stack of `rusty-kaspa` PRs — it's `kaspanet/vprogs` (separate monorepo, 6 layers, last touched 2026-05-15). Read its README + `l1/bridge/src/lib.rs` event shape.
- Output: extended `references/kips/SUMMARY.md` with a "KIP-16 implementation-level notes" section (opcode dispatch, fixed Gram costs, stack shapes for both precompiles, error stringification, the `TODO(covpp-mainnet)` audit-status finding, SDK glue requirement) and a "vProgs forward-compat notes" section (five concrete callouts: no L1 opcode needed for interop, subnet-id lane mapping, KIP-16 vs vProgs zkVM independence, no-recursive-lineage still applies, do-not-ship-vprogs-aware patterns in V1).
- Added Hans Moog to the outreach contact list as a low-priority sanity-check.

### 8. Runtime harness — landed and extended ✅ DONE 2026-05-23
- Picked up the previous session's uncommitted `runtime-tests/` crate, fixed the three rough edges (generic `MutableTransaction<T>`, `Vec::leak` on args, 32-byte cov-id literal), got the 4 starter tests passing.
- Extended coverage from 4 → **30 tests across 11 patterns, all green** (plus 7 documented-skipped). See `STATUS.md` matrix.
- Added `runtime-tests/target/` and `Cargo.lock` to `.gitignore` so build artefacts don't follow into commits.
- Three compiler/contract gaps surfaced by the harness (these were invisible to the AST-only vitest suite):
  1. ~~`streaming-payment.sil` and `vesting.sil` do not survive full compile~~ ✅ CLOSED 2026-05-23. Both refactored to the supported `termination = allowed` shape from upstream's `lowers_singleton_sugar_transition_termination_allowed_*` fixture: policy takes `next_states`, pins every field via `require(...)`, single trailing `return(next_states)`. Runtime coverage for `cancel`/`revoke` is now live; `withdraw`/`claim` singletons still need their own tests.
  2. NUM2BIN size cap on any singleton transition that writes a new byte[32] state value (runtime arg OR `byte[32](0)` literal). Affects Ownable, SocialRecovery, Vault owner-handoff. Action: refactor identity slots to `pubkey + bool flag` OR patch compiler to use OP_PUSHDATA on byte[32] state writes.
  3. ~~Missing engine-side `this.age` / DAA-score plumbing in the harness~~ ✅ CLOSED 2026-05-23. Reading the compiler revealed `this.age` lowers to `OpCheckSequenceVerify`, not a DAA-score op. We satisfy it by setting `input.sequence`. DMS.claim now has positive + negative runtime coverage (`sequence = timeout_age` vs `sequence < timeout_age`).
- Test bodies for the still-blocked NUM2BIN cases are kept in-file under `#[ignore = "..."]` with detailed notes, so the post-fix session can revive them without rewriting.

### 7. awesome-kaspa + Kaspa ecosystem index ✅ DONE 2026-05-23
- Cloned `Kasbah-commons/awesome-kaspa` (correction: repo owner is **not** `aspectron`).
- Added `docs/ecosystem/AWESOME_KASPA_SCAN.md` listing covenant-relevant projects and their relationship to OpenSilver.
- Key finding: the ecosystem is rich in wallets / L2 / merchant tools, but still lacks a canonical SilverScript covenant-pattern library category. This strengthens the OpenSilver thesis.
- This doc is now the Phase 11.3 outreach seed list.

## User-gated items (do not attempt autonomously)

- Outreach to Sutton + Newman + Manyfest + IzioDev + Kaspero Labs + KaspaCom (drafts in `ECOSYSTEM_COORDINATION.md`).
- Fetch Sutton's "Kaspa Covenants++ Toccata Hard-Fork Outlook" Medium post.
- Fetch Kaspero Labs SilverScript Studio docs.
- Setting up an external audit firm engagement (Phase 10.2).
- Bug-bounty pool funding (Phase 10.3).
- Toccata-activation-day launch coordination (Phase 11).

## Exit criteria (when this file empties)

All items above complete → flip `STATUS.md` to reflect Phase 2 completion and prompt for the next implementation slice. Keep recording outreach status in `ECOSYSTEM_COORDINATION.md` as responses arrive, but do not block execution on acknowledgements.

## Phase 4 queue (added 2026-05-23)

Pattern 4.1 KCC20 asset contract is scaffolded with vitest compile coverage. Five controller-covenant variants have stub docs at `docs/patterns/tokens/`; each captures the intended shape so implementation can pick up without re-deriving design choices. In order:

1. **4.4 KCC20Capped** — runtime lifecycle coverage landed in `runtime-tests/tests/kcc20_runtime.rs` (init/asset binding + happy-path mint + over-cap reject). SDK helper groundwork now lives in `sdk/src/index.ts`; next work is richer transaction-shape helpers for the three-output mint path.
2. **4.3 KCC20Pausable** — runtime coverage landed in `runtime-tests/tests/kcc20_runtime.rs` (pause + unpause + paused-mint reject).
3. **4.2 KCC20Ownable** — runtime coverage landed in `runtime-tests/tests/kcc20_runtime.rs` (pending-transfer mint + accepted-admin mint + stale-admin reject).
4. **4.5 KCC20Vesting** — runtime coverage landed in `runtime-tests/tests/kcc20_runtime.rs` (pre-cliff reject + first scheduled mint + second-period mint + final-drain mint).
5. **4.6 KCC20Snapshot** — wait for KIP-21 lane stability before implementing.
6. **KCC20 SDK follow-through** — helper surface now covers planning/state normalization, transaction-shape planning, compile/deploy spec bundles, a real TS-side `silverc` wrapper, deploy-ready compiled flow assembly, broadcast-ready transaction assembly inputs, Kaspa-facing transaction packages, RPC-backed UTXO resolution/build-request preparation, concrete Generator/PendingTransaction-based stage execution, and direct `kaspa-wasm` binding in `integrations/`. ✅ **As of 2026-05-24:** real silverc compile + covenant-output P2SH materialization now landed. SDK has `encodeConstructorArgsForSilverc`, `extractCompiledScript`, `describeCovenantScriptPublicKey`; integrations has `materializeCovenantOutput` + `P2shAddressDeriver` callback. The constructor-args bridge between the SDK's ergonomic raw-scalar API and silverc's `ExprKind` serde JSON is in place, and covenant-bound outputs now derive their address from compiled redeem-script bytes rather than role labels. End-to-end vitest test (`tests/compile-extract-materialize.test.ts`) exercises real `silverc` compile of `contracts/core/ownable.sil` and confirms the derived address is NOT the role-label fallback.

Each variant needs:
- `contracts/tokens/<name>.sil` controller covenant
- `docs/patterns/tokens/<name>.md` updated from STUB to scaffolded
- `tests/tokens/<name>-compile.test.ts` vitest AST validation
- Runtime test exercising the full three-phase genesis lifecycle (asset + controller + mint), once the harness has the `readInputStateWithTemplate` plumbing built out.

Runtime test harness extensions needed for 4.x:
- Multi-input transaction shape for KCC20.transfer (N:M leader+delegate path).
- `readInputStateWithTemplate` setup — building a template prefix/suffix/hash and pushing them into ctor state.
- Three-phase genesis lifecycle helper (minter genesis → asset genesis → mint).

## Phase-3 minor coverage gaps (added 2026-05-23) ✅ CLOSED 2026-05-24

Both items closed in commit `<vault-refactor-commit>`:

- **3.4 Vault** owner-handoff — refactored to `pubkey + has_pending_owner` shape; `propose_owner_transfer` and `accept_owner_transfer` runtime-verified.
- **3.10 SocialRecovery** `finalize_recovery` — positive + negative runtime tests landed (`accepts_pending_owner_after_activation`, `rejects_before_activation`).

Runtime suite is now **58/58 (51 core + 7 kcc20), 0 ignored**.

## Phase 5 queue (added 2026-05-24)

Four ZK-aware patterns specified in `docs/patterns/zk/` with full design + intended `.sil` shape. **All four remain compile-blocked upstream** on silverscript-lang exposing `OpZkPrecompile` as a callable builtin, but OpenSilver now has a validated local patch lane via `npm run patch:silverc:zk`. Engine side is shipped (KIP-16, `rusty-kaspa#775` merged 2026-02-05); SilverScript front-end at pinned commit `2c46231` has no builtin wired through by default.

### RFC landed (2026-05-24)

`references/silverscript-rfc-opzkprecompile.md` now contains the full upstream-patch design: a two-line change to `silverscript-lang/src/compiler/compile.rs` + one row in `debug_value_types.rs` + a stdlib doc-comment entry. The patch is sketched as `diff` blocks in the RFC for direct application. The 0-arity builtin shape deliberately avoids tag-specific operand schemas — higher-level wrappers live in OpenSilver's `sdk/zk/`.

Three unblock paths (in order of preference):

1. **Resolve the SilverScript authoring surface around `OpZkPrecompile`**. `kaspanet/silverscript#125` exposes the builtin name, but local prototyping showed that a 0-arg builtin is not enough: the parser rejects raw operand-push statements like `a; b; 2; proof; vk;`. We also now know (a) a fixed higher-arity surface is mechanically viable because a local 9-arg fixed-5-input Groth16 prototype compiled cleanly, (b) plain array args do not help because arrays compile as blob data, not separate stack items, and (c) a structured helper is viable: a local `OpGroth16Verify(vk, proof, [a, b, c, ...])` prototype with custom array-literal flattening compiled and kept upstream `examples_tests` green. Track discussion on the PR and try to turn that helper prototype into the upstreamable fix unless maintainers prefer broader explicit-push syntax.
2. **Use the local experimental patch lane** — `npm run patch:silverc:zk` applies `patches/silverscript-opzkprecompile.patch` to the pinned upstream checkout, rebuilds `silverc`, and smoke-tests the tracked contract `contracts/zk/opzkprecompile-smoke.sil`. Use this for local compiler probing and future prototyping once the authoring surface is clarified.
3. **Raw-script splice** at the OpenSilver compile pipeline level: run `silverc`, then walk the emitted bytecode and insert `OpZkPrecompile` (`0xa6`) at a marker-comment position. Brittle stopgap; remove the moment a proper front-end surface lands.
4. **Re-pin OpenSilver immediately if/when the upstream fix lands**, then implement 5.1 Verified Computation first.

Implementation order once unblocked:

1. **5.1 Verified Computation** — simplest. Pins down the Groth16 stack-order pattern that 5.2–5.4 build on. The first SDK safety rail is already landed as `buildGroth16WitnessPlan()` in `sdk/src/index.ts`; next work is to thread that helper into an actual compiled `.sil` contract once the upstream builtin patch is available (or the local patch lane is explicitly used for prototyping).
2. **5.3 ZK-Verified Oracle** — combines 5.1's Groth16 surface with the HodlVault-style M-of-N committee threshold. Demonstrates composition.
3. **5.2 Private Asset Transfer** — most ambitious; circuit IS the pattern. Needs a working Groth16 prover for a specific circuit before the covenant is meaningful.
4. **5.4 Proof-Stitched Multi-Pattern** — the vProgs forward-compat target. Should be LAST; needs 5.1's stack-order pattern stable and battle-tested first.

Each implementation needs:
- `contracts/zk/<name>.sil` (template ready in design doc's "Intended `.sil` shape" section)
- Runtime test wiring a real Groth16 proof — the harness extension is non-trivial because the proof has to actually verify, so we need either a vendored fixture VK+proof pair or an in-test prover. The first fixture is now staged at `references/fixtures/groth16-opzkprecompile-fixture.json`, copied from `kaspanet/rusty-kaspa`'s engine-side KIP-16 tests on `covpp-reset1`.
- SDK glue beyond the current witness-plan helper: VK-aware public-input-count validation, script-emission helpers that turn the witness plan into actual push ops, and any Phase-5 pattern-specific convenience wrappers.
