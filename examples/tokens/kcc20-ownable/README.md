# KCC20Ownable — worked example (Pattern 4.2)

Mint-authority rotation via the two-step admin handoff from Pattern
3.1 Ownable, sitting in front of the stable KCC20 asset contract.
Source at
[`contracts/tokens/kcc20-ownable.sil`](../../../contracts/tokens/kcc20-ownable.sil),
design notes at
[`docs/patterns/tokens/kcc20-ownable.md`](../../../docs/patterns/tokens/kcc20-ownable.md).

Read the [tokens README](../README.md) first for the three-phase
deploy lifecycle this walkthrough assumes.

## What KCC20Ownable adds over plain KCC20

Mint authority lives in `admin: pubkey` controller state. The admin
can rotate to a new pubkey through `propose_admin_transfer` →
`accept_admin_transfer`, identical in shape to core Ownable. The
asset's covenant-id stays stable across the rotation; only the
controller's admin slot changes.

**Pending admin does not pause minting.** Until the new admin signs
`accept_admin_transfer`, the current admin retains mint authority.

## Constructor (controller side)

```
KCC20Ownable(
  pubkey   initAdmin,
  bool     initHasPendingAdmin,
  pubkey   initPendingAdmin,
  byte[32] initKCC20Covid,            // byte[32](0) at genesis
  bool     initInitialized,           // false at genesis
  int      templatePrefixLen,
  int      templateSuffixLen,
  byte[32] expectedTemplateHash,
  byte[]   templatePrefix,
  byte[]   templateSuffix
)
```

The five `template*` fields come from compiling the asset contract
and extracting the bytes around its state-layout window. **Use the SDK
helper** — these are not hand-derivable:

```ts
import {
  buildKcc20ControllerState,
  buildKcc20ControllerConstructorArgs,
  buildKcc20DeploymentBundle,
} from '@opensilver/sdk';

const controllerState = buildKcc20ControllerState({
  kind: 'ownable',
  admin: adminPubkey,
  initialized: false,
}, /* kcc20Covid placeholder */ '00'.repeat(32));

const bundle = buildKcc20DeploymentBundle({
  controllerKind: 'ownable',
  controllerState,
  assetConfig: { /* see kcc20/README.md */ },
});
// bundle.controllerGenesis + bundle.assetGenesis are SilvercCompileSpec
// objects you feed to silverc to produce the on-chain scripts.
```

## Entrypoints

| Entrypoint | What it does | Who signs |
| --- | --- | --- |
| `init` | Controller side of asset-genesis tx; pins `kcc20Covid` to the freshly-created asset covenant-id and flips `initialized = true` | Current admin |
| `propose_admin_transfer` | Sets `hasPendingAdmin = true`, `pendingAdmin = nextAdmin` | Current admin |
| `accept_admin_transfer` | Rotates `admin → pendingAdmin`, clears flag | Pending admin |
| `cancel_admin_transfer` | Clears `hasPendingAdmin` without rotating | Current admin |
| `mint` | Creates a new recipient KCC20 output (non-minter, COVENANT_ID-owned by the recipient's chosen identity); decrements no allowance (the variant has no cap — that's 4.4's job) | Current admin |

The admin slot uses the same NUM2BIN-avoiding `pubkey + bool flag`
shape as core Ownable. The `pendingAdmin` pubkey slot keeps its prior
value across `accept_admin_transfer` and `cancel_admin_transfer` —
only the flag flips.

## When to pick this vs the other controllers

- **vs KCC20Capped** — no supply ceiling. Choose Capped if you need
  one, Ownable if you specifically want admin-discretion issuance.
- **vs KCC20Pausable** — no emergency halt. Choose Pausable if you
  need a switch to stop new issuance during a maintenance window.
- **vs KCC20Vesting** — no schedule. Choose Vesting if mint timing
  should follow a calendar, not admin discretion.
- **Combine them** — not in v1. Each controller is a single-policy
  scaffold. A combined Capped+Pausable+Ownable controller is a future
  4.7+ variant.

## Where the runtime tests live

`runtime-tests/tests/kcc20_runtime.rs` — search for `ownable_`.
Covers init, pending-transfer mint, accepted-admin mint, and the
stale-admin-rejected case.

## Verification posture

- Compile-validated: ✓ (`tests/tokens/kcc20-ownable-compile.test.ts`)
- Runtime-validated: ✓
- Audit-checked: ✓ (carries the KIP20-003 finding family-wide; see
  `AUDIT_CHECKLIST.md`)
