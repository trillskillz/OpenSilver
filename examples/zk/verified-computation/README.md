# Verified Computation — worked example (Pattern 5.1)

The reference ZK pattern: pay the recipient if a designated prover
submits a valid Groth16 proof for a known circuit. Source at
[`contracts/zk/verified-computation.sil`](../../../contracts/zk/verified-computation.sil),
design notes at
[`docs/patterns/zk/verified-computation.md`](../../../docs/patterns/zk/verified-computation.md).

Read the [ZK examples README](../README.md) for the patch-lane
prerequisite before this walkthrough.

## What's deploy-time vs witness-supplied

| Field | Where it lives | Why |
| --- | --- | --- |
| `verifying_key` | Contract state (`init_verifying_key`) | A caller cannot swap circuits at spend time |
| `recipient` | Contract state (`init_recipient`) | Payout destination is committed; the proof cannot redirect it |
| `prover` | Contract state (`init_prover`) | Only the designated prover may submit; closes open-redeem hole |
| `proof` | Witness (sigscript arg) | Per-spend payload |
| `pi0..pi4` | Witness (sigscript args) | Public inputs to the circuit |

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
npm run patch:silverc:zk        # critical — see ZK examples README
```

## 1. Build the deploy plan

Constructor:

```
VerifiedComputation(
  byte[]  init_verifying_key,    // serialised Groth16 VK (BN254)
  pubkey  init_recipient,
  pubkey  init_prover
)
```

The VK encoding is the same byte format the engine's `Groth16Precompile`
expects — that's the wire format produced by arkworks' serialisation
of `ark_groth16::VerifyingKey<Bn254>`. See
`references/fixtures/groth16-opzkprecompile-fixture.json` for the
canonical example bytes used by the runtime tests.

```bash
RECIPIENT=02$(openssl rand -hex 31)
PROVER=02$(openssl rand -hex 31)
# Use a hex-encoded real VK from your circuit. The example below uses
# the fixture VK trimmed to a placeholder — DO NOT deploy this in
# production; it's only enough bytes to pass the compile-shape probe.
VK_HEX=$(jq -r '.verifying_key' references/fixtures/groth16-opzkprecompile-fixture.json)

npx opensilver deploy-plan zk-aware.verified-computation \
  --ctor "[\"$VK_HEX\", \"$RECIPIENT\", \"$PROVER\"]" \
  --network kaspa:testnet-12 \
  > vc-deploy-plan.json
```

The plan will carry `compiler.requiresPatchedSilverc: true`. Your
wallet integration should check that flag and refuse if the patch
hasn't been applied.

## 2. The spend

Sigscript pushes `(prover_pk, prover_sig, proof, pi0, pi1, pi2, pi3, pi4)`.
The covenant:

1. Verifies `prover_pk == prev_state.prover` and `checkSig(prover_sig)`.
2. Runs `OpGroth16Verify(verifying_key, proof, [pi0..pi4])`.
3. Pays the input value minus 1000 sompi to a P2PK on `recipient`.

If any of those fail, the script aborts with
`TxScriptError::ZkIntegrity(String)` — the engine does not
discriminate "proof failed" from "operand deserialise failed."
Wallets surfacing the failure should display the full engine error,
not a custom interpretation.

## 3. Public-input layout (N = 5)

The contract is hard-coded to 5 public-input slots because
SilverScript's `byte[32][N]` is fixed-size. The runtime tests use 5 to
match the vendored fixture. **If your circuit has a different N,
recompile a sibling contract with the correct slot count** — there's
no runtime knob.

The "what each pi slot means" question is **circuit-side**:

- `pi0..pi4` are just 32-byte field elements at the covenant layer.
- The mapping from slots to semantic values (commitment_root,
  amount, recipient, nonce, …) lives in the prover's R1CS.
- Document your slot layout in the deployment's README so verifiers
  can reproduce it.

## 4. Why the prover signature is also state

Without `requireProver(...)`, anyone holding a valid `(proof,
public_inputs)` tuple could spend the covenant. For some use cases
that's intentional (open-redeem proofs, public bounties); for the
canonical reference we keep both layers (proof attests *what was
computed*, signature attests *who is submitting*).

If you genuinely want open-redeem semantics, fork the contract,
remove `requireProver`, and document it in your fork's "WHEN NOT TO
USE THIS" — the open-redeem variant has a meaningfully different
threat model.

## 5. Verification posture

- Compile-validated: ✓ (patch lane required;
  `tests/zk-verified-computation-compile.test.ts`)
- Runtime-validated: ✓ (3 cargo tests in
  `runtime-tests/tests/zk_runtime.rs` — positive, tampered-proof,
  wrong-prover)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
- External audit: **not yet**. TN12-only until the engine-side
  `TODO(covpp-mainnet)` marker on `Groth16Precompile::verify_zk`
  clears.
