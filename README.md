# OpenSilver

The OpenZeppelin of Kaspa. A battle-tested library of standard covenant patterns for SilverScript.

MIT licensed. Public from first commit. Currently in **Phase 0 — Ecosystem Coordination**.

See `PLAN.md` for the full implementation framework. See `ECOSYSTEM_COORDINATION.md` for live status of community outreach (Phase 0 is a hard gate — no pattern code is written until coordination is documented).

## Guiding Principles

1. **Security-by-construction.** Per Michael Sutton: "making it easy to write covenants that correctly validate state transitions and making it difficult to accidentally deploy insecure schemes."
2. **KIP-20 Covenant IDs** are the foundation for every stateful pattern. Recursive lineage proofs are an anti-pattern.
3. **Coordinate, do not compete.** SilverScript Studio, KaspaCom Wallet, kaspacom-defi-mcp are partners.
4. **Every pattern documents its failure modes.** Every doc has a "WHEN NOT TO USE THIS" section.
5. **No marketing claims without audit.** "Battle-tested" requires external audit or 30 days of mainnet usage with no critical findings.

## Status

Phase 0 — Ecosystem Coordination — IN PROGRESS

Reading-list reconnaissance is largely complete and pushed; the remaining work in Phase 0 is **outreach to Michael Sutton and Ori Newman** (drafts in `ECOSYSTEM_COORDINATION.md`) plus a final forward-compat pass on vProgs / KIP-16 implementation notes. One acknowledgement clears the gate to Phase 2.

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
| `upstream/silverscript/` | Pinned clone of `kaspanet/silverscript` at `2c46231` (gitignored). |
| `upstream/kips/` | Pinned clone of `kaspanet/kips` (gitignored). |

## Pattern catalogue (target — none built yet)

22 patterns across three groups, all gated on Phase 0 closing:

- **Phase 3 — Core (12):** Ownable, MultiSig, TimeLock, Vault, Escrow (bilateral), Escrow (milestone), Streaming Payment, Vesting, Dead Man's Switch, Social Recovery, Atomic Swap (HTLC), Freelance/Payroll.
- **Phase 4 — KRC-20 (6):** Reference, Ownable, Pausable, Capped, Vesting, Snapshot.
- **Phase 5 — ZK-aware (4):** Verified Computation, Private Asset Transfer, ZK-Verified Oracle, Proof-Stitched Multi-Pattern.

## Toolchain

`cargo test -p silverscript-lang` runs **466 tests across 21 suites with 0 failures** at the pinned upstream commit. See `STATUS.md`.
