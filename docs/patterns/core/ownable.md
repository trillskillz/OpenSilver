# Ownable

Status: scaffolded; runtime-verified

## Summary

A minimal stateful access-control covenant that binds a single owner identity to a KIP-20-safe singleton state transition.

This version uses a **two-step ownership handoff**:
1. current owner proposes a `pending_owner`
2. pending owner accepts the transfer
3. current owner can cancel before acceptance

## Security considerations

- Ownership is keyed by raw `pubkey` rather than `blake2b(pubkey)`. See "WHEN NOT TO USE THIS" for the trade-off.
- Pending-owner state is gated by a `bool has_pending_owner` flag — the pubkey slot is never literally cleared, only the flag is flipped. This avoids the current silverscript compiler's NUM2BIN-on-byte[32]-state-writes cap (8-byte limit), which would otherwise reject the cancel/accept paths.
- The proposal path forbids self-transfers.
- Acceptance requires the pending owner's signature AND `has_pending_owner == true`.
- Cancellation requires the current owner's signature AND `has_pending_owner == true`.
- This scaffold still lacks recovery hooks, timelocked acceptance, and explicit event/indexing glue.

## KIP-20 Covenant ID handling

This pattern compiles through the `#[covenant.singleton(mode = transition)]` declaration path so ownership rotation stays inside the same authenticated covenant lineage. All three entrypoints (`propose_transfer`, `accept_transfer`, `cancel_transfer`) preserve the covenant-id chain.

## Parameters

- `init_owner` (pubkey): initial owner pubkey stored in state.
- `init_has_pending_owner` (bool): whether the deployment starts with a pending owner. Typically `false`.
- `init_pending_owner` (pubkey): initial pending-owner pubkey. When `init_has_pending_owner = false` this slot is unused; pass any 32-byte placeholder (e.g. the owner pubkey itself).
- `next_owner` (pubkey, runtime arg): proposed next owner pubkey supplied during `propose_transfer`.

## Example usage

Use this as the base policy for Vault, Pausable KRC-20 controllers, and any pattern that needs a single administrative actor with safer ownership rotation semantics than a one-shot transfer.

## Runtime coverage

`runtime-tests/tests/core_runtime.rs` exercises:
- `ownable_propose_transfer_accepts_owner_sig` — happy-path proposal under a covenant context.
- `ownable_propose_transfer_rejects_wrong_owner_sig` — attacker signature in place of owner.
- `ownable_accept_transfer_completes_handoff` — pending owner promotes themselves.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold + runtime engine verification.

## WHEN NOT TO USE THIS

- Do not use this when control should be shared across multiple actors.
- Do not use this when you need social recovery, quorum approval, or timelocked guardian intervention.
- **Do not use this when you need post-quantum pubkey hiding on the owner slot.** Ownable v1 stores raw pubkeys in state, which exposes them at deploy time rather than committing-and-hiding behind blake2b. A hash-keyed variant would be preferable for post-quantum threat models, but it cannot be expressed under the current silverscript compiler's lowering — the NUM2BIN cap on byte[32] state writes prevents `byte[32]` state slots from being mutated via singleton transitions. When the compiler lowering uses OP_PUSHDATA for byte[32] state writes (upstream fix), an `OwnableHashed` variant of this pattern should be added that stores `blake2b(pubkey)` instead.
- Do not treat this scaffold as production-ready until it has external audit and 30 days of mainnet usage.
