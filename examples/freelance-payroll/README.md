# Freelance / Payroll — worked example

Bilateral payment with a hashed-arbiter tiebreaker and a
client-favored timeout. Source at
[`contracts/core/freelance-payroll.sil`](../../contracts/core/freelance-payroll.sil),
design notes at
[`docs/patterns/core/freelance-payroll.md`](../../docs/patterns/core/freelance-payroll.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to freelance/payroll.

## How this differs from bilateral escrow

`core.escrow-bilateral` and `core.freelance-payroll` look almost
identical from outside — two parties, an arbiter, a timeout. The
differences are intentional:

- **Naming + audit posture.** This pattern's parties are *client* and
  *worker*, and the timeout favors the *client* (not the buyer). The
  language matters when wiring UIs: a freelancer onboarding sees
  "you're the worker" rather than "you're the seller," which removes
  ambiguity about which co-signature is needed for which path.
- **Standard release is mutual, not arbiter-mediated.** `standard_release`
  needs client + worker co-signature; the arbiter is not involved on
  the happy path at all. The arbiter only appears for `arbiter_payout`
  (force-payment when client is uncooperative) and `arbiter_refund`
  (force-refund when worker is uncooperative).
- **No on-chain milestone counter.** This is single-payment freelance,
  not deliverable-batched. Use milestone escrow if you need that.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
FreelancePayroll(
  pubkey   init_client,
  pubkey   init_worker,
  byte[32] init_arbiter,        // blake2b(arbiter_pk)
  int      init_timeout
)
```

```bash
CLIENT=02$(openssl rand -hex 31)
WORKER=02$(openssl rand -hex 31)
ARBITER_PK=02$(openssl rand -hex 31)
ARBITER_HASH=$(printf '%s' "$ARBITER_PK" | xxd -r -p | b2sum -l 256 | cut -d' ' -f1)
TIMEOUT=$(date -d '+30 days' +%s)

npx opensilver deploy-plan core.freelance-payroll \
  --ctor "[\"$CLIENT\", \"$WORKER\", \"$ARBITER_HASH\", $TIMEOUT]" \
  --network kaspa:testnet-12 \
  > freelance-deploy-plan.json
```

`deployment.entrypoints` lists `["standard_release", "arbiter_refund", "arbiter_payout", "timeout_reclaim"]`.

## 2. The four lifecycle paths

### `standard_release` — happy path

Client + worker co-sign; funds go to the worker. The arbiter is not
needed; their address never sees the funds. This is the path most
contracts should take.

### `arbiter_payout` — arbiter forces pay-the-worker

Arbiter + worker co-sign; funds go to the worker. Used when the client
goes silent or refuses to release work the arbiter judges complete.

### `arbiter_refund` — arbiter forces refund

Arbiter + client co-sign; funds go back to the client. Used when the
worker fails to deliver and the arbiter agrees.

### `timeout_reclaim` — client recovers after timeout

`tx.time >= timeout` plus client signature. **The default failure mode
favors the client**, which is the opposite of bilateral escrow's
buyer-favored shape. Pick this pattern (vs `core.escrow-bilateral`) when
you specifically want the client/payer to be made whole if the deal
collapses without an arbiter ruling.

## 3. Picking the timeout

Long enough that a reasonable arbiter has time to receive a dispute
notice, hear both sides, and act. Common values for typical-scope
contracts: 30–90 days past the expected completion date.

## 4. Verification posture

- Compile-validated: ✓ (`tests/freelance-payroll-compile.test.ts`)
- Runtime-validated: ✓ (`runtime-tests/tests/core_runtime.rs`,
  all four paths + negative tests on each)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
