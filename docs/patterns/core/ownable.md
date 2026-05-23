# Ownable

Status: scaffolded

## Summary

A minimal stateful access-control covenant that binds a single owner identity to a KIP-20-safe singleton state transition.

## Security considerations

- Ownership is keyed by `byte[32]`, expected to be `blake2b(pubkey)`.
- The transfer path requires the current owner signature and forbids no-op self-transfer.
- This scaffold does **not** yet include two-step handoff, recovery hooks, or timelocked acceptance.

## KIP-20 Covenant ID handling

This pattern is intended to compile through the singleton covenant declaration path so ownership rotation stays inside the same authenticated covenant lineage.

## Parameters

- `init_owner`: initial owner identifier stored in state.
- `next_owner`: next owner identifier supplied during transition.

## Example usage

Use this as the base policy for Vault, Pausable KRC-20 controllers, and any pattern that needs a single administrative actor.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Initial scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when control should be shared across multiple actors.
- Do not use this when you need social recovery or delayed ownership transfer.
- Do not treat this scaffold as production-ready until it has compiler tests, failure-mode analysis, and testnet exercise.
