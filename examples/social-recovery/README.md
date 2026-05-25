# Social Recovery — worked example

Guardian-quorum owner replacement with a delay window for the current
owner to veto. Source at
[`contracts/core/social-recovery.sil`](../../contracts/core/social-recovery.sil),
design notes at
[`docs/patterns/core/social-recovery.md`](../../docs/patterns/core/social-recovery.md).

Same paste-ready tooling shape as the
[Ownable canonical walkthrough](../ownable/README.md); this doc focuses
on what's specific to social recovery.

## Why social recovery is different from "fallback" patterns

Compare to DMS (single fallback, owner-keepalive) and Vault (admin
rotation requires owner consent). Social recovery sits between them:

- **Guardians**, not a single fallback. M-of-N approval to initiate
  the rotation prevents a single compromised key from taking over.
- **Delayed activation**, not immediate. The current owner has until
  `activation_time` to spend `cancel_recovery` and abort.

This is the right shape when "the owner key might be lost or coerced,
and the guardian set is mutually distrustful." If guardians are
trusted, Vault's owner-handoff is cheaper.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc
```

## 1. Build the deploy plan

Constructor:

```
SocialRecovery(
  pubkey init_owner,
  bool   init_has_pending_owner,
  pubkey init_pending_owner,
  int    init_guardian_threshold,
  pubkey init_guardian1,
  pubkey init_guardian2,
  pubkey init_guardian3,
  int    init_activation_time,
  int    init_recovery_delay
)
```

```bash
OWNER=02$(openssl rand -hex 31)
PENDING=02$(openssl rand -hex 31)        # placeholder, flag=false
G1=02$(openssl rand -hex 31)
G2=02$(openssl rand -hex 31)
G3=02$(openssl rand -hex 31)
ACTIVATION=$(date +%s)                    # initial activation time
DELAY=604800                              # 7-day veto window

npx opensilver deploy-plan core.social-recovery \
  --ctor "[\"$OWNER\", false, \"$PENDING\", 2, \"$G1\", \"$G2\", \"$G3\", $ACTIVATION, $DELAY]" \
  --network kaspa:testnet-12 \
  > recovery-deploy-plan.json
```

`deployment.entrypoints` lists `["initiate_recovery", "finalize_recovery", "cancel_recovery"]`.

## 2. The three lifecycle paths

### `initiate_recovery` — guardians propose a new owner

Guardian quorum signs (M-of-3 per the configured threshold), nominates
`next_owner`, and sets `next_activation_time` forward by at least the
`recovery_delay` (the contract enforces `next_activation_time >=
prev_state.activation_time`; wallet UX should add `+ recovery_delay`
on top to give the owner the full veto window).

State commits `has_pending_owner: true, pending_owner: next_owner`.
Same NUM2BIN 8-byte cap rule as Ownable — the owner slot stays at its
prior value until finalize.

### `cancel_recovery` — current owner aborts

Owner signs; the flag clears, the pending_owner pubkey slot is
preserved (NUM2BIN avoidance) but no longer reachable. The owner has
the entire window between `initiate_recovery` and `activation_time` to
spend `cancel_recovery` — design recovery wallets to give the owner
strong notification.

### `finalize_recovery` — pending owner takes custody

Pending owner signs. Covenant verifies `tx.time >=
prev_state.activation_time`, so the spend can only confirm after the
window elapses. State becomes `{ owner: prev_state.pending_owner,
has_pending_owner: false, … }`.

Runtime tests in
[`runtime-tests/tests/core_runtime.rs`](../../runtime-tests/tests/core_runtime.rs)
cover `accepts_pending_owner_after_activation` (positive) and
`rejects_before_activation` (negative).

## 3. Threat-model boundaries

- **Compromised owner key alone** can't change state — they need at
  least the threshold of guardians to push a recovery.
- **Compromised guardian-quorum** can propose a hostile recovery, but
  the legitimate owner has `recovery_delay` to veto.
- **Both owner key compromised AND guardian-quorum compromised** —
  game over. Social recovery is not a defense against simultaneous
  compromise of both halves.
- **All guardians lost** — the owner key still works for everything
  except recovery. The wallet is not bricked; just no recovery path.

## 4. Verification posture

- Compile-validated: ✓ (`tests/social-recovery-compile.test.ts`)
- Runtime-validated: ✓ (`runtime-tests/tests/core_runtime.rs`,
  initiate + cancel + finalize, plus the pre-activation reject)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
