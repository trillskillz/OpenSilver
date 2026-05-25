import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIntegrationManifest } from '../integrations/src/index.js';
import { listPatterns } from '../sdk/src/index.js';

const repoRoot = process.cwd();
const buildPath = join(repoRoot, 'wizard/build/index.html');
const templatePath = join(repoRoot, 'wizard/src/template.html');

// The wizard build is a single self-contained HTML file produced by
// `npm run wizard:build`. These tests are a regression guard: if the
// template marker drifts, or the manifest the wizard inlines stops
// matching the canonical integration manifest, fail loudly so CI
// catches it before the wizard ships stale data.
describe('wizard build artifact', () => {
  it('template carries the OPENSILVER_MANIFEST_INJECT marker exactly once', () => {
    const template = readFileSync(templatePath, 'utf8');
    const matches = template.match(/\/\*OPENSILVER_MANIFEST_INJECT\*\//g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it('built index.html exists and inlines the IDE manifest verbatim', () => {
    expect(existsSync(buildPath)).toBe(true);
    const html = readFileSync(buildPath, 'utf8');
    // Build replaces the marker, so it must NOT appear in the output.
    expect(html).not.toContain('/*OPENSILVER_MANIFEST_INJECT*/');

    // The build script reads artifacts/manifests/ide-all.json and
    // substitutes it whole. Re-derive the canonical IDE manifest and
    // confirm every pattern id appears in the wizard output.
    const ideManifest = buildIntegrationManifest('ide', listPatterns());
    for (const pattern of ideManifest.patterns) {
      expect(html).toContain(`"id": "${pattern.id}"`);
    }
  });

  it('built index.html stays in sync with the checked-in ide manifest', () => {
    const html = readFileSync(buildPath, 'utf8');
    const ideManifest = JSON.parse(
      readFileSync(join(repoRoot, 'artifacts/manifests/ide-all.json'), 'utf8'),
    );
    // A simple structural check — totalPatterns claim from the
    // manifest summary must surface verbatim in the inlined payload.
    expect(html).toContain(`"totalPatterns": ${ideManifest.summary.totalPatterns}`);
  });
});
