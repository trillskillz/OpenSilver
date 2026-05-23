# KIP summaries for OpenSilver pattern authors

Source PRs (all OPEN as of 2026-05-23 in `kaspanet/kips`):
- KIP-16 — Saefstroem, `saefstroem:kip16`, PR #31
- KIP-17 — Ori Newman, `someone235:kip17`, PR #32
- KIP-20 — Michael Sutton, `michaelsutton:kip20`, PR #35 (status: **Proposed, Implemented, Activated in TN12**)
- KIP-21 — Michael Sutton, `michaelsutton:kip21`, PR #36 (Draft)

Full text of each is in this directory.

---

## KIP-17 — Covenants and Improved Scripting Capabilities (Ori Newman)

**Surface for OpenSilver:**

| Family | Opcode | Used by |
| --- | --- | --- |
| Transaction-level | `OpTxVersion` (0xb2), `OpTxLockTime` (0xb5), `OpTxSubnetId` (0xb6), `OpTxGas` (0xb7), `OpTxPayloadLen` (0xc4), `OpTxPayloadSubstr` (0xb8) | Anti-replay, gating |
| Input introspection | `OpTxInputSpkLen/Substr` (0xc5/0xc6), `OpTxInputScriptSigLen/Substr` (0xc9/0xca), `OpOutpointTxId/Index` (0xba/0xbb), `OpTxInputSeq` (0xbd), `OpTxInputIsCoinbase` (0xc1) | Cross-input introspection (Vault aggregation, MultiSig, KRC-20 transfer) |
| Output introspection | `OpTxOutputSpkLen/Substr` (0xc7/0xc8) | All output gating (Escrow, Vesting, Streaming) |
| Byte-string ops | `OpCat` (0x7e), `OpSubstr` (0x7f), `OpBlake2bWithKey` (0xa7), `OpInvert/And/Or/Xor` (0x83-0x86) | State encoding, template splicing |
| Arithmetic | `OpMul` (0x95), `OpDiv` (0x96), `OpMod` (0x97) | Streaming/Vesting math, slash splits |

Hard limit observed: `MAX_SCRIPT_ELEMENT_SIZE = 520` bytes on any substring/concat result. **OpenSilver pattern authors must verify every state encoding stays under this bound.** Cost benchmarks (`opensilver benchmark`) read activation gating from this KIP — pre-activation these opcodes are invalid; OpenSilver patterns must compile only for the activated chain or fence them appropriately.

Reference impl: `kaspanet/rusty-kaspa#797`.

---

## KIP-20 — Covenant IDs (Michael Sutton) — **CRITICAL FOUNDATION**

> Already **Activated in TN12**. This is what every stateful OpenSilver pattern compiles to.

**Three-layer model:**

1. **Output binding** — each output may carry `Some(CovenantBinding { authorizing_input: u16, covenant_id: Hash32 })`.
2. **UTXO entry** — each UTXO entry carries an optional `covenant_id: Hash32`.
3. **Continuation vs. genesis** — an output declaring `cov_id = id` is *continuation* if `utxo(authorizing_input).covenant_id == Some(id)`, else *genesis*. Genesis outputs must satisfy `covenant_id(O, auth_outputs) == id` where `O = in[a].previous_outpoint` and `auth_outputs` is the ordered grouped set with the same `id` and `authorizing_input`. Hash = `BLAKE2b-256("CovenantID" || tx_id || le_u32(index) || le_u64(n) || [for each: le_u32(out_idx) || le_u64(value) || le_u16(spk.version) || le_u64(len(spk.script)) || spk.script])`.

**Five script opcodes OpenSilver patterns rely on:**

| Opcode | Hex | Stack | What it gives the pattern |
| --- | --- | --- | --- |
| `OpInputCovenantId` | 0xcf | `[idx] -> [false \| cov_id]` | "Who am I?" — current input's lineage handle |
| `OpAuthOutputCount` | 0xcb | `[input_idx] -> [count]` | How many outputs this input authorizes |
| `OpAuthOutputIdx` | 0xcc | `[input_idx, k] -> [out_idx]` | Index of k-th authorized output |
| `OpCovInputCount` | 0xd0 | `[cov_id] -> [count]` | Co-spend inputs sharing this cov_id |
| `OpCovInputIdx` | 0xd1 | `[cov_id, k] -> [in_idx]` | Index of k-th covenant-sibling input |
| `OpCovOutCount` | 0xd2 | `[cov_id] -> [count]` | Co-output siblings sharing this cov_id |
| `OpCovOutputIdx` | 0xd3 | `[cov_id, k] -> [out_idx]` | Index of k-th covenant-sibling output |

**Architectural patterns called out in the KIP (non-normative but adopted as OpenSilver defaults):**

