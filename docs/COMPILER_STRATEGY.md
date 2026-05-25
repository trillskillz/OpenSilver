# OpenSilver compiler strategy

## Decision

**OpenSilver adopts the pinned-upstream bootstrap model as the default compiler strategy for v0.x.**

That means:

- the repo does **not** commit `silverc` binaries,
- the repo does **not** vendor the full upstream source tree into version control,
- local dev and CI both obtain the compiler through the same pinned bootstrap path,
- the Phase 5 ZK lane remains an explicit patched overlay on top of that pinned upstream checkout.

Primary entrypoints:

- `npm run bootstrap:silverc`
- `npm run patch:silverc:zk`

## Why this is the right choice now

### 1. Reproducibility without repo bloat

The current ignored `upstream/` checkout is already several gigabytes once built. Committing that into the OpenSilver repo would make clone/update ergonomics materially worse and would complicate normal review flow.

### 2. One path for local and CI

The bootstrap script already serves both developer setup and CI. Keeping one path reduces drift and keeps failures honest.

### 3. Upstream remains the source of truth

OpenSilver depends on `kaspanet/silverscript` behavior. The pinned-ref model makes that relationship explicit and makes pin bumps a deliberate reviewable change.

### 4. The ZK lane is an overlay, not a fork commitment

Phase 5 currently needs a local patch lane. Treating that as a patch on top of pinned upstream is cleaner than implicitly forking the whole compiler distribution story before the authoring surface settles upstream.

## What this means for downstream tools

CLI, MCP, Wizard, and integration code should assume:

- compiler requirements are discoverable from the manifest,
- non-ZK patterns use the normal bootstrap lane,
- ZK-aware patterns require the patch lane until upstream lands the needed surface.

The shared manifest now exposes:

- `compiler.bootstrapCommand`
- `compiler.defaultMode`
- `compiler.requiresPatchedSilverc`

## Update policy

When bumping the upstream compiler pin:

1. change the pinned ref in `scripts/bootstrap-silverc.sh`,
2. rerun `npm run verify`,
3. rerun `cargo test --manifest-path runtime-tests/Cargo.toml`,
4. rerun `npm run patch:silverc:zk` if the Phase 5 lane is still in use,
5. update any docs that mention pinned behavior or compile limitations.

## Deferred alternatives

These are explicitly deferred, not rejected forever:

### Prebuilt binary distribution

Could make sense later for releases, but is premature while the upstream authoring surface is still moving and while OpenSilver is still primarily a library/tooling repo for contributors.

### Vendored compiler source in-repo

Rejected for now because it increases repo size and maintenance burden without solving a pressing correctness problem.

### Separate maintained OpenSilver fork of SilverScript

Also deferred. The current patch lane is enough. A long-lived fork should happen only if upstream and OpenSilver genuinely diverge for a sustained period.
