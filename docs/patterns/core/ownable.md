# Ownable

Status: scaffolded

## Summary

A minimal stateful access-control covenant that binds a single owner identity to a KIP-20-safe singleton state transition.

This version uses a **two-step ownership handoff**:
1. current owner proposes a `pending_owner`
2. pending owner accepts the transfer
3. current owner can cancel before acceptance

## Security considerations

- Ownership is keyed by `byte[32]`, expected to be `blake2b(pubkey)`.
- The proposal path forbids zero-owner proposals, self-transfers, and duplicate pending-owner proposals.
- Acceptance requires the pending owner's signature.
- Cancellation requires the current owner's signature.
- The zero hash `byte[32](0)` is used as the sentinel for "no pending owner".
- This scaffold still lacks recovery hooks, timelocked acceptance, and explicit event/indexing glue.

## KIP-20 Covenant ID handling

This pattern is intended to compile through the singleton covenant declaration path so ownership rotation stays inside the same authenticated covenant lineage.

## Parameters

- `init_owner`: initial owner identifier stored in state.
- `init_pending_owner`: initial pending-owner sentinel, normally `byte[32](0)`.
- `next_owner`: proposed next owner identifier supplied during `propose_transfer`.

## Example usage

Use this as the base policy for Vault, Pausable KRC-20 controllers, and any pattern that needs a single administrative actor with safer ownership rotation semantics than a one-shot transfer.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when control should be shared across multiple actors.
- Do not use this when you need social recovery, quorum approval, or timelocked guardian intervention.
- Do not treat this scaffold as production-ready until it has behavioral tests, failure-mode analysis, and testnet exercise.
