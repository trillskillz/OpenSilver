# Atomic Swap (HTLC) — worked example

Hash Time-Lock Contract: the recipient claims with a preimage of the
hash, otherwise the refunder reclaims after the timeout. Source at
[`contracts/core/atomic-swap-htlc.sil`](../../contracts/core/atomic-swap-htlc.sil),
design notes at
[`docs/patterns/core/atomic-swap-htlc.md`](../../docs/patterns/core/atomic-swap-htlc.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to HTLC.

## What HTLC is for

Atomic cross-chain swaps (and any "I'll release X iff you release Y"
flow). Two HTLCs deployed on two chains with the **same** secret hash
mean revealing the preimage on chain 1 forces it onto chain 2 — either
both swaps complete or both refund.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
AtomicSwapHTLC(
  pubkey   init_recipient,
  pubkey   init_refunder,
  byte[32] init_secret_hash,    // blake2b(secret)
  int      init_timeout
)
```

```bash
RECIPIENT=02$(openssl rand -hex 31)
REFUNDER=02$(openssl rand -hex 31)
SECRET=$(openssl rand -hex 32)                # 32-byte hex secret
SECRET_HASH=$(printf '%s' "$SECRET" | xxd -r -p | b2sum -l 256 | cut -d' ' -f1)
TIMEOUT=$(date -d '+1 day' +%s)               # short window for swaps

npx opensilver deploy-plan core.atomic-swap-htlc \
  --ctor "[\"$RECIPIENT\", \"$REFUNDER\", \"$SECRET_HASH\", $TIMEOUT]" \
  --network kaspa:testnet-12 \
  > htlc-deploy-plan.json
```

`deployment.entrypoints` lists `["claim", "refund"]`.

**Hold `$SECRET` secret until the moment of claim.** Whoever knows it
first can take the funds (on either chain in a cross-chain swap setup).
This is the entire point of HTLC, but it means the secret-publication
event has timing consequences — design your swap protocol accordingly.

## 2. The two paths

### `claim` — recipient with the secret

Sigscript pushes `(recipient_pk, recipient_sig, secret)`. The covenant
verifies:
1. `recipient_pk == prev_state.recipient`
2. `checkSig(recipient_sig, recipient_pk)`
3. `blake2b(secret) == prev_state.secret_hash`
4. Output 0 pays the input value minus 1000 sompi to a P2PK on `recipient`.

Once this spend lands, `$SECRET` is on-chain forever. A counterparty
watching for it can use the same preimage to claim the *other* leg of
the swap.

### `refund` — refunder after the timeout

Sigscript pushes `(refunder_pk, refunder_sig)`. The covenant verifies
the timeout has elapsed and the refunder is the right key. The
preimage is **not** required.

## 3. Picking the timeout

Cross-chain HTLC has an asymmetry: the chain you claim on first is the
one where the preimage gets published. The accepted construction is:

- **First leg (proposer's deposit):** longer timeout (e.g. 48 hours).
- **Second leg (acceptor's deposit):** shorter timeout (e.g. 24 hours).

The acceptor watches their leg; once the proposer claims it (revealing
the preimage), the acceptor has enough time to claim the proposer's
leg before that one's timeout expires. Don't deploy with equal
timeouts — that's a known griefable shape.

## 4. Verification posture

- Compile-validated: ✓ (`tests/atomic-swap-htlc-compile.test.ts`)
- Runtime-validated: ✓ (`runtime-tests/tests/core_runtime.rs`, both
  paths plus wrong-secret + pre-timeout-refund rejections)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
