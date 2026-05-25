#!/usr/bin/env node
// Build the OpenSilver Web Wizard.
//
// Reads wizard/src/template.html, substitutes the marker
// `/*OPENSILVER_MANIFEST_INJECT*/` with the JSON contents of
// artifacts/manifests/ide-all.json (the all-phases IDE-consumer manifest),
// and writes the result to wizard/build/index.html.
//
// The output is a single self-contained HTML file (vanilla HTML + CSS +
// JS, no external dependencies) — open it directly in a browser via
// file:// or serve it from any static host.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

const template = readFileSync(resolve(here, 'template.html'), 'utf8');
const manifestPath = resolve(repoRoot, 'artifacts/manifests/ide-all.json');
const manifest = readFileSync(manifestPath, 'utf8').trim();

const MARKER = '/*OPENSILVER_MANIFEST_INJECT*/';
if (!template.includes(MARKER)) {
  console.error(`template.html missing required marker: ${MARKER}`);
  process.exit(1);
}

const output = template.replace(MARKER, manifest);
const outPath = resolve(repoRoot, 'wizard/build/index.html');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, output, 'utf8');
console.log(`wrote ${outPath} (${output.length} bytes, ${manifest.length} bytes manifest)`);
