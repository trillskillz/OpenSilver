# PATTERN_MAPPING.md

Cross-reference between upstream SilverScript example contracts, neighbouring-ecosystem libraries (OpenZeppelin / CashScript stdlib / Aiken stdlib), and the OpenSilver V1 pattern catalogue (Phases 3–5 of `PLAN.md`).

Draft — populated during Phase 0 / Phase 1 reconnaissance. Numbered Phase 3.x / 4.x / 5.x identifiers follow `PLAN.md`.

## Upstream `tests/examples/` inventory (relevant contracts)

| Upstream `.sil` | What it shows | Maps to OpenSilver pattern |
| --- | --- | --- |
| `2_of_3_multisig.sil` | `checkMultiSig` over hard-coded pks | **3.2 MultiSig** (generalise to N-of-M, key rotation) |
| `transfer_with_timeout.sil` | Two-entrypoint pattern: recipient claim vs sender-only timeout | **3.3 TimeLock (soft)**, base for **3.7 Streaming**, **3.11 HTLC** |
| `hodl_vault.sil` | Oracle-signed price + block height gate via `checkDataSig` | Building block for **5.3 ZK-Verified Oracle**, **3.8 Vesting** (price/time gates) |
| `covenant_escrow.sil` | Arbiter-released funds to one of two recipients | **3.5 Escrow (bilateral)** baseline |
| `covenant_last_will.sil` | Inheritor after `this.age >= 180`, plus cold/hot key paths | **3.9 Dead Man's Switch**, basis for **3.10 Social Recovery** |
| `mecenas.sil` | Recurring pledge with self-continuation (`scriptPubKey` echo) | **3.7 Streaming Payment** (pull-based), **3.8 Vesting** |
| `kcc20.sil` + `kcc20-minter.sil` | KCC20 token with covenant ID owner identifier, mint/transfer entrypoints | **4.1 KRC-20 Reference Implementation** (KCC20 likely == KRC-20 toolchain) |
| `covenant.sil` | Minimal `tx.version` + `this.activeScriptPubKey` covenant | Sanity / test fixture |
| `simulating_state.sil` | Stateful pattern via re-deployment | Foundation reading for KIP-20 lineage discussion |
| `sibling_introspection.sil` | Cross-input introspection | Required reading for any multi-UTXO pattern |
| `simple_checkdatasig.sil` | Oracle data-signature gate | Repeats the HodlVault primitive |

## Neighbouring ecosystem cross-reference

| OpenSilver V1 pattern | OpenZeppelin equivalent | CashScript stdlib equivalent | Aiken stdlib equivalent | SilverScript primitives used |
| --- | --- | --- | --- | --- |
| 3.1 Ownable | `Ownable` | n/a (CS does this inline) | n/a | `checkSig`, `validateOutputState` for owner rotation |
| 3.2 MultiSig | `AccessControl`/`Multicall`-style | implied via P2MS | `aiken/crypto` multisig | `checkMultiSig`, threshold params |
| 3.3 TimeLock | `TimelockController` | OP_CHECKLOCKTIMEVERIFY pattern | `aiken/transaction` validity range | `tx.time`, `this.age` |
| 3.4 Vault | composition pattern | composition pattern | composition pattern | composition of 3.1 + 3.2 + 3.3 |
| 3.5 Escrow (bilateral) | n/a | escrow example | n/a | from `covenant_escrow.sil` |
| 3.6 Escrow (milestone) | n/a | n/a | n/a | `validateOutputState` + KIP-20 cov ID |
| 3.7 Streaming | Sablier | n/a | n/a | from `mecenas.sil` + state |
| 3.8 Vesting | `VestingWallet` | n/a | n/a | linear/cliff via `tx.time` + state |
| 3.9 Dead Man's Switch | n/a | n/a | n/a | from `covenant_last_will.sil` |
| 3.10 Social Recovery | n/a | n/a | n/a | guardian quorum + delay (extends 3.2) |
| 3.11 HTLC | n/a (off-chain BIP-199) | HTLC example | n/a | preimage hash + timeout |
| 3.12 Freelance/Payroll | n/a | n/a | n/a | composition of 3.5 + 3.3 + 3.2 |
| 4.1 KRC-20 reference | `ERC20` | n/a | n/a | from `kcc20.sil` |
| 4.2 KRC-20 Ownable | `ERC20` + `Ownable` | n/a | n/a | 4.1 + 3.1 |
| 4.3 KRC-20 Pausable | `ERC20Pausable` | n/a | n/a | 4.1 + state flag |
| 4.4 KRC-20 Capped | `ERC20Capped` | n/a | n/a | 4.1 + supply cap in state |
| 4.5 KRC-20 Vesting | `ERC20Vesting` | n/a | n/a | 4.1 + 3.8 |
| 4.6 KRC-20 Snapshot | `ERC20Snapshot` | n/a | n/a | 4.1 + state checkpoint |
| 5.1 Verified Computation | n/a | n/a | n/a | Groth16 verifier opcode (KIP-16) |
| 5.2 Private Asset Transfer | n/a | n/a | n/a | KIP-16 + commitment hiding |
| 5.3 ZK-Verified Oracle | n/a | n/a | n/a | KIP-16 + `checkDataSig` |
| 5.4 Proof-Stitched Multi-Pattern | n/a | n/a | n/a | KIP-16 + cross-pattern composition |

