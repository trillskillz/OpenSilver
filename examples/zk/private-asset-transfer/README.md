# Private Asset Transfer — worked example (Pattern 5.2)

Privacy-preserving payment: spend a commitment from a deploy-time
committed tree to a recipient extracted from the proof's public
inputs, with the amount pinned at deploy. Source at
[`contracts/zk/private-asset-transfer.sil`](../../../contracts/zk/private-asset-transfer.sil),
design notes at
[`docs/patterns/zk/private-asset-transfer.md`](../../../docs/patterns/zk/private-asset-transfer.md).

Read the [ZK examples README](../README.md) for the patch-lane
prerequisite.

## Honest scope (read this first)

This is the **v1 covenant half** of a private-transfer system. The
circuit half is the deployment author's responsibility. v1
intentionally does **not** ship:

- **On-chain nullifier accumulator.** Each v1 deployment is single-use
  for one transfer (commitment_root is baked at deploy, no
  continuation). A v2 would add a `nullifier_root` state field
  updated via singleton transition, with the proof attesting
  `new_root = insert(old_root, nullifier)`.
- **Amount extraction from public inputs.** Amount is deploy-time
  state. Real circuits would bind amount into a public-input slot,
  but that requires a per-circuit Fr ↔ i64 codec with overflow
  handling — deferred to v2.
- **Selective-disclosure guarantees beyond what the circuit attests.**
  The covenant is a verifier; it cannot make guarantees about
  properties the circuit doesn't encode.

If you need any of those, this is not the pattern to deploy yet.

## What v1 *does* enforce

1. `pi[0] == commitment_root` (the deploy-time tree the proof refers to).
2. The proof verifies under the deploy-time VK.
3. `tx.outputs[0].value == amount` (deploy-time committed).
4. `tx.outputs[0].scriptPubKey == P2PK(pi[2])` (recipient extracted
   from the proof).

That's it. Everything else — that the nullifier hasn't been spent
before, that the commitment is actually in the tree, that pi[2] is a
valid x-only point — is the circuit's job.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
npm run patch:silverc:zk
```

## 1. Build the deploy plan

Constructor:

```
PrivateAssetTransfer(
  byte[]   init_verifying_key,
  byte[32] init_commitment_root,
  int      init_amount
)
```

```bash
COMMITMENT_ROOT=$(openssl rand -hex 32)     # placeholder; should come from your tree
AMOUNT=1000000                               # 0.01 KAS in sompi
VK_HEX=$(jq -r '.verifying_key' references/fixtures/groth16-opzkprecompile-fixture.json)

npx opensilver deploy-plan zk-aware.private-asset-transfer \
  --ctor "[\"$VK_HEX\", \"$COMMITMENT_ROOT\", $AMOUNT]" \
  --network kaspa:testnet-12 \
  > pat-deploy-plan.json
```

## 2. Public-input layout (per the fixture's 5 slots)

| Slot | What v1 expects | Who enforces it |
| --- | --- | --- |
| `pi[0]` commitment_root | Pinned to `commitment_root` state | Covenant |
| `pi[1]` nullifier | Proof commits to it; covenant doesn't retain | Circuit |
| `pi[2]` recipient_bytes | Pinned into `tx.outputs[0].scriptPubKey` as a P2PK lock | Covenant |
| `pi[3..4]` padding | Reserved for future circuit fields (amount, fee, expiry) | Circuit |

Note slot 2: the contract casts `pubkey(recipient_bytes)` which is a
**reinterpret**, not validation. The bytes are not required to form a
real secp256k1 x-only point — the engine compares the resulting P2PK
lock byte-for-byte against `tx.outputs[0].scriptPubKey`. If the bytes
are garbage, the output goes to a P2PK that no one can spend (funds
burned). The circuit must gate `pi_recipient` on x-only-point validity
**inside the circuit** if you want to prevent this.

## 3. The spend

Sigscript pushes `(proof, pi_commitment_root, pi_nullifier, pi_recipient, pi_padding1, pi_padding2)`.
No covenant-side signature is required — the proof + public-input
pinning is what gates the spend. This is intentional: the privacy
property "no one learns who sent the transfer" depends on the spend
not requiring a signature from the prior holder.

## 4. Verification posture

- Compile-validated: ✓ (patch lane required;
  `tests/zk-private-asset-transfer-compile.test.ts`)
- Runtime-validated: ✓ (3 cargo tests: valid + wrong commitment_root
  + wrong recipient)
- Audit-checked: ✓ (with the v1-limitations documented in
  `docs/patterns/zk/private-asset-transfer.md` "What this v1 does
  NOT do")
- External audit: **not yet**. Production circuits + nullifier
  accumulator + amount extraction are all v2+ work.

## 5. Production readiness checklist (deployment author)

Before treating any v1 instance as anything other than a *covenant
prototype*:

- [ ] Author a circuit that gates `pi[2]` on x-only-point validity.
- [ ] Add a nullifier accumulator state field (this requires v2 of
      the contract).
- [ ] Encode amount as a public input rather than deploy-time state.
- [ ] Document the full circuit threat model in your fork's
      pattern-doc — what the proof attests, what it doesn't, who can
      forge what.
- [ ] Get the *circuit* externally audited, not just the covenant.
