# Escrow (bilateral)

Status: scaffolded

## Summary

A bilateral escrow scaffold with three actors:

- **buyer** funds the escrow
- **seller** is the intended payout recipient on successful delivery
- **arbiter** resolves disputes by authorizing either release or refund

This first scaffold exposes three release paths:
- `release_to_seller`
- `refund_to_buyer`
- `timeout_reclaim`

## Security considerations

- Normal release requires both arbiter approval and seller participation.
- Refund requires both arbiter approval and buyer participation.
- Timeout reclaim allows the buyer to recover after `timeout`.
- This scaffold does not yet constrain exact output shape, amounts, or script destinations.
- This scaffold does not yet include milestone state, partial releases, or arbiter replacement.

## KIP-20 Covenant ID handling

This baseline bilateral escrow is currently modeled as a terminal-release scaffold. A future stateful milestone escrow variant will need explicit KIP-20 lineage handling.

## Parameters

- `init_buyer`: buyer pubkey.
- `init_seller`: seller pubkey.
- `init_arbiter`: arbiter identifier stored as `blake2b(pubkey)`.
- `init_timeout`: buyer timeout reclaim threshold.

## Example usage

Use this for freelance deals, OTC swaps with human arbitration, and marketplace transactions where a neutral dispute resolver decides buyer vs seller payout.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when funds should stream or release in milestones.
- Do not use this when arbitration should be automatic or oracle-driven.
- Do not treat this scaffold as production-ready until it has output constraints, value checks, and testnet exercise.
