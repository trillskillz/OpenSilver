# Streaming payment example

Planned example flow:

1. Deploy with sender, recipient, claim rate, total allowance, claim period, and first release timestamp.
2. Let recipient withdraw repeatedly on the configured cadence.
3. Terminate automatically when remaining allowance is exhausted.
4. Allow sender cancellation as an early-stop path.
