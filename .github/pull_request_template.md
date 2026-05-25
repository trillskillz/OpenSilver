<!--
  Read CONTRIBUTING.md before opening this PR.
  For new patterns, the checklist below is non-optional.
-->

## What this changes

<!-- One paragraph. What and, briefly, why. -->

## Type

- [ ] New pattern
- [ ] Bugfix
- [ ] Tooling / SDK / CLI / wizard / MCP improvement
- [ ] Docs only
- [ ] CI / drift gate
- [ ] Refactor (no behavior change)

## Verification

- [ ] `npm run verify` (tsc -b + vitest) — all green
- [ ] `npm run test:runtime` (cargo runtime suite) — all green
- [ ] `npm run manifests:check` — no drift
- [ ] `npm run wizard:check` — no drift
- [ ] For Phase-5 patterns: `npm run patch:silverc:zk` ran and the
      lane is still smoke-clean.

## New pattern checklist (skip if not a new pattern)

- [ ] Contract at `contracts/<phase>/<name>.sil`
- [ ] Design doc at `docs/patterns/<phase>/<name>.md` with required
      sections including **WHEN NOT TO USE THIS**
- [ ] Compile test at `tests/[zk/|tokens/]<name>-compile.test.ts`
- [ ] Runtime tests at `runtime-tests/tests/<phase>_runtime.rs` —
      positive AND negative coverage per entrypoint
- [ ] SDK manifest entry in `sdk/src/index.ts`
- [ ] Audit checklist entry in `tests/audit/audit-all-patterns.test.ts`
      `EXPECTED` and (if expected findings) a section in
      `AUDIT_CHECKLIST.md`
- [ ] Example walkthrough at `examples/[zk/|tokens/]<name>/README.md`
- [ ] `docs/PATTERNS.md` updated if the use-case mapping changes
- [ ] Manifests + wizard artifacts regenerated

## Anything else reviewers should know

<!-- Compatibility concerns, follow-up work, design alternatives
     considered. Leave blank if straightforward. -->
