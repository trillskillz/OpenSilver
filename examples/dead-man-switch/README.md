# Dead Man's Switch — worked example

Owner-kept-alive covenant: a fallback recipient claims if the owner
stops pinging within a configured age window. Source at
[`contracts/core/dead-man-switch.sil`](../../contracts/core/dead-man-switch.sil),
design notes at
[`docs/patterns/core/dead-man-switch.md`](../../docs/patterns/core/dead-man-switch.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to DMS.

## What DMS is for

Estate planning + lost-key recovery without a guardian quorum: as long
as the owner spends a `ping` transaction periodically, the fallback
cannot claim. If the owner disappears (loses keys, dies, is
incapacitated), `this.age >= timeout_age` becomes true and the
fallback can take custody unilaterally.

The `this.age` check lowers to `OpCheckSequenceVerify` against the
input's `sequence` field — a relative timelock measured in blocks/time
since the UTXO was created. Each successful `ping` creates a fresh
covenant UTXO, resetting the age clock; the moment `ping` cadence drops
below `timeout_age`, the fallback's window opens.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
DeadMansSwitch(
  pubkey init_owner,
  pubkey init_fallback,
  int    init_timeout_age,        // CSV units (relative timelock)
  int    init_last_ping_age       // book-keeping; not a security gate
)
```

```bash
OWNER=02$(openssl rand -hex 31)
FALLBACK=02$(openssl rand -hex 31)
# 30 days in seconds, encoded for CSV (BIP-112 semantics on Kaspa).
TIMEOUT_AGE=2592000

npx opensilver deploy-plan core.dead-mans-switch \
  --ctor "[\"$OWNER\", \"$FALLBACK\", $TIMEOUT_AGE, 0]" \
  --network kaspa:testnet-12 \
  > dms-deploy-plan.json
```

`deployment.entrypoints` lists `["claim", "ping", "update_fallback"]`.

## 2. The three lifecycle paths

### `ping` — owner keepalive (singleton transition)

Owner signs; covenant state is rolled forward to a new UTXO with the
age clock reset. Wallet UX should remind the owner to ping well before
`timeout_age` to avoid edge-case races.

### `update_fallback` — owner rotates the fallback (singleton transition)

Owner signs; the fallback slot becomes `next_fallback`. The new
fallback must differ from the old (`require(next_fallback !=
prev_state.fallback)`); the runtime contract refuses no-op rotations.
Use this when the originally-named fallback loses their keys or you
want to retarget the inheritance plan.

### `claim` — fallback takes custody (terminal)

Sigscript pushes `(fallback_pk, fallback_sig)`. Covenant verifies
`this.age >= prev_state.timeout_age` (so the UTXO must be old enough)
and the signature matches the configured fallback. Funds leave the
covenant; the switch is consumed.

Runtime tests in
[`runtime-tests/tests/core_runtime.rs`](../../runtime-tests/tests/core_runtime.rs)
cover the positive after-age claim and the negative
`sequence < timeout_age` case (which fails OP_CSV with
`UnsatisfiedLockTime`).

## 3. Picking `timeout_age`

Too short and a missed ping triggers the fallback unintentionally. Too
long and the inheritance pathway is unusable in practice (heirs wait
months). For most estate-planning shapes, 90–180 days is a reasonable
range; pair with a calendar reminder system the owner controls.

## 4. Verification posture

- Compile-validated: ✓ (`tests/dead-man-switch-compile.test.ts`)
- Runtime-validated: ✓ (positive + negative on the age gate; ping +
  update_fallback exercised)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`).
  Hardened 2026-05-24 to store pubkey state directly (not blake2b hashes)
  for compile + audit cleanliness; see commit `da71cb0`.
