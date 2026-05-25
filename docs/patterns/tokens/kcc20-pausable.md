# KCC20Pausable — pause-gated controller (Pattern 4.3)

Status: scaffolded; compile-validated

## Summary

KCC20 controller covenant with a `paused: bool` state flag. While `paused == true`, the mint entrypoint reverts. The asset contract remains the unchanged Pattern 4.1 KCC20 at `contracts/tokens/kcc20.sil`.

This pattern keeps the KCC20 asset stable and applies pause semantics only at the issuance-policy layer.

## State layout

```
kcc20Covid : byte[32]  // covenant-id of the bound KCC20 asset
paused     : bool      // issuance gate
initialized: bool      // false before the asset-genesis handoff
```

`admin`, `templatePrefixLen`, `templateSuffixLen`, `expectedTemplateHash`, `templatePrefix`, and `templateSuffix` are constructor constants.

## Entrypoints

### `init(prevState, newState, adminSig)`

Controller side of the asset-genesis handoff. Checks:
- controller was uninitialized,
- `paused` is preserved across the handoff,
- `kcc20Covid` is set to the freshly created asset covenant-id,
- admin signature is present.

### `pause(prevState, newState, adminSig)`

Admin-only state transition that flips `paused` from `false` to `true` while preserving the bound KCC20 asset covenant-id.

### `unpause(prevState, newState, adminSig)`

Admin-only state transition that flips `paused` from `true` to `false` while preserving the bound KCC20 asset covenant-id.

### `mint(prevState, newState, adminSig, minterKcc20NewState, recipientKcc20NewState)`

Single-recipient mint path. Checks:
- controller is initialized,
- controller is **not paused**,
- exactly one KCC20 input and two KCC20 outputs participate,
- output 0 is the continued minter branch still owned by this controller's covenant-id,
- output 1 is a non-minter recipient branch,
- minted amount is positive,
- admin signature is present.

## Design decisions

- Pausing only halts **new issuance**. Existing holder transfers continue, because the KCC20 asset contract itself is unchanged.
- This scaffold intentionally does not combine pause with cap or vesting logic. Composition can come later once the controller family settles.
- The minter branch cannot delegate mint authority away from this controller; `ownerIdentifier` must remain this controller's covenant-id.

## When to use this

- Emergency maintenance windows for token issuance.
- Token launches where distribution should be pausable without freezing existing holders.
- Controller-first governance designs where pause authority exists but supply is not otherwise capped.

## WHEN NOT TO USE THIS

- Do not use this if you need a hard issuance ceiling — use Pattern 4.4 KCC20Capped instead.
- Do not use this if you need holder-transfer freezing; that would require asset-side changes and is intentionally outside this pattern.
- Do not treat this scaffold as production-ready until runtime tests cover pause/unpause plus the full controller + asset lifecycle.

## Current limitations

- Runtime-covered for pause/unpause/paused-mint rejection, but not yet stressed under broader multi-input KCC20 transfer compositions.
- No admin rotation; admin is a constructor constant in this first scaffold.
- No cumulative-pause-duration or cooldown policy.
- No explicit controller-output value accounting yet; this scaffold focuses on issuance gating and templated KCC20-output validation.

## Verification

- Compile/AST validation: `tests/tokens/kcc20-pausable-compile.test.ts`
- Asset contract reference: `contracts/tokens/kcc20.sil`
- Standard notes: `docs/standards/KCC20.md`
