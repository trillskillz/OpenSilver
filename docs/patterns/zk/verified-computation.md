# Verified Computation — Pattern 5.1

Status: DESIGN. Blocked on silverscript-lang exposing `OpZkPrecompile`. See `docs/patterns/zk/README.md` for the unblock paths.

## Summary

A covenant that releases funds only on submission of a valid Groth16 proof attesting to some off-chain computation. The simplest Phase-5 pattern and the reference for the rest: it pins down the canonical Groth16 stack-order, the contract-state vs witness split for the verifying key, and the failure-mode surface.

Modelled on the ERC-8004 Validation Registry pattern from EVM but with on-chain verification rather than registry attestation. Each deployment commits to one verifying key (one circuit) at deploy time, so the contract instance has a 1:1 relationship with a specific verified program.

## State layout

```
verifyingKey   : byte[]      // uncompressed ark-groth16 VK, fixed at deploy
recipient      : pubkey      // who collects on successful proof
prover_pk      : pubkey      // who's allowed to submit the proof
n_public_inputs: int         // committed at deploy; must match every submission
```

The verifying key is stored as a byte[] because uncompressed Groth16 VKs are variable-size depending on `n_public_inputs`. The expected size is recoverable from `n_public_inputs` via `ark-groth16`'s VK layout (`vk.gamma_abc_g1.len() == n_public_inputs + 1` so VK size scales linearly).

## Intended `.sil` shape (compile-blocked)

```sil
pragma silverscript ^0.1.0;

contract VerifiedComputation(
    byte[] init_verifying_key,
    pubkey init_recipient,
    pubkey init_prover_pk,
    int init_n_public_inputs
) {
    byte[] verifying_key = init_verifying_key;
    pubkey recipient = init_recipient;
    pubkey prover_pk = init_prover_pk;
    int n_public_inputs = init_n_public_inputs;

    function requireProver(pubkey prover, sig prover_sig) {
        require(prover == prover_pk);
        require(checkSig(prover_sig, prover));
    }

    function requireExactPayout(pubkey destination) {
        int minerFee = 1000;
        int amount = tx.inputs[this.activeInputIndex].value - minerFee;
        byte[34] destinationLock = new ScriptPubKeyP2PK(destination);
        require(tx.outputs[0].value == amount);
        require(tx.outputs[0].scriptPubKey == byte[](destinationLock));
    }

    entrypoint function verify_and_release(
        pubkey prover,
        sig prover_sig,
        byte[] proof,
        byte[] public_inputs_concat  // n_public_inputs * 32 bytes
    ) {
        requireProver(prover, prover_sig);

        // OpZkPrecompile (tag 0x20 = Groth16) consumes the canonical stack:
        //   [..., public_input_{n-1}, ..., public_input_0,
        //         n_public_inputs (i32),
        //         proof,
        //         verifying_key]
        // The helper here writes the stack in the engine's pop order.
        require(OpZkPrecompile(
            0x20,
            verifying_key,
            proof,
            n_public_inputs,
            public_inputs_concat
        ));

        requireExactPayout(recipient);
    }
}
```

The `OpZkPrecompile` line is the gated call — won't compile until the silverscript builtin lands. Everything else parses against existing primitives.

## Security considerations

- Verifying key is contract state, never witness. Same trusted-source rule as `expectedTemplateHash`. A caller cannot substitute a different circuit for the proof.
- Prover key is contract state. This adds a second authorisation layer beyond the proof itself — without the prover signature, anyone with a valid (proof, public_inputs) tuple could spend. The prover signature gates *who* can submit, the proof gates *what* they're submitting.
- Payout destination is contract state; the proof does not parameterise where funds go. If you need recipient flexibility, the recipient pubkey should be part of the public inputs and bound into the circuit.
- `OpZkPrecompile` failure surfaces as one undifferentiated `TxScriptError::ZkIntegrity(String)`. The script aborts; from the chain's perspective the spend just fails. Off-chain tooling reading mempool reject reasons sees the stringified error message but can't programmatically distinguish "proof didn't verify" from "VK couldn't deserialise".

## Cost

One Groth16 verification per spend = `Gram(140 * 1000)` script units = 1/3 of a mainnet compute-mass block. Pattern docs MUST surface this — for high-throughput use, this is meaningfully more expensive than ECDSA.

## When to use

- Off-chain computation (proof generation) where on-chain verification is the trust anchor.
- Rollup settlement: prove a batch state transition, release reward to operator.
- Optimistic-execution dispute resolution: the canonical "correct execution" proof closes a challenge.

## WHEN NOT TO USE THIS

- Do not use this for any production deployment until `kaspanet/rusty-kaspa#775` clears its `TODO(covpp-mainnet)` audit-pending marker.
- Do not use this when the verifier needs to discriminate proof-failure modes for off-chain replay or recovery — the engine surfaces one stringified error.
- Do not use this for high-throughput settings (≥4 verifications per block). Groth16 verification consumes ~1/3 of a mainnet compute-mass block; resource exhaustion is real.
- Do not use this until the silverscript-lang `OpZkPrecompile` builtin lands. Working around with raw-script splicing is brittle; document any such workaround clearly and remove it the moment the builtin is available.

## Audit status

Not implemented. Design-only.
