# Dead Man's Switch example

Planned example flow:

1. Deploy with owner hash, fallback hash, and timeout age.
2. Let the owner keep the switch alive with `ping`.
3. Rotate the fallback through `update_fallback`.
4. Allow fallback `claim` once inactivity exceeds the configured age threshold.
