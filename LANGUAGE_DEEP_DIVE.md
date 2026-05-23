# LANGUAGE_DEEP_DIVE.md

SilverScript language surface as observed in `upstream/silverscript` @ commit `2c46231` (TN12-only, experimental). Phase 1 Task 1.1 output. Initial pass complete; `cargo test -p silverscript-lang` runs **466 tests across 21 suites, 0 failures**.

Reading sources covered:
- `silverscript-lang/std/builtins.sil` (139 lines, full).
- `docs/TUTORIAL.md` (1338 lines, section-headers + key sections — Data Types, Functions, Transaction Introspection, Covenants, Best Practices).
- `docs/DECL.md` (373 lines, full — declaration sugar layer).
- 10 example contracts in `silverscript-lang/tests/examples/`.

The remaining tutorial sections (Arithmetic/Comparison/Bitwise operators, Arrays/string/bytes ops, Type Casting, Number Units, Date Literals, Split/Slice, Cryptographic builtins) are skimmed; details are added below where they affect pattern design.

## Pragma / versioning

```sil
pragma silverscript ^0.1.0;
```
Semver. OpenSilver pins a single supported range per release.

## Type system (full)

| Type | Description | Notes |
| --- | --- | --- |
| `int` | 64-bit signed integer | `OpMul`/`OpDiv`/`OpMod` available post-KIP-17 activation; overflow errors |
| `bool` | boolean | |
| `string` | UTF-8 string | observed in tutorial; rarely useful in covenants |
| `byte` | single byte | |
| `byte[N]` | fixed-size byte array | preferred for hashes/keys |
| `byte[]` | variable-size | element-size hard cap 520 (KIP-17 `MAX_SCRIPT_ELEMENT_SIZE`) |
| `pubkey` | 32 bytes | |
| `sig` | 65 bytes | transaction signature |
| `datasig` | 64 bytes | off-chain data signature (`checkDataSig`) |
| `T[]` / `T[N]` | arrays | type after `[]` may be inferred from literal |
| `(T1, T2, ...)` | tuples | for return shapes and destructuring assignment |
| `State` | implicit compiler-synthesised struct | one `State` per contract = all bare contract-scope typed fields, in source order |
| `object` | foreign-template state | narrowed by destination type at the binding site |

## Contract declaration

```sil
contract Name(<ctor params>) {
    // constants
    // state fields (no keyword — bare typed declaration with default value)
    // helper functions
    // entrypoint functions
    // optional: covenant-declaration policy functions
}
```

State fields appear at contract scope **without a `state` keyword**:
```sil
byte[32] ownerIdentifier = genesisPk;
byte identifierType = genesisIdentifierType;
int amount = genesisAmount;
bool isMinter = genesisIsMinter;
```
The compiler synthesises an implicit `State` struct from these fields in source order. They are encoded into the redeem script at deploy time and updated via `validateOutputState({...})` calls.

## Constants

```sil
pubkey constant ORACLE_KEY = 0x466d7fcae5...;
int constant MINER_FEE = 300000;
```
Compile-time only. KasBonds uses these for hardcoded-pubkey test deployments; OpenSilver patterns parameterise instead.

## Entrypoints

`entrypoint function name(<args>) { … }` — each entrypoint is a separate redeem-script branch. Multiple entrypoints use compiler-generated function selectors.

## Inline functions

```sil
function helper(int x): int { ... }
function pair(): (int a, byte[32] b) { ... }
```
Single return: `: T`. Tuple return: `: (T1 n1, T2 n2, ...)`.

## Covenant declaration macros (`docs/DECL.md`)

This is the **security-by-construction surface OpenSilver patterns target**. Instead of writing `OpAuth*`/`OpCov*` + `readInputState`/`validateOutputState` boilerplate, a pattern writes one policy function and annotates it:

```sil
#[covenant(binding = auth|cov, from = X, to = Y, mode = verification|transition, groups = multiple|single, termination = disallowed|allowed)]
```

