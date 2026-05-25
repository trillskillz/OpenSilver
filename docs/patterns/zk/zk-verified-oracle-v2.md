# ZK-Verified Oracle v2 (Pattern 5.3 v2)

Status: scaffolded; compile-validated + runtime-verified end-to-end.

## Summary

A variant of [Pattern 5.3 ZK-Verified Oracle](./zk-verified-oracle.md)
that emits a **covenant-bound consumer output** instead of a terminal
payout. Every successful `publish` materialises a new
[OracleConsumer](./oracle-consumer.md) UTXO whose state carries the
published value (`pi[0]`) and the deploy-committed recipient. The
binding is enforced via `validateOutputStateWithTemplate` — the first
non-KCC20 use of cross-contract output binding in OpenSilver.

## Why v2 exists

v1 wires the oracle's result directly into a P2PK payout to a known
recipient address. That's fine for "the oracle triggers a release,"
but it limits composition: anything downstream that wants to gate on
the published value would need to inspect a P2PK output, which carries
no programmable state.

v2 wires the result into a covenant-bound output instead. The consumer
covenant holds `published_value` in its state, so a downstream pattern
can `readInputStateWithTemplate` over a sibling Consumer input and
make decisions on the value. Concrete downstream shapes (deferred to
follow-ups):

- A Freelance / Payroll variant whose `arbiter_payout` requires
  `published_value == 1` (oracle attests the work passed).
- A Vesting variant whose `claim` requires
  `published_value >= threshold` (oracle attests the milestone).
- A ZK rollup checkpoint whose `advance_state` consumes an oracle
  receipt as the source-of-truth attestation.

The OracleConsumer in this commit is intentionally minimal — it pays
out to a deploy-committed recipient via a normal `release` entrypoint.
A real downstream consumer fork would replace `release` with arbitrary
state-aware logic.

## Architecture

```
publish transaction:
  inputs:
    [0] oracle UTXO (this contract)
  outputs:
    [0] OracleConsumer UTXO carrying state = {
          published_value: pi[0],
          recipient:       <deploy-time consumer_recipient>,
        }
```

The oracle's `publish` entrypoint:

1. Verifies the M-of-N committee threshold (same as v1).
2. Verifies the Groth16 proof under the deploy-time VK (same as v1).
3. Verifies the caller-supplied `consumer_new_state` matches the
   pinned (published_value, recipient) tuple.
4. Calls `validateOutputStateWithTemplate(0, consumer_new_state, …)`
   to enforce that `tx.outputs[0]` is a new OracleConsumer UTXO with
   exactly that state.

If any step fails, the spend reverts and no consumer UTXO is created.

## Constructor

```
ZkVerifiedOracleV2(
  byte[]  init_verifying_key,
  pubkey  init_consumer_recipient,
  int     init_threshold,                       // 1..3
  pubkey  init_guardian1,
  pubkey  init_guardian2,
  pubkey  init_guardian3,
  int     consumerTemplatePrefixLen,
  int     consumerTemplateSuffixLen,
  byte[32] consumerExpectedTemplateHash,
  byte[]  consumerTemplatePrefix,
  byte[]  consumerTemplateSuffix
)
```

The five `consumerTemplate*` fields are computed by compiling
OracleConsumer with the deploy-time `consumer_recipient` pinned and
extracting `prefix + suffix` around the state-layout offset. The
OpenSilver SDK will provide a helper (`buildOracleConsumerTemplate`)
that handles this — same shape as the KCC20 deploy-bundle helpers.

## State

The oracle is **stateless** (no singleton transition). Each successful
spend is terminal from the oracle's perspective; the published value
lives in the consumer's state, not the oracle's.

If you need a stateful oracle (e.g. nonce-tracked publications, rate
limits), layer with a singleton wrapper or fork v2 to add a state
struct.

## Public-inputs layout (N = 5)

Same as v1 — five 32-byte field elements matching the fixture in
`references/fixtures/groth16-opzkprecompile-fixture.json`. `pi[0]`
is repurposed as **the published value**: a 32-byte field element
that the circuit attests to and the consumer stores. Slots
`pi[1..4]` are free for circuit-side use (commitment roots, nonces,
expiry timestamps, etc.).

## Why a witness-supplied `consumer_new_state`

The caller passes `consumer_new_state` as a sigscript arg, and the
covenant checks it matches the proven value before binding it into
the output template. This pattern (witness-supplied + pinned in
state) is the canonical KCC20 idiom — the controller doesn't try to
construct the next state internally; it asks the caller to provide
it and then verifies.

Mechanically this is forced by the SilverScript surface:
`validateOutputStateWithTemplate` takes a struct expression, not
slot-by-slot pushes. The caller is the only place we can shape a
fresh struct value with the right fields.

## What v2 deliberately does NOT do

- **No state in the oracle itself.** Repeat-publish behaviour is at
  the wallet layer; the oracle accepts every well-formed proof.
- **No nullifier / publication-id tracking.** The same proof could
  be replayed unlimited times — each successful spend just creates a
  fresh consumer UTXO. If you need replay protection, the circuit
  should bind a unique nonce into one of the public-input slots and
  the consumer should refuse to accept duplicates (a separate
  enforcement layer).
- **No multi-output binding.** v2 pins exactly `tx.outputs[0]`. A
  variant that pins multiple consumer outputs is a future v3.

## When to use v2 vs v1

- **v1** — you want a simple ZK-attested payout. The oracle releases
  funds to a known address. No downstream programmability.
- **v2** — you want the oracle's output to be a programmable
  receipt that downstream covenants can inspect. Use this when the
  oracle's published value is meaningful to a downstream pattern,
  not just a release trigger.

## Verification posture

- Compile-validated: ✓ (`tests/zk/zk-verified-oracle-v2-compile.test.ts`)
- Runtime-validated: ✓ (3 cargo tests in
  `runtime-tests/tests/zk_runtime.rs`:
  `zk_verified_oracle_v2_accepts_publish_with_correct_binding`,
  `_rejects_wrong_consumer_recipient_in_state`,
  `_rejects_tampered_proof`). The harness compiles OracleConsumer
  twice — once with zero state to probe the template, once with the
  real (pi[0], recipient) to lock the output[0] script — then
  computes the genesis cov-id from the funding outpoint + output,
  drives the publish transaction with witness sigs + proof + struct
  consumer_new_state, and verifies the engine accepts the binding.
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`).
  Expected findings: `OS-003`, `KIP20-003` — same template-hash
  trust posture as the KCC20 controller family.

## Cross-references

- v1 design: [`zk-verified-oracle.md`](./zk-verified-oracle.md)
- Consumer: [`oracle-consumer.md`](./oracle-consumer.md)
- Template-binding precedent: KCC20 controllers under
  [`docs/patterns/tokens/`](../tokens/)
- Engine-side primitive: KIP-20 covenant context +
  `validateOutputStateWithTemplate` in the stdlib
