# KCC20Vesting — schedule-gated issuance controller (Pattern 4.5)

Status: STUB. Asset contract reuses Pattern 4.1; controller covenant not yet implemented. Depends on Phase 3.8 Vesting for the cliff + linear curve semantics.

## Summary

KCC20 controller covenant that releases mint authority on a vesting schedule: cliff_time gates the first mint, then `release_per_period` becomes available every `period`. Asset contract is the unchanged Pattern 4.1 KCC20.

## Intended shape

```
contract KCC20Vesting(
    pubkey init_admin,
    pubkey init_beneficiary,
    int init_total_allocation,
    int init_minted_amount,
    int init_cliff_time,
    int init_period,
    int init_release_per_period,
    byte[32] init_kcc20_cov_id,
    bool init_initialized,
    int templatePrefixLen, int templateSuffixLen,
    byte[32] expectedTemplateHash,
    byte[] templatePrefix, byte[] templateSuffix
) {
    // Vesting (3.8) state shape applied to issuance rather than payout.

    entrypoint function init(...) { ... }

    #[covenant.singleton(mode = transition, termination = allowed)]
    function mint(State prev_state, sig beneficiary_sig, State[] next_states) : (State[]) {
        require(tx.time >= prev_state.cliff_time);
        requireBeneficiary(beneficiary_sig);

        // Same partial-vs-terminal branch shape as 3.8 Vesting.claim
        require(next_states.length <= 1);
        if (next_states.length == 1) {
            // Partial mint: per_period worth, shift schedule forward
            int remaining = prev_state.total_allocation - prev_state.minted_amount;
            require(remaining > prev_state.release_per_period);
            // validateOutputStateWithTemplate to produce recipient holder
            //   branch with amount=release_per_period
            require(next_states[0].minted_amount == prev_state.minted_amount + prev_state.release_per_period);
            require(next_states[0].cliff_time == prev_state.cliff_time + prev_state.period);
            // ... all other fields pinned ...
        } else {
            // Final mint: drain remaining, controller terminates
            int remaining = prev_state.total_allocation - prev_state.minted_amount;
            require(remaining <= prev_state.release_per_period);
            // validateOutputStateWithTemplate to produce recipient holder
            //   branch with amount=remaining
        }

        return(next_states);
    }
}
```

## Design decisions

- Reuses the **same single-return termination_allowed shape** as Phase 3.7 Streaming Payment and 3.8 Vesting — proven runtime-compatible.
- Beneficiary signs the mint, not the admin. Admin (if needed) sits on top via a separate Pattern 4.2 KCC20Ownable wrapping the beneficiary slot for rotation.
- No `revoke` path in v1 — vesting is uncancellable. A `KCC20VestingRevocable` future variant could add it.

## Open questions before implementation

1. Should the recipient holder branch be the beneficiary's pubkey, or a separately-configured payout address?
2. Should the `tx.time` gate use `tx.time` (CLV-driven) or `this.age` (CSV-driven)? Both work; the CSV variant doesn't require global timestamp tracking but does require the beneficiary to set the input sequence correctly.
3. How does this compose with KCC20Pausable — can an admin pause a vesting controller mid-schedule?
