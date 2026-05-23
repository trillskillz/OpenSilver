# KIP_REFERENCE.md

Pointer file. The actual extracted information from the four KIPs that govern OpenSilver pattern design (KIP-16, KIP-17, KIP-20, KIP-21) is in:

- **`references/kips/SUMMARY.md`** — opcode tables, architectural patterns, OpenSilver-impact callouts.
- **`references/kips/kip-0016.md`** — KIP-16 full text (Saefstroem, PR #31, OPEN). `OpZkPrecompile` + Groth16/RISC0-Succinct precompiles.
- **`references/kips/kip-0017.md`** — KIP-17 full text (Ori Newman, PR #32, OPEN). Extended introspection + byte-string opcodes.
- **`references/kips/kip-0020.md`** — KIP-20 full text (Michael Sutton, PR #35, OPEN; **Proposed, Implemented, Activated in TN12**). Covenant IDs.
- **`references/kips/kip-0021.md`** — KIP-21 full text (Michael Sutton, PR #36, OPEN, Draft). Partitioned sequencing commitment.

## Hard rules carried into pattern code

1. **KIP-20 is the foundation.** Every stateful OpenSilver pattern uses `#[covenant(binding = cov, ...)]` or explicit `OpInputCovenantId` lineage; recursive parent/grandparent-witness lineage proofs are an anti-pattern and `audit_covenant` (MCP tool, Phase 7) must flag them.
2. **`expectedTemplateHash` is trusted-source-only.** In `validateOutputStateWithTemplate` / `readInputStateWithTemplate`, this argument MUST come from a contract constant or a verified protocol commitment — never from caller witness.
3. **`MAX_SCRIPT_ELEMENT_SIZE = 520` is a hard byte cap** on any `OpCat`/`OpSubstr`/payload-substring result (KIP-17). State encodings exceeding this fail to compile or fail at runtime.
4. **ZK verifying keys + image IDs come from contract state, not caller witness** (KIP-16 patterns), mirroring rule 2.
5. **Lanes (KIP-21) may purge after inactivity window `F`.** Long-running patterns that key state to `tx.subnetwork_id` must explicitly re-anchor instead of assuming continuity.

## Reading order (for future contributors)

1. KIP-20 (foundation of every stateful pattern).
2. KIP-17 (the opcode surface every pattern compiles to).
3. KIP-16 (Phase 5 gate).
4. KIP-21 (refinement / vProgs forward-compat).
