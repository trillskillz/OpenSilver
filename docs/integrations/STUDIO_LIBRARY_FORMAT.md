# SilverScript Studio (Kaspero Labs) — integration notes

Phase 8.1 dependency. Surveyed Kaspero Labs' public repos via `gh search repos --owner kasperolabs`.

## Headline finding

**The "SilverScript Studio" referenced in `PLAN.md` line 39 does not exist publicly yet.** Kaspero Labs' six public repos are:

| Repo | Description | Last update | Relevance |
| --- | --- | --- | --- |
| `kasperolabs/silverscript-ext` | "VSCode for Silverscript" | 2026-02-28 | **Empty placeholder** (README only) |
| `kasperolabs/docs` | "Kaspero Documentation" | 2026-02-27 | No silverscript content; covers Kasperopay, Keystone, Payload Embedding, Kaspafy |
| `kasperolabs/kaspa-security-center` | Open-source security center | 2026-01-25 | Not relevant to L1 covenants |
| `kasperolabs/kaspa-notary` | Notary service | 2026-03-22 | Not relevant |
| `kasperolabs/kaspa-integration` | Wallet integration helper | 2026-01-20 | Possibly relevant for Phase 8 wallet integrations |
| `kasperolabs/kaspagravity.com` | 3D BlockDAG viewer | 2026-02-17 | Not relevant |

`silverscript-ext` is a one-line README repo. No source has been pushed. The Studio IDE either lives in a private repo, hasn't started, or is being built by a different team than the plan attributes it to.

A broader `gh search repos silverscript` returns:
- `kaspanet/silverscript` — the compiler (already vendored at `upstream/silverscript/`)
- `Manyfestation/silverscript-old` — Manyfest's earlier prototype before it merged into `kaspanet/silverscript`
- `Manyfestation/silver-lab` — **empty repo, name stake-out** (last updated 2026-04-28)

`silver-lab` is the most likely future home of the Studio, given Manyfest is the SilverScript co-author and listed in the plan's outreach list. **Watch this repo.**

## What we know about the would-be Studio surface

From `PLAN.md` line 39: *"Kaspero Labs SilverScript Studio (Remix-style IDE) — Target integration. Patterns appear in IDE pickers."*

A Remix-style IDE has three obvious extension surfaces:
1. A **file-tree library section** ("OpenZeppelin Contracts" in Remix) listing importable contracts by category.
2. A **right-pane parameter form** for a selected contract (ctor args, deploy network, compile-and-deploy button).
3. A **template starter list** for "New file from template…" actions.

Without a concrete Studio to negotiate against, OpenSilver should ship its `list_patterns` JSON manifest (proposed in `docs/integrations/KASPACOM_WALLET.md`) in a Studio-importable shape too. One manifest = three consumers (wallet, MCP, IDE).

## Adjacent finding — the security-tests goldmine

While surveying for Studio code, found `upstream/silverscript/silverscript-lang/tests/covenant_declaration_security_tests.rs`. This is **the canonical security test suite for `#[covenant(...)]` lowering**. Test catalogue (subset, all green at `2c46231`):

- `singleton_allows_exactly_one_authorized_output`
- `singleton_rejects_two_authorized_outputs_from_same_input`
- `singleton_transition_rejects_mismatched_output_state`
- `singleton_transition_termination_allowed_accepts_zero_outputs`
- `singleton_transition_termination_allowed_rejects_two_outputs`
- `singleton_missing_authorized_output_returns_invalid_auth_index_error`
- `auth_groups_single_rejects_parallel_group_with_same_covenant_id`
- `auth_groups_single_allows_other_covenant_id`
- `many_to_many_happy_path_succeeds`
- `many_to_many_rejects_wrong_entrypoint_role`
- `many_to_many_rejects_input_count_above_from_bound`
- `many_to_many_rejects_output_count_above_to_bound`

This is the seed checklist for the **OpenSilver `audit_covenant` MCP tool (Phase 7)**. The compiler enforces these statically; `audit_covenant` should re-enforce them on caller-submitted `.sil` source plus add OpenSilver-specific checks (recursive lineage anti-pattern, untrusted `expectedTemplateHash`, `witnesses[]` bounds checks, hardcoded-pubkey warnings, KIP-20 cov-ID adoption).

> **Action item for Phase 7:** vendor the compiler's security-test set as runtime checks (via the compiler crate's public API if it exposes them, otherwise re-state as our own assertions), then add the OpenSilver-specific layer on top.

## Outreach implications

Add a fifth question to Kaspero Labs outreach (drafted in `ECOSYSTEM_COORDINATION.md`):

> Is the SilverScript Studio currently public or in active development? `silverscript-ext` reads as a placeholder. If the Studio is happening, what import format would you prefer for an OpenSilver pattern library — a JSON manifest URL, a vendored package, or direct git pull from `trillskillz/OpenSilver`?

And one to Manyfest:

> `Manyfestation/silver-lab` looks like a name stake-out. Is this the future Studio home, and should we coordinate on the pattern-import shape now rather than later?

## Open questions

1. Is there a private Kaspero Labs repo for the Studio that I can't see?
2. Is "Studio" the same product as `silverscript-ext`'s eventual VSCode extension, or a separate web IDE?
3. Will the Studio target browser-only (Remix-style, WASM compiler) or desktop (Electron, native compiler)?
4. Compiler-as-a-service availability — does the Studio plan to embed `silverc` as WASM, or proxy to a hosted compile endpoint OpenSilver might also use?
