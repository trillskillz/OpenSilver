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

**First, a correction to my earlier draft:** neither CashScript nor Aiken ships a *standardised patterns library* the way OpenZeppelin does for Solidity. CashScript ships a language + 5 curated example contracts (in `cashscript/examples/`). Aiken stdlib ships *low-level building blocks* (`cardano/transaction`, `cardano/assets`, `aiken/crypto`) — the Cardano "patterns library" equivalent is third-party projects on top (Anastasia Labs Design Patterns, etc.). So when a cell below reads "no direct equivalent" it is **the gap OpenSilver is filling**, not an oversight.

Concrete paths in the upstream clones:

| OpenSilver V1 pattern | OpenZeppelin (Solidity) | CashScript example (`upstream/cashscript/`) | Aiken stdlib (`upstream/aiken-stdlib/`) | SilverScript primitives used |
| --- | --- | --- | --- | --- |
| 3.1 Ownable | `access/Ownable.sol` (5.x), `access/Ownable2Step.sol` for safer rotation | inline — no module; CS contracts gate by pubkey | no direct equivalent; `aiken/crypto` + `cardano/address.ak` building blocks | `checkSig`, `validateOutputState` for owner rotation |
| 3.2 MultiSig | `access/AccessControl.sol` is closer; `governance/utils/Votes.sol` for threshold logic | no example; native P2MS is BCH-level | no direct equivalent; `cardano/transaction/script_context.ak` for witness inspection | `checkMultiSig`, threshold params |
| 3.3 TimeLock | `governance/TimelockController.sol` | `examples/transfer_with_timeout.cash` + `examples/mecenas_locktime.cash` (locktime gate) | `cardano/transaction.ak` validity range fields | `tx.time`, `this.age` |
| 3.4 Vault | composition pattern (no single OZ file) | composition pattern | composition pattern | composition of 3.1 + 3.2 + 3.3 |
| 3.5 Escrow (bilateral) | no direct OZ pattern | no direct example; comes from CashScript guides + `cashscript/website/docs/guides/covenants.md` | no direct equivalent | from `upstream/silverscript/silverscript-lang/tests/examples/covenant_escrow.sil` |
| 3.6 Escrow (milestone) | no direct OZ pattern | no direct example | no direct equivalent | `validateOutputState` + KIP-20 cov ID |
| 3.7 Streaming Payment | Sablier (third-party, not OZ): `sablier-labs/v2-core` | `examples/mecenas.cash` (pull-based recurring payment) | no direct equivalent | from `silverscript-lang/tests/examples/mecenas.sil` + state |
| 3.8 Vesting | `finance/VestingWallet.sol` | no direct example | no direct equivalent | linear/cliff via `tx.time` + state |
| 3.9 Dead Man's Switch | no direct OZ pattern | no direct example | no direct equivalent | from `silverscript-lang/tests/examples/covenant_last_will.sil` |
| 3.10 Social Recovery | no direct OZ pattern (Argent/Safe-style; Argent contracts on GitHub) | no direct example | no direct equivalent | guardian quorum + delay (extends 3.2 + 3.3) |
| 3.11 HTLC | no OZ pattern (BIP-199 / Lightning HTLCs are external) | `cashscript/website/docs/guides/covenants.md` covers HTLC; no direct stdlib | no direct equivalent | preimage hash (`blake2b`) + timeout |
| 3.12 Freelance/Payroll | no direct OZ pattern | no direct example | no direct equivalent | composition of 3.5 + 3.3 + 3.2; KasBonds MinimumBond is the working precedent (`KASBONDS_AUDIT.md`) |
| 4.1 KRC-20 reference | `token/ERC20/ERC20.sol` | CashTokens are BCH-level, not CashScript-level: see `cashscript/website/docs/guides/cashtokens.md` | `cardano/assets.ak` (Value + native-token primitives) — different model (Cardano has L1 native tokens) | from `silverscript-lang/tests/examples/kcc20.sil` + `kcc20-minter.sil`; see `docs/standards/KCC20.md` |
| 4.2 KRC-20 Ownable | `token/ERC20/extensions/ERC20.sol` + `access/Ownable.sol` | no direct example | no direct equivalent | 4.1 + 3.1 (controller covenant) |
| 4.3 KRC-20 Pausable | `token/ERC20/extensions/ERC20Pausable.sol` + `utils/Pausable.sol` | no direct example | no direct equivalent | 4.1 + paused flag in controller state |
| 4.4 KRC-20 Capped | `token/ERC20/extensions/ERC20Capped.sol` | no direct example | no direct equivalent | 4.1 + `remainingAllowance` in controller state |
| 4.5 KRC-20 Vesting | `finance/VestingWallet.sol` over ERC20 | no direct example | no direct equivalent | 4.1 + 3.8 (vesting-aware controller covenant) |
| 4.6 KRC-20 Snapshot | `token/ERC20/extensions/ERC20Snapshot.sol` (deprecated in OZ 5.x; replaced by `ERC20Votes`) | no direct example | no direct equivalent | 4.1 + per-block checkpoint state |
| 5.1 Verified Computation | no OZ pattern; Risc Zero / SP1 examples exist | no direct example | `aiken/crypto/bls12_381` exposes pairing primitives | KIP-16 `OpZkPrecompile(0x20)` (Groth16) |
| 5.2 Private Asset Transfer | no OZ pattern; Aztec / Railgun contracts are external | no direct example | no direct equivalent | KIP-16 + commitment hiding |
| 5.3 ZK-Verified Oracle | no OZ pattern | no direct example | no direct equivalent | KIP-16 + `checkDataSig` |
| 5.4 Proof-Stitched Multi-Pattern | no OZ pattern | no direct example | no direct equivalent | KIP-16 + KIP-20 covenant context |

