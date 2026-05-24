# KCC20Vesting — schedule-gated issuance controller (Pattern 4.5)

Status: scaffolded; compile-validated

## Summary

KCC20 controller covenant that releases mint authority on a schedule: `cliffTime` gates the first mint, then `releasePerPeriod` becomes available every `period`. The asset contract remains the unchanged Pattern 4.1 KCC20.

This is the issuance-side analogue of the Phase 3 Vesting pattern, adapted for KCC20 minting instead of direct payout.

## State layout

```
totalAllocation : int
mintedAmount    : int
cliffTime       : int
period          : int
releasePerPeriod: int
kcc20Covid      : byte[32]
initialized     : bool
```

`admin`, `beneficiary`, and the KCC20 template metadata are constructor constants.

## Entrypoints

### `init(prevState, newState, adminSig)`

Controller side of the asset-genesis handoff. Checks:
- schedule fields are valid and preserved,
- controller was uninitialized,
- `kcc20Covid` is set to the freshly created asset covenant-id,
- controller becomes initialized,
- admin signature is present.

### `mint(prevState, newState, beneficiaryPk, beneficiarySig, minterKcc20NewState, recipientKcc20NewState)`

Single-recipient vesting mint path. Checks:
- beneficiary signature is present,
- `tx.time >= cliffTime`,
- there is still unminted allocation,
- exactly one KCC20 input and two KCC20 outputs participate,
- output 0 is the continued minter branch owned by this controller's covenant-id,
- output 1 is a beneficiary-owned non-minter branch,
- `claimAmount` is `min(remaining, releasePerPeriod)`,
- controller continuation updates `mintedAmount += claimAmount` and `cliffTime += period`.

## Design decisions

- Unlike the Phase 3 payout vesting contract, this controller **does not terminate** after the last mint. It remains as a fully-drained controller state (`mintedAmount == totalAllocation`) so the KCC20 minter branch never loses its controlling covenant lineage unexpectedly.
- Beneficiary signs the mint, not the admin. Admin is only used for the initial asset-genesis handoff in this first scaffold.
- Recipient holder branch is fixed to the configured beneficiary pubkey.

## When to use this

- Team / advisor / ecosystem allocations that should mint gradually rather than existing at genesis.
- Token programs where issuance itself, not just spendability, should follow a vesting curve.
- Any controller-first launch where beneficiary-directed scheduled issuance is the primary policy.

## WHEN NOT TO USE THIS

- Do not use this if you need revocation; this first scaffold is intentionally non-revocable.
- Do not use this if you need admin-rotatable control; combine the design with Pattern 4.2 later if needed.
- Do not treat this scaffold as production-ready until runtime tests cover the schedule logic plus the full KCC20 controller + asset lifecycle.

## Current limitations

- No runtime harness coverage yet.
- No termination path; fully-drained schedules remain as inert controller states.
- No pause/cap composition in this first version.
- No explicit controller-output value accounting yet; this scaffold focuses on issuance-schedule accounting and templated KCC20-output validation.

## Verification

- Compile/AST validation: `tests/tokens/kcc20-vesting-compile.test.ts`
- Asset contract reference: `contracts/tokens/kcc20.sil`
- Related core pattern: `docs/patterns/core/vesting.md`
