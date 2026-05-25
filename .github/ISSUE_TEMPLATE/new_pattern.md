---
name: New pattern proposal
about: Propose a new covenant pattern for the catalogue
title: '[pattern] '
labels: pattern-proposal
---

<!--
  Read docs/PATTERNS.md and CONTRIBUTING.md before opening this.
  If your idea fits an existing pattern by use case, fork that pattern
  rather than propose a new one.
-->

## The use case

<!-- One paragraph. What problem does this solve that no existing pattern solves? -->

## Why no existing pattern fits

<!-- Walk the docs/PATTERNS.md selection guide. Which entries did you
     consider, and why don't they work? -->

## Proposed shape

**Family** (core / krc20 / zk-aware):

**Statefulness** (stateless / stateful singleton / N:M cov-binding):

**Entrypoints**:

- `entrypoint_a(...)` — what it does
- `entrypoint_b(...)` — what it does

**State** (if stateful):

```
field_a : type     // what it stores
field_b : type
```

## WHEN NOT TO USE THIS

<!-- Required.  At least three concrete failure modes. -->

-
-
-

## Dependencies

- [ ] Requires patch lane (`npm run patch:silverc:zk`)
- [ ] Requires a KIP that isn't shipped yet (which? KIP-21? KIP-?)
- [ ] Requires SDK helpers that don't exist yet
- [ ] None — purely additive

## Open questions

<!-- Things you want the maintainer to weigh in on before you start
     implementation. -->

## Will you implement this?

- [ ] Yes — I'll open the PR. Please confirm the design first.
- [ ] No — proposing only; happy for someone else to take it.
