# TimeLock — worked example

Time-locked release of a sealed amount with optional owner-side soft
cancellation. Source at
[`contracts/core/timelock.sil`](../../contracts/core/timelock.sil),
design notes at
[`docs/patterns/core/timelock.md`](../../docs/patterns/core/timelock.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to TimeLock.

## Why TimeLock is the simplest stateful primitive worth deploying

Three lifecycle paths, all narrowly scoped:

- **`claim`** — beneficiary withdraws after `unlock_time` (terminal).
- **`cancel`** — owner reclaims **before** `unlock_time`, but only if
  `soft_cancel_enabled` was set true at deploy (terminal).
- **`extend_lock`** — owner pushes the unlock time **forward only** (singleton transition).

If you need anything beyond this — N-of-M signer quorum, beneficiary
rotation, partial withdrawals — reach for Vault instead.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
TimeLock(
  pubkey init_owner,
  pubkey init_beneficiary,
  int    init_unlock_time,
  bool   init_soft_cancel_enabled
)
```

```bash
OWNER=02$(openssl rand -hex 31)
BENEFICIARY=02$(openssl rand -hex 31)
UNLOCK=$(date -d '+7 days' +%s)

npx opensilver deploy-plan core.timelock \
  --ctor "[\"$OWNER\", \"$BENEFICIARY\", $UNLOCK, true]" \
  --network kaspa:testnet-12 \
  > timelock-deploy-plan.json
```

`deployment.entrypoints` lists `["claim", "cancel", "extend_lock"]`.

## 2. Soft-cancel semantics

The fourth ctor arg is the **only** thing distinguishing a "true
timelock" (no escape hatch) from a "soft timelock" (owner can reclaim
before unlock). Deploy with `false` if you want a *commit-and-forget*
gift / vesting cliff that you cannot rescind.

The `cancel` entrypoint enforces `tx.locktime < prev_state.unlock_time`
strictly — the soft-cancel window closes the moment the unlock time
elapses. This shape (rather than `tx.time < unlock_time`) exists
because the pinned `silverscript` compiler has a grammar special-case
for `require(tx.time >= …)`-style timelock checks but not for the
`<` direction. The runtime tests in
[`runtime-tests/tests/core_runtime.rs`](../../runtime-tests/tests/core_runtime.rs)
include positive + negative coverage for both `cancel` boundaries.

## 3. Why `extend_lock` is forward-only

`require(next_unlock_time >= prev_state.unlock_time)` is the trust gate
that makes TimeLock composable: a downstream covenant or wallet UI can
assume the lock never shortens once observed. If you need a "shrinkable
timer," that's a different pattern (and a different threat model — the
beneficiary should object).

## 4. Verification posture

- Compile-validated: ✓ (`tests/timelock-compile.test.ts`)
- Runtime-validated: ✓ (every entrypoint plus late-cancel rejection)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
