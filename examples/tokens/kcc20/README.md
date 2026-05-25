# KCC20 — asset contract reference (Pattern 4.1)

The shared **asset contract** that every Phase-4 token deployment
uses. Issuance policy lives in a separate controller covenant (4.2
Ownable, 4.3 Pausable, 4.4 Capped, 4.5 Vesting); this contract only
defines what counts as a valid token-state transition. Source at
[`contracts/tokens/kcc20.sil`](../../../contracts/tokens/kcc20.sil),
design notes at
[`docs/patterns/tokens/kcc20.md`](../../../docs/patterns/tokens/kcc20.md),
standard reference at
[`docs/standards/KCC20.md`](../../../docs/standards/KCC20.md).

This is a **reference / reading example**, not a deploy walkthrough.
You don't deploy 4.1 directly — you deploy a controller variant
(4.2-4.5) and the controller deploys the asset for you as part of
the three-phase genesis lifecycle.

## State layout

```
ownerIdentifier : byte[32]   // pubkey, P2SH script hash, or covenant ID
identifierType  : byte       // 0x00 PUBKEY | 0x01 SCRIPT_HASH | 0x02 COVENANT_ID
amount          : int
isMinter        : bool       // mint-capable branch vs ordinary holder
```

## Three ownership modes (the whole point)

| `identifierType` | Authorisation rule | Typical use |
| --- | --- | --- |
| `0x00 PUBKEY` | `checkSig(sigs[i], ownerIdentifier)` | Personal holder of tokens |
| `0x01 SCRIPT_HASH` | sibling input whose `scriptPubKey` matches `P2SH(ownerIdentifier)` | Tokens owned by a script (e.g. a treasury contract) |
| `0x02 COVENANT_ID` | sibling input with matching `OpInputCovenantId` | Tokens owned by a controller covenant — this is the inter-covenant comms mechanism the KCC20 book describes |

**The minter branch should always be COVENANT_ID-owned**, never PUBKEY.
A pubkey-owned minter is unbounded inflation on key compromise; a
covenant-owned minter is bounded by whatever rules that covenant
encodes (cap, pause, vest, etc.). The 4.2-4.5 controllers exist to
provide that policy.

## Two invariants `transfer` enforces

1. **Non-minter branches conserve supply.** Sum of input amounts ==
   sum of output amounts for any non-minter inputs/outputs.
2. **Non-minter branches cannot promote to minter.** No
   non-minter input may produce a minter output.

Minter branches may freely change amounts — that's what minting and
burning are. The controller covenant constrains *which* minter
transitions are valid.

## SDK surface

Don't try to hand-compute the asset ctor args. Use the SDK:

```ts
import {
  buildKcc20AssetConfig,
  buildKcc20AssetConstructorArgs,
  KCC20_IDENTIFIER_TYPE,
} from '@opensilver/sdk';

const config = buildKcc20AssetConfig({
  ownerIdentifier: controllerCovid,        // controller cov-id from stage 1
  amount: 0,                                // initial minter branch holds 0
  identifierType: KCC20_IDENTIFIER_TYPE.COVENANT_ID,
  isMinter: true,
  maxCovIns: 4,                             // bound on transfer fan-in
  maxCovOuts: 4,                            // bound on transfer fan-out
});
const ctorArgs = buildKcc20AssetConstructorArgs(config);
```

## When to use the asset contract directly

- As reading material to understand the three-ownership-mode pattern.
- As a reference if you author a new controller variant.

## WHEN NOT TO USE THIS

- Do not deploy a KCC20 instance with a pubkey-owned minter branch.
- Do not bypass the three-phase genesis lifecycle. The asset's
  covenant-id is what binds it to the controller; deploying the asset
  before the controller breaks that binding.
- Do not treat this scaffold as production-ready until external audit
  + meaningful mainnet usage. See `AUDIT_CHECKLIST.md` for the
  KIP20-003 finding tracked against the controller family.

## Where the runtime tests live

`runtime-tests/tests/kcc20_runtime.rs` exercises the asset contract
indirectly through every controller's init + mint flow. Search for
`asset_template_probe` to find the canonical compile-and-extract
pattern that produces the template-binding parameters every
controller's ctor needs.

## Verification posture

- Compile-validated: ✓ (`tests/tokens/kcc20-compile.test.ts`)
- Runtime-validated: ✓ (indirect — through the controller suite)
- Audit-checked: ✓ (`tests/audit/audit-all-patterns.test.ts`)