## Gap visualisation

Of the 22 V1 patterns:

- **5 patterns** have a direct OZ equivalent: 3.1 Ownable, 3.3 TimeLock, 3.8 Vesting, 4.1 KRC-20, plus the 4.x KRC-20 variants 4.2/4.3/4.4/4.5/4.6 which are all OZ extensions. **(So 5 base + 5 derivations = 10 patterns with concrete prior art.)**
- **5 patterns** have a CashScript example as the closest prior art (mostly Phase 3.3/3.7 derivatives that share the BCH covenant lineage).
- **12 patterns** have no direct equivalent in any of the three reference libraries and are genuine net-new for the L1 covenant space — including the four ZK-aware Phase 5 patterns and the entire Phase 4 controller-covenant architecture lifted from KCC20.

This is the quantitative basis for the OpenSilver thesis: **a credible majority of the catalogue does not exist anywhere else for any UTXO smart-contract platform yet.**

## Reference paths in `upstream/`

- `upstream/silverscript/silverscript-lang/tests/examples/` — 81 `.sil` example contracts (the ground truth for SilverScript idioms).
- `upstream/silverscript/silverscript-lang/std/builtins.sil` — 4 state-transition builtins.
- `upstream/silverscript/docs/DECL.md` — declaration sugar.
- `upstream/silverscript/docs/kcc20-book/` — KCC20 deep-dive book.
- `upstream/silverscript/silverscript-lang/tests/covenant_declaration_security_tests.rs` — security-test suite (seed checklist for Phase 7 `audit_covenant`).
- `upstream/cashscript/examples/` — 5 `.cash` reference contracts (HodlVault, Mecenas, Mecenas-with-locktime, TransferWithTimeout, P2PKH).
- `upstream/cashscript/website/docs/guides/covenants.md` — CashScript covenant idioms; close cousin to `LANGUAGE_DEEP_DIVE.md`.
- `upstream/cashscript/website/docs/guides/cashtokens.md` — BCH CashTokens primer; not directly transferable but the design parallels are instructive.
- `upstream/aiken-stdlib/lib/cardano/transaction.ak` — tx-context types we'd consult for the eUTXO comparison.
- `upstream/aiken-stdlib/lib/aiken/crypto/` — crypto building blocks (bls12_381 included; relevant for Phase 5).
- `upstream/kaspacom-defi-mcp/` — L2 DeFi MCP (different layer; see `docs/integrations/KASPACOM_MCP_BOUNDARY.md`).
- `upstream/kaspacom-web-wallet/` — KaspaCom web wallet (no L1 covenants today; see `docs/integrations/KASPACOM_WALLET.md`).
- `upstream/x402-KAS/contracts/silverscript/` — production x402 payment-channel covenants (Pattern 3.7b candidate; see `KASBONDS_AUDIT.md`).
- OpenZeppelin Contracts: `https://github.com/OpenZeppelin/openzeppelin-contracts` (not vendored; reference the file paths cited above).

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
