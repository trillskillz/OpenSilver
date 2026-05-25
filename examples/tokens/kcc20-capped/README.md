# KCC20Capped — worked example (Pattern 4.4)

Hard supply ceiling: total mintable amount is bounded at deploy time
and decremented on every successful `mint`. Source at
[`contracts/tokens/kcc20-capped.sil`](../../../contracts/tokens/kcc20-capped.sil),
design notes at
[`docs/patterns/tokens/kcc20-capped.md`](../../../docs/patterns/tokens/kcc20-capped.md).

Read the [tokens README](../README.md) first for the three-phase
deploy lifecycle.

## What KCC20Capped adds over plain KCC20

Two new controller-state fields:

- `totalCap: int` — the maximum amount that will ever be minted (set
  at deploy, never changes).
- `remainingAllowance: int` — how much issuance is still allowed.
  Starts at `totalCap`; decremented by every `mint`'s minted amount.

Plus a single new invariant on `mint`:

```
require(mintedAmount <= prev_state.remainingAllowance);
require(newState.remainingAllowance == prev_state.remainingAllowance - mintedAmount);
```

When `remainingAllowance` reaches zero, `mint` rejects every further
attempt. The cap is permanent — there is no `raise_cap` entrypoint in
v1, by design. If you need a raisable cap, layer with Ownable-style
admin rotation in a future combined variant.

## Constructor (controller side)

```
KCC20Capped(
  pubkey   admin,
  int      initTotalCap,
  int      initRemainingAllowance,    // = initTotalCap at deploy
  byte[32] initKCC20Covid,            // byte[32](0) at genesis
  bool     initInitialized,           // false at genesis
  int      templatePrefixLen,
  int      templateSuffixLen,
  byte[32] expectedTemplateHash,
  byte[]   templatePrefix,
  byte[]   templateSuffix
)
```

Standard SDK glue:

```ts
import {
  buildKcc20ControllerState,
  buildKcc20DeploymentBundle,
} from '@opensilver/sdk';

const TOTAL_CAP = 1_000_000_00000000n;   // 1,000,000 tokens at 8 decimals

const controllerState = buildKcc20ControllerState({
  kind: 'capped',
  admin: adminPubkey,
  totalCap: TOTAL_CAP,
  remainingAllowance: TOTAL_CAP,
  initialized: false,
}, /* kcc20Covid placeholder */ '00'.repeat(32));
```

## Entrypoints

| Entrypoint | What it does | Effect on `remainingAllowance` |
| --- | --- | --- |
| `init` | Controller side of asset-genesis | unchanged |
| `mint` | Create a recipient KCC20 output | `remainingAllowance` decreases by `mintedAmount` |

That's it. There's no pause, no admin rotation, no schedule — pure
"mint until you hit the cap." For more complex policies, combine with
the other variants (Phase 4.7+ work).

The `mint` policy gate is:

```
mintedAmount = minterKcc20NewState.amount + recipientKcc20NewState.amount - inAmount
require(mintedAmount > 0);
require(mintedAmount <= prevState.remainingAllowance);
```

where `inAmount` is `readInputStateWithTemplate` on the sibling KCC20
input's minter branch. This is the canonical use of the
template-binding ctor args — the controller reads the asset's prior
state without recompiling.

## When to pick this vs the other controllers

- **vs KCC20Ownable** — has a hard cap. Ownable has zero supply
  policy; this trades flexibility for a credible scarcity promise.
- **vs KCC20Pausable** — cap is permanent (good for trust); pause is
  reversible (good for operations). Different threat models.
- **vs KCC20Vesting** — Capped bounds *total*; Vesting bounds
  *timing*. Pick Capped if "no more than X ever"; Vesting if "X
  tokens by month N."

## Where the runtime tests live

`runtime-tests/tests/kcc20_runtime.rs` — search for `capped_`.
Covers init, happy-path mint, and over-cap mint reject.

## Verification posture

- Compile-validated: ✓ (`tests/tokens/kcc20-capped-compile.test.ts`)
- Runtime-validated: ✓
- Audit-checked: ✓ (carries the KIP20-003 finding family-wide)
