# Streaming Payment

Status: scaffolded

## Summary

A stateful recurring-payment scaffold inspired by the upstream Mecenas example, but modeled as an explicit covenant state machine.

Actors:
- **sender** funds and may cancel
- **recipient** withdraws recurring claims

State tracks:
- per-claim rate
- total allowance
- remaining allowance
- claim period
- next release time

## Security considerations

- `withdraw` requires recipient signature and `tx.time >= next_release_time`.
- `withdraw` now constrains output 0 to pay the recipient the actual claim amount, and terminal cancellation pays the sender `input_value - minerFee` on output 0.
- Stream state is monotonic: `remaining_allowance` decreases by the claim amount each successful withdrawal.
- The stream terminates automatically when allowance is exhausted.
- `cancel` currently acts as a terminal sender-authorized exit path.
- This scaffold now constrains the primary payout output, but it does not yet verify the continuation output's exact retained value/accounting.
- This scaffold also assumes a fixed amount per claim instead of continuously accrued fractional time accounting.

## KIP-20 Covenant ID handling

Withdrawals are modeled as singleton state transitions with termination allowed, making this a direct stateful continuation pattern under KIP-20-style covenant lineage.

## Parameters

- `init_sender`: sender pubkey.
- `init_recipient`: recipient pubkey.
- `init_rate_per_claim`: amount released per withdrawal.
- `init_total_allowance`: total planned allowance.
- `init_remaining_allowance`: starting remaining allowance.
- `init_period`: minimum delay between withdrawals.
- `init_next_release_time`: earliest next claim timestamp.

## Example usage

Use this for payroll, subscriptions, recurring grants, and staged disbursement flows where a beneficiary periodically pulls fixed-size payouts.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when payout should vest linearly every block or second.
- Do not use this when payouts depend on milestones or oracle conditions.
- Do not treat this scaffold as production-ready until it has output constraints, amount accounting, and testnet exercise.
