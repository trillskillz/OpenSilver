# Streaming Payment — worked example

Push a continuous flow of value to a recipient on a cadence, with the
sender able to cancel and reclaim the unspent balance. Source at
[`contracts/core/streaming-payment.sil`](../../contracts/core/streaming-payment.sil),
design notes at
[`docs/patterns/core/streaming-payment.md`](../../docs/patterns/core/streaming-payment.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to streaming payments.

## Why streaming is a meaningful primitive

The covenant turns a one-shot payment into a *schedule* with two invariants:

- The recipient can never withdraw more than `rate_per_claim` per
  `period`, and never before `next_release_time`.
- The sender can stop the stream at any time, but never claw back funds
  that have already vested into the recipient's withdrawal window.

`withdraw` is a `termination = allowed` singleton: each call either
shifts the schedule forward by one period (partial draw) or ends the
stream (final draw). The branch is selected by the number of
continuation outputs the spend produces — exactly the shape used by
the KCC20Vesting controller, so wallet code can share helpers.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
StreamingPayment(
  pubkey init_sender,
  pubkey init_recipient,
  int    init_rate_per_claim,
  int    init_total_allowance,
  int    init_remaining_allowance,    // = init_total_allowance at deploy
  int    init_period,                 // seconds between releases
  int    init_next_release_time       // unix seconds
)
```

```bash
SENDER=02$(openssl rand -hex 31)
RECIPIENT=02$(openssl rand -hex 31)
TOTAL=10000000           # total streamable amount in sompi
RATE=1000000             # per period
PERIOD=86400             # 1 day
FIRST=$(date -d '+1 day' +%s)

npx opensilver deploy-plan core.streaming-payment \
  --ctor "[\"$SENDER\", \"$RECIPIENT\", $RATE, $TOTAL, $TOTAL, $PERIOD, $FIRST]" \
  --network kaspa:testnet-12 \
  > stream-deploy-plan.json
```

`deployment.entrypoints` lists `["withdraw", "cancel"]`.

## 2. The two flow shapes of `withdraw`

### Partial draw (continuation, 1 output)

When `remaining_allowance > rate_per_claim`, the recipient draws
`rate_per_claim`, the schedule continues, and the next state commits:

```
remaining_allowance' = remaining_allowance - rate_per_claim
next_release_time'   = next_release_time   + period
```

All other fields are pinned to their prior values via `require(…)`.
Wallets compute this next state and reconstruct the continuation
output's `scriptPubKey` by splicing the new state bytes at the script's
`state_layout` offset (returned by `opensilver compile-pattern`).

### Final draw (terminal, 0 outputs)

When `remaining_allowance <= rate_per_claim`, the recipient draws
exactly `remaining_allowance` and the stream ends. The continuation
list is empty — `termination = allowed` is what makes this branch legal.

## 3. `cancel` semantics

`cancel` is unconditional from the sender's side (no timer, no quorum)
but **does not retroactively reclaim already-vested withdrawals** — the
recipient's window is enforced by `withdraw`'s `tx.time >=
next_release_time` gate. The race is: the sender's `cancel` spend lands
versus the recipient's `withdraw` spend; whichever confirms first wins
that round. Subsequent rounds are gone (either way) after cancel
confirms.

## 4. Verification posture

- Compile-validated: ✓ (`tests/streaming-payment-compile.test.ts`)
- Runtime-validated: ✓ (`runtime-tests/tests/core_runtime.rs`,
  partial + terminal withdraw + forged-state rejection + cancel)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
