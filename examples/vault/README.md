# Vault — worked example

The most feature-dense stateful pattern in the catalogue. Combines
owner control, timelocked release, an N-of-M signer quorum, and a
two-step owner handoff into one covenant. Source at
[`contracts/core/vault.sil`](../../contracts/core/vault.sil), design
notes at [`docs/patterns/core/vault.md`](../../docs/patterns/core/vault.md).

This example follows the same shape as the
[Ownable canonical walkthrough](../ownable/README.md); read that first
if you haven't. This doc focuses on what makes Vault unique: it has
**five** entrypoints, four of which are singleton transitions that
must preserve the locked value across the state change.

## Why Vault is the flagship stateful pattern

Most real treasury deployments need all four of these properties:

1. **Funds locked until a date D** — TimeLock-style.
2. **Released only with N-of-M approval** — MultiSig-style.
3. **Beneficiary locked at deploy time** — no rug.
4. **Operational keys rotatable without unwinding the treasury** — two-step owner handoff, quorum-gated signer reconfiguration.

Vault gives you all four in one covenant rather than layering three
patterns yourself. The runtime tests in
[`runtime-tests/tests/core_runtime.rs`](../../runtime-tests/tests/core_runtime.rs)
(search for `vault_`) exercise every entrypoint end-to-end.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
Vault(
  pubkey init_owner,
  bool init_has_pending_owner,
  pubkey init_pending_owner,
  int init_threshold,
  pubkey init_pk1, pubkey init_pk2, pubkey init_pk3,
  int init_unlock_time,
  pubkey init_beneficiary
)
```

```bash
OWNER=02$(openssl rand -hex 31)
PENDING=02$(openssl rand -hex 31)        # placeholder; flag=false
PK1=02$(openssl rand -hex 31)
PK2=02$(openssl rand -hex 31)
PK3=02$(openssl rand -hex 31)
BENEFICIARY=02$(openssl rand -hex 31)
UNLOCK=$(date -d '+30 days' +%s)         # 30 days out

npx opensilver deploy-plan core.vault \
  --ctor "[\"$OWNER\", false, \"$PENDING\", 2, \"$PK1\", \"$PK2\", \"$PK3\", $UNLOCK, \"$BENEFICIARY\"]" \
  --network kaspa:testnet-12 \
  > vault-deploy-plan.json
```

`deployment.entrypoints` lists all five:
`release`, `extend_lock`, `reconfigure_signers`, `propose_owner_transfer`, `accept_owner_transfer`.

## 2. The five lifecycle paths

### Path A: `release` (terminal — funds leave the covenant)

Preconditions: `tx.time >= unlock_time`, 2-of-3 quorum approves,
beneficiary signs. Sigscript carries `(pk1, sig1, pk2, sig2, pk3, sig3,
beneficiary_pk, beneficiary_sig)`. The covenant enforces
`tx.outputs[0]` is exactly a P2PK to the beneficiary for the input
value minus a 1000-sompi miner fee.

Negative coverage live: wrong beneficiary, pre-unlock release attempt,
sub-threshold quorum — all reject with `VerifyError`.

### Path B: `extend_lock` (singleton transition)

Quorum approves an unlock-time push-forward (`next_unlock_time >=
prev_state.unlock_time` — never pull in). All other state fields are
pinned to their previous values. `requireExactContinuationValue`
enforces that the single authenticated output (`OpAuthOutputCount == 1`)
holds the same value as the input minus the fee.

### Path C: `reconfigure_signers` (singleton transition)

Requires **both** owner signature **and** current-quorum approval —
this is intentionally double-gated because rotating the signer set is
the highest-impact administrative action. The new threshold + new
signers pass through the same `requireValidConfiguration` shape, so a
malformed rotation (duplicate keys, threshold out of range) reverts.

### Path D: `propose_owner_transfer` (singleton transition)

Current owner signs and nominates `next_owner`. State commits
`has_pending_owner: true, pending_owner: next_owner`. Same NUM2BIN
8-byte cap rule as Ownable — the owner slot stays at its prior value
and the bool flag is the source of truth.

### Path E: `accept_owner_transfer` (singleton transition)

`pending_owner` signs. State becomes
`{ owner: prev_state.pending_owner, has_pending_owner: false, pending_owner: prev_state.pending_owner, ... }`.
The pending_owner slot keeps its prior pubkey value (no fresh literal
write); the flag clears, which is what gates future paths.

## 3. Common composition mistakes to avoid

- **Don't deploy Vault + Ownable in parallel.** Vault already includes
  the two-step owner handoff. Layering Ownable on top creates two
  independent owner slots that drift.
- **Don't lower the threshold without owner gate.** `reconfigure_signers`
  requires both owner sig and quorum approval — preserve that gate when
  building wallet UI flows.
- **Don't expect `extend_lock` to shorten the timer.** It's
  forward-only by design (`next_unlock_time >= prev_state.unlock_time`).
  If you need to release before `unlock_time`, that's a design error —
  Vault is a commit-and-wait primitive.

## 4. Verification posture

- Compile-validated: ✓ (`tests/vault-compile.test.ts`)
- Runtime-validated: ✓ (`runtime-tests/tests/core_runtime.rs`, every
  entrypoint covered including the owner-handoff pair landed in the
  2026-05-24 hardening pass)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)

## 5. Where to go next

- **Other patterns** — `npx opensilver list`.
- **End-to-end deployment** — [`docs/DEPLOY_GUIDE.md`](../../docs/DEPLOY_GUIDE.md).
- **Wizard** — `npm run wizard:build` then open `wizard/build/index.html`.
- **Audit posture** — [`AUDIT_CHECKLIST.md`](../../AUDIT_CHECKLIST.md).
