import { listPatterns } from '@opensilver/sdk';

export function buildWizardCatalog(): string[] {
  return listPatterns().map((pattern) => `${pattern.id}:${pattern.status}`);
}