- **Singleton (1:1)** — exactly one continuation per transition. `#[covenant.singleton(...)]` sugar lowers to this. Used by: TimeLock, Vesting, Streaming Payment, ZK Verified Computation, KRC-20 Snapshot.
- **Split / One-to-Many (1:N)** — single covenant input authorizes N covenant outputs. `OpAuthOutputCount`/`OpAuthOutputIdx`. Used by: KRC-20 transfer (split), milestone Escrow release.
- **Merge / Many-to-Many (N:M, delegation)** — designate a leader input that validates the full transition; other inputs run a delegate path. Leader index encoded in witness or by convention. Used by: KRC-20 transfer (aggregation), Vault rebalancing.

**Non-forgeability invariant the library can rely on:** a covenant UTXO with id `id` is either a valid continuation of an existing covenant UTXO with id `id`, or a genesis whose hash preimage commits to a specific outpoint that never repeats. **Therefore OpenSilver patterns can treat `OpInputCovenantId(this.activeInputIndex)` as a non-forgeable identity** and key state on it directly.

**Recursive lineage proofs are explicitly named an anti-pattern.** OpenSilver `audit_covenant` MCP tool (Phase 7) must flag any pattern that walks parent/grandparent transactions instead of using `OpInputCovenantId`.

Reference impl:
- `crypto/txscript/src/covenants.rs`
- `consensus/core/src/hashing/covenant_id.rs`
- `crypto/txscript/src/opcodes/mod.rs`
- `consensus/core/src/tx.rs`

---

## KIP-16 — `OpZkPrecompile` for verifiable computation (Saefstroem)

**Single opcode:** `OpZkPrecompile` (0xa6). Tag-dispatched precompile interface. Two initial precompiles:

| Tag | Precompile | Args | Cost (vs ECDSA) |
| --- | --- | --- | --- |
| 0x20 | Groth16 (Arkworks, BN254) | uncompressed vk, proof, num_public_inputs, public_inputs... | ~134× ECDSA (≈1.65 ms) |
| 0x21 | RISC0-Succinct (STARK) | proof data, journal digest, image_id | ~738× ECDSA (≈9.08 ms) |

Tag values start at `0x20` to avoid colliding with `OpData` stack operations. Future precompiles add by tag without changing the opcode.

**OpenSilver Phase 5 impact:**
- **5.1 Verified Computation** uses tag `0x20` (Groth16) — compact, on-chain economic.
- **5.2 Private Asset Transfer** — Groth16 + commitment hiding; pricing model still TBD per KIP §4 (deferred to a future KIP).
- **5.3 ZK-Verified Oracle** — Groth16 wrap of `OpZkPrecompile` + `checkDataSig` fallback.
- **5.4 Proof-Stitched Multi-Pattern** — single proof verified once, shared across multiple covenant inputs via covenant context (KIP-20).

**Hard rule for OpenSilver Phase 5 patterns:** verifying-key + image-id must come from contract constants or a verified covenant-protocol commitment, never from caller witness. Same security-by-construction rule as `expectedTemplateHash` in `validateOutputStateWithTemplate`.

Reference impl: `kaspanet/rusty-kaspa#775`.

---

## KIP-21 — Partitioned Sequencing Commitment (Michael Sutton, Draft)

Replaces the per-chain-block linear sequencing commitment with a partitioned commitment over **active application lanes** (today: keyed by `tx.subnetwork_id`; vProgs lanes later). Header still publishes one 32-byte `accepted_id_merkle_root` which post-activation is `SeqCommit(B)`:

```
SeqCommit(B) = H(prev = SeqCommit(parent(B)), state = SeqStateRoot(B))
SeqStateRoot(B) = H(ActiveLanesRoot(B), block_context_hash, mergeset_miner_payload_root)
```

**Proving win:** for a single target lane L, the proof touches only the two anchors (start and end `SeqCommit`) plus a lane-local compressed transition. **Proof size is O(lane activity), not O(global throughput).**

**OpenSilver impact (mostly future-facing):**
- The opcode `OpChainblockSeqCommit(block_hash)` shows up in `DECL.md`'s `SeqCommitMirror` example — it's the read primitive that a 1:1 transition can mirror into covenant state. Pattern candidates: lane-anchored vesting, lane-anchored oracle attestation, ZK Verified Oracle (5.3) when oracle data lives in a vProg lane.
- Storage accounting: lane data has a purge index keyed by blue score (inactivity window `F`). OpenSilver patterns must not assume a lane tip is queryable after `F` blocks of inactivity; long-running patterns need to re-anchor explicitly.
- Forward-compat target: `PLAN.md` rule says patterns must not block vProgs migration. The KIP-21 lane abstraction is the vProgs primitive. Patterns that key state to `tx.subnetwork_id` today get vProgs migration for free.

This KIP is still **Draft** — its details may move. Phase 5 patterns will reference it but should not hard-depend on opcode semantics until the KIP advances.
