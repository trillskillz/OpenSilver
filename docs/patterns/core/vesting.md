# Vesting

Status: scaffolded

## Summary

A stateful vesting scaffold for beneficiary allocations with:

- fixed total allocation
- tracked claimed amount
- cliff-based release start
- periodic per-claim release amount
- optional admin revocation

This is a discrete-step vesting model rather than continuous pro-rata accrual.

## Security considerations

- `claim` requires beneficiary signature and `tx.time >= cliff_time`.
- vesting state is monotonic: `claimed_amount` increases and never exceeds `total_allocation`.
- vesting terminates automatically once the total allocation is exhausted.
- `revoke` is only enabled when `revocable == true`.
- This scaffold does not yet constrain exact output shapes, payout amounts, or refund accounting for revoked remainder.
- The current model advances `cliff_time` by `period` after each successful claim, effectively treating it as the next claim timestamp.

## KIP-20 Covenant ID handling

Claims are modeled as singleton state transitions with termination allowed, making Vesting a natural extension of the same stateful continuation shape used by Streaming Payment.

## Parameters

- `init_beneficiary`: beneficiary pubkey.
- `init_admin`: revocation/admin pubkey.
- `init_total_allocation`: full vesting allocation.
- `init_claimed_amount`: already claimed amount, normally `0`.
- `init_cliff_time`: first claim timestamp.
- `init_period`: spacing between claims.
- `init_release_per_period`: amount released each claim.
- `init_revocable`: whether the admin may revoke.

## Example usage

Use this for team allocations, contributor grants, investor lockups, and treasury emissions where a beneficiary should claim on a predictable schedule.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when vesting should depend on milestone completion instead of time.
- Do not use this when vesting must be continuously accrued at fine time granularity.
- Do not treat this scaffold as production-ready until it has output constraints, revocation accounting, and testnet exercise.
