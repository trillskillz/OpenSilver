# ZK-aware examples (Phase 5)

End-to-end worked examples for the Phase-5 ZK-aware covenants. These
patterns all use `OpGroth16Verify` (a wrapper over Kaspa's
`OpZkPrecompile` engine surface), which is **not** exposed by vanilla
upstream `silverc` at the pinned commit. Read this README first; the
patch-lane prerequisite changes the deploy flow.

## Critical prerequisite — apply the ZK patch lane

Before any contract under `contracts/zk/` will compile, run:

```bash
npm run patch:silverc:zk
```

This applies [`patches/silverscript-opzkprecompile.patch`](../../patches/silverscript-opzkprecompile.patch)
to the pinned upstream `silverc` checkout, rebuilds the binary, and
smoke-tests the two tracked probe contracts
(`contracts/zk/opzkprecompile-smoke.sil` and
`contracts/zk/opgroth16verify-smoke.sil`). If you skip this step,
every ZK pattern compile will fail with `OpGroth16Verify: unknown
function`.

The patch carries a local stack-order correctness fix that needs
folding into upstream PR `kaspanet/silverscript#125` before that PR
merges. Until upstream lands the surface natively, you must rerun
`npm run patch:silverc:zk` after every `silverc` re-bootstrap.

## The four ZK patterns

| Pattern | Directory | What it proves | When to use |
| --- | --- | --- | --- |
| 5.1 Verified Computation | [`verified-computation/`](./verified-computation/README.md) | "I ran circuit C correctly" | Pay a prover for off-chain compute; oracle-style result release |
| 5.2 Private Asset Transfer | [`private-asset-transfer/`](./private-asset-transfer/README.md) | "I'm spending a valid commitment in the deploy-time tree to the recipient slot in pi[2]" | Privacy-preserving payments where transfer validity is in-circuit |
| 5.3 ZK-Verified Oracle | [`zk-verified-oracle/`](./zk-verified-oracle/README.md) | "M-of-N guardians attest AND the computation is sound" | Trust-minimised oracle: both data correctness and publish-authority gated |
| 5.4 Proof-Stitched Multi-Pattern | [`proof-stitched-multi-pattern/`](./proof-stitched-multi-pattern/README.md) | "Run Groth16 once; amortise across N covenant inputs" | Batch payouts where per-recipient cost dominates |
| 5.3 v2 ZK-Verified Oracle (cross-contract binding) | [`zk-verified-oracle-v2/`](./zk-verified-oracle-v2/README.md) | "5.3 + bind the published value into a covenant-bound consumer output via `validateOutputStateWithTemplate`" | The oracle's published value needs to be programmable on-chain, not just trigger a release. Runtime-verified. |
| (companion) Oracle Consumer | [`oracle-consumer/`](./oracle-consumer/README.md) | Holds the published value in state; `release` to a deploy-time recipient (replaceable by downstream forks) | Used as the receipt UTXO created by the v2 oracle publish. Runtime-verified via the v2 oracle binding test. |

## What the covenant side does — and doesn't

OpenSilver's ZK patterns are **verifier covenants**, not full ZK
applications. Each contract:

- ✅ holds the verifying key as deploy-time state (so it cannot be
  swapped at spend time),
- ✅ runs `OpGroth16Verify(vk, proof, [public_inputs…])` against
  caller-supplied proof + public inputs,
- ✅ pins outputs and pubkeys at the boundary (e.g. "first output
  must be P2PK to the recipient committed in pi[2]"),
- ❌ does **not** generate the proof,
- ❌ does **not** validate the *meaning* of the public inputs beyond
  what the proof attests,
- ❌ does **not** enforce circuit-level invariants like
  "the commitment_root grew monotonically" or
  "the nullifier hasn't been spent" — those are the **circuit
  author's** responsibility.

**Threat-model assessment must include the circuit, not just the
covenant.** Read each pattern's "What this v1 does NOT do" section.

## Compile-time vs runtime artifacts

For these patterns, `opensilver deploy-plan` will work but emits a
plan whose `compiler.requiresPatchedSilverc` flag is `true` — your
wallet should check that flag and refuse to ship a build that didn't
apply the patch lane.

The runtime tests under `runtime-tests/tests/zk_runtime.rs` are the
executable byte-shape reference. Each pattern's runtime test loads
the Groth16 fixture from
[`references/fixtures/groth16-opzkprecompile-fixture.json`](../../references/fixtures/groth16-opzkprecompile-fixture.json)
(VK + proof + public-input vector from rusty-kaspa's engine-side
KIP-16 tests, vendored verbatim). That fixture is a placeholder for
the covenant-side test surface — **real deployments need a real
circuit + real prover**, neither of which OpenSilver ships.

## What an example is, and isn't

**An example is**: a paste-ready walkthrough of the covenant side,
with concrete ctor placeholders, sigscript shape pointer, and a
runtime-test cross-reference.

**An example is not**: a circuit. Authoring the Groth16 circuit
(constraints, commitment scheme, public-input layout) is the
deployment author's job. The examples below note where the circuit
half lives — usually as a TODO referencing the design doc at
`docs/patterns/zk/<pattern>.md`.

## Verification posture (all four)

- Compile-validated via `tests/zk-*-compile.test.ts` (patch lane
  required).
- Runtime-validated: ✓ 12 cargo tests in
  `runtime-tests/tests/zk_runtime.rs` exercise positive + tampered +
  wrong-prover variants against the real Groth16 fixture.
- Audit-checked: ✓ `tests/audit/audit-all-patterns.test.ts`.
- External audit: not yet. The patch lane itself needs upstream
  fold-back before mainnet.
