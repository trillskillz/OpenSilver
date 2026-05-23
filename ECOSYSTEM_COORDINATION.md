# Ecosystem Coordination — Phase 0

> **Hard gate.** No pattern code is written until at least Michael Sutton OR Ori Newman has acknowledged the project.

Last updated: 2026-05-23

## 0.1 — Reading list (status)

| Source | Location | Status | Notes |
| --- | --- | --- | --- |
| `kaspanet/silverscript` repo (full) | GitHub | CLONED (commit `2c46231`) | `upstream/silverscript/`. Initial pass through README, `std/builtins.sil`, and 10 key examples complete. |
| `silverscript/covenants/sdk` folder | GitHub | **NOT FOUND** | Folder does not exist on master @ `2c46231`. Closest matches: `silverscript-lang/std/builtins.sil` (4 documented builtins) and `silverscript-lang/tests/examples/` (81 `.sil` files). **First question for Sutton:** which path did he mean? |
| TUTORIAL.md, DECL.md, KCC20 book | upstream | PARTIAL (file sizes verified, full read scheduled) | `docs/TUTORIAL.md` 1338 lines, `docs/DECL.md` 373 lines, `docs/kcc20-book/`. |
| KIP-17 (extended script opcodes) | kaspanet/kips | PENDING | |
| KIP-20 (Covenant IDs) | kaspanet/kips | PENDING | **Critical** — foundation for every stateful pattern. |
| KIP-16 (ZK opcodes + verifier precompile) | kaspanet/kips | PENDING | |
| KIP-21 (sequencing commitments) | kaspanet/kips | PENDING | |
| Sutton's "Kaspa Covenants++ Toccata Hard-Fork Outlook" Medium post | Medium | PENDING | |
| Kaspero Labs SilverScript Studio docs | Kaspero Labs | PENDING | |
| KaspaCom covenant wallet code | GitHub | PENDING | |
| `kaspacom-defi-mcp` source | GitHub | PENDING | Confirm scope boundary with our MCP. |
| Saefstroem Groth16 verifier PR | rusty-kaspa | PENDING | Foundation for ZK patterns (Phase 5). |
| Hans Moog vProgs PRs | rusty-kaspa | PENDING | Forward-compat target. |

## 0.2 — Outreach log

| Contact | Channel | Status | Date sent | Response |
| --- | --- | --- | --- | --- |
| Michael Sutton (@michaelsuttonil) | X / Kaspa Discord | NOT SENT | — | — |
| Ori Newman (@OriNewman) | X / GitHub | NOT SENT | — | — |
| Manyfest (@manyfest_) | X | NOT SENT | — | — |
| IzioDev | GitHub / Discord | NOT SENT | — | — |
| Kaspero Labs team | Discord / GitHub | NOT SENT | — | — |
| KaspaCom team | Discord / GitHub | NOT SENT | — | — |

### Outreach goals (per plan)
Coordination, not permission. We need to discover:
- What is already covered by core / `covenants/sdk`?
- What conflicts with planned core work?
- What overlaps with existing community tooling?
- What concrete gaps does OpenSilver fill?

### Draft message (Sutton)

> Hi Michael — I'm putting together OpenSilver, a MIT-licensed library of audited SilverScript covenant patterns (Ownable, MultiSig, TimeLock, Vault, Escrow, Streaming, Vesting, HTLC, KRC-20 reference impls, plus ZK-aware patterns building on Saefstroem's Groth16 work). The thesis is direct from your security-by-construction post: ship the secure defaults so devs don't accidentally deploy unsafe schemes.
>
> Before writing a line of pattern code I want to make sure this is additive to what you and the team have planned, not duplicative. `covenants/sdk` looks like the current best reference — is OpenSilver something you'd want as the dependency layer above it, or does core already plan to ship this? Either way I'd like your steer on what would actually be useful.

### Draft message (Newman)

> Hi Ori — I'm starting OpenSilver, a battle-tested SilverScript covenant pattern library (OpenZeppelin/CashScript-stdlib equivalent for Kaspa). I want to make sure it evolves in lockstep with the compiler rather than against it. Open to a quick async sync on language surface stability, what's planned vs. what's open for community to fill, and whether you'd be willing to review the pattern set before we publish.

## 0.3 — Findings (live)

- **Already covered in upstream (current best reference):**
  - Four state-transition builtins in `std/builtins.sil` (`validateOutputState`, `validateOutputStateWithTemplate`, `readInputState`, `readInputStateWithTemplate`). These are the **entire** stateful covenant surface and every OpenSilver pattern compiles to them. See `LANGUAGE_DEEP_DIVE.md`.
  - Working but minimal example contracts in `tests/examples/`: 2-of-3 MultiSig, TransferWithTimeout, HodlVault, covenant Escrow, LastWill, Mecenas, KCC20 + KCC20 Minter. These map cleanly onto Phase 3 patterns 3.2, 3.3, 3.5, 3.7, 3.9, and Phase 4 pattern 4.1.
- **Confirmed gaps OpenSilver fills (preliminary, awaiting Sutton/Newman confirmation):**
  - No N-of-M MultiSig with key rotation (upstream has fixed `pk1, pk2, pk3`).
  - No Vault composition (Ownable + TimeLock + MultiSig).
  - No milestone Escrow (only bilateral arbiter release).
  - No Vesting / Social Recovery / HTLC / Streaming-with-cancel patterns.
  - No KRC-20 variants beyond reference (Pausable, Capped, Snapshot).
  - No ZK-aware patterns yet (Phase 5 — Saefstroem PR not merged at clone time).
  - No SDK / TS glue for any pattern.
  - No `audit_covenant` / `check_kip20_compliance` tooling.
- **Confirmed overlaps + how handled:** none yet. KCC20 reference in upstream will be *the* reference impl; our 4.1 will be a documented, tested, SDK-wrapped re-export, not a fork.
- **Letters of support / no-objection:** none yet. Outreach not sent (blocker: outreach happens via X/Discord/GitHub from the user's account, not from this session).

## 0.4 — Recon docs in repo (Phase 1 outputs drafted in parallel — non-pattern code, permitted under hard gate)

- `LANGUAGE_DEEP_DIVE.md` — SilverScript surface as observed at `2c46231`.
- `KIP_REFERENCE.md` — what we need to extract from each KIP, reading order.
- `PATTERN_MAPPING.md` — upstream examples × neighbouring ecosystems × OpenSilver V1 catalogue.

## Exit criteria for Phase 0

- [ ] Reading list complete (all upstream sources read, notes captured)
- [ ] Outreach sent to all six contacts
- [ ] At least one acknowledgment from Sutton OR Newman recorded here
- [ ] Findings section populated
- [ ] Phase 1 reconnaissance docs (`KIP_REFERENCE.md`, `PATTERN_MAPPING.md`, language deep-dive) drafted
