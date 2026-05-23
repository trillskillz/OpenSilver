# Next-session queue

Autonomous work picked up by the next agent run. Coordination continues, but implementation can proceed. This queue now tracks the remaining recon work plus active Phase 2 scaffolding.

## Queue (in order)

### 0. Phase 2 scaffold follow-through ✅ PARTIALLY DONE 2026-05-23
- Created monorepo directories for `contracts`, `sdk`, `cli`, `mcp`, `wizard`, `integrations`, `docs`, `examples`, `tests`, and `benchmarks`.
- Added strict TypeScript + Vitest tooling, workspace config, baseline CI, and a Docusaurus docs-site seed.
- Added a first shared pattern-manifest/types surface in `sdk/` and wired basic consumers in CLI/MCP/Wizard/Integrations.
- Remaining: expand the manifest schema, add contract-compilation hooks, and decide whether to vendor the compiler or reference the pinned upstream clone.
- Phase 3.1 has started with an `Ownable` covenant scaffold; compiler validation is in place, and next work is behavior-level tests plus deciding whether the two-step handoff is the default variant.
- Phase 3.2 has started with a `MultiSig` scaffold over three explicit signers with a reconfiguration path; next work is behavior validation and deciding how far to push toward true N-of-M in v1.
- Phase 3.3 has started with a `TimeLock` scaffold supporting hard/soft modes plus a forward-only extension path; next work is behavior validation and deciding whether hashed-owner identifiers should replace raw pubkeys in state. The soft-cancel guard limitation is logged as GitHub issue #1.
- Phase 3.4 has started with a `Vault` scaffold combining owner rotation, signer quorum, and timelocked release; next work is behavior validation and output-shape constraints.
- Phase 3.5 has started with a bilateral `Escrow` scaffold exposing release/refund/timeout paths; next work is output-shape constraints and value-conservation checks.
- Phase 3.6 has started with a stateful milestone `Escrow` scaffold exposing monotonic milestone progression, final release, dispute refund, and timeout reclaim; next work is payout accounting and output constraints.
- Phase 3.7 has started with a stateful `Streaming Payment` scaffold exposing recipient withdrawals, remaining-allowance tracking, and sender cancellation; next work is payout accounting and output constraints.
- Phase 3.8 has started with a stateful `Vesting` scaffold exposing cliff-gated claims, claimed-amount tracking, and optional revocation; next work is revocation accounting and output constraints.

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

### 6. Saefstroem Groth16 PR + Hans Moog vProgs PRs
- Read `kaspanet/rusty-kaspa#775` (KIP-16 reference impl) — opcode dispatch, precompile structure, error modes.
- Survey vProgs PRs (search "vProgs" in `kaspanet/rusty-kaspa` PRs).
- Output: extend `references/kips/SUMMARY.md` with implementation-level notes for KIP-16 (Phase 5) and forward-compat callouts for vProgs.

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
