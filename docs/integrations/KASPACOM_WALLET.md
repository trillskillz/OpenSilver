# KaspaCom wallet + covenant surface — integration notes

Phase 8.2 dependency. Source: surveyed `KASPACOM/*` repos via `gh search repos --owner KASPACOM`.

## Headline finding

**The KaspaCom *web wallet* does not currently embed L1 covenant templates.** A grep for `silverscript|covenant|\.sil` across `KASPACOM/kaspacom-web-wallet/src` returns only false positives (CSS class names containing the substring). The wallet ships L2 EVM features (Igra/Kasplex), KRC-20/KRC-721 token UX, swaps, and Aave lending. No covenant template selector exists yet.

This means Plan task 8.2 ("Work with KaspaCom to expose OpenSilver patterns in the wallet template selector") is **a greenfield ask, not an extension of an existing feature**. The pitch becomes: *"here is the JSON pattern manifest format; the wallet team can add a single covenant template page on top of it."* This is easier in some ways (no legacy format to negotiate against) and harder in others (no prior art to point at).

## KASPACOM L1 covenant surface (what does exist)

Across the KASPACOM org, only one repo ships production SilverScript covenants today:

### `KASPACOM/x402-KAS`

x402 (HTTP-402 micropayments) protocol implementation for Kaspa. Contracts at `contracts/silverscript/`:

| File | Loc | Shape | Notes |
| --- | --- | --- | --- |
| `x402-channel.sil` | 52 | v1 — stateless 2-of-2 settle with timeout refund | Original |
| `x402-channel-v2.sil` | 36 | v2 — refined v1 | |
| `x402-channel-v3.sil` | 36 | v3 — refined v2 | |
| `x402-channel-v4-locked.sil` | 35 | v4 — **stateful** channel with `validateOutputState({ nonce + 1, timeout })` | Production target. Facilitator pubkey hardcoded in source. |

Spec: `specs/scheme_exact_kaspa.md`. Quote: *"The exact scheme on Kaspa uses a covenant-based payment channel to enable gasless, double-spend-protected micropayments for HTTP 402 resources."*

We already analysed `x402-channel-v4-locked.sil` in `KASBONDS_AUDIT.md` (KasBonds vendors a copy). The audit slot stands: this is **OpenSilver Pattern 3.7b — Stateful Payment Channel**, with generalisations:
- Drop hardcoded facilitator pubkey (parameterise or wrap with 3.1 Ownable).
- Use KIP-20 covenant ID rather than implicit P2SH self-continuation.
- Add `expire(clientSig)` after timeout for stale-channel sweep.

## Adjacent KASPACOM repos (L2, not L1)

| Repo | Stack | What it is | OpenSilver relevance |
| --- | --- | --- | --- |
| `kaspacom-web-wallet` | Angular / TS | Production wallet UX, L2 token + DEX flows | **Phase 8.2 integration target.** No covenant code today. |
| `kaspacom-defi-mcp` | TS | L2 DeFi MCP — see `KASPACOM_MCP_BOUNDARY.md` | Adjacent layer; no overlap. |
| `kaspacom-wallet-messages` | TS types | Wallet message-type definitions | Worth reading once we have a pattern manifest format — wallet may expose covenants over the same messaging. |
| `multisignature-safe` | Foundry / Solidity | L2 EVM multisig | Not L1, but the UX pattern (named guardians, threshold UI) is a reference for our 3.10 Social Recovery wallet page. |
| `kaspacom-sc` | Foundry / Solidity | L2 smart contracts | Solidity, not relevant. |
| `krc721` | Rust | KRC-721 NFT toolchain | Worth watching for any KIP-20 covenant-ID NFT integration. |
| `pearl-infra` | Solidity + Apps | KaspaCom infra for Pearl ecosystem | L2 escrow (`PrlUsdcEscrow.sol`) only — not L1 covenant. |
| `agent-liquidity` | TS | AI agent for DEX liquidity | L2 only. |
| `swap-sdk` | TS | DEX swap widget | L2 only. |

## Phase 8.2 minimum deliverable (revised)

The smallest thing the KaspaCom wallet can integrate is a JSON pattern manifest the wallet imports and renders as a "Deploy from template" page. Proposed shape:

```json
{
  "version": "0.1.0",
  "source": "https://github.com/trillskillz/OpenSilver",
  "patterns": [
    {
      "id": "ownable",
      "displayName": "Ownable",
      "category": "access-control",
      "summary": "Single-owner pattern; owner can transfer ownership.",
      "sil": "https://raw.githubusercontent.com/.../contracts/ownable/Pattern.sil",
      "ctorParams": [
        { "name": "ownerPk", "type": "pubkey", "label": "Owner public key" }
      ],
      "auditStatus": "unaudited",
      "kip20Compliant": true,
      "whenNotToUse": "Single point of failure; use 3.2 MultiSig if any irrecoverable funds will be held."
    }
  ]
}
```

This manifest doubles as the OpenSilver MCP `list_patterns` payload. One source of truth, two consumers (wallet + MCP).

## Outreach implications

Add a fourth question to the KASPACOM outreach (already drafted in `ECOSYSTEM_COORDINATION.md`):

> Does the wallet team have a roadmap slot for an L1 covenant-template page, or is L1 covenant UX currently out of scope? If in scope, would you take a JSON manifest of OpenSilver patterns (with `.sil` source URLs + ctor schemas), or do you prefer a fully-vendored package?

## Open questions

1. Is there a *separate* KaspaCom L1-focused wallet (not the web wallet) that ships covenant templates today? (Web search punt to next session if needed.)
2. Is `kaspacom-wallet-messages` already extensible to carry covenant-deploy intents, or would it need a new message type for OpenSilver pattern deployment?
3. Should OpenSilver's manifest live in the wallet repo (vendor-in) or be fetched at runtime from `opensilver.dev`? The latter keeps the wallet stateless but adds a network dependency.
