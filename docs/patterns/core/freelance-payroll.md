# Freelance / Payroll

Status: scaffolded

## Summary

A three-party work-payment scaffold for client/worker relationships with optional arbitration.

Actors:
- **client** funds the agreement
- **worker** receives payout on successful completion
- **arbiter** resolves disputes

Paths:
- `standard_release` with client + worker agreement
- `arbiter_refund` with arbiter + client approval
- `arbiter_payout` with arbiter + worker approval
- `timeout_reclaim` for client recovery after timeout

## Security considerations

- Happy-path release requires both client and worker signatures.
- Dispute paths require arbiter participation plus the destination party signature.
- Timeout reclaim protects the client if work stalls.
- This scaffold does not yet constrain exact payout outputs, milestone partials, invoices, or evidence attachments.
- This scaffold is terminal rather than stateful; milestone payroll would layer on top of Escrow (milestone).

## KIP-20 Covenant ID handling

This baseline freelance/payroll scaffold is modeled as a terminal spend pattern. More advanced payroll flows can compose the milestone escrow state machine later.

## Parameters

- `init_client`: client pubkey.
- `init_worker`: worker pubkey.
- `init_arbiter`: arbiter identifier stored as `blake2b(pubkey)`.
- `init_timeout`: client reclaim timeout.

## Example usage

Use this for freelance commissions, one-off contractor deals, payroll disbursement disputes, and service agreements where a neutral third party may need to resolve payout direction.

## Gas / size notes

Benchmarking not yet recorded.

## Audit status

Not audited. Compiler-validated scaffold only.

## WHEN NOT TO USE THIS

- Do not use this when payment should stream continuously or vest over time.
- Do not use this when work releases in multiple milestones unless the milestone escrow layer is added.
- Do not treat this scaffold as production-ready until it has output constraints, amount checks, and testnet exercise.
