import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { buildIntegrationManifest } from '../integrations/dist/index.js';
import { listPatterns, listPatternsByPhase } from '../sdk/dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const outputs = [
  {
    path: resolve(repoRoot, 'artifacts/manifests/mcp-all.json'),
    manifest: buildIntegrationManifest('mcp', listPatterns()),
  },
  {
    path: resolve(repoRoot, 'artifacts/manifests/ide-all.json'),
    manifest: buildIntegrationManifest('ide', listPatterns()),
  },
  {
    path: resolve(repoRoot, 'artifacts/manifests/wallet-krc20.json'),
    manifest: buildIntegrationManifest('wallet', listPatternsByPhase('krc20')),
  },
];

for (const output of outputs) {
  mkdirSync(dirname(output.path), { recursive: true });
  writeFileSync(output.path, JSON.stringify(output.manifest, null, 2) + '\n', 'utf8');
  process.stdout.write(`${output.path}\n`);
}
