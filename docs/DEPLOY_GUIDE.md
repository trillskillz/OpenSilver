# OpenSilver — Deploy Guide

End-to-end path for deploying an OpenSilver covenant pattern to Kaspa Testnet 12. Walks through the four real CLI tools we ship and points at where to wire a real wallet.

> **Status of the underlying technology.** As of writing, OpenSilver patterns compile against a pinned upstream silverscript commit (Phase 3/4) or that same commit plus our local Phase-5 patch lane. **None of the patterns are externally audited yet.** Deploy to mainnet only after Phase-10 external audit work clears. See `docs/COMPILER_STRATEGY.md` and `AUDIT_CHECKLIST.md`.

## 1. One-time setup

You need Node 24+ (or Node 22 with corepack), a Rust toolchain (cargo), and a Kaspa testnet-12 RPC endpoint (`ws://tn12-node.kaspa.com:17210` is the documented public one).

```bash
git clone https://github.com/trillskillz/OpenSilver
cd OpenSilver
npm install
npm run bootstrap:silverc   # clones + builds the pinned upstream silverc
```

If you intend to deploy a Phase-5 ZK pattern, run the additional patch step:

```bash
npm run patch:silverc:zk    # applies patches/silverscript-opzkprecompile.patch
```

Confirm everything works:

```bash
npm run verify               # 156/156 vitest tests
npm run test:runtime         # 70/70 cargo runtime tests
```

## 2. Pick a pattern

List the catalogue (filter by phase if you know what you want):

```bash
opensilver list                       # all 22 patterns
opensilver list --phase core          # 12 Phase-3 patterns
opensilver list --phase krc20         # 5 KCC20 family patterns
opensilver list --phase zk-aware      # 4 ZK patterns (require the patch lane)
opensilver list --json                # machine-readable
```

Inspect one:

```bash
opensilver get core.timelock          # human-readable details
opensilver get core.timelock --json   # full PatternManifestEntry JSON
opensilver doc core.timelock          # prints path to the pattern's design doc
```

## 3. Build a deploy plan

The deploy plan is the JSON artifact wallets and IDEs render. It bundles the compiled redeem script, P2SH commitment, suggested entrypoints, and network hints.

```bash
opensilver deploy-plan core.timelock \
  --ctor '["00..32hex","00..32hex",1700000000,true]' \
  --network kaspa:testnet-12
```

The ctor JSON is a positional array matching the contract's `init_*` parameters in source order. For `core/timelock.sil`:

| Position | Param | Type | Example |
| --- | --- | --- | --- |
| 0 | `init_owner` | pubkey (32-byte hex) | `"00...01"` |
| 1 | `init_beneficiary` | pubkey (32-byte hex) | `"00...02"` |
| 2 | `init_unlock_time` | int (timestamp) | `1700000000` |
| 3 | `init_soft_cancel_enabled` | bool | `true` |

Read each pattern's contract source for its exact ctor shape, or use `opensilver get <id>` then open the doc with `opensilver doc <id>`.

The output looks like:

```jsonc
{
  "patternId": "core.timelock",
  "patternTitle": "TimeLock",
  "phase": "core",
  "stateful": true,
  "status": "scaffolded",
  "constructorArgs": ["00...01", "00...02", 1700000000, true],
  "compiled": {
    "contractName": "TimeLock",
    "compilerVersion": "0.1.0",
    "scriptHex": "...",          // the full redeem script
    "scriptLength": 145
  },
  "p2shCommitment": {
    "scheme": "p2sh",
    "redeemScriptHex": "..."
  },
  "deployment": {
    "instructions": [...],
    "entrypoints": ["claim", "cancel", "extend_lock"],
    "networkHints": [
      "Target network: kaspa:testnet-12.",
      "Derive the deploy address via `kaspa-wasm` (e.g., Address.fromScriptPublicKey(...))",
      "OR use the `integrations` package: `materializeCovenantOutput(...)` with a `P2shAddressDeriver` callback."
    ]
  },
  "compiler": { "bootstrap": "pinned-upstream", "bootstrapCommand": "npm run bootstrap:silverc", ... },
  "verification": { "compileValidated": true, "runtimeValidated": true, "auditChecked": true, ... }
}
```

## 4. Materialize the P2SH address

The deploy plan emits the **redeem-script bytes**, not the final Kaspa address. The address is `blake2b(redeem_script)` wrapped in the P2SH opcode envelope, encoded with the network's bech32 prefix.

Two paths to derive it:

### Option A — `kaspa-wasm` directly (browser or node)

```ts
import init, { Address, NetworkType, payToScriptHashAddress } from 'kaspa-wasm';
await init();

const redeemScript = Buffer.from(plan.p2shCommitment.redeemScriptHex, 'hex');
const address = payToScriptHashAddress(redeemScript, NetworkType.Testnet);
console.log('Send KAS to:', address.toString());
```

Exact kaspa-wasm API names vary by version; check the version published to your registry. The integrations package below abstracts this.

### Option B — OpenSilver integrations layer (typed, version-agnostic)

