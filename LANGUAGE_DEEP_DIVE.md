# LANGUAGE_DEEP_DIVE.md

SilverScript language surface as observed in `upstream/silverscript` @ `2c46231` (TN12-only, experimental). Phase 1 Task 1.1 output. Initial pass.

## Pragma / versioning

```sil
pragma silverscript ^0.1.0;
```
Semver. OpenSilver pins a single supported range per release.

## Contract declaration

```sil
contract Name(<ctor params>) {
    // constants
    // state fields (no keyword — bare typed declaration at contract scope, with default value)
    // helper functions
    // entrypoint functions
}
```

Examples:
- `Escrow(byte[32] arbiter, pubkey buyer, pubkey seller)` — pure-config, no state.
- `KCC20(byte[32] genesisPk, int genesisAmount, byte genesisIdentifierType, bool genesisIsMinter, int maxCovIns, int maxCovOuts)` — config + initial state (state fields appear inside the contract body, see below).

## State fields

State fields appear at contract scope **without a `state` keyword**:

```sil
byte[32] ownerIdentifier = genesisPk;
byte identifierType = genesisIdentifierType;
int amount = genesisAmount;
bool isMinter = genesisIsMinter;
```

They are encoded into the redeem script at deploy time and updated via `validateOutputState({...})` calls in entrypoints.

## Constants

```sil
byte constant IDENTIFIER_PUBKEY = 0x00;
```
Compile-time only.

## Entrypoints

`entrypoint function name(<args>) { … }` — callable spend paths. Each entrypoint corresponds to a separate redeem-script branch.

## Inline functions

Plain `function` (no `entrypoint`) helpers. Called from entrypoints. Example: `KCC20.checkSigs`, `KCC20.checkAmounts`.

## Covenant attribute

```sil
#[covenant(binding = cov, from = maxCovIns, to = maxCovOuts)]
function transfer(State[] prevStates, State[] newStates, sig[] sigs, byte[] witnesses) { … }
```
Marks an entrypoint as a covenant-binding function. `from`/`to` bound the input/output cardinality. `State[] prevStates`/`State[] newStates` are auto-decoded from sibling inputs/outputs.

## Types observed

- `int` — variable-width int (encoded compactly).
- `bool`
- `byte`, `byte[N]` (fixed), `byte[]` (variable).
- `pubkey`, `sig`, `datasig` — distinct cryptographic types.
- `State` (contract-defined) and `State[]` collection.
- Tuples via `(t1 a, t2 b) = expr` destructuring.
- `object` returned from foreign-template reads, narrowed by destination type.

## Builtins (from `std/builtins.sil`)

- `validateOutputState(int outputIndex, object newState)`
- `validateOutputStateWithTemplate(int outputIndex, object newState, byte[] prefix, byte[] suffix, byte[32] templateHash)`
- `readInputState(int inputIndex) : (State)`
- `readInputStateWithTemplate(int inputIndex, int prefixLen, int suffixLen, byte[32] templateHash) : (object)`

## Crypto / introspection primitives observed in examples

- `checkSig(sig, pubkey) : bool`
- `checkMultiSig(sig[], pubkey[]) : bool`
- `checkDataSig(datasig, byte[], pubkey) : bool`
- `blake2b(byte[]) : byte[32]`
- `OpInputCovenantId(witnessIndex) : byte[32]` (KIP-20 surface — used by `kcc20.sil`)
- `tx.inputs[i].value | scriptPubKey`
- `tx.outputs[i].value | scriptPubKey`
- `tx.time`, `tx.version`
- `this.activeInputIndex`, `this.activeScriptPubKey`, `this.age`
- `new ScriptPubKeyP2PK(pubkey)`, `new ScriptPubKeyP2SH(byte[32])` — output-script builders.

## Control flow

- `require(bool)` — assertion (failure aborts script).
- `if (…) { … } else { … }`
- `for(i, lo, hi, max)` — bounded loop with compile-time `max` upper bound.

## Tooling

- `cargo test -p silverscript-lang` runs the full suite.
- `cli-debugger` lets us step through entrypoints with concrete ctor + spend args.
- Tree-sitter grammar lives in `tree-sitter/` (used by Zed, Helix, Neovim, VSCode extensions; OpenSilver Studio integration can rely on this).

## Open questions for outreach

1. Is the `covenants/sdk` folder Sutton referred to the same as `std/builtins.sil`, or a separate WIP?
2. Stability commitments on the four builtin signatures before mainnet?
3. Is there an official `pragma silverscript` version range targeted for Toccata activation?
4. Are there forthcoming primitives for ZK proof verification (KIP-16) that should be reflected in builtins.sil?

## Hard constraints already enforced for OpenSilver code

- No em dashes in code/comments/docs/copy (`PLAN.md`).
- `.sil` files only for covenant source; TypeScript glue elsewhere.
- Every stateful pattern uses KIP-20 cov IDs (`OpInputCovenantId` / cov ID identifier type in state).
- Every pattern includes a `WHEN NOT TO USE THIS` section in its docs.
