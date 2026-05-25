# Oracle Consumer — worked example

Companion to [ZK-Verified Oracle v2](../zk-verified-oracle-v2/README.md).
A minimal singleton whose only state is `(published_value, recipient)`,
created by the v2 oracle's publish transaction and redeemed by the
recipient via `release`. Source at
[`contracts/zk/oracle-consumer.sil`](../../../contracts/zk/oracle-consumer.sil),
design notes at
[`docs/patterns/zk/oracle-consumer.md`](../../../docs/patterns/zk/oracle-consumer.md).

## Status

Compile-validated and runtime-verified indirectly through the v2
oracle binding test: the publish transaction creates the consumer
UTXO via `validateOutputStateWithTemplate`, which is what
`zk_verified_oracle_v2_accepts_publish_with_correct_binding` covers
end-to-end.

## What this consumer is for

The consumer UTXO is **created by the oracle's publish transaction**.
Its first state is whatever the oracle bound at publication time:

```
published_value : byte[32]    // pi[0] from the proven public inputs
recipient       : pubkey       // the oracle's deploy-time consumer_recipient
```

The consumer's `release` entrypoint is a simple P2PK redemption — the
recipient signs and the funds leave. This is the minimal shipping
shape.

The interesting use cases substitute `release` for value-aware logic:

| Variant | release-body change |
| --- | --- |
| Equality gate | `require(published_value == expected_value);` then payout |
| Threshold gate | `int score = bytesToInt(published_value); require(score >= threshold);` then payout |
| Routing | `if (published_value[0] == 0x01) requireExactPayout(recipient_a); else requireExactPayout(recipient_b);` |

None of these variants ship in v1 — they are intentionally left to
downstream forks.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

OracleConsumer has **no** ZK primitives. The vanilla pinned silverc
compiles it. The v2 oracle that creates the consumer UTXO does need
the patch lane, but the consumer itself does not.

## 1. Build the deploy plan

You don't typically deploy OracleConsumer directly — its first UTXO
is created by the v2 oracle's publish transaction. For the
template-binding ctor extraction step in the v2 oracle deploy,
though, you do compile OracleConsumer:

```
OracleConsumer(
  byte[32] init_published_value,
  pubkey   init_recipient
)
```

```bash
RECIPIENT=02$(openssl rand -hex 31)
PLACEHOLDER_VALUE=00$(printf '00%.0s' {1..31})    # 32-byte placeholder

npx opensilver deploy-plan zk-aware.oracle-consumer \
  --ctor "[\"$PLACEHOLDER_VALUE\", \"$RECIPIENT\"]" \
  --network kaspa:testnet-12 \
  > consumer-deploy-plan.json
```

The plan's `compiled.scriptHex` is what the v2 oracle's
`buildOracleConsumerTemplate` helper inspects to derive the
prefix/suffix/hash.

## 2. The redeem transaction

After the oracle has published and the consumer UTXO exists with the
real published value baked in, the recipient redeems it:

Sigscript pushes `(recipient_pk, recipient_sig)`. The covenant:

1. Verifies `recipient_pk == prev_state.recipient`.
2. Verifies `checkSig(recipient_sig, recipient_pk)`.
3. Pays the input value minus 1000 sompi to a P2PK on the recipient.

The `published_value` is NOT consumed by `release` — it's just sitting
in state. If you want a release variant that gates on the value,
fork the contract.

## 3. Why the recipient slot is in the consumer's state

The recipient is in the consumer's state (not the v2 oracle's
sigscript args) because:

- The v2 oracle pins **both** `published_value` and `recipient` via
  `validateOutputStateWithTemplate`. The recipient is fixed at oracle
  deploy time — every publication routes to the same downstream.
- Each fresh consumer UTXO created by a publish thus has a known
  recipient encoded in its scriptPubKey (through the template
  binding). The recipient slot in the consumer's state is the same
  recipient repeated, ensuring `release` only honours that one
  recipient.

If you want per-publication recipients, that's a v3 design: the
recipient would be a public input (`pi[2]`, say) the circuit
attests to, and the oracle would pin it into the consumer's state
at publication time. The OracleConsumer state slot would then need
to permit any pubkey rather than a deploy-fixed one — i.e. the v2
oracle's `consumer_new_state.recipient` check would change to
"the new state's recipient equals `pi[2]`."

## 4. Verification posture

- Compile-validated: ✓ (`tests/zk/zk-verified-oracle-v2-compile.test.ts`
  — covers both OracleConsumer and the v2 oracle in one file)
- Runtime-validated: ✓ via the v2 oracle binding test.
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`).
  No expected findings — no template binding, no hardcoded pubkey
  state.
