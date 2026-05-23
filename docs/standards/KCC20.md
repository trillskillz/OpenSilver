# KCC20 — token standard notes for OpenSilver Pattern 4.x

Source: `upstream/silverscript/docs/kcc20-book/` (7 chapters, ~2.4 k lines) + `tests/examples/kcc20.sil` (56 lines) + `tests/examples/kcc20-minter.sil` (83 lines). Authored by the SilverScript team as worked examples; the book states explicitly: *"The contracts are examples, not a production token standard. Their value is that they show what the SilverScript covenant model can express."*

## KCC20 vs KRC-20 — naming

The plan (`PLAN.md` line 53, 291–303) refers to the mainnet token standard as **KRC-20**. The upstream worked example is **KCC20**. There are three possibilities:

1. KRC-20 is the mainnet/specification name and KCC20 is the SilverScript reference impl.
2. KCC20 was renamed to KRC-20 along the way and only one of the two names is current.
3. KCC20 is a generic state-machine demo and KRC-20 is a separate, stricter standard yet to ship.

The book itself never uses the term "KRC-20". `KIP-15` in `upstream/kips/` does not define a token standard either. **This is open outreach question #2 to Newman:** is the OpenSilver 4.1 "KRC-20 Reference Implementation" supposed to wrap the upstream KCC20 examples as-is, or is there a separate KRC-20 KIP-track standard we should target?

Until clarified, OpenSilver patterns refer to "**the KCC20 family**" and 4.1 is the **KCC20 reference implementation**. Renaming to KRC-20 is a search-and-replace once the standard is named.

## The two-contract architecture (the headline lesson)

KCC20 is split deliberately:

| Contract | Role | OpenSilver pattern slot |
| --- | --- | --- |
| `KCC20` | Token state machine. Defines what counts as a valid transition. | **4.1 reference impl** |
| `KCC20Minter` | Controller covenant. Defines issuance policy bound to one KCC20 instance via covenant-ID linkage. | **4.x companion** (Phase 4 variants extend this controller, not the asset contract) |

OpenSilver design rule extracted from this split: **issuance policy lives in a separate controller covenant**, not in the asset contract. Phase 4 variants (Pausable, Capped, Snapshot, Vesting, Ownable) should ship as **alternative KCC20Minter implementations**, all binding to the same vanilla KCC20 asset. This keeps the asset contract reusable across policies.

## KCC20 state layout

```
ownerIdentifier : byte[32]    // pubkey | P2SH script hash | covenant id
identifierType  : byte        // 0x00 PUBKEY | 0x01 SCRIPT_HASH | 0x02 COVENANT_ID
amount          : int
isMinter        : bool
```

Constructor takes `(genesisPk, genesisAmount, genesisIdentifierType, genesisIsMinter, maxCovIns, maxCovOuts)`. `maxCovIns/maxCovOuts` are compile-time caps on covenant fan-in/fan-out loops (SilverScript has no unbounded loops).

## Three ownership modes (the major reusable idea)

| `identifierType` | Authorisation rule (from `kcc20.sil:checkSigs`) | OpenSilver patterns that should adopt this |
| --- | --- | --- |
| `0x00 PUBKEY` | `require(checkSig(sigs[i], prevStates[i].ownerIdentifier))` | All single-key patterns: 3.1 Ownable, 3.5 Escrow keys |
| `0x01 SCRIPT_HASH` | `require(tx.inputs[witnesses[i]].scriptPubKey == new ScriptPubKeyP2SH(prevStates[i].ownerIdentifier))` — proof-by-presence of a P2SH input | 3.2 MultiSig as owner, 3.4 Vault delegation |
| `0x02 COVENANT_ID` | `require(OpInputCovenantId(witnesses[i]) == prevStates[i].ownerIdentifier)` — proof-by-presence of a sibling covenant input | 3.10 Social Recovery (owned by guardian quorum covenant), 4.x KRC-20 (owned by controller covenant), 5.x ZK-gated assets |

The `witnesses` parameter (`byte[]` of input indices) lets the contract jump directly to the relevant input instead of scanning — necessary because SilverScript loops are bounded. **OpenSilver patterns reusing this idiom must validate `witnesses[i] < tx.inputs.length`** (the upstream example does not, but its `for(i, 0, prevStates.length, maxCovIns)` bound implies caller honesty; production patterns need the explicit check).

## Supply rules

```sil
if(!isMinter) {
    // for each input/output: sum amounts
    require(totalIn == totalOut);                 // conservation
}
checkMintingTransfer:
if(!isMinter) {
    require(!newStates[i].isMinter);              // mint flag cannot be set by non-minter
}
```

Two invariants:

1. **Non-minter branches conserve supply** (sum-in == sum-out).
2. **Non-minter branches cannot mint flag-flip.** A non-minter cannot create a minter child. This closes the escape hatch where an ordinary holder upgrades themselves to a minter.

Minter branches may freely change `amount`. The system relies on the **controller covenant (KCC20Minter)** to constrain *which* minter transitions are valid — KCC20 itself does not.

