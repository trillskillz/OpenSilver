# ZK-Verified Oracle v2 — worked example (Pattern 5.3 v2)

The cross-contract-binding variant of the 5.3 oracle. Every successful
`publish` pins a covenant-bound consumer output via
`validateOutputStateWithTemplate` instead of emitting a terminal
payout. Source at
[`contracts/zk/zk-verified-oracle-v2.sil`](../../../contracts/zk/zk-verified-oracle-v2.sil),
design notes at
[`docs/patterns/zk/zk-verified-oracle-v2.md`](../../../docs/patterns/zk/zk-verified-oracle-v2.md).

Read the [ZK examples README](../README.md) for the patch-lane
prerequisite. Also read the
[v1 walkthrough](../zk-verified-oracle/README.md) — v2 carries
v1's two-tier authorisation surface verbatim; the **only** new
mechanism is the cross-contract output binding.

## Status

**Compile-validated + runtime-verified end-to-end.** v2 is the
first non-KCC20 use of `validateOutputStateWithTemplate` in
OpenSilver, and the three runtime tests in
`runtime-tests/tests/zk_runtime.rs` prove the binding works through
the real `kaspa-txscript` engine: positive (correct binding accepts),
wrong-recipient (binding pre-check rejects), tampered-proof (Groth16
verification rejects).

## What v2 changes vs v1

| | v1 | v2 |
| --- | --- | --- |
| Authorisation | M-of-N committee + Groth16 proof | Same |
| Output shape | Terminal P2PK payout to deploy-committed recipient | Covenant-bound: pins `tx.outputs[0]` to an OracleConsumer UTXO carrying state `{ published_value: pi[0], recipient: <deploy-time> }` |
| Downstream composition | Pay-to-pubkey; downstream sees a normal output | Downstream can `readInputStateWithTemplate` over the OracleConsumer UTXO and gate logic on the published value |
| Replay protection | None (oracle is stateless) | None (same — circuit-side nonce binding remains the answer) |

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
npm run patch:silverc:zk
```

## 1. The consumer template

v2 needs five `consumerTemplate*` ctor constants that come from
compiling [`OracleConsumer`](../oracle-consumer/README.md) with the
deploy-time recipient pinned. The five values:

- `consumerTemplatePrefixLen` — length of the script bytes before the
  state-bytes window.
- `consumerTemplateSuffixLen` — length of the script bytes after the
  state-bytes window.
- `consumerExpectedTemplateHash` — `blake2b(prefix || suffix)`.
- `consumerTemplatePrefix`, `consumerTemplateSuffix` — the raw prefix
  and suffix bytes.

These are **not hand-derivable**. The OpenSilver SDK will provide a
helper (`buildOracleConsumerTemplate(recipient)`) returning the five
values, the same shape as the KCC20 deploy-bundle helpers — landing
alongside the v2 runtime test in the follow-up. Until then, the
runtime test code in `runtime-tests/tests/zk_runtime.rs` (when it
lands) is the canonical reference.

## 2. Build the deploy plan

Constructor:

```
ZkVerifiedOracleV2(
  byte[]   init_verifying_key,
  pubkey   init_consumer_recipient,
  int      init_threshold,                // 1..3
  pubkey   init_guardian1,
  pubkey   init_guardian2,
  pubkey   init_guardian3,
  int      consumerTemplatePrefixLen,
  int      consumerTemplateSuffixLen,
  byte[32] consumerExpectedTemplateHash,
  byte[]   consumerTemplatePrefix,
  byte[]   consumerTemplateSuffix
)
```

The first six args mirror v1. The remaining five are the consumer
template binding constants (above).

```bash
# Stage 1: compile OracleConsumer with the deploy-time recipient
# baked in to extract the template constants. (Helper TBD; for now,
# point at runtime-tests/tests/zk_runtime.rs for the canonical
# extraction once it lands.)

# Stage 2: deploy v2 oracle with template constants pinned.
RECIPIENT=02$(openssl rand -hex 31)
G1=02$(openssl rand -hex 31)
G2=02$(openssl rand -hex 31)
G3=02$(openssl rand -hex 31)
VK_HEX=$(jq -r '.verifying_key' references/fixtures/groth16-opzkprecompile-fixture.json)

# CTOR_TEMPLATE_FIELDS will come from buildOracleConsumerTemplate($RECIPIENT)
# once the helper lands. The five values are concatenated after the
# first six.

npx opensilver deploy-plan zk-aware.zk-verified-oracle-v2 \
  --ctor "[\"$VK_HEX\", \"$RECIPIENT\", 2, \"$G1\", \"$G2\", \"$G3\", /* + 5 template fields */]" \
  --network kaspa:testnet-12 \
  > oracle-v2-deploy-plan.json
```

## 3. The publish transaction

Single input (the oracle UTXO), single output (the new consumer UTXO).
Sigscript pushes:

```
(signer1, sig1, signer2, sig2, signer3, sig3,
 proof, pi0, pi1, pi2, pi3, pi4,
 consumer_new_state)
```

where `consumer_new_state` is a `{ published_value, recipient }`
struct that must:

- `published_value == pi0` (caller cannot lie about what was attested).
- `recipient == oracle's deploy-time consumer_recipient` (caller
  cannot redirect).

The covenant verifies committee + proof, then calls
`validateOutputStateWithTemplate(0, consumer_new_state, …)` to pin
the structural shape of `tx.outputs[0]`. If any check fails, the
spend reverts and no consumer is created.

## 4. What downstream patterns can do with the consumer

The consumer is a `published_value`-carrying singleton. Patterns
wanting to gate on a specific value substitute a custom `release`
body — see the [`OracleConsumer` walkthrough](../oracle-consumer/README.md)
for variants. Concrete cross-pattern composition (deferred to
follow-ups):

- Freelance/Payroll variant whose `arbiter_payout` reads sibling
  consumer state and requires `published_value == 0x01…` (oracle
  scored the work as approved).
- Vesting variant whose `claim` requires
  `bytesToInt(published_value) >= milestone_threshold`.
- ZK rollup checkpoint consuming the oracle's attestation as its
  source-of-truth.

## 5. Verification posture

- Compile-validated: ✓ (patch lane required;
  `tests/zk/zk-verified-oracle-v2-compile.test.ts`)
- Runtime-validated: ✓ (3 cargo tests in
  `runtime-tests/tests/zk_runtime.rs` exercising positive +
  wrong-recipient + tampered-proof paths through the real engine).
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`).
  Expected findings: `OS-003`, `KIP20-003` — same template-hash
  posture as the KCC20 controller family. See `AUDIT_CHECKLIST.md`
  "ZK Verified Oracle v2" section.
- External audit: **not yet**.