```ts
import { materializeCovenantOutput, loadKaspaWasmModule } from '@opensilver/integrations';
import { describeCovenantScriptPublicKey } from '@opensilver/sdk';

const kaspaWasm = loadKaspaWasmModule();
const shape = describeCovenantScriptPublicKey({ script: redeemScriptBytes });

const deriver = (script, networkType) => {
  // Plug your kaspa-wasm's P2SH derivation here. The integrations
  // module exposes the callback type as `P2shAddressDeriver` so the
  // typing is stable across kaspa-wasm versions.
  return kaspaWasm.payToScriptHashAddress(script, networkType).toString();
};

const materialized = materializeCovenantOutput(
  { role: 'controller', amountSompi: 100_000_000, owner: 'placeholder', covenantBound: true },
  fallbackAddresses,
  { networkType: 'kaspa:testnet-12', deriver, artifactsByRole: { controller: { script: Array.from(redeemScriptBytes) } } },
);
console.log('Send KAS to:', materialized.address);
```

## 5. Fund the address

Send KAS to the derived address from a wallet of your choice (kaspad CLI, KaspaCom wallet, browser wallet). The amount you send becomes the covenant's input value. The pattern's entrypoints will each spend the UTXO under the documented rules — for `core.timelock`, that's `claim` (post-unlock terminal payout), `cancel` (soft-cancel by owner), or `extend_lock` (singleton transition).

## 6. Spend the covenant

Each spend builds a transaction that:

1. Takes the P2SH UTXO as input.
2. Pushes the entrypoint args onto the sigscript (use `silverscript-lang::CompiledContract::build_sig_script("<entrypoint>", args)` from the SDK, or the runtime test helpers as a reference).
3. Pushes the redeem script as the last sigscript item (for P2SH; this is the bytes from `plan.p2shCommitment.redeemScriptHex`).
4. Produces the output shape the entrypoint enforces — for `core.timelock.claim`, that's a single P2PK output to the beneficiary at value `input.value - 1000`.

The full machinery is in `runtime-tests/tests/core_runtime.rs` — every Phase-3 pattern has a working example transaction there.

## 7. Submit

```ts
import { createKaspaWasmRpcClient } from '@opensilver/integrations';
const rpc = createKaspaWasmRpcClient(kaspaWasm, { url: 'ws://tn12-node.kaspa.com:17210' });
await rpc.connect?.();
const txid = await pending.submit(rpc);
console.log('Broadcast tx:', txid);
```

## 8. Observe

Watch the spend on the [Kaspa TN12 explorer](https://explorer-tn12.kaspa.org/) (URL varies; check `awesome-kaspa` for current options). For ongoing covenants (Vault, Streaming Payment, etc.), each state transition is its own transaction with a fresh sigscript selecting the next entrypoint.

## Known limitations

- **Phase-5 patterns require the patch lane** (`npm run patch:silverc:zk`). The deploy plan's `compiler.requiresPatchedSilverc` flag is `true` for these; the `networkHints` includes the bootstrap reminder.
- **`opensilver deploy-plan` does NOT yet compute the final Kaspa address** — that's a `kaspa-wasm` concern. We emit the raw redeem script + commitment scheme so consumers can wire any kaspa-wasm version.
- **No mainnet patterns are externally audited yet.** Phase 10.2 (external audit) is user-gated; see `AUDIT_CHECKLIST.md` for the current internal-audit posture per pattern.
- **KCC20Snapshot (4.6)** is deferred until KIP-21 lane stability lands. Don't use the snapshot pattern.
- **Phase-5 ZK patterns 5.2 + 5.4 are covenant-side only** in v1 — real production needs per-circuit Groth16 provers. See `docs/patterns/zk/` for what's the deployment author's responsibility vs OpenSilver's.

## What to do if something fails

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `silverc: command not found` | Bootstrap not run | `npm run bootstrap:silverc` |
| `OpGroth16Verify: unknown function` | ZK patch not applied | `npm run patch:silverc:zk` |
| `false stack entry at end of script execution` | sigscript missing redeem script bytes (P2SH spends only) | Append the redeem script as the last sigscript element |
| `NUM2BIN target size 32 exceeds 8 bytes` | Pattern uses byte[32] state writes (legacy) | Update to a version that uses the pubkey + has_pending flag shape |
| `ZkIntegrity: Groth16 verification failed` | Public-input order wrong | Check against `runtime-tests/tests/zk_runtime.rs` for the canonical push order |

## Reference material in this repo

- `contracts/` — the actual `.sil` sources
- `docs/patterns/` — per-pattern design + WHEN NOT TO USE THIS notes
- `runtime-tests/tests/` — working example transactions for every pattern
- `tests/audit/audit-all-patterns.test.ts` — current audit posture
- `AUDIT_CHECKLIST.md` — human-readable companion to the audit test
- `docs/COMPILER_STRATEGY.md` — why we bootstrap rather than vendor
- `references/silverscript-rfc-opzkprecompile.md` — Phase-5 upstream coordination
