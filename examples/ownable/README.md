# Ownable — worked example

This walks through the **full Ownable deploy + lifecycle** using the
shipped OpenSilver tooling. The flow is identical to every other
stateful pattern in the catalogue, so once this one clicks, the other
21 patterns follow the same shape.

The contract source lives at [`contracts/core/ownable.sil`](../../contracts/core/ownable.sil).
Its design notes are in [`docs/patterns/core/ownable.md`](../../docs/patterns/core/ownable.md).

## What this example demonstrates

1. **Browse the catalogue** via the Web Wizard or CLI.
2. **Build a deploy plan** — compile, derive the P2SH commitment, list
   entrypoints — from a single CLI invocation.
3. **Read the plan into a wallet** to fund the covenant address.
4. **Spend the covenant** through each of the three lifecycle paths:
   `propose_transfer` → `accept_transfer`, with `cancel_transfer` as an
   alternate branch.

This example does **not** broadcast to TN12; deployment is the wallet's
job. Every step below is exercised end-to-end by the runtime tests in
[`runtime-tests/tests/core_runtime.rs`](../../runtime-tests/tests/core_runtime.rs)
(search for `ownable_`), so the on-chain shapes are not hypothetical.

## 0. Prerequisites

```bash
npm install
npm run bootstrap:silverc      # one-time pinned silverc build
```

## 1. Browse the catalogue (optional but recommended)

```bash
npm run wizard:build
xdg-open wizard/build/index.html   # or `open` / `start` on macOS / Windows
```

Filter by `core` in the left pane and select **Ownable**. The detail
pane shows verification posture (compile ✓ / runtime ✓ / audit ✓), the
compiler bootstrap requirement (pinned upstream, no patch needed), and
copy-ready CLI snippets. Everything below is a paste of those snippets
with concrete values filled in.

## 2. Inspect the pattern from the CLI

```bash
npx opensilver get core.ownable --json
```

Returns the same manifest entry the wizard renders. Useful for piping
into wallet UIs or audit pipelines.

## 3. Build the deploy plan

Pick three pubkeys you control. For this example we use placeholders
that match the constructor signature
`Ownable(pubkey init_owner, bool init_has_pending_owner, pubkey init_pending_owner)`:

```bash
OWNER_PK=02$(openssl rand -hex 31)         # 33-byte compressed; replace with a real key
PENDING_PK=02$(openssl rand -hex 31)       # placeholder; ignored while flag=false

npx opensilver deploy-plan core.ownable \
  --ctor "[\"$OWNER_PK\", false, \"$PENDING_PK\"]" \
  --network kaspa:testnet-12 \
  > ownable-deploy-plan.json
```

The JSON contains:

| Field | What it carries |
| --- | --- |
| `compiled.scriptHex` | Redeem-script bytes, hex-encoded |
| `compiled.scriptLength` | Length in bytes (for fee estimation) |
| `p2shCommitment.scheme` | Always `"p2sh"` for v0.x |
| `p2shCommitment.redeemScriptHex` | Mirror of `compiled.scriptHex`, passed to your wallet's `payToScriptHash` helper |
| `deployment.entrypoints` | `["propose_transfer", "accept_transfer", "cancel_transfer"]` |
| `deployment.networkHints` | Network-id strings the wallet should pin |
| `verification` | Compile/runtime/audit flags so the wallet can refuse unverified patterns |

## 4. Materialize the covenant output

The deploy plan stops at the redeem script — turning that into a Kaspa
address belongs to whatever `kaspa-wasm` version your wallet uses.
OpenSilver ships two paths:

- **`integrations/materializeCovenantOutput`** — pure helper, takes the
  compiled script + a `P2shAddressDeriver` callback you wire to your
  `kaspa-wasm`. Returns a fully-shaped `TransactionOutput`. See
  [`integrations/src/index.ts`](../../integrations/src/index.ts).
- **Direct kaspa-wasm** — call `addressFromScriptPublicKey(scriptPubKey, networkType)`
  yourself; the redeem script lives at `compiled.scriptHex`.

Either way you end up with a `kaspa:qz…` address. Fund it from any
wallet — that's the deploy.

## 5. Spend the covenant: lifecycle paths

Each spend is an ordinary Kaspa transaction whose **sigscript selects
the entrypoint** and **whose first output reconstructs the covenant
address with the next state pushed in**. The runtime tests are the
canonical reference for the exact byte shapes — point your wallet code
at them.

### Path A: propose → accept

1. **`propose_transfer`** — owner signs, nominates `next_owner`. After
   this spend the on-chain state is
   `{ owner: A, has_pending_owner: true, pending_owner: B }`.
2. **`accept_transfer`** — `next_owner` signs. State becomes
   `{ owner: B, has_pending_owner: false, pending_owner: B }`. Ownership
   has moved.

### Path B: propose → cancel

1. **`propose_transfer`** — as above.
2. **`cancel_transfer`** — owner signs. State becomes
   `{ owner: A, has_pending_owner: false, pending_owner: B }`. The
   `pending_owner` slot keeps its prior value (writing a fresh literal
   would hit the NUM2BIN 8-byte cap); the bool flag is the source of
   truth.

Negative coverage is also live: an unauthorized signer on either path
gets `VerifyError` from the engine. See
[`runtime-tests/tests/core_runtime.rs`](../../runtime-tests/tests/core_runtime.rs)
for the exact failure-mode assertions.

## 6. Where to go next

- **Other patterns** — same flow, swap `core.ownable` for any id from
  `npx opensilver list`.
- **End-to-end deployment** — the longer-form guide is at
  [`docs/DEPLOY_GUIDE.md`](../../docs/DEPLOY_GUIDE.md), which adds
  troubleshooting and known-issues notes.
- **Wizard** — `npm run wizard:build` regenerates the static HTML
  catalogue whenever the SDK manifest changes.
- **Audit posture** — [`AUDIT_CHECKLIST.md`](../../AUDIT_CHECKLIST.md)
  documents what the internal-audit suite asserts for every pattern.
