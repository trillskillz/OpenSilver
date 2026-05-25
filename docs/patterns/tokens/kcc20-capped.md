# KCC20Capped — supply-capped controller (Pattern 4.4)

Status: scaffolded; compile-validated

## Summary

KCC20 controller covenant that bounds total issuance via a `remainingAllowance` state field. Each successful mint decrements the allowance; once it reaches zero, further mints fail. The asset contract is the unchanged Pattern 4.1 KCC20 at `contracts/tokens/kcc20.sil`.

This scaffold is a direct OpenSilver lift of the upstream `kcc20-minter.sil` controller shape, with the cap made explicit and documented.

## State layout

```
kcc20Covid         : byte[32]  // covenant-id of the bound KCC20 asset
 totalCap          : int       // original cap for off-chain tooling / audits
 remainingAllowance: int       // authoritative issuance budget
 initialized       : bool      // false before the asset-genesis handoff
```

`admin`, `templatePrefixLen`, `templateSuffixLen`, `expectedTemplateHash`, `templatePrefix`, and `templateSuffix` are constructor constants, not rotating state.

## Entrypoints

### `init(prevState, newState, adminSig)`

The asset-genesis handoff. This is the controller half of the three-phase KCC20 lifecycle:

1. spend the uninitialized controller genesis UTXO,
2. create the KCC20 asset output,
3. continue the controller with `initialized = true` and `kcc20Covid = OpOutputCovenantId(0)`.

Checks enforced:
- controller was not yet initialized,
- `totalCap` and `remainingAllowance` are preserved,
- the continued controller points at the freshly created KCC20 covenant-id,
- admin signature is present.

### `mint(prevState, newState, adminSig, minterKcc20NewState, recipientKcc20NewState)`

Single-recipient capped mint path.

Checks enforced:
- controller is initialized,
- exactly one KCC20 input and two KCC20 outputs participate,
- output 0 is the continued minter branch still owned by this controller's covenant-id,
- output 1 is a non-minter recipient branch,
- `mintedAmount > 0`,
- `mintedAmount <= prevState.remainingAllowance`,
- `newState.remainingAllowance == prevState.remainingAllowance - mintedAmount`,
- admin signature is present.

## Design decisions

- `remainingAllowance` is the authoritative cap. `totalCap` records original policy intent for explorers, auditors, and SDKs.
- This first scaffold only supports the simple **1 controller input / 1 KCC20 input / 2 KCC20 outputs / 1 controller continuation** mint shape.
- The minter branch cannot delegate mint authority: its `ownerIdentifier` must remain `OpInputCovenantId(this.activeInputIndex)` and `identifierType` must remain `COVENANT_ID`.

## When to use this

- Fixed-supply or hard-capped token launches.
- Token sales / rewards programs where issuance authority exists but must be numerically bounded.
- Any Phase-4 deployment where a separate pausable/ownable layer is not required yet.

## WHEN NOT TO USE THIS

- Do not use this if you need pause / maintenance windows — that belongs in Pattern 4.3 KCC20Pausable.
- Do not use this if the cap needs replenishment or epoch-based refill — this scaffold intentionally has no replenish path.
- Do not use this as production-ready issuance logic until runtime tests cover the full three-phase lifecycle and multi-input KCC20 transfer shape.

## Current limitations

- Runtime-covered for init/happy-path mint/over-cap reject, but not yet stressed under broader multi-input KCC20 transfer compositions.
- No batching: one recipient branch per mint call.
- No admin rotation: this is intentionally the simplest controller variant first.
- No explicit output-value accounting on the controller UTXO itself yet; the main safety property here is issuance-budget accounting plus templated KCC20-output validation.

## Verification

- Compile/AST validation: `tests/tokens/kcc20-capped-compile.test.ts`
- Asset contract reference: `contracts/tokens/kcc20.sil`
- Standard notes: `docs/standards/KCC20.md`
