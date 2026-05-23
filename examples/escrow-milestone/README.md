# Milestone escrow example

Planned example flow:

1. Deploy with buyer, seller, arbiter hash, total milestone count, and timeout.
2. Advance milestones through repeated `approve_milestone` transitions.
3. Release to seller only when all milestones are complete.
4. Refund to buyer on dispute.
5. Allow buyer timeout reclaim after `timeout`.
