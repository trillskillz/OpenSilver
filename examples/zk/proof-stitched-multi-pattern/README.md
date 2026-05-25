# Proof-Stitched Multi-Pattern — worked example (Pattern 5.4)

KIP-20 leader/delegate composition for Groth16: run the expensive
proof verification **once**, amortise across N covenant inputs that
share the same `covenant_id`. Source at
[`contracts/zk/proof-stitched-multi-pattern.sil`](../../../contracts/zk/proof-stitched-multi-pattern.sil),
design notes at
[`docs/patterns/zk/proof-stitched-multi-pattern.md`](../../../docs/patterns/zk/proof-stitched-multi-pattern.md).

Read the [ZK examples README](../README.md) for the patch-lane
prerequisite.

## The cost-amortisation idea

A single Groth16 verification on Kaspa costs roughly `Groth16_cost ≈
96 ECDSA equivalents` per the engine-side KIP-16 benchmarks. For a
single-input spend (Pattern 5.1), that's the per-spend cost — expensive,
but acceptable for high-value flows.

For a *batch* of N covenant inputs that all want to release on the
same proof, naive composition would run the Groth16 N times. This
pattern runs it **once on the leader input** and lets the other N-1
delegate inputs trust the leader via the shared `covenant_id`. The
per-recipient cost drops to `Groth16_cost / N + O(1)`. For a 32-input
batch: ~3 ECDSA equivalents per recipient.

## Leader/delegate roles

The LEADER is the lowest-indexed covenant input sharing the cov-id.
DELEGATEs are every other input sharing the cov-id.

| Role | Script entrypoint | What it does |
| --- | --- | --- |
| Leader | `leader_release` | Runs `OpGroth16Verify` + pays own input value to `recipient`. Requires `this.activeInputIndex == OpCovInputIdx(cov_id, 0)`. |
| Delegate | `delegate_release` | Skips proof verification; pays own input value to `recipient`. Requires `this.activeInputIndex != OpCovInputIdx(cov_id, 0)`. |

Both entrypoints `require(OpCovInputCount(cov_id) >= 2)` — a single
input invocation should use Pattern 5.1 directly.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
npm run patch:silverc:zk
```

## 1. Build the deploy plan

Constructor:

```
ProofStitchedMultiPattern(
  byte[]  init_verifying_key,
  pubkey  init_recipient
)
```

```bash
RECIPIENT=02$(openssl rand -hex 31)
VK_HEX=$(jq -r '.verifying_key' references/fixtures/groth16-opzkprecompile-fixture.json)

npx opensilver deploy-plan zk-aware.proof-stitched-multi-pattern \
  --ctor "[\"$VK_HEX\", \"$RECIPIENT\"]" \
  --network kaspa:testnet-12 \
  > stitched-deploy-plan.json
```

All N UTXOs in the batch derive from the same deploy — they share the
P2SH redeem script, which means they share the `covenant_id` at spend
time. The wallet code that funds them simply pays the same P2SH
address N times.

## 2. Building the batch spend

The spend is a **single transaction with N covenant inputs**:

- Input 0: sigscript selects `leader_release` and pushes
  `(proof, pi0, pi1, pi2, pi3, pi4)`.
- Inputs 1..N-1: sigscripts select `delegate_release` (no args).
- Output i pairs with input i: `tx.outputs[i].value == tx.inputs[i].value - 1000`
  and `tx.outputs[i].scriptPubKey == P2PK(recipient)`.

The `tx.outputs[this.activeInputIndex]` pairing is what makes
the 1:1 batch shape work. Reordering inputs/outputs breaks the
pairing — wallets must keep them aligned.

See `runtime-tests/tests/zk_runtime.rs:proof_stitched_leader_delegate_two_input_batch_passes`
for the canonical multi-input transaction shape; the harness helper
`execute_multi_input_with_covenants` makes the test setup tractable.

## 3. What v1 doesn't do

v1 routes **all inputs' value to one deploy-time recipient**. The
full design ties `tx.outputs[i]` to slices of `public_inputs_concat`
so each recipient is per-input. That requires a per-recipient circuit
(the prover must commit to N recipients in the public inputs) and is
deferred until a real per-recipient circuit is in flight.

For "all inputs pay the same recipient" use cases (a single party
redeeming N HTLC-like covenants in a batch), v1 is sufficient. For
"N inputs pay N different recipients in one tx," wait for v2.

## 4. Common composition mistakes

- **Don't deploy this for single-input use.** The `cov_input_count
  >= 2` gate rejects it. Use Pattern 5.1 Verified Computation instead.
- **Don't put the proof on a delegate input.** Delegate inputs reject
  `this.activeInputIndex == leader_idx`. The proof goes on the leader
  (lowest-indexed) input.
- **Don't reorder outputs relative to inputs.** The 1:1 pairing is
  positional: `tx.outputs[i]` belongs to `tx.inputs[i]`.
- **Don't expect N-recipient semantics in v1.** All inputs pay the
  single deploy-time recipient. Per-recipient binding waits on a real
  per-recipient circuit (v2).

## 5. Verification posture

- Compile-validated: ✓ (patch lane required;
  `tests/zk-proof-stitched-multi-pattern-compile.test.ts`)
- Runtime-validated: ✓ (3 cargo tests in `zk_runtime.rs`:
  leader+delegate batch passes, delegate-at-leader-position rejected,
  leader-with-tampered-proof rejected)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
- External audit: **not yet**.
