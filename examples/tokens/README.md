# Token examples (KCC20, Phase 4)

End-to-end worked examples for the KCC20 token family. Unlike the
core patterns under [`examples/`](../README.md), every KCC20 deployment
is **three-phase**, so the tooling shape is different and these
walkthroughs explain that explicitly.

## Start here

- **[`kcc20/`](./kcc20/README.md)** — the asset contract reference
  (Pattern 4.1). Read this **first** — every controller variant
  reuses the same asset contract, and its three ownership modes
  (PUBKEY / SCRIPT_HASH / COVENANT_ID) are what make the
  controller-covenant split work.

## Controller variants

| Pattern | Directory | What it adds | Reach for it when… |
| --- | --- | --- | --- |
| 4.2 KCC20Ownable | [`kcc20-ownable/`](./kcc20-ownable/README.md) | Two-step admin handoff for mint authority | Governance / treasury control is the main requirement |
| 4.3 KCC20Pausable | [`kcc20-pausable/`](./kcc20-pausable/README.md) | Pause-gated mint paths | You need an emergency mint halt without freezing transfers |
| 4.4 KCC20Capped | [`kcc20-capped/`](./kcc20-capped/README.md) | Hard supply ceiling | Total issuance must be bounded at deploy time |
| 4.5 KCC20Vesting | [`kcc20-vesting/`](./kcc20-vesting/README.md) | Beneficiary-signed vesting schedule for new issuance | Issuance follows a release schedule, not admin discretion |
| 4.6 KCC20Snapshot | _(stub doc only)_ | Snapshot-based governance reads | **Not yet implemented** — waits on KIP-21 lane stability |

## What's different about KCC20 deploys

A core pattern (e.g. Ownable) deploys with one `opensilver deploy-plan`
call. A KCC20 deployment runs **three** stages:

1. **Controller genesis** — the controller covenant is deployed
   uninitialized (`initialized = false`). Its constructor pins
   `kcc20Covid = byte[32](0)` as a placeholder.
2. **Asset genesis + controller init** — a single transaction creates
   the KCC20 asset's first UTXO and spends the controller's genesis
   output through `init`. The asset's freshly-created covenant-id is
   committed into the controller state in the same tx.
3. **Operations** — `mint`, admin rotation, pause/unpause, vest, etc.
   Every operation that touches the minter branch must spend the
   controller and the asset together (sibling inputs).

The OpenSilver SDK has dedicated helpers for this. Look for:

```ts
import {
  buildKcc20AssetConfig,
  buildKcc20ControllerState,
  buildKcc20AssetConstructorArgs,
  buildKcc20ControllerConstructorArgs,
  buildKcc20LifecyclePlan,
  buildKcc20LifecycleTransactionPlans,
  buildKcc20DeploymentBundle,
  compileKcc20DeploymentBundle,
  buildKcc20DeployFlow,
  buildKcc20BroadcastReadyFlow,
} from '@opensilver/sdk';
```

These compute the template-binding ctor args (`templatePrefixLen`,
`templateSuffixLen`, `expectedTemplateHash`, `templatePrefix`,
`templateSuffix`) — those are **not** hand-derivable; they come from
hashing the asset contract's compiled script around the state-bytes
window. Don't try to fill them in by hand.

## What about `opensilver deploy-plan` for KCC20?

`opensilver deploy-plan krc20.kcc20-*` works and is useful for **the
controller side alone** — it emits the controller's compiled script
and a P2SH commitment. But the controller's ctor needs the asset's
covenant-id, which doesn't exist yet at that point. The `kcc20Covid`
slot is a `byte[32](0)` placeholder that the asset-genesis tx fills
in via `init`. Use the SDK lifecycle helpers if you want the complete
deploy bundle.

## What an example is, and isn't

Each KCC20 walkthrough below shows:
- the controller-specific state fields and entrypoints,
- which variant to choose vs the alternatives,
- where the SDK helper does the heavy lifting,
- where the runtime tests prove the byte shapes.

Each walkthrough is **not** a deployable script. The three-phase
genesis tx assembly is wallet-layer work; OpenSilver provides the
plan, not the broadcast.

## Verification posture (all five)

- Compile-validated via `tests/tokens/kcc20-*-compile.test.ts`.
- Runtime-validated against `runtime-tests/tests/kcc20_runtime.rs`
  (every controller exercises init/mint/policy-specific paths).
- Audit-checked via `tests/audit/audit-all-patterns.test.ts`. **The
  KCC20 family carries one expected finding** (`KIP20-003`,
  documented in `AUDIT_CHECKLIST.md`) — review it before mainnet.
