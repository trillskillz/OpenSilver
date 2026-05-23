# `kaspacom-defi-mcp` ↔ OpenSilver MCP — scope boundary

Phase 7 Task 7.2 dependency. Confirms the two MCP servers are complementary, not overlapping. Source: `upstream/kaspacom-defi-mcp` cloned from `KASPACOM/kaspacom-defi-mcp` master.

## TL;DR

- **kaspacom-defi-mcp** targets **EVM L2 DeFi** on Igra and Kasplex. Its tools are token-level user actions: swap, supply, borrow, list pairs.
- **OpenSilver MCP** (Phase 7) targets **Kaspa L1 covenant patterns**. Its tools are pattern-level composition primitives: list patterns, get source, generate, validate, audit, check KIP-20 compliance.
- They sit at different layers. No overlap, no conflict. Coordination = host both side-by-side in the same agent config.

## kaspacom-defi-mcp surface (15 tools, observed at `src/mcp/index.ts`)

| Category | Tool | Layer | Network |
| --- | --- | --- | --- |
| **DEX** (Uniswap V2 fork) | `getPairs` | EVM L2 | Igra / Kasplex |
| | `getTokenPrice` | EVM L2 | Igra / Kasplex |
| | `swap` (write) | EVM L2 | Igra / Kasplex |
| | `addLiquidity` (write) | EVM L2 | Igra / Kasplex |
| | `removeLiquidity` (write) | EVM L2 | Igra / Kasplex |
| **Lending** (Aave V3) | `getMarkets` | EVM L2 | Igra / Kasplex |
| | `getPosition` | EVM L2 | Igra / Kasplex |
| | `supply` (write) | EVM L2 | Igra / Kasplex |
| | `borrow` (write) | EVM L2 | Igra / Kasplex |
| | `repay` (write) | EVM L2 | Igra / Kasplex |
| **LFG Launchpad** | `getActiveLaunches` | EVM L2 | Igra / Kasplex |
| | `buyLaunchToken` (write) | EVM L2 | Igra / Kasplex |
| | `sellLaunchToken` (write) | EVM L2 | Igra / Kasplex |
| **Portfolio / Info** | `getPortfolio` | EVM L2 | Igra / Kasplex |
| | `getProtocolInfo` | EVM L2 | Igra / Kasplex |

Network names supported: `igra`, `igra-testnet`, `kasplex`, `kasplex-testnet` (+ aliases `galleon`, `testnet`, `mainnet`).

Implementation notes:
- Single MCP server `src/mcp/index.ts` + CLI `src/cli/index.ts`, both backed by `src/core/tools/*.ts`.
- Reads via `subgraph` (`src/core/subgraph.ts`) + RPC (`src/core/rpc.ts`).
- Write tools (8 of 15) require `MCP_WALLET_KEY`.
- Per the README: Phase 3 will add the write tools; currently shipping is read-only by default.

## OpenSilver MCP planned surface (Phase 7 of `PLAN.md`)

| Tool | Layer | Notes |
| --- | --- | --- |
| `list_patterns(category)` | L1 | List all OpenSilver patterns (Ownable, MultiSig, KCC20, ZK Verified Computation, etc.) |
| `get_pattern(name)` | L1 | Full `.sil` source + docs |
| `generate_covenant(spec)` | L1 | AI describes intent, MCP returns recommended pattern + config |
| `validate_covenant(sil_source)` | L1 | Check OpenSilver best-practices compliance |
| `audit_covenant(sil_source)` | L1 | Automated security checks (security-by-construction). Must flag recursive-lineage anti-patterns, untrusted `expectedTemplateHash`, missing `witnesses[]` bounds checks (see KCC20 audit findings). |
| `check_kip20_compliance(sil_source)` | L1 | Verify cov-ID handling, no parent-tx-witness shortcuts |
| `estimate_costs(sil_source)` | L1 | Gas/size estimation (uses KIP-17 opcode cost table) |

## Boundary

```
┌────────────────────────────────────┬─────────────────────────────────────────┐
│ kaspacom-defi-mcp                  │ OpenSilver MCP                          │
├────────────────────────────────────┼─────────────────────────────────────────┤
│ Layer: Kaspa L2 (Igra / Kasplex)   │ Layer: Kaspa L1 (TN12 / Toccata)        │
│ Lang: Solidity (EVM bytecode)      │ Lang: SilverScript (`.sil` → KAS script)│
│ Domain: DeFi protocol interaction  │ Domain: covenant pattern composition    │
│ Verb shape: "do X with this asset" │ Verb shape: "compose / validate / audit │
│ Audience: agents acting as users   │              a covenant pattern"        │
│                                    │ Audience: agents acting as developers   │
└────────────────────────────────────┴─────────────────────────────────────────┘
```

No tool name collisions. No semantic overlap. Both can register in the same agent config without conflict.

## Federation strategy

**No federation required.** Each MCP serves a distinct domain. An agent that needs both gets both in its config:

```json
{
  "mcpServers": {
    "kaspacom-defi": { "command": "node", "args": ["..."], "env": {...} },
    "opensilver":    { "command": "node", "args": ["..."], "env": {...} }
  }
}
```

The one place a thin bridge could help is when an OpenSilver L1 covenant pattern (e.g. a 3.4 Vault holding KAS) needs an L2-DeFi action (e.g. supply held KAS into Aave once bridged). That's a Phase 11.3 integration concern, not a Phase 7 coordination concern. **Defer until at least one production Vault wants to use an L2 protocol.**

## Outreach implications

The original plan (`PLAN.md` line 41) labels kaspacom-defi-mcp as "DeFi-specific MCP" and says OpenSilver MCP is broader. Confirmed: their MCP is **L2 DeFi-specific** (Igra/Kasplex EVM), ours is **L1 covenant-specific**. The earlier framing of "broader scope" undersells the distinction — they're not nested scopes, they're adjacent layers.

**Outreach action:** loop the KASPACOM team in via the Phase 0 outreach already drafted. The right pitch is not "our MCP is broader than yours" but "your MCP and ours are at adjacent layers — let's cross-link docs and share a unified agent config snippet."

## Open questions

1. Is KASPACOM planning an L1 covenant-deploy MCP separate from the L2 DeFi one? If yes, that's the actual scope-overlap risk.
2. The KaspaCom wallet (queue item #3) reportedly has covenant templates. Are those the L1 surface KASPACOM cares about, and is the wallet the intended integration target for OpenSilver patterns rather than the DeFi MCP?
3. Should OpenSilver MCP run on the same hosted infra (`mcp.opensilver.dev`) as a sibling to `mcp.kaspacom.com` (if it exists), or fully independent?
