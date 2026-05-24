# Social Recovery

Status: scaffolded; runtime-verified

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
- Pending-owner state is gated by a `bool has_pending_owner` flag — the pubkey slot is never literally cleared, only the flag is flipped. Same lowering-driven shape as Ownable; see Ownable's doc for the rationale.
- This scaffold does not yet model guardian rotation, owner-initiated guardian updates, or explicit activation-time derivation from `recovery_delay`.
- This scaffold also does not yet constrain exact output shapes or recovery notification side effects.

## KIP-20 Covenant ID handling

Recovery initiation, cancellation, and finalization are modeled as `#[covenant.singleton(mode = transition)]` state transitions, so recovery stays inside the same authenticated covenant lineage.

## Parameters

- `init_owner` (pubkey): current owner pubkey.
- `init_has_pending_owner` (bool): whether the deployment starts with a pending recovery in flight. Typically `false`.
- `init_pending_owner` (pubkey): pending-owner pubkey. When `init_has_pending_owner = false` this slot is unused; pass any 32-byte placeholder.
- `init_guardian_threshold` (int): threshold across three explicit guardians.
- `init_guardian1`, `init_guardian2`, `init_guardian3` (pubkey): guardian pubkeys.
- `init_activation_time` (int): earliest finalization timestamp.
- `init_recovery_delay` (int): tracked delay metadata for future richer derivation logic.

## Example usage

Use this for wallet recovery, treasury admin fallback, and contracts where a trusted guardian set should restore access if the owner key is lost.

## Runtime coverage

`runtime-tests/tests/core_runtime.rs` exercises:
- `social_recovery_initiate_accepts_guardian_quorum` — 2-of-3 guardians initiate a recovery with attacker-padded third slot.
- `social_recovery_cancel_accepts_owner_signature` — current owner cancels a pending recovery.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold + runtime engine verification.

## WHEN NOT TO USE THIS

- Do not use this when recovery should be immediate and owner cancellation is undesirable.
- Do not use this when guardian membership is large or dynamic unless a richer guardian registry exists.
- Do not use this when you need post-quantum pubkey hiding on the owner slot — same trade-off as Ownable.
- Do not treat this scaffold as production-ready until guardian rotation, output constraints, and activation-delay semantics are tightened.
