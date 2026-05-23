# Ownable example

Planned example flow:

1. Deploy the covenant with an initial owner hash and `byte[32](0)` pending-owner sentinel.
2. Spend through `propose_transfer` to nominate a new owner hash.
3. Spend through `accept_transfer` from the nominated owner.
4. Optionally spend through `cancel_transfer` before acceptance.
5. Reuse the same policy inside a higher-level Vault or token-controller pattern.
