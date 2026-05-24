# Private Asset Transfer — Pattern 5.2

Status: **v1 SCAFFOLDED + RUNTIME-VERIFIED (local patch lane, covenant-side only)**. Contract at `contracts/zk/private-asset-transfer.sil` compiles via `npm run patch:silverc:zk`. Three runtime tests in `runtime-tests/tests/zk_runtime.rs`:

- `private_asset_transfer_accepts_valid_proof_with_pinned_outputs` — fixture's `publicInputs[0]` is set as the deploy-time `commitment_root`; the contract verifies the proof, then pins `tx.outputs[0]` to `(amount, P2PK(publicInputs[2]))`. Engine accepts.
- `private_asset_transfer_rejects_wrong_commitment_root` — same fixture but the contract is deployed with a DIFFERENT `commitment_root`. The `require(pi_commitment_root == commitment_root)` gate fires before proof verification.
- `private_asset_transfer_rejects_payout_to_wrong_recipient` — valid proof, matching commitment_root, but the output routes to a different recipient than `pi_recipient`. The `requirePayoutToPiRecipient` gate fires.

**v1 honestly-documented limitations (the circuit half is missing):**

1. **No on-chain nullifier accumulator.** Real production needs a stateful continuation tracking spent nullifiers. v1 leaves this to the deploy lifecycle (single-use per deployment, commitment_root baked at deploy). A future v2 should add a `nullifier_root` state field updated via singleton transition, with the proof attesting `new_root = insert(old_root, nullifier)`.
2. **No amount extraction from public inputs.** Amount is also deploy-time state. Real circuits would bind amount into a dedicated public-input slot — that requires per-circuit Fr ↔ i64 codecs which are circuit-specific.
3. **The fixture's `publicInputs[2]` is a BN254 field element, not a real secp256k1 x-only point.** The engine compares scriptPubKey bytes verbatim, so an "invalid pubkey" still produces a deterministic P2PK shape that matches on both sides. A real circuit would gate `pi_recipient` on x-only-point validity inside the circuit.
4. **No selective-disclosure guarantees beyond what the circuit attests.** This contract is a verifier; it cannot make guarantees about properties the prover's circuit does not encode. Threat model assessment must include the circuit, not just the covenant.

The runtime tests prove **the covenant boundary is wired correctly against the standard Groth16 verifier surface**. They do NOT prove the circuit half does anything meaningful — that's the circuit author's responsibility, and depends on the specific commitment scheme + nullifier derivation chosen for a deployment.

## Summary

A covenant that hides the transfer amount and the recipient identity behind a commitment, releasing funds only on a Groth16 proof attesting that the commitment opens to a valid transfer. Foundation for confidential payments and the bridge target for vProgs-style sovereignty (where state lives in a vProg rollup and L1 verifies one summary proof per batch).

This is the most architecturally ambitious Phase 5 pattern. It composes:
- A pre-image commitment scheme (Pedersen, MiMC, or Poseidon, parameterised at deploy time).
- A Groth16 verification asserting "the spender knows the commitment opening *and* the opening describes a valid transfer to a known recipient set."
- A nullifier set committed in covenant state to prevent double-spend.

## State layout

```
verifyingKey       : byte[]    // uncompressed ark-groth16 VK
commitment_root    : byte[32]  // merkle root of valid transfer commitments
nullifier_root     : byte[32]  // accumulator of spent commitments
n_public_inputs    : int       // committed at deploy
```

## Architectural sketch

```
                ┌──────────────────────────────────────┐
                │ off-chain: prover                    │
                │  - knows commitment preimage         │
                │  - knows merkle path → commitment_root│
                │  - knows recipient pubkey            │
                │  - builds Groth16 proof attesting:   │
                │    1. (preimage, path) is in tree    │
                │    2. nullifier = H(preimage)        │
                │    3. amount + recipient pin output  │
                └──────────────┬───────────────────────┘
                               │ proof + public_inputs
                               ▼
   ┌─────────────────────────────────────────────────────────┐
   │ on-chain spend                                          │
   │  - covenant.verify_and_spend(proof, public_inputs)      │
   │  - OpZkPrecompile(0x20, VK, proof, n_inputs, inputs)    │
   │  - new state.nullifier_root = inserted nullifier        │
   │  - tx.outputs[0] = recipient P2PK pinned via            │
   │    public_inputs[recipient_pubkey_slot]                 │
   └─────────────────────────────────────────────────────────┘
```

The covenant's continuation singleton updates `nullifier_root` so the same commitment cannot be spent twice. The new root is bound into the next-state hash and validated via `validateOutputState`.

## Public inputs schema (one canonical layout per circuit)

```
public_inputs[0]: commitment_root    // must equal contract state
public_inputs[1]: new_nullifier_root // must equal continuation state
public_inputs[2]: recipient_pubkey   // pins tx.outputs[0].scriptPubKey
public_inputs[3]: amount             // pins tx.outputs[0].value
```

The four-slot layout pins every consensus-relevant variable to a value the prover commits to. None of these can be set by the spender independently — the proof binds all four to a single circuit execution.

## Security considerations

- **Nullifier accumulator must be append-only.** The continuation state's `nullifier_root` must derive from `prev_state.nullifier_root` via the proof's nullifier insertion. The contract cannot validate this directly — the circuit must include the old root as a public input and prove `new_root = insert(old_root, nullifier)`.
- **Commitment root rotation is admin-gated.** Adding new valid commitments to the tree requires updating `commitment_root`. This is an admin path separate from the spend path — same shape as KCC20Ownable but on the commitment root rather than the admin pubkey.
- **Amount is in the clear in tx outputs, but the link from amount → spender is hidden by the proof.** This is "selective disclosure" privacy, not "Zcash-level" privacy. The pattern docs MUST clarify this — it's a meaningful threat-model boundary.

## Pricing model

Per KIP-16 §4, the pricing model for `OpZkPrecompile` is deferred to a future KIP. The fixed Groth16 cost (`Gram(140 * 1000)` = ~3 verifications/block at mainnet compute-mass) is the current estimate but may shift. Pattern 5.2 docs must warn that pricing is unstable and re-benchmark on every silverscript-lang / rusty-kaspa upgrade.

## When to use

- Confidential transfers within a closed merchant network.
- vProgs L2 → L1 settlement: a rollup proves a batch of confidential transfers, settles to L1 in one proof.
- Sealed-bid auctions where bid amount + bidder identity must stay hidden until reveal.

## WHEN NOT TO USE THIS

- Do not use this for any production deployment until `kaspanet/rusty-kaspa#775` clears its `TODO(covpp-mainnet)` audit-pending marker.
- Do not use this when transfer amounts must be observable on-chain — the pattern hides the link, not the amount.
- Do not use this when the nullifier scheme is not auditable by an honest validator. Custom commitment schemes need their own security audit before going live.
- Do not use this until you have a deployed, tested Groth16 prover for the specific circuit. The circuit IS the pattern — without a working prover, the deployed covenant is just a verifier without anything to verify.
- Do not use this until the silverscript-lang `OpZkPrecompile` builtin lands and the SDK ships `sdk/zk/groth16.ts` with stack-order safety.

## Audit status

Not implemented. Design-only. Critical dependency on circuit correctness; the covenant by itself is a thin verifier.
