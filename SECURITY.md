# Security policy

OpenSilver is a covenant-pattern library for Kaspa's L1. Bugs in
shipped patterns can translate to permanent loss of locked funds in
downstream deployments, so the responsible-disclosure path matters.

## Reporting a vulnerability

**Do not open a public GitHub issue for security findings.** The
exposure window between disclosure and remediation matters — even
patterns marked "TN12-only" can be (and probably are) being studied
by people watching the repo for an opportunity.

Instead:

1. **Reach out directly** to the maintainer (`@trillskillz` on GitHub
   — see commit history for current contact). Include:
   - The pattern or tool affected.
   - The class of issue (state-corruption, signature-bypass,
     replay, value-loss, denial-of-service, audit-checklist
     mismatch, etc.).
   - A proof-of-concept transaction shape or test-case sketch if
     you have one.
2. **Wait for acknowledgement** before disclosing publicly. We aim
   to acknowledge within 72 hours and resolve within 30 days for
   critical findings.
3. **Coordinated disclosure preferred** — we'll work with you on a
   joint advisory once the fix lands.

## Scope

The following are **in scope** for disclosure:

- Any `contracts/<phase>/<name>.sil` shipping in the catalogue.
- The OpenSilver patch lane (`patches/silverscript-opzkprecompile.patch`)
  and the `scripts/apply-silverscript-opzkprecompile-patch.sh` driver.
- SDK / CLI / integrations / MCP code that affects on-chain
  artifacts (e.g. `buildPatternDeployPlan`, `materializeCovenantOutput`,
  `buildKcc20DeploymentBundle`).
- Audit-checklist heuristics in
  `tests/audit/audit-all-patterns.test.ts` and `mcp/` that produce
  false-negatives on real vulnerabilities.
- Wizard / docs that misrepresent verification posture or audit
  status in a way that could mislead a deployer.

**Out of scope:**

- Bugs in pinned upstream dependencies (`kaspanet/silverscript`,
  `kaspanet/rusty-kaspa`). Report those to the respective projects.
- Issues that depend on a deployment author shipping a circuit that
  doesn't enforce a property the covenant doc explicitly notes is
  the circuit's responsibility — see each Phase-5 pattern's
  "What this v1 does NOT do" section.
- Issues with deploys that ignore the patch-lane prerequisite (`npm
  run patch:silverc:zk`) for Phase-5 patterns.

## What "battle-tested" means here

OpenSilver does not claim any pattern is production-ready in the
absence of:

1. External audit by a SilverScript-capable auditor, **and**
2. 30 days of mainnet usage with no critical findings.

Until both conditions are met, every pattern carries the implicit
"internal-regression-gated; TN12 / small-amount mainnet only"
posture documented in [`AUDIT_CHECKLIST.md`](AUDIT_CHECKLIST.md).
Phase 5 patterns additionally inherit the `TODO(covpp-mainnet)`
marker from rusty-kaspa's `Groth16Precompile::verify_zk` until that
clears.

## Known intentional findings

Several patterns trip the `OS-003` (template-hash trust) and
`KIP20-003` (template-hash from state) heuristics intentionally —
the entire KCC20 controller family + the 5.3 v2 oracle rely on
deploy-time template-hash trust to bind foreign covenant outputs.
These are not bugs; they are design choices documented in the
audit checklist. Reports that re-discover them as bugs will be
closed with a pointer to [`AUDIT_CHECKLIST.md`](AUDIT_CHECKLIST.md).

## Bug bounty

Bug bounty program is a Phase 10.3 deliverable (not yet active).
Until it launches, security disclosures are handled on a best-effort
basis. Acknowledgement and coordinated disclosure are guaranteed;
monetary rewards are not.
