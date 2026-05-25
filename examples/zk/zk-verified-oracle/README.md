# ZK-Verified Oracle — worked example (Pattern 5.3)

Two-tier authorisation: M-of-3 guardian committee *and* a Groth16
proof of correct computation. Source at
[`contracts/zk/zk-verified-oracle.sil`](../../../contracts/zk/zk-verified-oracle.sil),
design notes at
[`docs/patterns/zk/zk-verified-oracle.md`](../../../docs/patterns/zk/zk-verified-oracle.md).

Read the [ZK examples README](../README.md) for the patch-lane
prerequisite.

## Why two tiers

A pure-signature oracle trusts the committee on data correctness.
A pure-proof oracle trusts whoever can produce a valid `(proof,
public_inputs)` tuple to be authorised. Neither alone is enough for
"trust-minimised on **what** is published AND **who** publishes":

- **Proof alone** — anyone with the right inputs could spend. Useful
  for open-redeem patterns but wrong for an oracle where you want a
  known publish authority.
- **Signatures alone** — collusion among `threshold` guardians lets
  them publish garbage data with the right signatures. The proof
  closes that hole by binding the published value to a verifiable
  computation.

Combined: the committee attests *who is allowed to publish*, the
proof attests *what they're publishing is sound*.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
npm run patch:silverc:zk
```

## 1. Build the deploy plan

Constructor:

```
ZkVerifiedOracle(
  byte[]  init_verifying_key,
  pubkey  init_recipient,
  int     init_threshold,         // 1..3
  pubkey  init_guardian1,
  pubkey  init_guardian2,
  pubkey  init_guardian3
)
```

```bash
RECIPIENT=02$(openssl rand -hex 31)
G1=02$(openssl rand -hex 31)
G2=02$(openssl rand -hex 31)
G3=02$(openssl rand -hex 31)
VK_HEX=$(jq -r '.verifying_key' references/fixtures/groth16-opzkprecompile-fixture.json)

npx opensilver deploy-plan zk-aware.zk-verified-oracle \
  --ctor "[\"$VK_HEX\", \"$RECIPIENT\", 2, \"$G1\", \"$G2\", \"$G3\"]" \
  --network kaspa:testnet-12 \
  > oracle-deploy-plan.json
```

## 2. The `publish` entrypoint

Single entrypoint, multi-witness:

```
publish(
  pubkey signer1, sig sig1,
  pubkey signer2, sig sig2,
  pubkey signer3, sig sig3,
  byte[] proof,
  byte[32] pi0, byte[32] pi1, byte[32] pi2, byte[32] pi3, byte[32] pi4
)
```

Sigscript pushes three (pubkey, sig) pairs plus the proof + 5 public
inputs. The covenant verifies, in order:

1. `requireValidConfiguration` — threshold in 1..3, guardians distinct.
2. `distinctSigners(signer1, signer2, signer3)` — caller can't double-count.
3. `approvalCount >= threshold` — quorum check.
4. `OpGroth16Verify(verifying_key, proof, [pi0..pi4])` — proof check.
5. `requireExactPayout(recipient)` — terminal payout to the configured recipient.

If any of those fail, the script aborts. The order matters for
**which** failure surfaces — wallets surfacing errors should test the
proof side last because it's the most expensive.

## 3. What v1 doesn't do (cross-contract output binding)

The full Pattern 5.3 design (see
`docs/patterns/zk/zk-verified-oracle.md`) ties the oracle's published
value to a **consumer covenant** input via
`validateOutputStateWithTemplate`. v1 emits a simple terminal payout
to a recipient; the consumer-covenant wiring is a follow-up wrapper
that pairs the oracle with a concrete downstream consumer (e.g. a
Freelance / Payroll covenant gated on an oracle-published score).

If you need cross-contract binding now, build it as a v2 oracle paired
with your specific consumer — the validateOutputStateWithTemplate
shape is already exercised in the KCC20 family
(`contracts/tokens/kcc20-*.sil`) and you can copy that idiom.

## 4. Picking the threshold

- `1-of-3` — fastest publish; any guardian can act unilaterally. Use
  when guardians are mutually trusting and you optimise for liveness.
- `2-of-3` — balanced. Tolerates one offline / compromised guardian.
- `3-of-3` — slowest but strongest. Use when even one compromised
  guardian would be a meaningful loss.

Note that **threshold is deploy-time and never rotates in v1**. If you
need rotation, layer with KCC20Ownable's admin-rotation idea (a
future combined pattern).

## 5. Verification posture

- Compile-validated: ✓ (patch lane required;
  `tests/zk-verified-oracle-compile.test.ts`)
- Runtime-validated: ✓ (3 cargo tests: 2-of-3 + Groth16 OK,
  1-of-3 below threshold rejected, 2-of-3 with tampered proof
  rejected)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
- External audit: **not yet**.
