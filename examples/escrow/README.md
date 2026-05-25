# Escrow (bilateral) — worked example

Two-party escrow with an arbiter as the tiebreaker and a timeout
fallback to the buyer. Source at
[`contracts/core/escrow-bilateral.sil`](../../contracts/core/escrow-bilateral.sil),
design notes at
[`docs/patterns/core/escrow-bilateral.md`](../../docs/patterns/core/escrow-bilateral.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to bilateral escrow.

## Why bilateral escrow is the simplest *trust-minimised* payment primitive

Three terminal paths, no state continuation:

- **`release_to_seller`** — arbiter + seller co-sign; funds go to seller.
- **`refund_to_buyer`** — arbiter + buyer co-sign; funds go back to buyer.
- **`timeout_reclaim`** — after the timeout, buyer reclaims unilaterally.

The arbiter never gains custody — they can only **tilt** which way the
funds flow, and only if the corresponding counterparty co-signs. The
timeout closes the worst case where the arbiter goes silent.

If you need *multiple* milestones rather than a single release/refund
decision, use the milestone-escrow pattern
(`contracts/core/escrow-milestone.sil`) instead.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
BilateralEscrow(
  pubkey   init_buyer,
  pubkey   init_seller,
  byte[32] init_arbiter,        // blake2b hash of arbiter pubkey
  int      init_timeout
)
```

Note: the arbiter slot is a **hash**, not a raw pubkey. The arbiter
reveals their pubkey at spend time and the covenant verifies
`blake2b(arbiter_pk) == prev_state.arbiter`. This keeps the arbiter
identity private until they actually have to act.

```bash
BUYER=02$(openssl rand -hex 31)
SELLER=02$(openssl rand -hex 31)
ARBITER_PK=02$(openssl rand -hex 31)
ARBITER_HASH=$(printf '%s' "$ARBITER_PK" | xxd -r -p | b2sum -l 256 | cut -d' ' -f1)
TIMEOUT=$(date -d '+14 days' +%s)

npx opensilver deploy-plan core.escrow-bilateral \
  --ctor "[\"$BUYER\", \"$SELLER\", \"$ARBITER_HASH\", $TIMEOUT]" \
  --network kaspa:testnet-12 \
  > escrow-deploy-plan.json
```

`deployment.entrypoints` lists `["release_to_seller", "refund_to_buyer", "timeout_reclaim"]`.

## 2. Threat model in one paragraph

The covenant is safe against any single party going rogue. Buyer can't
unilaterally drain (needs arbiter); seller can't (same); arbiter can't
take custody at all (no path mentions arbiter as the destination). The
worst case is collusion: any two of (buyer, seller, arbiter) can
together force one of the two non-timeout paths. The timeout caps the
"arbiter unreachable" failure mode by handing control back to the
buyer.

## 3. Where the runtime tests live

`runtime-tests/tests/core_runtime.rs` — search for `bilateral_escrow_`.
Positive coverage for `release_to_seller` and `timeout_reclaim`;
negative coverage for wrong-arbiter-pubkey, missing-co-signer, and
pre-timeout reclaim attempts.

## 4. Verification posture

- Compile-validated: ✓ (`tests/escrow-bilateral-compile.test.ts`)
- Runtime-validated: ✓
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
