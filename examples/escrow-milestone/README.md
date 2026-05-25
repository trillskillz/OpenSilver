# Escrow (milestone) — worked example

Bilateral escrow with explicit milestone counting: each `approve_milestone`
transition advances a counter, and the final release is gated on the
counter matching `total_milestones`. Source at
[`contracts/core/escrow-milestone.sil`](../../contracts/core/escrow-milestone.sil),
design notes at
[`docs/patterns/core/escrow-milestone.md`](../../docs/patterns/core/escrow-milestone.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to milestone escrow.

## Why milestone escrow is *stateful* bilateral escrow

The bilateral escrow pattern (`core.escrow-bilateral`) decides
release-vs-refund once. Milestone escrow runs the decision N times,
each time advancing the on-chain `completed_milestones` counter through
a singleton-transition `approve_milestone` spend. The funds stay locked
in the covenant address across every approval — only the final
`final_release` after `completed_milestones == total_milestones` lets
them leave.

This shape matters when the work is fungibly divisible (a contract for
4 quarters of work, a delivery in 5 batches) and you want each
milestone signed off on-chain rather than buried in a side document.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
MilestoneEscrow(
  pubkey   init_buyer,
  pubkey   init_seller,
  byte[32] init_arbiter,            // blake2b(arbiter_pk)
  int      init_total_milestones,
  int      init_completed_milestones,    // = 0 at deploy
  int      init_timeout
)
```

```bash
BUYER=02$(openssl rand -hex 31)
SELLER=02$(openssl rand -hex 31)
ARBITER_PK=02$(openssl rand -hex 31)
ARBITER_HASH=$(printf '%s' "$ARBITER_PK" | xxd -r -p | b2sum -l 256 | cut -d' ' -f1)
TOTAL=4
TIMEOUT=$(date -d '+180 days' +%s)

npx opensilver deploy-plan core.escrow-milestone \
  --ctor "[\"$BUYER\", \"$SELLER\", \"$ARBITER_HASH\", $TOTAL, 0, $TIMEOUT]" \
  --network kaspa:testnet-12 \
  > milestone-deploy-plan.json
```

`deployment.entrypoints` lists `["approve_milestone", "final_release", "dispute_refund", "timeout_reclaim"]`.

## 2. The four lifecycle paths

### `approve_milestone` — singleton transition

Arbiter + seller co-sign; `completed_milestones` increments by 1.
`requireExactContinuationValue` enforces a single authenticated output
holding the input value minus the 1000-sompi miner fee. Repeat once
per milestone delivered.

### `final_release` — terminal

Arbiter + seller co-sign **and** the covenant enforces
`completed_milestones == total_milestones`. Funds leave the covenant
as a P2PK to the seller. Calling this before all milestones approved
is rejected by the engine.

### `dispute_refund` — terminal

Arbiter + buyer co-sign; funds go back to the buyer regardless of
milestone progress. This is the arbiter's veto path — they certify
that the work was not delivered as agreed.

### `timeout_reclaim` — terminal

After `tx.time >= timeout`, buyer reclaims unilaterally. This caps
the "arbiter unreachable" failure mode. Set `timeout` generously
(months past expected completion); too-short timeouts undermine the
escrow guarantee.

## 3. Composability note

The arbiter slot is a **blake2b hash** of the arbiter pubkey, not the
raw pubkey. This means an arbiter can run a single keypair and serve
multiple escrows without revealing they are the arbiter for any
specific deal until they actually have to act.

## 4. Verification posture

- Compile-validated: ✓ (`tests/escrow-milestone-compile.test.ts`)
- Runtime-validated: ✓ (KIP-20 cov-id continuation across the
  approve_milestone chain plus all terminal paths)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
