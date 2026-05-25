# KCC20Vesting — worked example (Pattern 4.5)

Time-gated, beneficiary-signed issuance schedule for the KCC20 asset.
Source at
[`contracts/tokens/kcc20-vesting.sil`](../../../contracts/tokens/kcc20-vesting.sil),
design notes at
[`docs/patterns/tokens/kcc20-vesting.md`](../../../docs/patterns/tokens/kcc20-vesting.md).

Read the [tokens README](../README.md) first for the three-phase
deploy lifecycle.

## What KCC20Vesting adds over plain KCC20

A vesting schedule on issuance itself — *not* on transfers. Tokens
flow from `0 → totalAllocation` over time, with the beneficiary
pulling each release window. Compare:

- **Core vesting (3.8)** — locks an *existing* balance and releases
  to one beneficiary on a schedule. Funds exist at deploy.
- **KCC20Vesting (4.5)** — bounds *future issuance*. Tokens are
  minted into existence on each `mint` call, not pre-allocated.

This means the controller's accounting tracks `mintedAmount` against
`totalAllocation`. When `mintedAmount == totalAllocation`, the
schedule is complete and further mints reject.

## Constructor (controller side)

```
KCC20Vesting(
  pubkey   admin,
  pubkey   beneficiary,
  int      initTotalAllocation,
  int      initMintedAmount,          // = 0 at deploy
  int      initCliffTime,             // unix seconds
  int      initPeriod,                // seconds between releases
  int      initReleasePerPeriod,
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
  kind: 'vesting',
  admin: adminPubkey,
  beneficiary: beneficiaryPubkey,
  totalAllocation: 12_000_000n,
  mintedAmount: 0n,
  cliffTime: cliffUnixSeconds,
  period: 30 * 86400,                   // monthly
  releasePerPeriod: 1_000_000n,         // 12 periods → totalAllocation
  initialized: false,
}, /* kcc20Covid placeholder */ '00'.repeat(32));
```

## Entrypoints

| Entrypoint | Who signs | Gate |
| --- | --- | --- |
| `init` | admin | controller uninitialized; pins `kcc20Covid` |
| `mint` | admin + beneficiary | `tx.time >= cliffTime`; advances `cliffTime` and `mintedAmount` |

`mint` is double-signed because the schedule is enforced *and* the
beneficiary co-signs each release. This means:

- The admin cannot mint to themselves or to a different recipient —
  the recipient KCC20 output's owner is pinned to `beneficiary`.
- The beneficiary cannot accelerate the schedule — `tx.time >=
  cliffTime` is the gate, and `cliffTime` advances by `period` on
  each mint, just like core Vesting (3.8) does.
- Either party can stall, but neither can extract more than the
  schedule allows.

There is no `revoke` entrypoint in v1 — the schedule is irrevocable
once the controller is initialized. If you need revocation, layer
with Ownable-style admin authority over the beneficiary slot in a
future combined variant.

## When to pick this vs the other controllers

- **vs KCC20Ownable** — issuance is rule-based, not admin-discretion.
  Trust the schedule, not the admin.
- **vs KCC20Pausable** — issuance is forward-only and time-gated;
  pause is reactive.
- **vs KCC20Capped** — both bound issuance, but Capped is *total*
  (no time component), Vesting is *over time* (schedule with
  beneficiary co-sign). Combine semantically by setting
  `totalAllocation == hard cap` in vesting — same effect, plus a
  schedule.

## Where the runtime tests live

`runtime-tests/tests/kcc20_runtime.rs` — search for `vesting_`.
Covers init, pre-cliff reject, first scheduled mint, second-period
mint, and final-drain mint.

## Verification posture

- Compile-validated: ✓ (`tests/tokens/kcc20-vesting-compile.test.ts`)
- Runtime-validated: ✓
- Audit-checked: ✓ (carries the KIP20-003 finding family-wide)
