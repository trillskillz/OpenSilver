# MultiSig

Status: scaffolded

## Summary

A first OpenSilver MultiSig scaffold that generalizes the upstream fixed 2-of-3 example into a **configurable threshold over three explicit signers**, with a stateful `reconfigure` transition.

## Security considerations

- Current scaffold supports **three configured members** with threshold `1..3`.
- The three supplied signers for `spend` and `reconfigure` must be distinct.
- Each signer must both match a configured member and provide a valid signature.
- Reconfiguration is authorized by the **current** quorum, not the proposed next quorum.
- This scaffold does not yet support true N-of-M arrays, signer ordering normalization, absent-signature compaction, or batched key-rotation ergonomics.

## KIP-20 Covenant ID handling

The `reconfigure` path is intended to compile through a singleton state transition so key rotation stays in the same covenant lineage.

## Parameters

- `init_threshold`: starting threshold, constrained to `1..3`.
- `init_pk1`, `init_pk2`, `init_pk3`: initial configured signers.
- `next_threshold`, `next_pk1`, `next_pk2`, `next_pk3`: proposed next signer set during `reconfigure`.

## Example usage

Use this as the base quorum policy for Vault, Social Recovery, enterprise treasury flows, and any pattern that needs threshold authorization before a state transition.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when you need more than three configured signers.
- Do not use this when signer anonymity or signature aggregation matters.
- Do not treat this scaffold as production-ready until it has behavior tests, cost measurements, and testnet exercise.
