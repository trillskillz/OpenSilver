# Contributing to OpenSilver

Thanks for considering a contribution. OpenSilver aims to be a
security-by-construction reference library for Kaspa L1 covenants —
which makes the bar for accepting code higher than a typical project,
but the structure for getting there is consistent across every pattern.

## Quick orientation

- **All patterns follow the same shape.** Read one fully-landed pattern
  (e.g. [`contracts/core/ownable.sil`](contracts/core/ownable.sil) +
  [`docs/patterns/core/ownable.md`](docs/patterns/core/ownable.md) +
  [`examples/ownable/`](examples/ownable/README.md)) before proposing
  a new one. The naming and layout conventions are load-bearing.
- **Every pattern is runtime-verified** through `kaspa-txscript`'s
  engine before it ships. Compile-only landings exist as transient
  states (`compileOnly: true` in the manifest) but should not be the
  end state.
- **Read [`docs/PATTERNS.md`](docs/PATTERNS.md) first** — if your idea
  fits an existing pattern by use case, fork that pattern rather than
  add a new one to the catalogue.

## Development setup

```bash
git clone https://github.com/trillskillz/OpenSilver && cd OpenSilver
npm install
npm run bootstrap:silverc           # pinned silverc compiler
npm run verify                      # tsc -b + vitest
npm run test:runtime                # cargo runtime suite (engine-level)
```

For Phase-5 ZK patterns you also need:

```bash
npm run patch:silverc:zk            # applies OpZkPrecompile patch
```

That patch lane is documented in
[`docs/COMPILER_STRATEGY.md`](docs/COMPILER_STRATEGY.md) and the
upstream RFC at
[`references/silverscript-rfc-opzkprecompile.md`](references/silverscript-rfc-opzkprecompile.md).

## Adding a new pattern — checklist

Every pattern lands as a single PR that touches each of these surfaces
in lockstep. If any item is missing, the PR is not ready to merge.

1. **Contract** at `contracts/<phase>/<name>.sil`. Must compile under
   the pinned silverc (or, for Phase-5 patterns, the patched lane).
2. **Design doc** at `docs/patterns/<phase>/<name>.md`. Required
   sections: Summary, State, Entrypoints, Design decisions, When to
   use this, **WHEN NOT TO USE THIS**, Current limitations, Verification.
3. **Compile test** at `tests/<phase>/<name>-compile.test.ts` (or
   `tests/<name>-compile.test.ts` for core patterns). Use the
   existing pattern tests as templates.
4. **Runtime test** in `runtime-tests/tests/<phase>_runtime.rs`.
   Minimum: one positive test + at least one negative (boundary
   failure) test per entrypoint. The KCC20 controller suite + 5.3 v2
   suite are good references for template-binding patterns.
5. **SDK manifest entry** in `sdk/src/index.ts` `patternManifestSeeds`.
   If runtime tests land in the same PR, do not set `compileOnly: true`.
6. **Audit-checklist entry** in `tests/audit/audit-all-patterns.test.ts`
   `EXPECTED` and (if any findings are expected) a section in
   [`AUDIT_CHECKLIST.md`](AUDIT_CHECKLIST.md) explaining the posture.
7. **Example walkthrough** at `examples/<phase>/<name>/README.md`
   following the shape of [`examples/ownable/`](examples/ownable/README.md):
   prerequisites, deploy-plan invocation with concrete placeholders,
   per-entrypoint sigscript shape pointer, runtime-test cross-reference,
   verification posture, "when to reach for something else."
8. **Update [`docs/PATTERNS.md`](docs/PATTERNS.md)** if your pattern
   solves a use case not already covered, or replaces an entry.
9. **Regenerate artifacts**: `npm run manifests:generate && npm run wizard:build`.
   CI will fail otherwise on the drift gates.

## Patterns we'll accept

- **A new pattern that solves a use case not in the catalogue.** The
  pattern selection guide is the bar — if `docs/PATTERNS.md` can't
  point at an existing solution, we're interested.
- **A v2 of an existing pattern** that hardens semantics, adds
  meaningful expressiveness (e.g. the 5.3 v2 cross-contract binding),
  or refactors around a real compiler limitation. Don't replace v1;
  ship v2 alongside.
- **Hardening fixes** for failure modes documented in "WHEN NOT TO USE
  THIS" sections.
- **Test coverage** for entrypoints currently exercised only on the
  happy path.
- **MCP / SDK / CLI tooling improvements** — additional audit
  heuristics, lint rules, helpers that close gaps surfaced by example
  walkthroughs.

## Patterns we'll send back

- A pattern that's a renaming / restructuring of an existing one.
- A pattern with no negative runtime tests. ("It works on the happy
  path" is half a test.)
- A contract that compiles but has no design doc.
- A "production-ready" claim on a pattern without external audit.
- Changes that bypass the audit checklist regression gate, the
  manifests:check drift gate, or the wizard:check drift gate.
- Patterns that depend on engine-side opcodes not yet shipped (e.g.
  KIP-21 dependencies — wait for upstream).

## Patches against existing patterns

Bugfixes, doc improvements, additional test cases, audit-checklist
corrections — open a PR directly. CI will tell you if anything
drifted.

If you're touching a pattern's contract source, run the audit
regression locally:

```bash
npx vitest run tests/audit/
```

That fails fast if the `EXPECTED` posture for a pattern shifts. If
the shift is intentional, update both `EXPECTED` and the relevant
section in `AUDIT_CHECKLIST.md` in the same commit, with the reasoning
in the commit body.

## Commit + PR conventions

- **Commit subject**: `<type>(<scope>): <one-line summary>`. Types we
  use:
  - `feat` — new pattern, new tool, new SDK surface.
  - `fix` — bugfix without API change.
  - `docs` — docs only.
  - `test` — test-only.
  - `ci` — CI / drift-gate changes.
  - `refactor` — internal reshaping; no behavior change.
- **Commit body**: explain the *why*, not just the *what*. The diff
  shows the what; the body should say what's hard about it and why
  this design.
- **PR description**: link the issue or design doc this PR resolves.
  If there's no issue, the PR body should justify the change against
  the "Patterns we'll accept" list.

## Security disclosure

Security issues — vulnerabilities in shipped patterns or in the SDK /
CLI / wizard tooling that could affect on-chain deployments — should
go through the disclosure path in [`SECURITY.md`](SECURITY.md), not
the public issue tracker.

## License

By contributing, you agree your work is licensed under the MIT license
that covers the rest of the repository.
