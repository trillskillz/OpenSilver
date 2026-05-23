export type PatternPhase = 'core' | 'krc20' | 'zk-aware';

export interface PatternManifestEntry {
  id: string;
  title: string;
  phase: PatternPhase;
  stateful: boolean;
  status: 'planned' | 'scaffolded' | 'implemented' | 'audited';
  summary: string;
}

export const patternManifest: PatternManifestEntry[] = [
  {
    id: 'core.ownable',
    title: 'Ownable',
    phase: 'core',
    stateful: true,
    status: 'planned',
    summary: 'Single-owner covenant with explicit transfer semantics and KIP-20-safe state rotation.',
  },
  {
    id: 'core.multisig',
    title: 'MultiSig',
    phase: 'core',
    stateful: true,
    status: 'planned',
    summary: 'Configurable N-of-M signature policy intended to generalize the upstream 2-of-3 example.',
  },
];

export function listPatterns(): PatternManifestEntry[] {
  return [...patternManifest];
}