Sugar aliases:
- `#[covenant.singleton]` ≡ `from = 1, to = 1`
- `#[covenant.fanout(to = Y)]` ≡ `from = 1, to = Y`

Inference rules (the ones OpenSilver patterns rely on):
- `binding` omitted: `from == 1 -> auth`, otherwise `cov`.
- `mode` omitted: no returns -> `verification`, has returns -> `transition`.
- `groups` default: `auth -> multiple`, `cov -> single`.
- `binding = auth` with `from > 1` is a **compile error**.
- `binding = cov` with `from = 1` is allowed but warns (recommends `binding = auth`).
- `binding = cov` with `groups = multiple` is a **compile error**.
- `termination = allowed` is valid only on singleton transition (`from = 1, to = 1, mode = transition`).

Verification mode: wrapper reads prior state from tx context, calls policy with `(prev_state(s), new_states, call_args...)`, enforces `out_count == new_states.length`, validates each output via `validateOutputState(...)`.

Transition mode: policy computes and returns `new_states`. `State[]` return shape enforces exact cardinality. Singleton transitions are strict by default; `State[]` returns require explicit `termination = allowed`.

Cov-binding lowering pattern (illustrative N:M leader path, from DECL.md):
```sil
byte[32] cov_id = OpInputCovenantId(this.activeInputIndex);
int in_count  = OpCovInputCount(cov_id);
int out_count = OpCovOutputCount(cov_id);
require(out_count == new_states.length);
require(OpCovInputIdx(cov_id, 0) == this.activeInputIndex);  // k=0 leader path
for(k, 0, in_count,  max_ins)  { ... readInputState(OpCovInputIdx(cov_id, k)) ... }
for(k, 0, out_count, max_outs) { validateOutputState(OpCovOutputIdx(cov_id, k), { ... }); }
```
Auth-binding lowering is the same shape but uses `OpAuthOutputCount`/`OpAuthOutputIdx` on `this.activeInputIndex`.