> **Security checklist for any OpenSilver KCC20 variant (Pattern 4.2–4.6):**
> - [ ] Both invariants above hold under every non-minter transition.
> - [ ] Minter branches are owned by a covenant ID, not a pubkey. (Pubkey-owned minters are an anti-pattern: key compromise = unbounded inflation. Use a controller covenant.)
> - [ ] The controller covenant binds itself to **one** asset covenant ID and validates it via `validateOutputStateWithTemplate` with `expectedTemplateHash` sourced from controller state, not caller witness.
> - [ ] Issuance budget is decremented in the controller covenant's own state on every mint, not asserted externally.
> - [ ] Each mint transaction produces *both* a fresh zero-amount minter branch (keeping the lineage alive) and a separate recipient branch (the newly minted supply).

## The covenant entrypoint

```sil
#[covenant(binding = cov, from = maxCovIns, to = maxCovOuts)]
function transfer(State[] prevStates, State[] newStates, sig[] sigs, byte[] witnesses) {
    checkSigs(prevStates, sigs, witnesses);
    checkAmounts(prevStates, newStates);
    checkMintingTransfer(newStates);
}
```

This is the **N:M leader+delegate shape** from `DECL.md`. The compiler generates a `__leader_transfer` and a `__delegate_transfer` entrypoint; leader runs the policy, delegates check only that the leader is the active input. See `LANGUAGE_DEEP_DIVE.md`.

## Inter-covenant communication (ICC) lesson

The book makes this explicit (kcc20-overview.md:81–96):

> *"there is no `eval` mechanism here. One covenant cannot directly execute another covenant's code by reference inside the current script."*
>
> *"The proof that 'this token is owned by that contract' is not an abstract reference. The proof is that the KCC20 transaction actually spends a UTXO owned by that contract."*

**This is the operative ICC rule for OpenSilver.** Cross-contract ownership = sibling input with matching covenant ID, witnessed inside the same transaction. There is no remote call.

## Three-phase lifecycle (genesis pattern)

1. **Minter genesis** — plain funding UTXO → uninitialized `KCC20Minter`. Establishes controller covenant ID `C` via standard KIP-20 genesis hashing.
2. **Asset genesis** — spend `C` via `init` entrypoint. In the same transaction, create:
   - the KCC20 asset (ID `A`) as a minter branch (`amount = 0`, `ownerIdentifier = C`, `identifierType = COVENANT_ID`)
   - the next `KCC20Minter` output with `initialized = true, kcc20Covid = A`
3. **Issuance** — spend both the KCC20 asset minter branch and the KCC20Minter together. Each contract validates its own side of the rules.

This is the genesis pattern OpenSilver Pattern 4.x docs must replicate. The book's mermaid lifecycle diagram (kcc20-overview.md:148–172) is the canonical illustration.

## OpenSilver 4.x slot mapping (revised)

| Plan slot | Original idea | Revised (post-KCC20-read) |
| --- | --- | --- |
| 4.1 KRC-20 Reference Implementation | KRC-20 base | Wrap `KCC20` + `KCC20Minter` from upstream, parameterise where they're hardcoded, ship SDK helpers for the three-phase lifecycle |
| 4.2 KRC-20 Ownable | KRC-20 + Ownable | **Alternative KCC20Minter** with `Ownable` (3.1) for admin rotation. KCC20 asset unchanged. |
| 4.3 KRC-20 Pausable | KRC-20 + paused flag | **Alternative KCC20Minter** with `paused: bool` in state; while paused, `mint` entrypoint reverts. KCC20 asset unchanged. |
| 4.4 KRC-20 Capped | Supply cap | **Alternative KCC20Minter** with `remainingAllowance: int` (already present in upstream KCC20Minter), parameterised cap, no replenish. KCC20 asset unchanged. |
| 4.5 KRC-20 Vesting | Vesting unlock schedule | **Alternative KCC20Minter** with cliff + linear curve; mint allowed only if `tx.time` past schedule. Pairs with 3.8. |
| 4.6 KRC-20 Snapshot | Governance voting snapshot | **Adds a snapshot field to KCC20 asset** (this one *does* touch the asset contract), checkpoint balance per-block. Best deferred until we know KIP-21 `OpChainblockSeqCommit` lane stability. |

This mapping confirms the architectural call: 5 of 6 Phase 4 variants are **controller-side**, leaving the asset contract stable. OpenSilver SDK can expose them as a single `KCC20 asset + pluggable Minter` API.

## Open questions surfaced (to add to outreach)

1. KCC20 ↔ KRC-20 naming: which is the mainnet standard?
2. Is there a forthcoming KIP for a frozen KCC20-spec, or is this perpetually an example?
3. Should the `witnesses` parameter be bounds-checked in the upstream example before mainnet, or is that left to higher-level wrappers? (Looks like a real gap.)
4. Is template-hash validation in `KCC20Minter` enough to prevent template-substitution attacks across the three identifier modes, or are there known edge cases?
