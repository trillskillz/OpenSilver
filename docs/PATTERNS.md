# Pattern selection guide

Use-case-indexed decision tree for picking the right OpenSilver
pattern. Read this when you know *what you want to build* but don't
yet know which of the 22 patterns to reach for.

For per-pattern walkthroughs, see [`examples/`](../examples/README.md).
For the design rationale behind each pattern, see
[`docs/patterns/`](./patterns/) (organised by phase).

## Index by use case

- [I want to control who can spend funds](#i-want-to-control-who-can-spend-funds)
- [I want funds released after a time](#i-want-funds-released-after-a-time)
- [I want a periodic payout schedule](#i-want-a-periodic-payout-schedule)
- [I want a third party to mediate a transaction](#i-want-a-third-party-to-mediate-a-transaction)
- [I want to swap with someone on another chain](#i-want-to-swap-with-someone-on-another-chain)
- [I want recovery options for lost keys](#i-want-recovery-options-for-lost-keys)
- [I want to issue a fungible token](#i-want-to-issue-a-fungible-token)
- [I want zero-knowledge proofs to gate spends](#i-want-zero-knowledge-proofs-to-gate-spends)

## I want to control who can spend funds

| If you need | Pick | Why |
| --- | --- | --- |
| One authorised key, rotatable safely | **[Ownable (3.1)](./patterns/core/ownable.md)** | Two-step handoff prevents single-tx ownership theft |
| N-of-M signer quorum | **[MultiSig (3.2)](./patterns/core/multisig.md)** | Threshold approval with a stateful reconfiguration path |
| Everything above + a timer + a beneficiary slot | **[Vault (3.4)](./patterns/core/vault.md)** | The flagship treasury pattern — N-of-M release after `unlock_time`, owner-handoff for ops keys, signer rotation |

**Don't layer Ownable + MultiSig + TimeLock yourself.** Vault already
contains all three. Layering them as separate covenants creates two
owner slots, two threshold slots, and two timers that can drift apart.

## I want funds released after a time

| If you need | Pick | Why |
| --- | --- | --- |
| A one-shot release at a fixed time | **[TimeLock (3.3)](./patterns/core/timelock.md)** | Three lifecycle paths: claim after unlock, soft-cancel before unlock (optional), forward-only `extend_lock` |
| A release gated by both timer AND signer quorum | **[Vault (3.4)](./patterns/core/vault.md)** | TimeLock with a 2-of-3 (configurable) approval layer on top |

**The TimeLock `cancel` window** is `tx.locktime < unlock_time`
strictly — the moment the timer elapses, soft-cancel is gone. Set
`soft_cancel_enabled = false` if you want a commit-and-forget gift
that you cannot rescind.

## I want a periodic payout schedule

| If you need | Pick | Why |
| --- | --- | --- |
| Periodic payment from day one | **[Streaming Payment (3.7)](./patterns/core/streaming-payment.md)** | No cliff; first release at `next_release_time`, sender can cancel |
| Periodic payment AFTER a cliff date | **[Vesting (3.8)](./patterns/core/vesting.md)** | Same shape as streaming but with a cliff before any release; revocable flag |
| Periodic NEW TOKEN issuance (not spending an existing balance) | **[KCC20Vesting (4.5)](./patterns/tokens/kcc20-vesting.md)** | Beneficiary-signed mint schedule; bounds future issuance, not an existing pool |

The Streaming / Vesting / KCC20Vesting trio all use the same
`termination = allowed` singleton shape — wallets can share helpers.
The selection turns entirely on whether the funds *already exist*
(Streaming, Vesting) or are being *minted* by the schedule
(KCC20Vesting).

## I want a third party to mediate a transaction

| If you need | Pick | Why |
| --- | --- | --- |
| One-shot release / refund decision with a tiebreaker | **[Bilateral Escrow (3.5)](./patterns/core/escrow-bilateral.md)** | Buyer + seller + arbiter; arbiter never holds funds, only tilts direction |
| Multiple deliverables, each individually signed off | **[Milestone Escrow (3.6)](./patterns/core/escrow-milestone.md)** | Stateful counter advances per approved milestone; final release only when all approved |
| Payroll / freelance shape — happy path is mutual, no arbiter needed | **[Freelance / Payroll (3.12)](./patterns/core/freelance-payroll.md)** | `standard_release` doesn't touch arbiter; client-favored timeout (vs buyer-favored for bilateral escrow) |

The arbiter slot is a **blake2b hash** of the arbiter pubkey in all
three patterns. The arbiter only reveals their identity at the moment
they have to act, which means a single arbiter keypair can serve many
escrows without their participation in any specific deal being public.

## I want to swap with someone on another chain

Pick **[Atomic Swap HTLC (3.11)](./patterns/core/atomic-swap-htlc.md)**.

Two HTLCs deployed on two chains with the same secret hash. Whoever
claims first reveals the preimage, which forces the second leg.
Construct asymmetrically: first leg longer timeout (48h), second
shorter (24h). Don't deploy with equal timeouts — that's a known
griefable shape.

## I want recovery options for lost keys

| If you need | Pick | Why |
| --- | --- | --- |
| One fallback recipient, owner keepalive via `ping` | **[Dead Man's Switch (3.9)](./patterns/core/dead-man-switch.md)** | Simplest shape; uses `OpCheckSequenceVerify` for the inactivity timer |
| Guardian quorum + delayed activation so the owner can veto | **[Social Recovery (3.10)](./patterns/core/social-recovery.md)** | M-of-N guardians propose, owner has `recovery_delay` window to cancel |

Pick DMS when there's a single trusted fallback (estate planning,
single backup). Pick Social Recovery when guardians are mutually
distrustful — the delayed-activation window protects against
guardian-quorum collusion.

## I want to issue a fungible token

Use the **KCC20 family (Phase 4)**. Deploy the asset contract
([4.1 KCC20](./patterns/tokens/kcc20.md)) once, then pick a
controller covenant for your issuance policy:

| Issuance policy | Controller |
| --- | --- |
| Admin discretion + safe admin rotation | **[KCC20Ownable (4.2)](./patterns/tokens/kcc20-ownable.md)** |
| Emergency mint halt (transfers unaffected) | **[KCC20Pausable (4.3)](./patterns/tokens/kcc20-pausable.md)** |
| Hard supply cap | **[KCC20Capped (4.4)](./patterns/tokens/kcc20-capped.md)** |
| Time-gated mint schedule | **[KCC20Vesting (4.5)](./patterns/tokens/kcc20-vesting.md)** |
| Snapshot reads for governance | _(KCC20Snapshot 4.6 — deferred until KIP-21 lane stability)_ |

KCC20 deploys are **three-phase** (controller genesis → asset
genesis + controller init → operations). Don't try to use
`opensilver deploy-plan` as a one-shot for KCC20 — use the SDK
helper `buildKcc20DeploymentBundle` that handles all three stages.
See [`examples/tokens/`](../examples/tokens/README.md) for the lifecycle
explainer.

A combined controller (e.g. Capped + Pausable + Ownable in one) is a
future 4.7+ deliverable. v1 keeps each controller single-policy so
the audit surface is bounded.

## I want zero-knowledge proofs to gate spends

Phase-5 patterns. They all require the OpenSilver patch lane
(`npm run patch:silverc:zk`) before they compile.

| If you need | Pick | Why |
| --- | --- | --- |
| Pay a prover for off-chain computation | **[Verified Computation (5.1)](./patterns/zk/verified-computation.md)** | Reference ZK pattern: VK + recipient + prover are state; proof + signature gate the release |
| Privacy-preserving payment (covenant half) | **[Private Asset Transfer (5.2)](./patterns/zk/private-asset-transfer.md)** | Pins commitment_root + recipient; v1 honest-scope notes apply |
| Trust-minimised oracle (data correctness AND publish authority) | **[ZK-Verified Oracle (5.3)](./patterns/zk/zk-verified-oracle.md)** | M-of-N guardians + Groth16 proof; both required to publish |
| Batch payout with amortised proof cost | **[Proof-Stitched Multi-Pattern (5.4)](./patterns/zk/proof-stitched-multi-pattern.md)** | KIP-20 leader/delegate split: leader runs proof once, delegates trust via shared cov-id |

**The covenant is a verifier, not a prover.** OpenSilver does not
ship circuits. Your deployment must pair the covenant with a Groth16
circuit you author — for the v1 patterns above, that's the
deployment author's responsibility. Read each pattern's
"What this v1 does NOT do" section before treating any of these as
production-ready.

## What if no pattern fits?

The 22 patterns cover the standard library shape (OZ equivalent for
Kaspa L1). If your use case isn't here:

1. **Check the design docs** at `docs/patterns/<phase>/<name>.md`.
   Each has a "WHEN NOT TO USE THIS" section that may rule out a
   close-but-wrong fit.
2. **Compose existing patterns** before authoring a new one.
   Vault + Bilateral Escrow + Atomic Swap is a meaningful chunk of
   the design surface; combine them as separate covenants in the
   same wallet flow.
3. **Author a new pattern** by forking the closest existing scaffold
   and following the structure (contract + design doc + compile test
   + runtime test + AUDIT_CHECKLIST entry). Open a PR — the catalogue
   is meant to grow.

## Cross-references

- **Per-pattern walkthroughs**: [`examples/`](../examples/README.md)
- **End-to-end deploy guide**: [`docs/DEPLOY_GUIDE.md`](./DEPLOY_GUIDE.md)
- **Audit posture per pattern**: [`AUDIT_CHECKLIST.md`](../AUDIT_CHECKLIST.md)
- **Web Wizard**: `npm run wizard:build` then open `wizard/build/index.html`
- **CLI**: `npx opensilver list` for the live pattern index
