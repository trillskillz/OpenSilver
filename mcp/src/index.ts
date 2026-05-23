import { listPatterns, type PatternManifestEntry } from '@opensilver/sdk';

export interface ListPatternsResponse {
  patterns: PatternManifestEntry[];
}

export function listPatternsTool(): ListPatternsResponse {
  return { patterns: listPatterns() };
}
