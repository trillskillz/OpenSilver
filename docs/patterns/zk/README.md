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

1. **Drive / amend the upstream patch path** in `kaspanet/silverscript`. OpenSilver contributed the initial builtin-exposure PR as `kaspanet/silverscript#125`, but local prototyping found that a **0-arg builtin alone is not sufficient** in current SilverScript syntax: the parser rejects raw expression statements (`a; b; 2; proof; vk;`) that would be needed to push operands before `OpZkPrecompile()`. Generic array args are also not enough by themselves because SilverScript lowers arrays as blob data, not separate stack items. The strongest current candidate is a structured helper with custom lowering — locally prototyped as `OpGroth16Verify(vk, proof, [a, b, c, ...])` — which compiled successfully and kept upstream `examples_tests` green (`27/27`).
2. **Use the local experimental patch lane** — OpenSilver now ships `patches/silverscript-opzkprecompile.patch` plus `npm run patch:silverc:zk`, which applies the RFC patch to the pinned upstream checkout, rebuilds `silverc`, and smoke-tests both a minimal builtin-recognition contract (`require(OpZkPrecompile())`) and the structured helper shape (`OpGroth16Verify(vk, proof, [a, b, c, ...])`). Good for probing compiler behavior; still not a runtime-ready Phase-5 contract.
3. **Drop to raw script post-processing** — have the OpenSilver compile pipeline call `silverc` to produce the base redeem script, then splice the `OpZkPrecompile` opcode in at a designated insertion point. Brittle; works as a stopgap if the compiler surface remains too constrained.

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

## SDK glue (Phase 5 safety rail)

The Groth16 stack-order helper now lives in `sdk/src/index.ts` as `buildGroth16WitnessPlan()`. Pattern authors **must not** push verifier args directly — the helper fixes the canonical order that matches `Groth16Precompile::verify_zk`: push public inputs in reverse, then `n_inputs`, then compressed proof, then uncompressed verifying key, then push tag `0x20` and invoke `OpZkPrecompile()`.

Current shape:

```ts
function buildGroth16WitnessPlan(opts: {
  verifyingKey: Uint8Array;
  proof: Uint8Array;
  publicInputs: Uint8Array[];
  expectedPublicInputs?: number;
}): {
  tag: 0x20;
  pushOrder: ZkStackSlot[];       // push these, then push tag, then invoke opcode
  stackTopToBottom: ZkStackSlot[];
}
```

Current limitation: the helper validates the explicit `expectedPublicInputs` count when supplied, but does **not** yet deserialize the verifying key to derive the count automatically. That stricter VK-aware validation remains future work once the first compiled Phase-5 contract is wired end-to-end.
