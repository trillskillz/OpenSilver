# Vesting example

Planned example flow:

1. Deploy with beneficiary, admin, total allocation, first cliff, and periodic release amount.
2. Let beneficiary claim on each release interval.
3. Terminate automatically once the full allocation is exhausted.
4. Allow admin revocation when `revocable = true`.
