# TimeLock example

Planned example flow:

1. Deploy a hard timelock with `soft_cancel_enabled = false`.
2. Claim after `unlock_time` with the beneficiary signature.
3. Deploy a soft timelock with `soft_cancel_enabled = true`.
4. Exercise owner cancellation before unlock.
5. Exercise `extend_lock` to move the unlock time farther into the future.
