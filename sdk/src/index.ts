export type PatternPhase = 'core' | 'krc20' | 'zk-aware';

export interface PatternManifestEntry {
  id: string;
  title: string;
  phase: PatternPhase;
  stateful: boolean;
  status: 'planned' | 'scaffolded' | 'implemented' | 'audited';
  summary: string;
  contractPath?: string;
  docPath?: string;
}

export const patternManifest: PatternManifestEntry[] = [
  {
    id: 'core.ownable',
    title: 'Ownable',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Single-owner covenant with explicit transfer semantics and KIP-20-safe state rotation.',
    contractPath: 'contracts/core/ownable.sil',
    docPath: 'docs/patterns/core/ownable.md',
  },
  {
    id: 'core.multisig',
    title: 'MultiSig',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Configurable threshold policy over three explicit signers with a stateful reconfiguration path.',
    contractPath: 'contracts/core/multisig.sil',
    docPath: 'docs/patterns/core/multisig.md',
  },
  {
    id: 'core.timelock',
    title: 'TimeLock',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Time-locked release scaffold with hard/soft cancel modes and a forward-only lock extension path.',
    contractPath: 'contracts/core/timelock.sil',
    docPath: 'docs/patterns/core/timelock.md',
  },
  {
    id: 'core.vault',
    title: 'Vault',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Enterprise-treasury scaffold combining owner rotation, signer quorum, and timelocked release.',
    contractPath: 'contracts/core/vault.sil',
    docPath: 'docs/patterns/core/vault.md',
  },
  {
    id: 'core.escrow-bilateral',
    title: 'Escrow (bilateral)',
    phase: 'core',
    stateful: false,
    status: 'scaffolded',
    summary: 'Three-party bilateral escrow scaffold with arbiter-approved release/refund and buyer timeout reclaim.',
    contractPath: 'contracts/core/escrow-bilateral.sil',
    docPath: 'docs/patterns/core/escrow-bilateral.md',
  },
  {
    id: 'core.escrow-milestone',
    title: 'Escrow (milestone)',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Stateful milestone escrow scaffold with monotonic progress, final release, dispute refund, and timeout reclaim.',
    contractPath: 'contracts/core/escrow-milestone.sil',
    docPath: 'docs/patterns/core/escrow-milestone.md',
  },
  {
    id: 'core.streaming-payment',
    title: 'Streaming Payment',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Recurring-payment scaffold with recipient withdrawals, remaining allowance tracking, and sender cancellation.',
    contractPath: 'contracts/core/streaming-payment.sil',
    docPath: 'docs/patterns/core/streaming-payment.md',
  },
  {
    id: 'core.vesting',
    title: 'Vesting',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Discrete-step vesting scaffold with cliff gating, claimed-amount tracking, and optional admin revocation.',
    contractPath: 'contracts/core/vesting.sil',
    docPath: 'docs/patterns/core/vesting.md',
  },
  {
    id: 'core.dead-mans-switch',
    title: "Dead Man's Switch",
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Inheritance/recovery scaffold with owner keepalive, fallback claim, and beneficiary rotation.',
    contractPath: 'contracts/core/dead-man-switch.sil',
    docPath: 'docs/patterns/core/dead-man-switch.md',
  },
  {
    id: 'core.social-recovery',
    title: 'Social Recovery',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Guardian-quorum recovery scaffold with delayed activation and owner cancellation.',
    contractPath: 'contracts/core/social-recovery.sil',
    docPath: 'docs/patterns/core/social-recovery.md',
  },
];

export function listPatterns(): PatternManifestEntry[] {
  return [...patternManifest];
}
