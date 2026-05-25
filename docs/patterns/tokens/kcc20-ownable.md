# KCC20Ownable — admin-rotated controller (Pattern 4.2)

Status: scaffolded; compile-validated

## Summary

KCC20 controller covenant whose admin (the actor authorised to mint) rotates through the same two-step handoff shape as Pattern 3.1 Ownable. The asset contract stays the unchanged Pattern 4.1 KCC20 at `contracts/tokens/kcc20.sil`.

This is the governance-oriented controller variant: issuance policy is not capped or paused here; the main feature is safe mint-authority rotation.

## State layout

```
admin          : pubkey
hasPendingAdmin: bool
pendingAdmin   : pubkey
kcc20Covid     : byte[32]
initialized    : bool
```

`templatePrefixLen`, `templateSuffixLen`, `expectedTemplateHash`, `templatePrefix`, and `templateSuffix` are constructor constants used to validate the foreign KCC20 asset outputs.

## Entrypoints

### `init(prevState, newState, adminPk, adminSig)`

Controller side of the asset-genesis handoff. Checks:
- controller was uninitialized,
- current admin authorises the handoff,
- admin / pending-admin state is preserved,
- `kcc20Covid` is set to the freshly created asset covenant-id,
- controller becomes initialized.

### `propose_admin_transfer(prevState, nextAdmin, adminPk, adminSig)`

Current admin starts a rotation by setting `hasPendingAdmin = true` and storing `nextAdmin` in `pendingAdmin`.

### `accept_admin_transfer(prevState, pendingAdminPk, pendingAdminSig)`

Pending admin finalizes the handoff. Mirrors Ownable v1: the `pendingAdmin` pubkey slot keeps its existing value while the bool flag flips back to `false`.

### `cancel_admin_transfer(prevState, adminPk, adminSig)`

Current admin cancels a pending handoff and clears it logically by flipping `hasPendingAdmin = false`.

### `mint(prevState, newState, adminPk, adminSig, minterKcc20NewState, recipientKcc20NewState)`

Single-recipient mint path. Checks:
- controller is initialized,
- current admin authorises mint,
- admin-rotation state is preserved across mint,
- exactly one KCC20 input and two KCC20 outputs participate,
- output 0 is the continued minter branch owned by this controller's covenant-id,
- output 1 is a non-minter recipient branch,
- minted amount is positive.

Pending admin transfer does **not** pause minting: until `accept_admin_transfer`, mint authority remains with the current admin.

## Design decisions

- Reuses the `pubkey + bool hasPendingAdmin + pendingAdmin` shape from Ownable v1 to avoid the current compiler's byte[32]-state-write NUM2BIN limitation.
- Admin rotation is controller-only. The KCC20 asset covenant-id stays stable throughout the handoff.
- This scaffold does not add cap or pause semantics. Those belong to Patterns 4.4 and 4.3 respectively.

## When to use this

- Token programs where governance / treasury control is the main requirement.
- Phased launches where mint authority should move from deployer to foundation / DAO multisig over time.
- Any KCC20 deployment that needs safer authority transfer but not necessarily a hard cap.

## WHEN NOT TO USE THIS

- Do not use this if you need issuance ceilings — use Pattern 4.4 KCC20Capped.
- Do not use this if you need emergency issuance halts — use Pattern 4.3 KCC20Pausable.
- Do not use this if you need hidden owner commitments; admin pubkeys are explicit in state, just like Ownable v1.

## Current limitations

- Runtime-covered for init/admin-transfer/mint flows, but not yet stressed under broader multi-input KCC20 transfer compositions.
- No combined pause/cap/ownable controller; this is intentionally a single-policy scaffold.
- No explicit controller-output value accounting yet; this scaffold focuses on authority rotation and templated KCC20-output validation.

## Verification

- Compile/AST validation: `tests/tokens/kcc20-ownable-compile.test.ts`
- Asset contract reference: `contracts/tokens/kcc20.sil`
- Related core pattern: `docs/patterns/core/ownable.md`
