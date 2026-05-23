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
];

export function listPatterns(): PatternManifestEntry[] {
  return [...patternManifest];
}
