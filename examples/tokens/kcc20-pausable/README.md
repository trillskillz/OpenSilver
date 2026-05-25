# KCC20Pausable — worked example (Pattern 4.3)

Admin-gated pause / unpause for new KCC20 issuance, while leaving
existing-holder transfers unaffected. Source at
[`contracts/tokens/kcc20-pausable.sil`](../../../contracts/tokens/kcc20-pausable.sil),
design notes at
[`docs/patterns/tokens/kcc20-pausable.md`](../../../docs/patterns/tokens/kcc20-pausable.md).

Read the [tokens README](../README.md) first for the three-phase
deploy lifecycle.

## What KCC20Pausable adds over plain KCC20

A single `paused: bool` flag on the controller, plus `pause` and
`unpause` entrypoints to toggle it. `mint` adds a `require(!paused)`
gate. Critically, **`paused` only blocks issuance** — token holders
can still transfer freely, because transfers are governed by the
asset contract (4.1), which has no pause hook.

This separation is intentional. Compare to ERC20Pausable, which
typically halts transfers too — that's a stronger primitive but also
a more dangerous one. KCC20Pausable's "stop new minting, leave
existing holdings alone" shape is the right tool for:

- Emergency response when a mint pipeline misbehaves (you halt new
  issuance without freezing user balances).
- Coordinated rollouts where new tokens shouldn't enter circulation
  during a known maintenance window.

If you actually want to freeze transfers too, that's a feature for
the asset contract itself, not the controller.

## Constructor (controller side)

```
KCC20Pausable(
  pubkey   admin,
  bool     initPaused,
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

const controllerState = buildKcc20ControllerState({
  kind: 'pausable',
  admin: adminPubkey,
  paused: false,
  initialized: false,
}, /* kcc20Covid placeholder */ '00'.repeat(32));
```

## Entrypoints

| Entrypoint | What it does | Pre-state | Post-state |
| --- | --- | --- | --- |
| `init` | Controller side of asset-genesis | `initialized = false` | `initialized = true`, `kcc20Covid` pinned |
| `pause` | Halt new issuance | `initialized = true, paused = false` | `paused = true` |
| `unpause` | Resume issuance | `initialized = true, paused = true` | `paused = false` |
| `mint` | Create a recipient KCC20 output | `initialized = true, paused = false` | unchanged |

All four are admin-signed; there is no separate pause role in v1. If
you need a circuit-breaker role distinct from the mint admin, layer
on KCC20Ownable's admin-rotation idea (a future combined controller)
or run a multisig as `admin`.

## When to pick this vs the other controllers

- **vs KCC20Ownable** — has a pause switch, no admin rotation. Pause
  is the *headline* feature here; Ownable's admin rotation can be
  added orthogonally to a future combined variant.
- **vs KCC20Capped** — no supply ceiling. Pause is a soft halt;
  capping is a hard one.
- **vs KCC20Vesting** — no schedule. Pause is reactive; vesting is
  prospective.

## Where the runtime tests live

`runtime-tests/tests/kcc20_runtime.rs` — search for `pausable_`.
Covers init, pause+unpause toggle, and paused-mint-rejected.

## Verification posture

- Compile-validated: ✓ (`tests/tokens/kcc20-pausable-compile.test.ts`)
- Runtime-validated: ✓
- Audit-checked: ✓ (carries the KIP20-003 finding family-wide)
