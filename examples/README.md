# examples/

End-to-end worked examples for OpenSilver patterns. Each example
walks through the full deploy + lifecycle flow using the shipped
tooling (Wizard, `opensilver deploy-plan`, runtime-tested entrypoint
shapes) with copy-pasteable commands.

## Start here

- **[`ownable/`](./ownable/README.md)** — canonical worked example.
  Demonstrates the wizard → deploy-plan → fund → spend lifecycle that
  every other pattern follows. Read this first; the other 21 patterns
  swap pattern ids but keep the same shape.

## Token patterns (Phase 4 — KCC20 family)

The KCC20 family lives under [`examples/tokens/`](./tokens/README.md).
Token deploys are **three-phase** (controller genesis → asset genesis +
controller init → operations), which differs meaningfully from the
one-shot deploy shape used by core patterns; the tokens README
explains the lifecycle and points at the SDK helpers that compute the
template-binding ctor args. Five walkthroughs are paste-ready: the
KCC20 asset reference (4.1), KCC20Ownable (4.2), KCC20Pausable (4.3),
KCC20Capped (4.4), and KCC20Vesting (4.5). KCC20Snapshot (4.6) waits
on upstream KIP-21 lane stability.

## Other core patterns

The remaining directories hold per-pattern lifecycle stubs. They share
the same flow as the Ownable example — the difference is which
entrypoints are exposed and what state the singleton transition writes.
For the exact on-chain shapes per pattern, point your wallet at the
runtime tests under [`runtime-tests/tests/`](../runtime-tests/tests/),
which are the executable source of truth for each entrypoint.

| Pattern | Directory | Entrypoints |
| --- | --- | --- |
| Atomic Swap (HTLC) | [`atomic-swap/`](./atomic-swap/README.md) | `claim`, `refund` |
| Dead Man's Switch | [`dead-man-switch/`](./dead-man-switch/README.md) | `ping`, `claim`, `rotate_fallback` |
| Escrow (bilateral) | [`escrow/`](./escrow/README.md) | `release`, `refund`, `timeout` |
| Escrow (milestone) | [`escrow-milestone/`](./escrow-milestone/README.md) | `approve_milestone`, `final_release`, `dispute_refund`, `timeout_reclaim` |
| Freelance / Payroll | [`freelance-payroll/`](./freelance-payroll/README.md) | `mutual_release`, `arbiter_payout`, `arbiter_refund`, `timeout_reclaim` |
| MultiSig | [`multisig/`](./multisig/README.md) | `spend`, `reconfigure` |
| Ownable | [`ownable/`](./ownable/README.md) | `propose_transfer`, `accept_transfer`, `cancel_transfer` |
| Social Recovery | [`social-recovery/`](./social-recovery/README.md) | `initiate_recovery`, `cancel_recovery`, `finalize_recovery` |
| Streaming Payment | [`streaming-payment/`](./streaming-payment/README.md) | `withdraw`, `cancel` |
| TimeLock | [`timelock/`](./timelock/README.md) | `claim`, `cancel`, `extend` |
| Vault | [`vault/`](./vault/README.md) | `release`, `extend`, `reconfigure`, `propose_owner_transfer`, `accept_owner_transfer` |
| Vesting | [`vesting/`](./vesting/README.md) | `claim`, `revoke` |

## What an example is, and isn't

**An example is**: a paste-ready walkthrough of the tooling against one
pattern. It shows the wizard, the CLI command shapes, the deploy-plan
JSON fields a wallet consumes, and the lifecycle paths the runtime
tests already verify.

**An example is not**: a deployable script. Address derivation, fee
estimation, and broadcast belong to whatever `kaspa-wasm` version your
wallet ships. OpenSilver provides the covenant scripts, the manifest
metadata, and a `P2shAddressDeriver` integration seam — the rest is
wallet-layer.
