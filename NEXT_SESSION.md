# Next-session queue

Autonomous work picked up by the next agent run. Nothing here requires user input; everything is reading + writing recon docs (Phase 0/1 territory, permitted under the hard gate). When this file is empty, prompt for the next phase.

## Queue (in order)

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

### 5. Neighbouring-ecosystem stdlibs (fill in `PATTERN_MAPPING.md`)
- **OpenZeppelin Contracts** (Solidity): map every relevant pattern. Focus on `access`, `token/ERC20`, `governance`, `finance/VestingWallet`, `security/Pausable`.
- **Aiken stdlib** (Cardano): the UTXO model is closest to Kaspa's. Map patterns to Aiken's `aiken/transaction`, `aiken/crypto`, `aiken/list`.
- **CashScript stdlib** — direct comparison since SilverScript is CashScript-inspired. Surface every pattern + idiom from `cashscript/cashscript`.
- Output: replace the "implied" cells in `PATTERN_MAPPING.md` with concrete file/path references.

### 6. Saefstroem Groth16 PR + Hans Moog vProgs PRs
- Read `kaspanet/rusty-kaspa#775` (KIP-16 reference impl) — opcode dispatch, precompile structure, error modes.
- Survey vProgs PRs (search "vProgs" in `kaspanet/rusty-kaspa` PRs).
- Output: extend `references/kips/SUMMARY.md` with implementation-level notes for KIP-16 (Phase 5) and forward-compat callouts for vProgs.

### 7. awesome-kaspa + Kaspa ecosystem index
- Clone `https://github.com/aspectron/awesome-kaspa`.
- Add a `docs/ecosystem/AWESOME_KASPA_SCAN.md` listing every covenant-relevant project with a one-line "relationship to OpenSilver" tag.
- This becomes the source of truth for Phase 11.3 ecosystem outreach.

## User-gated items (do not attempt autonomously)

- Outreach to Sutton + Newman + Manyfest + IzioDev + Kaspero Labs + KaspaCom (drafts in `ECOSYSTEM_COORDINATION.md`).
- Fetch Sutton's "Kaspa Covenants++ Toccata Hard-Fork Outlook" Medium post.
- Fetch Kaspero Labs SilverScript Studio docs.
- Setting up an external audit firm engagement (Phase 10.2).
- Bug-bounty pool funding (Phase 10.3).
- Toccata-activation-day launch coordination (Phase 11).

## Exit criteria (when this file empties)

All items above complete → flip `STATUS.md` `PHASE_0_STATUS` to `READY_FOR_PHASE_2` and prompt the user for outreach status. Until at least one acknowledgement from Sutton OR Newman is recorded in `ECOSYSTEM_COORDINATION.md`, **do not begin Phase 2 scaffolding**.
