# RFC: Expose `OpZkPrecompile` as a SilverScript builtin

**Target repo:** `kaspanet/silverscript` (specifically `silverscript-lang/src/compiler/compile.rs`)
**Tracking issue:** OpenSilver #3 — "Upstream silverscript PR: expose OpZkPrecompile builtin"
**Upstream PR:** `kaspanet/silverscript#125` — https://github.com/kaspanet/silverscript/pull/125
**Author:** OpenSilver maintainers
**Status:** Design (2026-05-24)

## Motivation

KIP-16 (`OpZkPrecompile`, opcode `0xa6`) is fully implemented and audited on the engine side via [`kaspanet/rusty-kaspa#775`](https://github.com/kaspanet/rusty-kaspa/pull/775), merged 2026-02-05. The opcode gates ZK-proof verification (Groth16 tag `0x20` and RISC0-Succinct tag `0x21`) and is active on TN12 alongside the rest of the covenant opcodes.

But at the silverscript-lang front-end (pinned commit `2c46231` at the time of this RFC), `OpZkPrecompile` has no builtin entry in the compile dispatcher at `compiler/compile.rs:3554-3596`. Every neighbouring opcode in that file gets a one-line registration like:

```rust
"OpInputCovenantId" => compile_opcode_builtin_call(&mut ctx, name, args, 1, OpInputCovenantId),
```

`OpZkPrecompile` simply has no row in this match. As a result, the four Phase 5 patterns in OpenSilver (`docs/patterns/zk/`) cannot be expressed in SilverScript — they need to fall back to raw-bytecode splicing, which is brittle and bypasses every static check the compiler offers.

## Proposed change

Add one row to the dispatcher:

```rust
"OpZkPrecompile" => compile_opcode_builtin_call(&mut ctx, name, args, 0, OpZkPrecompile),
```

Note `expected_args = 0`: the engine-side opcode consumes its arguments off the stack (tag first, then tag-specific operands). The SilverScript caller is responsible for pushing those args onto the stack in the right order before invoking `OpZkPrecompile()`. This mirrors how `OpTxSubnetId` (also 0 args) and `OpTxGas` are wired today.

A higher-arity wrapper that takes named SilverScript-level arguments (e.g. `OpZkPrecompile(tag, vk, proof, n_inputs, public_inputs)`) is a deliberate non-goal of this minimal RFC. The argument shape varies per precompile tag (Groth16 needs N+3 stack slots for N public inputs; RISC0-Succinct needs 8 fixed slots), and forcing one schema at the builtin layer leaks tag-specific knowledge into the compiler. OpenSilver will instead provide higher-level wrappers in `sdk/zk/` that emit the right pre-opcode stack-builder bytes.

### One required type-system addition

`compiler/debug_value_types.rs::builtin_call_value_type` currently switches over all known opcode-builtin names and returns their result type. `OpZkPrecompile` pushes `true` on success (per `rusty-kaspa#775::opcodes/mod.rs:889-906`) and aborts otherwise. Result type: `bool`. Add:

```rust
"OpZkPrecompile" => "bool",
```

to the match arm in `builtin_call_value_type`.

## Patch sketch

```diff
diff --git a/silverscript-lang/src/compiler/compile.rs b/silverscript-lang/src/compiler/compile.rs
@@ -3582,6 +3582,7 @@
         "OpBin2Num" => compile_opcode_builtin_call(&mut ctx, name, args, 1, OpBin2Num),
         "OpChainblockSeqCommit" => compile_opcode_builtin_call(&mut ctx, name, args, 1, OpChainblockSeqCommit),
+        "OpZkPrecompile" => compile_opcode_builtin_call(&mut ctx, name, args, 0, OpZkPrecompile),
         "bytes" => compile_bytes_call(&mut ctx, args),

diff --git a/silverscript-lang/src/compiler/debug_value_types.rs b/silverscript-lang/src/compiler/debug_value_types.rs
@@ -72,6 +72,7 @@
     match name {
         ...
         "OpInputCovenantId" | "OpOutputCovenantId" => "byte[32]",
+        "OpZkPrecompile" => "bool",
         ...
     }

diff --git a/silverscript-lang/std/builtins.sil b/silverscript-lang/std/builtins.sil
@@ -end-of-file
+/**
+ * Role:
+ *      Verify a ZK proof via the KIP-16 precompile dispatcher.
+ *
+ * Definition:
+ *      The KIP-16 OpZkPrecompile opcode (0xa6) reads a tag byte from the
+ *      stack top, dispatches to the corresponding verifier
+ *      (0x20 = Groth16, 0x21 = RISC0-Succinct), and pushes `true` if the
+ *      proof verifies. Tag-specific operands are consumed from the stack
+ *      in the order documented per precompile.
+ *
+ * Stack shape (Groth16, tag 0x20, top-to-bottom):
+ *   [..., public_input_{n-1}, ..., public_input_0,
+ *         n_public_inputs (i32),
+ *         proof_bytes,                      // compressed
+ *         uncompressed_verifying_key,
+ *         tag (0x20)]
+ *
+ * Stack shape (RISC0-Succinct, tag 0x21, top-to-bottom):
+ *   [claim, control_index, control_digests, seal, journal,
+ *    image_id, control_id, hashfn, tag (0x21)]
+ *
+ * Security notes:
+ *   - Verifying key, image_id, and any other identity-binding inputs
+ *     should come from contract state or a verified protocol
+ *     commitment, never from caller witness. Same trusted-source rule as
+ *     `expectedTemplateHash` in `validateOutputStateWithTemplate`.
+ *   - Failure surfaces as `TxScriptError::ZkIntegrity(String)`.
+ *     SilverScript cannot discriminate "verify failed" from
+ *     "operand deserialise failed".
+ *   - Both precompiles are gated on `vm.flags.covenants_enabled`. They
+ *     activate with the rest of Toccata; pre-activation calls fail with
+ *     `InvalidOpcode`.
+ */
+function OpZkPrecompile() : (bool);
```

## Test plan (upstream)

One new `silverscript-lang/tests/examples/zk_minimal.sil`:

```silverscript
pragma silverscript ^0.1.0;

contract ZkMinimal(byte[] init_vk, int init_n_inputs) {
    byte[] vk = init_vk;
    int n_inputs = init_n_inputs;

    entrypoint function verify(byte[] proof, byte[] public_inputs_concat) {
        // Caller is responsible for the canonical Groth16 stack shape.
        // SDK glue (OpenSilver `sdk/zk/groth16.ts`) wraps this in a
        // type-checked builder; this raw form is exposed for parity with
        // OpAuthOutputCount and friends.
        require(OpZkPrecompile());
    }
}
```

And matching `examples_tests.rs::test_examples_compile` should add `zk_minimal.sil` to its parameterised list. Engine-side execution coverage already lives in `rusty-kaspa/crypto/txscript/src/zk_precompiles/tests/`; no new engine tests needed here.

## Risk

Low. The change is two one-liners in compile.rs + debug_value_types.rs + one stdlib doc comment. The opcode itself is already audited engine-side; this PR only routes a builtin name to the existing emitter. The 0-arg arity choice deliberately avoids the tag-specific operand schema, leaving that to higher-level wrappers.

## Adoption path for OpenSilver

Once the patch lands:

1. **Re-pin upstream silverscript-lang** in OpenSilver to the new commit.
2. **Implement Pattern 5.1 Verified Computation** at `contracts/zk/verified-computation.sil` using the design at `docs/patterns/zk/verified-computation.md`. The "Intended `.sil` shape" section already drops in cleanly with `OpZkPrecompile()` as the call.
3. **Ship `sdk/zk/groth16.ts`** with the canonical stack-order builder (`buildGroth16Witness(opts)`) so pattern authors don't reverse the verifier's pop order. Shape captured in `docs/patterns/zk/README.md`.
4. **Add a runtime test** that compiles `verified-computation.sil` with a real Groth16 fixture VK+proof+inputs and exercises the verifier through `kaspa-txscript`'s engine. We already have a working Groth16 test vector in upstream `rusty-kaspa/crypto/txscript/src/zk_precompiles/groth16/mod.rs:try_verify_stack` — vendor the hex constants into the OpenSilver test.
5. **Repeat for 5.3, 5.2, 5.4** in order, per `docs/patterns/zk/README.md`.

## Filing the PR

Recommended PR title: `Expose OpZkPrecompile builtin to SilverScript front-end`. Tag reviewers: `@OriNewman` (compiler maintainer), `@saefstroem` (KIP-16 author, will sanity-check the stack-shape comments in `builtins.sil`). Mention this RFC in the PR body so reviewers can see the design context. Until the upstream PR merges, Phase 5 in OpenSilver stays at design-only.