## Builtin primitives observed (from `std/builtins.sil`)

Four state-transition primitives form the **entire stateful covenant surface** of SilverScript today. Every OpenSilver stateful pattern compiles down to these:

1. `validateOutputState(int outputIndex, object newState)` — same-template continuation. Required for self-perpetuating patterns (Mecenas, Streaming, Vesting, KRC-20 transfer).
2. `validateOutputStateWithTemplate(outputIndex, newState, templatePrefix, templateSuffix, expectedTemplateHash)` — cross-template state transition. Required for milestone Escrow, KRC-20 minter→holder transitions, governance handoffs.
3. `readInputState(inputIndex) : (State)` — read sibling input as same template. Required for any multi-UTXO aggregation (token transfer summing inputs, multi-sig consensus across UTXOs).
4. `readInputStateWithTemplate(inputIndex, prefixLen, suffixLen, expectedTemplateHash) : (object)` — read sibling input as foreign template. Required for cross-contract composition (a Vault containing a Vesting schedule).

> **Security-by-construction implication:** OpenSilver SDK glue MUST surface `expectedTemplateHash` as a trusted-source-only parameter. Helpers should accept it only from contract constants or verified protocol commitments — never from caller arguments. This is the prime "make the secure path the default path" requirement.

## Two upstream surfaces, not one folder

There is no `covenants/sdk` folder in `kaspanet/silverscript` master at commit `2c46231`. What Sutton's quote likely references is two surfaces that *together* form the current best reference:

1. **`silverscript-lang/std/builtins.sil`** — four documented state-transition builtins (see `LANGUAGE_DEEP_DIVE.md`).
2. **`docs/DECL.md`** — the `#[covenant(binding = …, from = X, to = Y, mode = …)]` declaration sugar that lowers into those builtins plus KIP-20 `OpAuth*`/`OpCov*` opcodes.

OpenSilver patterns target the **declaration sugar** layer, not the lowered form. This means every pattern is written as a policy function annotated with the covenant macro, and the compiler generates the lowered entrypoint(s). Hand-rolled lowerings exist only where the macro cannot express the shape (document why in "WHEN NOT TO USE THIS").

This remains the first outreach question to Sutton: "Is the `covenants/sdk` you flagged the current `std/builtins.sil` + `DECL.md` + `tests/examples`, or a separate WIP path?"

## Composition-level patterns DECL.md formalises

DECL.md's macro semantics give OpenSilver three first-class transition shapes:

| Shape | Sugar | Lowered | OpenSilver patterns that use this |
| --- | --- | --- | --- |
| `1:1 singleton` | `#[covenant.singleton(mode = transition)]` | `OpAuthOutput*` + single `validateOutputState` | 3.3 TimeLock, 3.7 Streaming, 3.8 Vesting, 4.6 KRC-20 Snapshot, 5.1 Verified Computation |
| `1:N split` (fanout) | `#[covenant.fanout(to = Y)]` | `OpAuthOutput*` loop + N `validateOutputState` | 3.5 Escrow, 3.6 Milestone Escrow, 4.1 KRC-20 transfer (split) |
| `N:M leader+delegate` | `#[covenant(binding = cov, from = X, to = Y)]` | `OpCovInput*`/`OpCovOutput*` + leader/delegate entrypoints | 3.4 Vault rebalancing, 4.1 KRC-20 transfer (aggregation), 5.4 Proof-Stitched |

`termination = allowed` on a singleton transition unlocks the explicit zero-or-one continuation pattern, which 3.7 Streaming (cancel) and 3.9 Dead Man's Switch (final release) both need.
