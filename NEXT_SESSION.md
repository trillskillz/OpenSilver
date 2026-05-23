# Next-session queue

Autonomous work picked up by the next agent run. Nothing here requires user input; everything is reading + writing recon docs (Phase 0/1 territory, permitted under the hard gate). When this file is empty, prompt for the next phase.

## Queue (in order)

### 1. KCC20 book — Pattern 4.1 dependency ✅ DONE 2026-05-23
- Read introduction, overview, kcc20-contract, what-the-tests-demonstrate.
- Output: `docs/standards/KCC20.md` covering identifier types, supply rules, security checklist, three-phase lifecycle, and revised 4.x slot mapping (5 of 6 variants are controller-side, leaving asset contract stable).
- KCC20 ↔ KRC-20 naming is open; raised as outreach question #2 to Newman.
- Remaining: read `kcc20-minter-contract.md` and `scenarios.md` for deep-dive on controller covenant + worked happy/sad paths (deferred to Phase 3 when actually building the pattern).

### 2. `kaspacom-defi-mcp` scope-boundary scan
- Clone `https://github.com/kaspacom/kaspacom-defi-mcp` (or the canonical org path; find via GitHub search if the URL guess is wrong).
- Enumerate every tool the MCP exposes.
- Output: `docs/integrations/KASPACOM_MCP_BOUNDARY.md` listing their tools vs. OpenSilver MCP tools (`list_patterns`, `get_pattern`, `generate_covenant`, `validate_covenant`, `audit_covenant`, `check_kip20_compliance`, `estimate_costs`).
- Identify federation strategy: are we strictly broader (general patterns vs. DeFi-specific), or is there real overlap that needs renegotiating?

### 3. KaspaCom wallet covenant templates
- Locate the wallet's covenant-template code on GitHub (likely `kaspacom/kaspa-wallet` or similar).
- Document which patterns the wallet already exposes to end users.
- Output: extend `docs/integrations/KASPACOM_MCP_BOUNDARY.md` with a "Wallet templates" section.
- Identify the smallest Phase 8.2 deliverable: a JSON manifest of OpenSilver patterns the wallet can import without code changes.

### 4. SilverScript Studio (Kaspero Labs)
- Find the IDE source repo. Likely `kasperolabs/silverscript-studio` or similar.
- Document IDE plugin / extension surface — what defines a "library" inside the IDE? What format does the IDE expect for an importable pattern?
- Output: `docs/integrations/STUDIO_LIBRARY_FORMAT.md`.

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
