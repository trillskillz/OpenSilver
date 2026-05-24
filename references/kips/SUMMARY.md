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

### KIP-16 implementation-level notes (from `rusty-kaspa#775`, merged 2026-02-05)

PR #775 by Saefstroem landed as commit on the `covpp-reset1` integration branch, +2430/-121 across 56 files. Notable structural decisions OpenSilver Phase 5 patterns inherit:

**Opcode dispatch.** `OpZkPrecompile (0xa6)` in `crypto/txscript/src/opcodes/mod.rs:889` gates on `vm.flags.covenants_enabled` (so it shares Toccata activation with the rest of the covenant opcodes; not a separately-toggleable feature). The body is a four-line dispatcher: pop tag → consume tag cost → call into `verify_zk(tag, dstack)` → push `true`. Failure pops out as `TxScriptError::ZkIntegrity(...)` — there is no separate "proof failed" vs "proof malformed" axis at the engine boundary; both surface as one error variant.

**Tag costs are fixed Gram values, not measured per call.** From `zk_precompiles/tags.rs`:
- `ZkTag::Groth16` = `Gram(1000 * 140)` script units
- `ZkTag::R0Succinct` = `Gram(1000 * 250)` script units
- `ZkTag::max_cost()` = R0Succinct (highest)
- Test asserts: Groth16 → 3 verifications per block at mainnet compute-mass limit; R0Succinct → 2 per block. **OpenSilver `estimate_costs` MCP tool (Phase 7) must hardcode these constants, not call out to the verifier.**

**Stack shape for Groth16 (consumed top-to-bottom by `Groth16Precompile::verify_zk`):**
```
[..., public_input_{n-1}, ..., public_input_0,
      n_inputs (i32),
      proof_bytes,                       ← compressed
      unprepared_compressed_vk]          ← uncompressed VK, ironically named
```
Verifier algorithm: deserialise vk → `prepare_verifying_key` → deserialise proof → `Groth16::<Bn254>::prepare_inputs(pvk, &fr_inputs)` → `Groth16::<Bn254>::verify_proof_with_prepared_inputs(pvk, proof, prepared_inputs)`. Built on `ark-groth16` over `ark-bn254`.

**Stack shape for R0Succinct (top-to-bottom):**
```
[claim, control_index, control_digests, seal, journal, image_id, control_id, hashfn]
```
The verifier internally calls `compute_assert_claim(rcpt.claim(), image_id, journal)` after `rcpt.verify_integrity()` — this is the binding step that prevents an attacker from substituting a different image_id/journal with an otherwise valid receipt. Worth quoting from the inline comment: *"This step binds that the provided image id and journal are indeed the ones that were used to generate the proof."*

**Errors are stringified.** Both precompiles' typed errors (`Groth16Error`, `R0Error`) are coerced to `String` and wrapped in `TxScriptError::ZkIntegrity(String)`. Pattern authors don't get to discriminate "verification failed" from "deserialisation failed" inside the script — both abort with the same outcome. Worth noting in Phase 5 docs.

**Both precompiles carry a `TODO(covpp-mainnet)` "not yet fully audited for mainnet use" comment.** This means Phase 5 OpenSilver patterns MUST be doubly cautious in their "WHEN NOT TO USE THIS" sections until those audit comments come off. Concrete guidance for the patterns:
- Reference implementations only — no production calls without explicit mainnet-ready signoff from the rusty-kaspa team.
- Tn12-only deployment for the first 30 days post-activation, regardless of audit.
- Bug-bounty pool must explicitly cover precompile-derived findings (Phase 10.3).

**SDK glue requirement** for Phase 5 patterns: a Groth16-helper module in the `sdk/` workspace that owns the canonical stack-order builder so pattern authors can't accidentally reverse it. `OpenSilver/sdk/zk/groth16.ts` shape:
```ts
function buildGroth16Witness(opts: {
  verifyingKey: Uint8Array;   // uncompressed ark-groth16 VK
  proof: Uint8Array;          // compressed
  publicInputs: Uint8Array[]; // each is an Fr (compressed); pattern must validate count == vk's expected
}): Uint8Array[]
```

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

### vProgs forward-compat notes (from `kaspanet/vprogs`, last touched 2026-05-15)

`kaspanet/vprogs` is the **already-public** prototype framework for "based computation on the Kaspa network" — Hans Moog's vProgs is no longer a stack of open PRs against `rusty-kaspa`, it's a separate monorepo. ~5.7 MB, six layers (core / storage / state / scheduling / transaction-runtime / node). Recent commits (April 2026): "ZK Backend RISC0 - risc0 zkVM backend implementation", "ZK VM - scheduler Processor integrating the proving pipeline", "ZK Batch Prover". The vProgs+ZK stack is being built in vprogs, not bolted onto rusty-kaspa.

**L1 surface in vprogs** lives at `l1/bridge/` and `l1/types/`. `l1/bridge/src/lib.rs` shows the event-driven shape:

```rust
// Event-driven bridge to the Kaspa L1 network.
// Spawns a background worker thread that connects to an L1 node over wRPC,
// tracks the selected parent chain, and emits L1Events through a lock-free queue.
//
// L1Event variants:
//   Connected
//   ChainBlockAdded { checkpoint, ... }
//   Rollback { checkpoint, blue_score_depth }
//   Finalized(checkpoint)
//   Disconnected
//   Fatal { reason }
```

vProgs talks to a normal Kaspa node over wRPC and consumes the **selected-parent chain** via its own bridge — it does *not* extend the L1 consensus. Reorgs are handled in vprogs land via `blue_score_depth`-tagged rollbacks.

**OpenSilver forward-compat callouts (refinement of the earlier KIP-21 section):**

1. **No L1 opcode is needed for vProgs interop.** vProgs reads L1 via wRPC, not via on-chain witness. OpenSilver patterns that just sit on L1 will be observable by vProgs without any pattern-side changes.
2. **vProgs lanes are likely to map onto KIP-21 `tx.subnetwork_id` lanes** based on the language in `vprogs/node/README.md` and the recent ZK Batch Prover commit. Any OpenSilver pattern that names a custom subnetwork ID gets a free vProgs lane mapping; patterns that use the default native subnet are vProgs-transparent.
3. **The ZK backend in vProgs (`risc0` zkVM)** is independent of KIP-16's on-chain `OpZkPrecompile`. vProgs proves *off-chain batches* and could (later) attest them to L1 via a Groth16 verifier — but that path is not yet built. Phase 5 ZK patterns should target KIP-16 directly for the L1 verification step; vProgs is a separate execution layer, not a co-processor for our patterns.
4. **Sutton's "no recursive lineage" rule still applies** — vProgs does not change this. If a pattern needs to prove "this UTXO descends from genesis G" it must still use KIP-20 covenant IDs, not walk a parent-tx witness, even if vProgs would in principle be able to verify the walk off-chain.
5. **vProgs is "early development / prototype phase" per its own README.** OpenSilver SHOULD NOT ship a vProgs-aware Phase 5 pattern in V1. The forward-compat target is "patterns don't *block* a future vProgs port" — not "patterns work *natively* with vProgs today." Re-evaluate at the V2 milestone once vProgs has had a stable-API release.

**No outreach changes** — Hans Moog wasn't on the Phase 0 contact list because his vProgs work didn't yet have a public surface to coordinate against. Now that `kaspanet/vprogs` is live, add him to the list with a low-priority note: *"sanity-check that our patterns won't conflict with the vProgs L1 bridge's event consumption."*
