# ZK-aware patterns (Phase 5)

Four patterns gated on KIP-16 (`OpZkPrecompile`, opcode `0xa6`). Implementation guidance and the verifier-side stack shape for both supported precompiles (Groth16 tag `0x20`, RISC0-Succinct tag `0x21`) live in `references/kips/SUMMARY.md`.

| Slot | Pattern | Precompile | Status |
| --- | --- | --- | --- |
| 5.1 | Verified Computation | Groth16 (0x20) | Design only — blocked on silverscript-lang exposing `OpZkPrecompile` |
| 5.2 | Private Asset Transfer | Groth16 (0x20) + commitment hiding | Design only |
| 5.3 | ZK-Verified Oracle | Groth16 (0x20) + `checkDataSig` fallback | Design only |
| 5.4 | Proof-Stitched Multi-Pattern | Groth16 (0x20) + KIP-20 covenant context | Design only |

## Why no compiled scaffolds yet

`silverscript-lang` at the pinned commit `2c46231` does **not** expose `OpZkPrecompile` as a callable builtin. The opcode is fully implemented and audited on the engine side via `kaspanet/rusty-kaspa#775` (merged 2026-02-05), and `vm.flags.covenants_enabled` activates it on TN12. But the SilverScript front-end has no `OpZkPrecompile(...)` builtin yet, so we can't emit a working `.sil` source for any of the four patterns at this commit.

Three paths to unblock:

1. **Land an upstream patch** in `kaspanet/silverscript` adding the `OpZkPrecompile` builtin to `silverscript-lang::std::builtins.sil` with the canonical stack shape Saefstroem's verifier consumes (uncompressed VK, compressed proof, `n_inputs: i32`, then n public inputs). This is a roughly one-screen change to the compiler. OpenSilver should contribute it.
2. **Drop to raw script post-processing** — have the OpenSilver compile pipeline call `silverc` to produce the base redeem script, then splice the `OpZkPrecompile` opcode in at a designated insertion point. Brittle; works as a stopgap.
3. **Wait** — silverscript-lang is under active development. The builtin may land before Toccata activation. Worth a tracking question to Newman in outreach.

The design docs in this directory pin down every other architectural choice (proof shape, verifying-key sourcing, covenant-id binding, security invariants) so the moment the builtin lands, the contract sources can be written from these docs without re-deriving anything.

## Security-by-construction rules carried into every Phase 5 pattern

Lifted from `references/kips/SUMMARY.md` and `KIP_REFERENCE.md`:

1. **Verifying key and image ID come from contract state**, not caller witness. Same trusted-source-only rule as `expectedTemplateHash` in `validateOutputStateWithTemplate`.
2. **Tag costs are fixed and hardcoded**. `estimate_costs` MCP tool (Phase 7) reads from the `tags.rs` constants:
   - Groth16: `Gram(140 * 1000)` script units → 3 verifications per block at mainnet compute-mass.
   - RISC0-Succinct: `Gram(250 * 1000)` script units → 2 verifications per block.
3. **Errors are stringified.** Both precompiles surface failure as one `TxScriptError::ZkIntegrity(String)` variant — pattern code cannot discriminate "proof failed" from "proof malformed". WHEN NOT TO USE THIS sections must call this out.
4. **TODO(covpp-mainnet) until further notice.** Both precompiles' reference implementations carry "not yet fully audited for mainnet use" comments. Phase 5 patterns are TN12-only by default until those comments come off; Phase 10.3 bug-bounty must explicitly cover precompile-derived findings.
5. **vProgs is NOT a substitute.** `kaspanet/vprogs` has its own RISC0 zkVM but operates as a separate execution layer that consumes L1 via wRPC. Phase 5 patterns target on-chain L1 verification via `OpZkPrecompile`; they are not vProgs-aware in V1.

## SDK glue (Phase 7 dependency)

The `sdk/zk/groth16.ts` module owns the canonical stack-order builder. Pattern authors **must not** push verifier args directly — the helper enforces the order that matches `Groth16Precompile::verify_zk` (uncompressed VK at the top, then compressed proof, then `n_inputs`, then n public inputs in reverse). This eliminates the most likely Phase-5 footgun.

Shape (intended):

```ts
function buildGroth16Witness(opts: {
  verifyingKey: Uint8Array;        // uncompressed ark-groth16 VK
  proof: Uint8Array;               // compressed
  publicInputs: Uint8Array[];      // each is an Fr (compressed)
  // The helper validates publicInputs.length == vk's expected input count
  // (pulled from the deserialized VK) before returning the witness array.
}): Uint8Array[]
```

To be implemented as part of the Phase 5 build-out, once at least one pattern has a compiled `.sil` to feed it into.
