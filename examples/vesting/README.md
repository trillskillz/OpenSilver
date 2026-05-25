# Vesting — worked example

Cliff-gated periodic release schedule, with optional admin revocation.
Source at [`contracts/core/vesting.sil`](../../contracts/core/vesting.sil),
design notes at
[`docs/patterns/core/vesting.md`](../../docs/patterns/core/vesting.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to vesting.

## Vesting vs Streaming Payment

The two patterns are siblings — both run a periodic-release singleton
with `termination = allowed`. Choose based on:

- **Vesting** — has a **cliff**, after which periodic releases begin.
  Designed for compensation/equity flows: employee earns `X` per
  period, but nothing until the cliff date.
- **Streaming Payment** — no cliff. First release happens at
  `next_release_time` and continues from there. Designed for
  service-payment flows: pay $X/month from day one.

Both expose a single beneficiary, both allow a non-beneficiary actor
(admin / sender) to terminate. Pick by *cliff semantics*, not by
function-name preference.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
Vesting(
  pubkey init_beneficiary,
  pubkey init_admin,
  int    init_total_allocation,
  int    init_claimed_amount,        // = 0 at deploy
  int    init_cliff_time,            // unix seconds
  int    init_period,                // seconds between releases
  int    init_release_per_period,
  bool   init_revocable
)
```

```bash
BENEFICIARY=02$(openssl rand -hex 31)
ADMIN=02$(openssl rand -hex 31)
TOTAL=120000000               # full grant
RELEASE=10000000              # per period (so 12 periods total)
PERIOD=2592000                # 30 days
CLIFF=$(date -d '+90 days' +%s)

npx opensilver deploy-plan core.vesting \
  --ctor "[\"$BENEFICIARY\", \"$ADMIN\", $TOTAL, 0, $CLIFF, $PERIOD, $RELEASE, true]" \
  --network kaspa:testnet-12 \
  > vesting-deploy-plan.json
```

`deployment.entrypoints` lists `["claim", "revoke"]`.

## 2. The two flow shapes of `claim`

### Partial release (continuation, 1 output)

When `total_allocation - claimed_amount > release_per_period`, the
beneficiary draws `release_per_period`, the schedule advances:

```
claimed_amount' = claimed_amount + release_per_period
cliff_time'     = cliff_time     + period
```

Note that the per-claim gate is `tx.time >= prev_state.cliff_time`,
which gets pushed forward each period. The cliff field doubles as the
"next release time" for every subsequent draw — the first claim opens
the cliff, every later claim opens the next period.

### Final release (terminal, 0 outputs)

When the remaining grant is `<= release_per_period`, the beneficiary
draws the rest and the schedule ends. `termination = allowed` is what
makes this branch legal.

## 3. `revoke` semantics

`revoke` requires `prev_state.revocable == true` (set at deploy; cannot
be changed) and an admin signature. The full unclaimed balance returns
to the admin in a single P2PK output minus the 1000-sompi miner fee.

If you want a non-revocable grant (e.g. a public-commitment retirement
fund) deploy with `init_revocable = false`. The `revoke` entrypoint is
still callable but the `require(prev_state.revocable)` gate rejects
every attempt.

## 4. Verification posture

- Compile-validated: ✓ (`tests/vesting-compile.test.ts`)
- Runtime-validated: ✓ (`runtime-tests/tests/core_runtime.rs`,
  partial + terminal claim + pre-cliff rejection + revoke)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
