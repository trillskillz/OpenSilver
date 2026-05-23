# Social Recovery

Status: scaffolded

## Summary

A stateful social-recovery scaffold where a guardian quorum may propose a new owner and the candidate finalizes control after a delay.

Actors:
- **owner** may cancel a pending recovery
- **guardians** authorize recovery initiation
- **pending owner** finalizes after activation time

Paths:
- `initiate_recovery` with guardian quorum
- `finalize_recovery` by pending owner after delay
- `cancel_recovery` by current owner

## Security considerations

- Guardian approvals are threshold-gated across three explicit guardian keys.
- Recovery is delayed through `activation_time` to give the current owner time to react.
- Finalization requires the pending owner's signature.
- This scaffold does not yet model guardian rotation, owner-initiated guardian updates, or explicit activation-time derivation from `recovery_delay`.
- This scaffold also does not yet constrain exact output shapes or recovery notification side effects.

## KIP-20 Covenant ID handling

Recovery initiation, cancellation, and finalization are modeled as singleton state transitions, making this a continuation-style access-control recovery pattern.

## Parameters

- `init_owner`: current owner identifier stored as `blake2b(pubkey)`.
- `init_pending_owner`: proposed recovery target, normally zeroed when idle.
- `init_guardian_threshold`: threshold across three explicit guardians.
- `init_guardian1`, `init_guardian2`, `init_guardian3`: guardian pubkeys.
- `init_activation_time`: earliest finalization timestamp.
- `init_recovery_delay`: tracked delay metadata for future richer derivation logic.

## Example usage

Use this for wallet recovery, treasury admin fallback, and contracts where a trusted guardian set should restore access if the owner key is lost.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when recovery should be immediate and owner cancellation is undesirable.
- Do not use this when guardian membership is large or dynamic unless a richer guardian registry exists.
- Do not treat this scaffold as production-ready until guardian rotation, output constraints, and activation-delay semantics are tightened.
