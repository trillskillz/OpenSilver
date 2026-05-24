# ZK-Verified Oracle — Pattern 5.3

Status: DESIGN. Blocked on silverscript-lang exposing `OpZkPrecompile`.

## Summary

An oracle covenant that accepts a price/data feed value only if it arrives with a Groth16 proof attesting to correct computation over a committed data source. Connects with TEE-secured oracle work (QUEX, Chainlink Functions, etc.) and gives the consumer covenant a single verification primitive regardless of which off-chain oracle stack produced the value.

The pattern's value is **trust minimisation on oracle data**: a covenant downstream of this oracle doesn't have to trust the oracle operator's signature alone — it sees a proof that the operator ran the canonical fetch+transform program over a committed source. This is the third leg of the "trust-minimised L1 covenant" stool: SigHash for transaction integrity, KIP-20 for state lineage, ZK proofs for off-chain data.

## State layout

```
verifyingKey      : byte[]    // uncompressed ark-groth16 VK
oracle_committee  : pubkey[N] // M-of-N committee that must co-sign the proof
threshold         : int       // M
data_commitment   : byte[32]  // commitment to the source data (e.g., merkle root of a price feed)
n_public_inputs   : int       // committed at deploy
```

## Two-tier authorisation

The proof verifies *computation correctness over a committed source*. But the proof itself doesn't authenticate *who* ran the program. Pattern 5.3 layers two checks:

1. **M-of-N committee signature** on the proof + claimed result. Inspired by HodlVault from upstream silverscript examples — the committee signs `(data_commitment, proof, claimed_result)` and the covenant checks `M` of `N` valid signatures.
2. **Groth16 proof verification** of the claimed result against the data commitment.

Either alone is insufficient: signatures alone = trust the committee; proof alone = anyone can submit. Combined: the committee gates *who can present a result*, the proof gates *whether the result is correct*.

## Intended `.sil` shape (compile-blocked)

```sil
contract ZkVerifiedOracle(
    byte[] init_verifying_key,
    int init_n_public_inputs,
    byte[32] init_data_commitment,
    int init_threshold,
    pubkey init_committee_1,
    pubkey init_committee_2,
    pubkey init_committee_3,
    pubkey init_consumer_covenant_id  // covenant ID this oracle feeds
) {
    // ... state declarations ...

    entrypoint function publish(
        pubkey signer1, sig sig1,
        pubkey signer2, sig sig2,
        pubkey signer3, sig sig3,
        byte[] proof,
        byte[] public_inputs_concat,
        byte[32] claimed_result
    ) {
        // 1. Committee threshold check (HodlVault-style).
        require(distinctSigners(signer1, signer2, signer3));
        require(approvalCount(...) >= threshold);

        // 2. Groth16 verification.
        // public_inputs layout: [data_commitment, claimed_result, ...domain-specific]
        require(OpZkPrecompile(
            0x20,
            verifying_key,
            proof,
            n_public_inputs,
            public_inputs_concat
        ));

        // 3. Tie the result to the consumer covenant's output.
        // (Either continuation singleton that writes claimed_result into
        //  oracle state, or auth-output-bound write to the consumer's
        //  expected output index. Pattern doc covers both shapes.)
        validateOutputStateWithTemplate(
            0, { result: claimed_result, ... },
            consumer_prefix, consumer_suffix, consumer_template_hash
        );
    }
}
```

## Composability with KCC20Vesting / VerifiedComputation / FreelancePayroll

Three composition stories the pattern docs should illustrate:

1. **Vesting + Oracle**: KCC20Vesting controller uses the oracle's published price to gate the release per period (release only if `tx.time > cliff` AND `oracle.price >= unlock_strike`).
2. **VerifiedComputation chaining**: Pattern 5.1's prover input is itself the oracle's claimed_result, so the prover's circuit verifies "given price P from the oracle, here's the off-chain computation that fires the trigger."
3. **FreelancePayroll arbitration**: The arbiter slot is replaced by a ZK-verified oracle output, e.g. "if the delivery API returned a 200 with the expected hash, release to worker."

## Security considerations

- **Committee thresholds and threat models.** M-of-N with M=2 and N=3 is sufficient when one committee member compromise is the threat. Tightening to M=3/N=5 multiplies cost (5 sig slots in the entrypoint signature) but tolerates two compromises. Pattern doc should give concrete recommendations per threat tier.
- **Data commitment must rotate.** A static `data_commitment` means the oracle is publishing summary attestations over the same source forever. Real oracles need a rotation path (admin-gated singleton transition flipping `data_commitment` per epoch).
- **The proof binds (data_commitment, claimed_result) to a circuit execution; it does NOT bind a timestamp.** If your downstream covenant needs freshness, the oracle's continuation state needs a `last_published_blue_score` or similar, and the consumer covenant must check freshness via `tx.time` or KIP-21 sequencing commitments.
- **`checkDataSig` fallback path.** If the proof verification fails (e.g. due to a precompile bug post-activation), the oracle should NOT silently fall back to signature-only — that erases the trust-minimisation property. Any fallback must be opt-in by the consumer covenant and clearly labeled in the consumer's "WHEN NOT TO USE THIS" docs.

## When to use

- Cross-chain bridges where one side is Kaspa and the source-of-truth is another chain's state.
- DeFi protocols that need price oracles with stronger guarantees than committee signatures alone.
- Identity attestations where a TEE-protected service vouches for an off-chain credential.

## WHEN NOT TO USE THIS

- Do not use this for any production deployment until `kaspanet/rusty-kaspa#775` clears its `TODO(covpp-mainnet)` audit-pending marker.
- Do not use this without a documented data-commitment rotation policy. A frozen-forever commitment turns the oracle into a stale-data feed.
- Do not use this when freshness alone matters — if you only need timeliness, a simple `checkDataSig` oracle is cheaper.
- Do not use this when the oracle committee is the same trust set as the downstream consumer's admin. That defeats the trust-minimisation goal.

## Audit status

Not implemented. Design-only.
