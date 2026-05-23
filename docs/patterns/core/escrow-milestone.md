# Escrow (milestone)

Status: scaffolded

## Summary

A stateful milestone escrow scaffold where work progresses across a fixed number of milestones before final seller release.

Actors:
- **buyer** funds the deal
- **seller** completes work
- **arbiter** approves milestones or resolves disputes

Paths:
- `approve_milestone` advances milestone state by one
- `final_release` releases only after all milestones are complete
- `dispute_refund` lets arbiter refund the buyer
- `timeout_reclaim` lets buyer recover after timeout

## Security considerations

- Milestone progression is monotonic: `completed_milestones` can only increase by one.
- `final_release` requires full completion and now constrains a single seller P2PK payout on output 0 with `input_value - minerFee` conservation.
- Refund requires arbiter plus buyer participation and now constrains a single buyer P2PK payout on output 0 with `input_value - minerFee` conservation.
- Timeout reclaim remains a buyer-protection path and now constrains the same buyer payout shape.
- `approve_milestone` now constrains the authenticated continuation output count to one and preserves `input_value - minerFee` on that continuation output.
- This scaffold still does not encode per-milestone payout accounting or partial withdrawals.

## KIP-20 Covenant ID handling

This is the first escrow scaffold in the repo that actually depends on stateful continuation. Milestone progression is intended to stay in a singleton covenant lineage, making it the bridge from the bilateral terminal escrow to more complete stateful payment flows.

## Parameters

- `init_buyer`: buyer pubkey.
- `init_seller`: seller pubkey.
- `init_arbiter`: arbiter identifier stored as `blake2b(pubkey)`.
- `init_total_milestones`: total milestone count.
- `init_completed_milestones`: starting completed count, normally `0`.
- `init_timeout`: buyer timeout reclaim threshold.

## Example usage

Use this for freelance contracts, grant disbursements, or delivery agreements that need multiple checkpoints before final release.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when all funds should release in one shot; bilateral escrow is simpler.
- Do not use this when payout amounts differ per milestone unless the accounting layer is added.
- Do not treat this scaffold as production-ready until it has output constraints, value accounting, and testnet exercise.
