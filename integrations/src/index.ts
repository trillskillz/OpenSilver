import type { PatternManifestEntry } from '@opensilver/sdk';

export interface IntegrationManifest {
  consumer: 'wallet' | 'ide' | 'mcp';
  patterns: PatternManifestEntry[];
}

export function buildIntegrationManifest(
  consumer: IntegrationManifest['consumer'],
  patterns: PatternManifestEntry[],
): IntegrationManifest {
  return { consumer, patterns };
}
