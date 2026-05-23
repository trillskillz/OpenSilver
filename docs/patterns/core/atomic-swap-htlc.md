# Atomic Swap (HTLC)

Status: scaffolded

## Summary

A hash time-locked contract scaffold for atomic exchange flows.

Actors:
- **recipient** claims by revealing a secret preimage
- **refunder** recovers after timeout

Paths:
- `claim` with matching secret preimage and recipient signature
- `refund` after timeout with refunder signature

## Security considerations

- `claim` requires both recipient authorization and a secret matching `secret_hash`.
- `refund` requires `tx.time >= timeout`.
- This scaffold uses `blake2b(secret)` as the hash-lock primitive.
- This scaffold does not yet constrain output shapes, cross-chain coordination, or proof of reciprocal lock placement.
- Secret sizing, reveal encoding, and swap coordination policy still need tightening for production use.

## KIP-20 Covenant ID handling

This baseline HTLC scaffold is modeled as a terminal spend pattern rather than a continuing stateful contract.

## Parameters

- `init_recipient`: claimant pubkey.
- `init_refunder`: refund pubkey.
- `init_secret_hash`: hash-lock commitment.
- `init_timeout`: refund timeout timestamp.

## Example usage

Use this for same-chain conditional swaps, escrowed secret reveals, and as the local-leg primitive for cross-chain HTLC coordination.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when you need milestone progression or ongoing stateful accounting.
- Do not use this as a full cross-chain swap solution without the paired remote leg and coordination rules.
- Do not treat this scaffold as production-ready until secret-handling, output constraints, and swap choreography are tightened.
