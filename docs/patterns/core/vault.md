# Vault

Status: scaffolded

## Summary

A first enterprise-treasury-style composition of the earlier OpenSilver primitives:

- **Ownable** admin rotation via `owner` / `pending_owner`
- **MultiSig** signer quorum for protected treasury actions
- **TimeLock** delayed release via `unlock_time`

## Security considerations

- `release` requires both quorum approval and the beneficiary signature after `unlock_time`.
- `release` now constrains the terminal payout to a single beneficiary P2PK output with `input_value - minerFee` conservation on output 0.
- `extend_lock` is quorum-gated and forward-only.
- `reconfigure_signers` requires both owner approval and current-signer quorum.
- owner transfer follows a two-step handoff.
- This scaffold does not yet constrain exact output shapes, value conservation, or destination script templates.
- There is no emergency path yet beyond signer reconfiguration and lock extension.

## KIP-20 Covenant ID handling

All stateful admin and configuration paths are intended to remain in one singleton covenant lineage.

## Parameters

- `init_owner`, `init_pending_owner`: owner admin state.
- `init_threshold`, `init_pk1`, `init_pk2`, `init_pk3`: signer quorum configuration.
- `init_unlock_time`: earliest release time.
- `init_beneficiary`: final release beneficiary.

## Example usage

Use this as the starting point for treasury custody, vesting treasuries, team/community allocation vaults, and reserve-management patterns that need both delayed release and signer governance.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when releases depend on milestones, arbiters, or oracle settlement.
- Do not use this when you need batched outputs or fanout accounting.
- Do not treat this scaffold as production-ready until it has behavior tests, output-shape constraints, and testnet exercise.
