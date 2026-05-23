# KIP_REFERENCE.md

Per-KIP notes used by every OpenSilver pattern. Draft — populated during Phase 1; populated here in advance only to capture **what we need from each KIP** so reading is targeted.

## KIP-17 — Extended script opcodes

What we need to extract:
- Full opcode list and operand types
- New introspection opcodes (input/output value, scriptPubKey, sequence, locktime)
- Any state-aware opcodes Toccata adds beyond what TN12 ships
- Cost (sigops / weight) of each new opcode — required for `benchmarks/`
- Stack-depth changes that affect pattern design

OpenSilver dependency: every pattern compiles to these opcodes. Cost benchmarks (`opensilver benchmark`) read from this reference.

## KIP-20 — Covenant IDs (CRITICAL)

What we need to extract:
- Exact definition of a Covenant ID (commitment scheme)
- How a Covenant ID is computed at deploy time
- How `OpInputCovenantId(witnessIndex)` reads a sibling input's covenant ID (seen in `kcc20.sil`)
- Rules for lineage continuation across spend transactions
- Failure modes (cov ID forgery, reorg behaviour, reuse across transitions)

OpenSilver hard rule: **every stateful pattern uses KIP-20 cov IDs. Recursive lineage proofs are an anti-pattern.** This means:
- `IDENTIFIER_COVENANT_ID = 0x02` is the default identifier type in our KRC-20 reference (4.1).
- `validateOutputState` calls in our stateful patterns must commit to the same cov ID lineage.
- `audit_covenant` (MCP tool, Phase 7) must flag any pattern that re-derives state from full input history instead of cov ID.

## KIP-16 — ZK opcodes + verifier precompile

What we need to extract:
- Verifier precompile address / call convention
- Supported proof systems (Groth16 confirmed via Saefstroem PR; any others?)
- Verifying-key commitment format on-chain
- Gas / size cost of a verify operation (so 5.1–5.4 patterns can document realistic UX)
- Whether public inputs are sized / hashed / serialized — interacts with state encoding

OpenSilver Phase 5 patterns (5.1 Verified Computation, 5.2 Private Asset, 5.3 ZK Oracle, 5.4 Proof-Stitched) all sit on this KIP.

## KIP-21 — Sequencing commitments

What we need to extract:
- Sequence number / ordering semantics
- Interaction with reorgs
- Use in streaming / vesting / replay protection
- Whether sequencing commitments replace any of our current `this.age` / `tx.time` gates

Relevant to 3.3 TimeLock, 3.7 Streaming, 3.8 Vesting.

## Reading order

1. KIP-20 first (foundation of every stateful pattern).
2. KIP-17 second (the opcode surface every pattern lives in).
3. KIP-16 third (Phase 5 gate).
4. KIP-21 last (refinement layer).

Each KIP will get its own `references/kips/kip-<n>.md` summary file once read, with quoted-relevant-bits + OpenSilver-impact section.
