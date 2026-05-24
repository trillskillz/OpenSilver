# TimeLock

Status: scaffolded

## Summary

A baseline time-locked covenant with two operating modes:

- **hard timelock**: beneficiary can claim after `unlock_time`, no owner cancellation
- **soft timelock**: owner can cancel before `unlock_time`

This scaffold also includes an owner-authorized `extend_lock` state transition so the same covenant lineage can move the unlock date forward.

## Security considerations

- `claim` requires both the beneficiary signature and `tx.time >= unlock_time`.
- `claim` now constrains the terminal payout to a single beneficiary P2PK output with `input_value - minerFee` conservation on output 0.
- `cancel` is only enabled when `soft_cancel_enabled == true`.
- `cancel` now enforces strict pre-unlock behavior with `tx.locktime < unlock_time` and constrains the terminal payout to a single owner P2PK output with `input_value - minerFee` conservation on output 0.
- `extend_lock` can only move the lock **forward**, never backward.
- This scaffold uses explicit `pubkey` state fields instead of hashed identifiers for simplicity; that may not be the final OpenSilver convention for all composable patterns.
- This scaffold does not yet constrain transaction outputs or preserve value across transitions beyond the singleton continuation requirement.

## KIP-20 Covenant ID handling

The `extend_lock` path is intended to compile through the singleton covenant declaration surface so lock extensions remain inside the same authenticated covenant lineage.

## Parameters

- `init_owner`: administrative key that may extend or, in soft mode, cancel.
- `init_beneficiary`: claimant key after unlock.
- `init_unlock_time`: earliest `tx.time` at which `claim` succeeds.
- `init_soft_cancel_enabled`: chooses hard (`false`) or soft (`true`) behavior.

## Example usage

Use this as a building block for Vaults, Vesting schedules, escrow timeout fallbacks, and dead-man-switch style release paths.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold with runtime coverage on claim / cancel / extend paths.

## WHEN NOT TO USE THIS

- Do not use this when release conditions depend on multiple signers, oracles, or milestone state.
- Do not use this when you need automatic recurring release; use a streaming or vesting pattern instead.
- Do not treat this scaffold as production-ready until it has cost measurements, testnet exercise, and external review.
