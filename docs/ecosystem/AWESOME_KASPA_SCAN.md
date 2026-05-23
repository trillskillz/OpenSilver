# Awesome Kaspa scan for OpenSilver

Source scanned: `Kasbah-commons/awesome-kaspa` README (snapshot read on 2026-05-23).

Purpose: keep a short list of ecosystem projects that are covenant-relevant, plus the exact relationship each one has to OpenSilver. This is the Phase 11.3 outreach seed list.

## High-signal projects for OpenSilver

| Project | Category in awesome-kaspa | Relationship to OpenSilver | Notes |
| --- | --- | --- | --- |
| `kaspanet/rusty-kaspa` | Development Tools | **Base-layer dependency** | Carries KIP-16 / KIP-20 / KIP-21 activation path and eventual vProgs migration target. |
| `kaspanet/silverscript` | not listed directly in awesome-kaspa search result set, but core to repo | **Primary upstream compiler/language dependency** | OpenSilver patterns compile to this surface. |
| Kaspacom Wallet | Web Wallets | **Phase 8.2 integration target** | Wallet exists today, but our repo scan found no current L1 covenant-template surface. |
| KaspaCom | DeFi & DEX | **Potential downstream consumer, not a competitor** | Useful distribution channel for audited covenant templates if they add L1 deploy flows. |
| `KASPACOM/kaspacom-defi-mcp` | not listed directly in awesome-kaspa README sections | **Adjacent MCP, different layer** | L2 DeFi MCP; documented boundary in `docs/integrations/KASPACOM_MCP_BOUNDARY.md`. |
| `michaelsutton/kdapp` | Development Tools | **Adjacent architecture input** | High-frequency dApp framework; relevant for future UX, not a substitute for covenant pattern library. |
| Kasware / Kastle / Kaspium / Kaspa NG | Wallets | **Future integration candidates** | If OpenSilver ships a manifest format, these are plausible downstream covenant-template consumers. |
| Kasplex Protocol | KRC-20 & NFT Marketplaces | **Parallel token ecosystem reference** | Distinct from SilverScript/KCC20 controller-covenant path, but useful for token UX expectations. |
| Proof of Works | Jobs & Marketplace | **Real user of Phase 3.12** | Strong evidence that freelance/payroll escrow is not hypothetical demand. |
| Kaspa Security Center | Tools & Utilities | **Potential audit-disclosure / security coordination venue** | Good place to surface findings once patterns exist. |
| Kaspapay / NOWPayments / merchant tooling | Payment Solutions | **Potential adopter set for payment-channel / escrow patterns** | Relevant for channelized or conditional-payments patterns later. |
| Kaspa Wiki / Kaspa Research / Kasmedia | News & Education | **Documentation and launch-distribution surfaces** | Likely targets for Phase 11 educational launch material. |

## What the awesome-kaspa scan changes

### Confirms
- OpenSilver is **not** entering a crowded covenant-library category. The awesome list is rich in wallets, exchanges, L2 DeFi, explorers, and merchant tools, but there is still no canonical SilverScript pattern library.
- Wallet distribution matters. The ecosystem already has multiple credible wallets, which strengthens the case for a shared pattern manifest instead of wallet-specific hardcoding.
- Jobs/payments are real. Listings like Proof of Works and payment gateways make the Phase 3.12 freelance/payroll and 3.7 payment-channel patterns more defensible.

### Suggests
- Phase 8 should not stop at KaspaCom Wallet. If the manifest shape is clean, OpenSilver can target **multiple** wallets and deploy surfaces.
- Phase 11.3 outreach should include not just protocol authors, but also ecosystem-discovery surfaces (`awesome-kaspa`, Kaspa Wiki, Kasmedia, Kaspa Research).
- A small "who should consume OpenSilver first" ranking belongs in README / launch docs once Phase 2 starts.

## Gaps in the awesome-kaspa listing from an OpenSilver lens

The awesome list is broad, but it does **not** presently provide:
- a covenant-pattern-library category,
- a SilverScript tooling category distinct from generic dev tools,
- a registry of audited covenant templates,
- a shared manifest format for wallets / IDEs / agents,
- any obvious catalog for KIP-20-safe stateful covenant patterns.

That absence is useful evidence for the OpenSilver thesis.

## Recommended Phase 11.3 outreach order

1. `awesome-kaspa` maintainers (`Kasbah-commons/awesome-kaspa`) — add OpenSilver under Development Tools once Phase 3 or Phase 6 has shippable artifacts.
2. Kaspa Wiki / Kaspa Research / Kasmedia — technical explainer once the first audited patterns exist.
3. Wallet teams with public repos: Kaspacom Wallet, Kasware, Kastle, Kaspium, Kaspa NG.
4. Merchant/payment projects if payment-channel or escrow patterns land early.

## Open questions left after the scan

- Which wallet teams are open to covenant-template manifests or remote registries?
- Should OpenSilver define a new category proposal for `awesome-kaspa` (for example, "Covenants & SilverScript") once enough projects exist?
- Are there ecosystem projects missing from the awesome list that are already building on SilverScript privately?