> **OpenSilver hard rule:** every stateful pattern in `contracts/<name>/Pattern.sil` SHOULD be authored as a `#[covenant(...)]` policy function (or a singleton/fanout sugar form). The lowered form is generated by the compiler. Hand-rolled lowerings are allowed only for patterns where the declaration sugar cannot express the shape (document why in the pattern's "WHEN NOT TO USE THIS" section).

## State-transition builtins (`std/builtins.sil`)

| Builtin | Signature | When to use |
| --- | --- | --- |
| `validateOutputState` | `(int outputIndex, object newState)` | Self-template continuation (1:1, 1:N, N:M). The dominant primitive. |
| `validateOutputStateWithTemplate` | `(int outputIndex, object newState, byte[] prefix, byte[] suffix, byte[32] templateHash)` | Cross-template transition (e.g., milestone Escrow moving to a different contract per stage). `templateHash` must come from a trusted source. |
| `readInputState` | `(int inputIndex) : (State)` | Read sibling input as same template. Safe iff covenant domain guarantees a single allowed contract/layout. |
| `readInputStateWithTemplate` | `(int inputIndex, int prefixLen, int suffixLen, byte[32] templateHash) : (object)` | Read sibling input as foreign template. Independently verifies template hash + P2SH commitment. |

**Security-by-construction implication for OpenSilver SDK:** every helper that calls `*WithTemplate` MUST surface `expectedTemplateHash` as a trusted-source-only parameter (contract constant or verified protocol commitment), never from caller arguments. The `audit_covenant` MCP tool (Phase 7) must flag any pattern that derives `expectedTemplateHash` from caller witness.

## Crypto / introspection primitives observed

Crypto:
- `checkSig(sig, pubkey) : bool`
- `checkMultiSig(sig[], pubkey[]) : bool`
- `checkDataSig(datasig, byte[], pubkey) : bool`
- `blake2b(byte[]) : byte[32]`
- `OpBlake2bWithKey` (KIP-17) — domain-separated blake2b for state encoding

Transaction-level (`tx.…`): `tx.inputs.length`, `tx.outputs.length`, `tx.version`, `tx.locktime`, `tx.time`. KIP-17 adds `OpTxGas`, `OpTxSubnetId`, `OpTxPayloadLen/Substr`.

Per-input: `tx.inputs[i].value`, `tx.inputs[i].scriptPubKey`. KIP-17 adds `OpTxInputSpkLen/Substr`, `OpTxInputScriptSigLen/Substr`, `OpOutpointTxId/Index`, `OpTxInputSeq`, `OpTxInputIsCoinbase`.

Per-output: `tx.outputs[i].value`, `tx.outputs[i].scriptPubKey`. KIP-17 adds `OpTxOutputSpkLen/Substr`.

Active-input shortcuts: `this.activeInputIndex`, `this.activeScriptPubKey`, `this.age`.

ScriptPubKey constructors:
- `new ScriptPubKeyP2PK(pubkey) : byte[34]`
- `new ScriptPubKeyP2SH(byte[32] scriptHash) : byte[35]`
- `new ScriptPubKeyP2SHFromRedeemScript(byte[] redeemScript) : byte[35]`

KIP-20 covenant context: `OpInputCovenantId(idx)`, `OpAuthOutputCount/Idx`, `OpCovInputCount/Idx`, `OpCovOutCount/OutputIdx`. See `references/kips/SUMMARY.md` for full table.

KIP-16 ZK: `OpZkPrecompile(tag, ...)` with tag `0x20` = Groth16, `0x21` = RISC0-Succinct.

KIP-21: `OpChainblockSeqCommit(block_hash) : byte[32]` (observed in `DECL.md` example).

## Control flow

- `require(bool)` — assertion (failure aborts script).
- `if (…) { … } else { … }`
- `for(i, lo, hi, max)` — bounded loop; `max` is a compile-time upper bound on iteration count.
- Ternary: `cond ? a : b`.

## Tooling observed

- `cargo test -p silverscript-lang` — 466 tests, 21 suites, all green at `2c46231`. Includes `cashc_valid_examples_tests`, `chess_apps_tests` (a full chess game implementation under `tests/apps/chess/`), `covenant_compiler_tests`, `covenant_declaration_ast_tests`, `covenant_declaration_security_tests`, `examples_tests`, `kcc20_tests`, `tutorial_examples_tests`, `tutorial_rust_examples_tests`.
- `cli-debugger` — step through entrypoints with concrete ctor + spend args.
- `silverc` CLI — compiler frontend.
- Tree-sitter grammar in `tree-sitter/` (Zed, Helix, Neovim, VSCode bindings shipped).

The presence of `covenant_declaration_security_tests` is highly relevant: upstream is shipping security tests for the declaration layer. **OpenSilver should mirror this test pattern for every promoted pattern** rather than re-deriving safety properties.

## Open questions for outreach

1. Is the "`covenants/sdk` folder" Sutton referenced the same as `silverscript-lang/std/builtins.sil` + `tests/examples/`, or a separate WIP path?
2. Stability commitments on the four builtins and the `#[covenant(...)]` macro surface before mainnet?
3. Is there an official `pragma silverscript` version range targeted for Toccata activation?
4. Will `OpZkPrecompile` (KIP-16) get a SilverScript builtin wrapper (so 5.x patterns don't drop to raw bytecode), and on what timeline?
5. Will `OpChainblockSeqCommit` get a wrapper, and is it stable enough to design 5.4 Proof-Stitched on?

## Hard constraints enforced for OpenSilver code (from `PLAN.md` rules)

- No em dashes in code/comments/docs/copy.
- `.sil` files only for covenant source; TypeScript glue elsewhere.
- Every stateful pattern uses KIP-20 cov IDs (`#[covenant(binding = cov, ...)]` or explicit `OpInputCovenantId`).
- Every pattern includes a "WHEN NOT TO USE THIS" section in its docs.
- Public interfaces frozen at v1.
- MIT-licensed always.
