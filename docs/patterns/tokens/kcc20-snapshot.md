# KCC20Snapshot — governance-snapshot asset (Pattern 4.6)

Status: STUB. **Deferred until KIP-21 `OpChainblockSeqCommit` lane stability lands.**

## Summary

Unlike Patterns 4.2-4.5 which add controller covenants on top of the unchanged 4.1 asset, KCC20Snapshot *touches the asset contract itself* — it adds a per-block snapshot checkpoint field to the state layout so off-chain tools (e.g. governance voting weight lookups) can read historical balances.

## Why this is deferred

The snapshot mechanism requires reading the chain block's sequencing commitment from inside the covenant. The relevant primitive is `OpChainblockSeqCommit(block_hash)` documented in KIP-21 (`references/kips/kip-0021.md`) and used in the upstream `DECL.md` example `SeqCommitMirror`. KIP-21 is still in Draft status as of `2026-02-17`, and its lane abstraction may shift before activation.

Building KCC20Snapshot against an unstable KIP would lock OpenSilver into rework whenever KIP-21 advances. The cost of waiting is one missing variant; the cost of shipping early is potential rework across every snapshot-aware token.

## Re-evaluate when

- KIP-21 advances from Draft to Proposed (status change in `kaspanet/kips`).
- `kaspanet/research/vProgs/main.tex` ships a stable lane-id convention.
- At minimum 30 days of TN12 production usage of `OpChainblockSeqCommit` by another covenant project.

When any of these land, lift this stub into a real implementation. Until then, KCC20-based governance voting should use off-chain snapshot indexing (the wallet/MCP layer querying tx history) rather than on-chain snapshots — same approach Ethereum took before `ERC20Snapshot` shipped, and downgrading later is much cheaper than upgrading.
