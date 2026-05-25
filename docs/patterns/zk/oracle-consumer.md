# Oracle Consumer

Status: scaffolded; compile-validated. Runtime test landing in a follow-up.

## Summary

Companion covenant to [ZK-Verified Oracle v2](./zk-verified-oracle-v2.md).
A minimal singleton whose only state is `(published_value: byte[32],
recipient: pubkey)`. The published value is set by the oracle at
publication time via `validateOutputStateWithTemplate`. The consumer's
only entrypoint, `release`, pays the locked balance to the recipient.

This contract has **no ZK primitives** — it does not require the
Phase-5 patch lane. The only ZK-aware actor is the v2 oracle, which
writes into the consumer's state at publish time.

## Why this is a separate contract

Three reasons to put the published-value carrier in its own covenant
rather than as state on the oracle itself:

1. **Stateless oracle.** The v2 oracle is terminal-per-spend (no
   singleton continuation). Pushing the published value into a
   separate covenant means the oracle's own deploy doesn't have to
   thread a `published_value` slot through every spend.
2. **Multiple publications.** Each publish creates a NEW consumer
   UTXO. The oracle can publish many values; each one is a separate
   on-chain artifact a downstream pattern can spend or inspect.
3. **Composition surface.** Downstream patterns that want to gate on
   a published value (a Freelance contract requiring "oracle scored
   the work above threshold," a Vesting variant requiring "oracle
   attested the milestone") subclass / fork OracleConsumer and
   replace `release` with their own logic. The published value is
   already in state; the downstream just reads it.

## State

```
published_value : byte[32]   // the value pi[0] the oracle committed to
recipient       : pubkey      // who can drain the consumer UTXO via release
```

## Constructor

```
OracleConsumer(
  byte[32] init_published_value,
  pubkey   init_recipient
)
```

Initial state == constructor args. The consumer's first UTXO is
created by the oracle's publish transaction, with
`init_published_value = pi[0]` and `init_recipient = oracle's
configured consumer_recipient` — both pinned by the oracle's
`validateOutputStateWithTemplate` call.

## Entrypoints

### `release(recipient_pk, recipient_sig)`

Sigscript pushes the recipient's pubkey + signature. The covenant:

1. Verifies `recipient_pk == prev_state.recipient`.
2. Verifies `checkSig(recipient_sig, recipient_pk)`.
3. Pays the input value minus a 1000-sompi miner fee to a P2PK on
   `recipient`.

This is a terminal entrypoint — the UTXO is consumed and no
continuation is emitted. After `release`, the published value is no
longer on-chain (in the sense that no live UTXO carries it; the
publish transaction is still in history).

## Variants to subclass / fork

This v1 release is unconditional — any signer matching the
deploy-time recipient can drain. Downstream patterns wanting to gate
on the published value would replace the `release` body. Examples:

**Gate on equality:**

```
require(published_value == expected_value);
```

**Gate on numeric threshold** (treating `published_value` as a
little-endian i64):

```
int score = bytesToInt(published_value);     // hypothetical helper
require(score >= threshold);
```

**Multi-recipient routing** (treating `published_value` slots as
routing flags):

```
if (published_value[0] == 0x01) {
  requireExactPayout(recipient_a);
} else {
  requireExactPayout(recipient_b);
}
```

None of these variants ship in v1 — they are intentionally left to
downstream forks.

## When to use OracleConsumer directly

- As the receipt UTXO created by a v2 oracle publish.
- As a starting scaffold for any pattern that needs "covenant state
  carries an oracle-attested value, then runs custom logic."

## WHEN NOT TO USE THIS

- Do not deploy as a standalone covenant — it depends on something
  (typically a v2 oracle) creating its first UTXO with the correct
  state.
- Do not treat the v1 `release` shape as production for any flow
  needing value-aware logic. Fork it.
- Do not use `published_value` as a security primitive without
  understanding what the producing oracle's circuit attests to. The
  consumer trusts that the value was correctly committed; the
  threat model of "what the value means" is upstream.

## Verification posture

- Compile-validated: ✓ (`tests/zk/zk-verified-oracle-v2-compile.test.ts`
  — covers both OracleConsumer and the v2 oracle in one test file)
- Runtime-validated: deferred to the v2 oracle runtime-test follow-up.
- Audit-checked: pending runtime test.

## Cross-references

- Producer: [ZK-Verified Oracle v2](./zk-verified-oracle-v2.md)
- Template-binding mechanic: KCC20 controllers under
  [`docs/patterns/tokens/`](../tokens/)
