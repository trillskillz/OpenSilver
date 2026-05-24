# Token patterns (Phase 4)

Six patterns. The headline architectural rule, lifted from the upstream KCC20 book and captured in `docs/standards/KCC20.md`: **the asset contract and the issuance-policy controller are separate covenants**. The asset contract (4.1) is shared across every variant; the variants (4.2-4.6) implement different controller covenants that bind to the asset via covenant-id ownership.

| Slot | Pattern | Asset contract | Controller covenant | Status |
| --- | --- | --- | --- | --- |
| 4.1 | KCC20 reference | `contracts/tokens/kcc20.sil` | (controller is pluggable) | Scaffolded; compile-validated |
| 4.2 | KCC20Ownable | (4.1 reused) | TODO `contracts/tokens/kcc20-ownable.sil` | Stub doc only |
| 4.3 | KCC20Pausable | (4.1 reused) | TODO `contracts/tokens/kcc20-pausable.sil` | Stub doc only |
| 4.4 | KCC20Capped | (4.1 reused) | TODO `contracts/tokens/kcc20-capped.sil` | Stub doc only |
| 4.5 | KCC20Vesting | (4.1 reused) | TODO `contracts/tokens/kcc20-vesting.sil` | Stub doc only |
| 4.6 | KCC20Snapshot | (touches the asset; deferred to KIP-21 lane stability) | — | Stub doc only |

The asset contract is stable across 4.2-4.5; the only difference between those variants is the controller covenant they bind to. The repo now also has SDK glue in `sdk/src/index.ts` for selecting controller paths, normalizing controller state, building constructor args, planning the three-phase KCC20 lifecycle, describing the concrete transaction shapes for controller genesis/asset genesis/mint flows, and emitting compile/deploy spec bundles against the pinned `silverc` binary.

## Why this architecture matters

A naive approach would bake the issuance policy into the asset contract: ERC20Capped, ERC20Pausable, ERC20Vesting all *replace* the base ERC20. That works in Solidity because contracts inherit, but it forces every token to recompile its asset bytecode per variant.

KCC20's controller-covenant split lets a single deployed KCC20 asset bind to *any* controller — including one that swaps out mid-lifecycle (e.g. start Capped, then transition to Pausable for a maintenance window). The covenant-id binding gives the asset a stable identity that survives controller changes, which is meaningfully more expressive than ERC20's monolithic bytecode.

See `docs/standards/KCC20.md` for the three-phase genesis lifecycle and the security checklist all 4.x variants must satisfy.
