# `contracts/zk/` — Phase 5 patterns

**No SilverScript sources yet** for the four Phase 5 patterns. Design pinned down in `docs/patterns/zk/`. Compilation blocked on silverscript-lang exposing `OpZkPrecompile` as a builtin (KIP-16 opcode `0xa6`, fully implemented in `kaspanet/rusty-kaspa#775` but not yet wired into the SilverScript front-end at the pinned commit `2c46231`).

When the builtin lands, sources will be added here:

- `verified-computation.sil` (5.1)
- `private-asset-transfer.sil` (5.2)
- `zk-verified-oracle.sil` (5.3)
- `proof-stitched-multi-pattern.sil` (5.4)

Each design doc in `docs/patterns/zk/` carries an "Intended `.sil` shape (compile-blocked)" section with the policy code ready to drop in once the builtin is available.
