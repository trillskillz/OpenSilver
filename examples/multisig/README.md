# MultiSig — worked example

Threshold N-of-3 signature covenant with a stateful reconfiguration path.
Source at [`contracts/core/multisig.sil`](../../contracts/core/multisig.sil),
design notes at [`docs/patterns/core/multisig.md`](../../docs/patterns/core/multisig.md).

This example uses the same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md). Read that first if
you haven't — this doc focuses on what makes MultiSig different.

## Why MultiSig is interesting

Two distinct flow shapes coexist in one covenant:

- **`spend`** is a **terminal** entrypoint. The quorum approves a spend
  and the funds leave the covenant. No state continuation, no output
  pinning to the covenant address.
- **`reconfigure`** is a **singleton transition**. The quorum approves
  a swap of the signer set itself; the funds stay locked, the new state
  is committed into a continuation output.

Most real deployments only need `spend`, but reconfigure matters when
a guardian key is compromised and you need to rotate without unwinding
the treasury.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor: `MultiSig(int init_threshold, pubkey init_pk1, pubkey init_pk2, pubkey init_pk3)`.

```bash
PK1=02$(openssl rand -hex 31)
PK2=02$(openssl rand -hex 31)
PK3=02$(openssl rand -hex 31)

npx opensilver deploy-plan core.multisig \
  --ctor "[2, \"$PK1\", \"$PK2\", \"$PK3\"]" \
  --network kaspa:testnet-12 \
  > multisig-deploy-plan.json
```

`deployment.entrypoints` will list `["spend", "reconfigure"]`. The
threshold is set at deploy time and can only be lowered/raised via the
`reconfigure` path (which itself requires current-quorum approval — you
can't unilaterally weaken the policy).

## 2. Spend the covenant: terminal vs continuation

### Path A: `spend` (terminal)

Sigscript pushes three (pubkey, sig) pairs — exactly three, even if two
suffice for the quorum (the third pair is checked but does not need to
count toward the approval, because the entrypoint takes a fixed number
of signer slots). To get the engine to accept a 2-of-3 with the third
signer "unused," push any signer pubkey from the configured set with a
sig that fails `checkSig`; `approvalCount` will see the failure and
count only the two valid pairs.

The runtime test `multisig_spend_with_two_valid_signers_passes` in
[`runtime-tests/tests/core_runtime.rs`](../../runtime-tests/tests/core_runtime.rs)
is the canonical reference for the exact byte shape.

### Path B: `reconfigure` (singleton transition)

Sigscript carries the new threshold + new signer set + current quorum.
The continuation output must:

1. Reconstruct the **same** redeem script (covenant address unchanged).
2. Carry the new state (`{ threshold: next_threshold, pk1: next_pk1, pk2: next_pk2, pk3: next_pk3 }`).

The compile pipeline (`opensilver compile-pattern core.multisig`)
returns the `state_layout` describing where the state bytes live in the
script — your wallet code splices the new state in at that offset to
form the continuation output's `scriptPubKey`.

## 3. Composition: MultiSig as a building block

The Vault pattern (`contracts/core/vault.sil`) embeds the same 3-signer
quorum check (`requireValidConfiguration` + `signerIsMember` +
`approvalCount`) inside a richer lifecycle that adds a timelock, a
beneficiary slot, and a two-step owner handoff. If your use case
includes "treasury held until date D with N-of-M approval to release,"
deploy `core.vault` instead of layering MultiSig + TimeLock yourself.

The same pattern composition is reused by Social Recovery
(`contracts/core/social-recovery.sil`) for the guardian-quorum check
that initiates an owner-recovery flow.

## 4. Verification posture

- Compile-validated: ✓ (`tests/multisig-compile.test.ts`)
- Runtime-validated: ✓ (`runtime-tests/tests/core_runtime.rs`, multiple
  positive + negative cases including stale quorum + wrong signer set)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
