# KCC20 — token state machine (Pattern 4.1)

Status: scaffolded (asset contract); compile-validated

## Summary

OpenSilver Pattern 4.1, the **KCC20 reference implementation**. This is the *asset contract* in a two-contract token architecture — its only job is to define what counts as a valid token state transition. Issuance policy lives in a separate controller covenant (Patterns 4.2 Ownable, 4.3 Pausable, 4.4 Capped, 4.5 Vesting, 4.6 Snapshot).

Sourced from `upstream/silverscript/silverscript-lang/tests/examples/kcc20.sil` and analysed in depth in `docs/standards/KCC20.md`.

## State layout

```
ownerIdentifier : byte[32]   // pubkey, P2SH script hash, or covenant ID
identifierType  : byte       // 0x00 PUBKEY | 0x01 SCRIPT_HASH | 0x02 COVENANT_ID
amount          : int
isMinter        : bool       // mint-capable branch vs ordinary holder
```

## Three ownership modes

| `identifierType` | Authorisation rule |
| --- | --- |
| `0x00 PUBKEY` | `checkSig(sigs[i], prevStates[i].ownerIdentifier)` |
| `0x01 SCRIPT_HASH` | sibling input whose `scriptPubKey` matches `P2SH(prevStates[i].ownerIdentifier)` |
| `0x02 COVENANT_ID` | sibling input whose `OpInputCovenantId` matches `prevStates[i].ownerIdentifier` |

This is the "inter-covenant communication" mechanism the KCC20 book describes — cross-contract ownership = sibling input with matching covenant ID, witnessed in the same transaction. No remote `eval`.

## Two invariants `transfer` enforces

1. **Non-minter branches conserve supply.** Sum of `prevStates[i].amount` == sum of `newStates[i].amount`.
2. **Non-minter branches cannot promote to minter.** No new state may set `isMinter = true`.

Minter branches may freely change `amount` (mint or burn). The controller covenant (4.2-4.6) is what constrains *which* minter transitions are valid.

## Parameters

- `genesisIdentifier` (byte[32]): initial owner identifier — pubkey, script-hash, or covenant-id depending on `genesisIdentifierType`.
- `genesisAmount` (int): initial token amount in this state.
- `genesisIdentifierType` (byte): `0x00`/`0x01`/`0x02` per the table above.
- `genesisIsMinter` (bool): whether this genesis branch is minter-capable.
- `maxCovIns` (int): compile-time bound on covenant fan-in loops.
- `maxCovOuts` (int): compile-time bound on covenant fan-out loops.

## Security considerations

- The transfer entrypoint compiles through `#[covenant(binding = cov, from = maxCovIns, to = maxCovOuts)]` — this is the N:M leader+delegate shape from `DECL.md`. The leader runs the policy; delegate inputs only check the leader is correctly selected.
- The `byte[] witnesses` array carries input indices the contract jumps to for SCRIPT_HASH and COVENANT_ID ownership proofs. The bounded `for(i, 0, prevStates.length, maxCovIns)` loop limits iteration, but the contract does NOT explicitly bounds-check `witnesses[i] < tx.inputs.length`. Production wrappers SHOULD add this check. See `docs/standards/KCC20.md` "Open questions" #3.
- Minter branches should always be owned by a controller covenant (COVENANT_ID), never by a raw pubkey. A pubkey-owned minter is unbounded inflation on key compromise.

## KIP-20 covenant-ID handling

Every stateful transition in KCC20 stays inside the same covenant-id lineage via the N:M cov-binding wrapper. The asset contract relies on KIP-20 cov IDs for two things:

1. **Self-identity** — sibling KCC20 inputs in a transfer transaction are discovered via `OpCovInputIdx` on the active cov_id.
2. **Cross-contract ownership** — when `identifierType == COVENANT_ID`, the foreign controller covenant proves authorisation by being a sibling input with matching cov_id.

## When to use this

- As the asset contract for any Phase 4 KCC20 variant (4.2-4.6).
- As a reference for understanding the three-ownership-mode pattern; the same idiom should appear in any OpenSilver pattern that needs flexible identity.

## WHEN NOT TO USE THIS

- Do not deploy a KCC20 instance with a pubkey-owned minter branch. Use a controller covenant (4.2 Ownable, 4.3 Pausable, etc.) so mint authority lives in covenant state, not in a single key.
- Do not deploy without the production `witnesses[i] < tx.inputs.length` bounds-check wrapper. The OpenSilver SDK helper for `transfer` should add this.
- Do not use this as the only artefact for a token launch — you also need a controller covenant + the three-phase genesis lifecycle (see `docs/standards/KCC20.md`).
- Do not treat this scaffold as production-ready until external audit + 30 days of mainnet usage.

## Runtime coverage

Compile-validated via `tests/tokens/kcc20-compile.test.ts`. Full end-to-end asset-transfer runtime coverage is still deferred because it needs the heavier multi-input N:M transfer harness, but the shared KCC20 lifecycle around this asset is already exercised indirectly by the controller runtime suites (`runtime-tests/tests/kcc20_runtime.rs`).

## Audit status

Not audited. Verbatim port of upstream worked example + parameterised ctor + OpenSilver docs.

## Phase 4 follow-up

- 4.2 KCC20Ownable controller — controller-covenant owning the minter branch, ownership rotates via Ownable (3.1) shape.
- 4.3 KCC20Pausable controller — adds a `paused: bool` state field; mint paths revert while paused.
- 4.4 KCC20Capped controller — bounds total issuance via `remainingAllowance` (already present in upstream `kcc20-minter.sil`).
- 4.5 KCC20Vesting controller — pairs the controller with Vesting (3.8) for cliff + linear issuance schedules.
- 4.6 KCC20Snapshot — touches the asset contract (adds a snapshot field); deferred until KIP-21 `OpChainblockSeqCommit` lane stability lands.
