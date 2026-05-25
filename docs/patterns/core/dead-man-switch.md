# Dead Man's Switch

Status: scaffolded

## Summary

A stateful inheritance / recovery scaffold where a fallback party may claim funds if the owner does not keep the covenant alive.

Actors:
- **owner** keeps the switch alive with `ping`
- **fallback** claims after inactivity timeout

Paths:
- `claim` for fallback after timeout age
- `ping` for owner keepalive continuation
- `update_fallback` for owner-managed beneficiary rotation

## Security considerations

- `claim` requires fallback signature and `this.age >= timeout_age`.
- `ping` lets the owner continue the covenant state.
- `update_fallback` lets the owner rotate the fallback identity.
- This scaffold does not yet constrain output shapes, value preservation, or exact reset semantics for the inactivity timer.
- `last_ping_age` is tracked as state metadata for future richer logic, but this first scaffold still relies on `this.age` as the enforceable timeout primitive.

## KIP-20 Covenant ID handling

Keepalive and fallback updates are modeled as singleton state transitions, making this a direct continuation pattern under KIP-20-style state lineage.

## Parameters

- `init_owner`: owner pubkey stored directly in state.
- `init_fallback`: fallback pubkey stored directly in state.
- `init_timeout_age`: inactivity threshold expressed against `this.age`.
- `init_last_ping_age`: tracked metadata for the last keepalive state.

## Example usage

Use this for inheritance flows, contingency treasury recovery, solo-operator failover, and dormant-account release logic.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not externally audited. Internal audit posture is now clean of the earlier byte[32]-state-write compiler hazard: this pattern uses direct `pubkey` state instead of hashed `byte[32]` owner/fallback slots, matching the safer workaround already used in Ownable v1 / SocialRecovery.

## WHEN NOT TO USE THIS

- Do not use this when recovery should require multiple guardians or a quorum.
- Do not use this when claim conditions depend on off-chain attestations or milestone proof.
- Do not use this if hidden owner/fallback commitments matter more than compiler compatibility; this v1 keeps pubkeys explicit in state.
- Do not treat this scaffold as production-ready until it has output constraints, clearer timer semantics, and testnet exercise.
