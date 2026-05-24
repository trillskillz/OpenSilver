# KCC20Ownable — admin-rotated controller (Pattern 4.2)

Status: STUB. Asset contract reuses Pattern 4.1; controller covenant not yet implemented.

## Summary

KCC20 controller covenant whose admin (the actor authorised to mint) is itself rotatable via the **Ownable (3.1)** pattern. Asset contract is the unchanged Pattern 4.1 KCC20.

## Intended shape

```
contract KCC20Ownable(
    pubkey init_admin,
    bool init_has_pending_admin,
    pubkey init_pending_admin,
    byte[32] init_kcc20_cov_id,
    bool init_initialized,
    int templatePrefixLen, int templateSuffixLen,
    byte[32] expectedTemplateHash,
    byte[] templatePrefix, byte[] templateSuffix
) {
    // Embedded Ownable (3.1) shape for admin rotation: admin + has_pending_admin + pending_admin
    // plus the standard KCC20Minter template metadata.

    entrypoint function init(...) { ... }       // asset genesis tx
    #[covenant.singleton(mode = transition)]
    function propose_admin_transfer(...) { ... }
    function accept_admin_transfer(...) { ... }
    function cancel_admin_transfer(...) { ... }
    #[covenant(binding = cov, ...)]
    function mint(...) { ... }                  // requires admin signature
}
```

## Design decisions

- Admin rotation reuses the `pubkey + bool has_pending_admin` shape from Ownable v1 (see `docs/patterns/core/ownable.md` for the NUM2BIN-driven rationale).
- Admin rotation does NOT pass through the asset contract — only the controller covenant rebuilds. The asset's covenant-id stays stable.
- Mint authorisation = admin signature on the controller's mint entrypoint, NOT a direct asset-side check. The asset just sees a minter branch owned by the controller's cov_id.

## Open questions before implementation

1. Does admin rotation require a delay (like Vault.propose_owner_transfer + accept_owner_transfer + activation_time), or is a two-step handoff sufficient?
2. Should the controller cap the per-mint amount, or rely on a separate Pattern 4.4 KCC20Capped for that?
3. What's the right interaction model when admin rotation is pending — is mint still allowed by the current admin, or paused until rotation finalises?
