#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildIntegrationManifest } from '@opensilver/integrations';
import {
  buildPatternCompilePlan,
  buildPatternDeployPlan,
  describeCovenantScriptPublicKey,
  extractCompiledScript,
  getPatternById,
  listPatterns,
  listPatternsByPhase,
  runSilvercCompileSpec,
  type PatternManifestEntry,
  type PatternPhase,
} from '@opensilver/sdk';

interface ParsedArgs {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === undefined) continue;
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positionals.push(token);
    }
  }
  return { command, positionals, flags };
}

function printUsage(): void {
  const usage = [
    'opensilver — CLI for the OpenSilver covenant pattern library',
    '',
    'Usage:',
    '  opensilver list [--phase <core|krc20|zk-aware>] [--json]',
    '  opensilver get <pattern-id> [--json]',
    '  opensilver doc <pattern-id>',
    '  opensilver compile <file.sil> [--ast-only] [--ctor <json>] [--ctor-file <path>] [--repo-root <path>]',
    '  opensilver compile-pattern <pattern-id> [--ast-only] [--ctor <json>] [--ctor-file <path>] [--repo-root <path>]',
    '  opensilver deploy-plan <pattern-id> --ctor <json> [--network <kaspa:testnet-12|kaspa:testnet-11|kaspa:mainnet>] [--ctor-file <path>] [--repo-root <path>]',
    '  opensilver export-manifest [--consumer <wallet|ide|mcp>] [--phase <core|krc20|zk-aware>] [--out <path>]',
    '  opensilver script <file.sil> [--hex] [--ctor <json>] [--ctor-file <path>] [--repo-root <path>]',
    '  opensilver help',
    '',
    'Pattern phases: core (Phase 3), krc20 (Phase 4), zk-aware (Phase 5)',
    '',
    'Constructor args:',
    "  --ctor passes a JSON array of scalar values, e.g. --ctor '[\"abc...32hex\", false, 100]'.",
    '  --ctor-file reads the same JSON shape from disk.',
    '  Compile-mode (default) requires ctor args for contracts that take any.',
    '  --ast-only skips ctor args entirely.',
    '',
    'Examples:',
    '  opensilver list --phase krc20',
    '  opensilver get core.timelock --json',
    '  opensilver compile contracts/core/ownable.sil --ast-only',
    '  opensilver export-manifest --consumer wallet --phase krc20 --out wallet-manifest.json',
    '  opensilver deploy-plan core.timelock --ctor \'["00..32hex","00..32hex",1700000000,true]\'',
  ].join('\n');
  process.stdout.write(usage + '\n');
}

function readCtorArgs(flags: Record<string, string | boolean>): Array<string | number | boolean> {
  const inline = flags['ctor'];
  const file = flags['ctor-file'];
  let raw: string | undefined;
  if (typeof inline === 'string') {
    raw = inline;
  } else if (typeof file === 'string') {
    raw = readFileSync(file, 'utf8');
  }
  if (raw === undefined) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`ctor args JSON is invalid: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('ctor args must be a JSON array of scalar values');
  }
  for (const value of parsed) {
    const type = typeof value;
    if (type !== 'string' && type !== 'number' && type !== 'boolean') {
      throw new Error(`ctor args must contain only strings, numbers, and booleans; got ${type}`);
    }
  }
  return parsed as Array<string | number | boolean>;
}

function formatPattern(pattern: PatternManifestEntry): string {
  const stateful = pattern.stateful ? 'stateful' : 'stateless';
  const status = pattern.status.padEnd(10);
  const runtime = pattern.verification.runtimeValidated ? 'runtime' : pattern.verification.compileValidated ? 'compile' : 'planned';
  return `  ${pattern.id.padEnd(38)} ${status}  ${stateful.padEnd(9)}  ${runtime.padEnd(7)}  ${pattern.title}`;
}

function cmdList(flags: Record<string, string | boolean>): number {
  const phaseFlag = flags['phase'];
  let entries: PatternManifestEntry[];
  if (phaseFlag === true || phaseFlag === undefined) {
    entries = listPatterns();
  } else if (phaseFlag === 'core' || phaseFlag === 'krc20' || phaseFlag === 'zk-aware') {
    entries = listPatternsByPhase(phaseFlag as PatternPhase);
  } else {
    process.stderr.write(`unknown phase: ${phaseFlag}\n`);
    return 2;
  }

  if (flags['json']) {
    process.stdout.write(JSON.stringify(entries, null, 2) + '\n');
    return 0;
  }

  if (entries.length === 0) {
    process.stdout.write('  (no patterns)\n');
    return 0;
  }
  const heading =
    phaseFlag && phaseFlag !== true ? `OpenSilver patterns (phase: ${phaseFlag})` : 'OpenSilver patterns';
  process.stdout.write(heading + '\n');
  process.stdout.write(`  ${'id'.padEnd(38)} ${'status'.padEnd(10)}  ${'kind'.padEnd(9)}  ${'verify'.padEnd(7)}  title\n`);
  process.stdout.write(`  ${'-'.repeat(38)} ${'-'.repeat(10)}  ${'-'.repeat(9)}  ${'-'.repeat(7)}  ${'-'.repeat(20)}\n`);
  for (const entry of entries) {
    process.stdout.write(formatPattern(entry) + '\n');
  }
  return 0;
}

function cmdGet(positionals: string[], flags: Record<string, string | boolean>): number {
  const id = positionals[0];
  if (!id) {
    process.stderr.write('opensilver get: pattern id required\n');
    return 2;
  }
  const entry = getPatternById(id);
  if (!entry) {
    process.stderr.write(`opensilver get: no pattern with id ${id}\n`);
    return 1;
  }
  if (flags['json']) {
    process.stdout.write(JSON.stringify(entry, null, 2) + '\n');
    return 0;
  }
  process.stdout.write(`${entry.title} (${entry.id})\n`);
  process.stdout.write(`  Phase:        ${entry.phase}\n`);
  process.stdout.write(`  Status:       ${entry.status}\n`);
  process.stdout.write(`  Stateful:     ${entry.stateful}\n`);
  process.stdout.write(`  Tags:         ${entry.tags.join(', ')}\n`);
  process.stdout.write(`  Verification: compile=${entry.verification.compileValidated} runtime=${entry.verification.runtimeValidated} audit=${entry.verification.auditStatus}\n`);
  process.stdout.write(`  Compiler:     mode=${entry.compiler.defaultMode} patched=${entry.compiler.requiresPatchedSilverc} bootstrap=${entry.compiler.bootstrapCommand}\n`);
  if (entry.contractPath) process.stdout.write(`  Contract:     ${entry.contractPath}\n`);
  if (entry.docPath) process.stdout.write(`  Docs:         ${entry.docPath}\n`);
  if (entry.verification.compileTestPath) process.stdout.write(`  Compile test: ${entry.verification.compileTestPath}\n`);
  if (entry.verification.runtimeTestPath) process.stdout.write(`  Runtime test: ${entry.verification.runtimeTestPath}\n`);
  process.stdout.write(`  Summary:\n    ${entry.summary}\n`);
  return 0;
}

function cmdDoc(positionals: string[]): number {
  const id = positionals[0];
  if (!id) {
    process.stderr.write('opensilver doc: pattern id required\n');
    return 2;
  }
  const entry = getPatternById(id);
  if (!entry) {
    process.stderr.write(`opensilver doc: no pattern with id ${id}\n`);
    return 1;
  }
  if (!entry.docPath) {
    process.stderr.write(`opensilver doc: pattern ${id} has no docPath\n`);
    return 1;
  }
  process.stdout.write(entry.docPath + '\n');
  return 0;
}

function cmdCompile(positionals: string[], flags: Record<string, string | boolean>): number {
  const filePath = positionals[0];
  if (!filePath) {
    process.stderr.write('opensilver compile: source file required\n');
    return 2;
  }
  const repoRoot = typeof flags['repo-root'] === 'string' ? (flags['repo-root'] as string) : process.cwd();
  const absoluteSource = resolve(repoRoot, filePath);
  if (!existsSync(absoluteSource)) {
    process.stderr.write(`opensilver compile: ${filePath} not found (under ${repoRoot})\n`);
    return 1;
  }

  const mode = flags['ast-only'] ? 'ast-only' : 'compile';
  let ctorArgs: Array<string | number | boolean>;
  try {
    ctorArgs = readCtorArgs(flags);
  } catch (err) {
    process.stderr.write(`opensilver compile: ${(err as Error).message}\n`);
    return 2;
  }
  try {
    const result = runSilvercCompileSpec(
      {
        binary: 'upstream/silverscript/target/debug/silverc',
        contractPath: filePath,
        constructorArgs: ctorArgs,
        mode,
      },
      { repoRoot },
    );
    if (mode === 'ast-only') {
      process.stdout.write(`ok (ast-only): ${filePath} parses cleanly\n`);
      return 0;
    }
    const artifact = result.artifact as { contract_name?: string; script?: number[] };
    process.stdout.write(JSON.stringify(artifact, null, 2) + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`opensilver compile: ${(err as Error).message}\n`);
    return 1;
  }
}

function cmdCompilePattern(positionals: string[], flags: Record<string, string | boolean>): number {
  const id = positionals[0];
  if (!id) {
    process.stderr.write('opensilver compile-pattern: pattern id required\n');
    return 2;
  }
  const repoRoot = typeof flags['repo-root'] === 'string' ? (flags['repo-root'] as string) : process.cwd();
  let ctorArgs: Array<string | number | boolean>;
  try {
    ctorArgs = readCtorArgs(flags);
  } catch (err) {
    process.stderr.write(`opensilver compile-pattern: ${(err as Error).message}\n`);
    return 2;
  }
  try {
    const plan = buildPatternCompilePlan(id, ctorArgs, flags['ast-only'] ? { mode: 'ast-only' } : {});
    const result = runSilvercCompileSpec(plan.spec, { repoRoot });
    if (result.spec.mode === 'ast-only') {
      process.stdout.write(`ok (${result.spec.mode}): ${plan.pattern.contractPath} parses cleanly\n`);
      return 0;
    }
    process.stdout.write(JSON.stringify({ pattern: plan.pattern.id, artifact: result.artifact }, null, 2) + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`opensilver compile-pattern: ${(err as Error).message}\n`);
    return 1;
  }
}

function cmdDeployPlan(positionals: string[], flags: Record<string, string | boolean>): number {
  const id = positionals[0];
  if (!id) {
    process.stderr.write('opensilver deploy-plan: pattern id required\n');
    return 2;
  }
  const repoRoot = typeof flags['repo-root'] === 'string' ? (flags['repo-root'] as string) : process.cwd();
  let ctorArgs: Array<string | number | boolean>;
  try {
    ctorArgs = readCtorArgs(flags);
  } catch (err) {
    process.stderr.write(`opensilver deploy-plan: ${(err as Error).message}\n`);
    return 2;
  }
  const networkFlag = flags['network'];
  let network: 'kaspa:testnet-12' | 'kaspa:testnet-11' | 'kaspa:mainnet' | undefined;
  if (typeof networkFlag === 'string') {
    if (networkFlag === 'kaspa:testnet-12' || networkFlag === 'kaspa:testnet-11' || networkFlag === 'kaspa:mainnet') {
      network = networkFlag;
    } else {
      process.stderr.write(`opensilver deploy-plan: unknown network ${String(networkFlag)}\n`);
      return 2;
    }
  }
  try {
    const plan = buildPatternDeployPlan(id, ctorArgs, { repoRoot, ...(network ? { network } : {}) });
    process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`opensilver deploy-plan: ${(err as Error).message}\n`);
    return 1;
  }
}

function cmdExportManifest(flags: Record<string, string | boolean>): number {
  const consumerFlag = flags['consumer'];
  const phaseFlag = flags['phase'];
  const outFlag = flags['out'];

  const consumer =
    consumerFlag === undefined || consumerFlag === true
      ? 'mcp'
      : consumerFlag === 'wallet' || consumerFlag === 'ide' || consumerFlag === 'mcp'
        ? consumerFlag
        : null;
  if (!consumer) {
    process.stderr.write(`opensilver export-manifest: unknown consumer ${String(consumerFlag)}\n`);
    return 2;
  }

  let patterns: PatternManifestEntry[];
  if (phaseFlag === undefined || phaseFlag === true) {
    patterns = listPatterns();
  } else if (phaseFlag === 'core' || phaseFlag === 'krc20' || phaseFlag === 'zk-aware') {
    patterns = listPatternsByPhase(phaseFlag as PatternPhase);
  } else {
    process.stderr.write(`opensilver export-manifest: unknown phase ${String(phaseFlag)}\n`);
    return 2;
  }

  const manifest = buildIntegrationManifest(consumer, patterns);
  const json = JSON.stringify(manifest, null, 2) + '\n';
  if (typeof outFlag === 'string') {
    writeFileSync(outFlag, json, 'utf8');
    process.stdout.write(`${outFlag}\n`);
    return 0;
  }
  process.stdout.write(json);
  return 0;
}

function cmdScript(positionals: string[], flags: Record<string, string | boolean>): number {
  const filePath = positionals[0];
  if (!filePath) {
    process.stderr.write('opensilver script: source file required\n');
    return 2;
  }
  const repoRoot = typeof flags['repo-root'] === 'string' ? (flags['repo-root'] as string) : process.cwd();
  const absoluteSource = resolve(repoRoot, filePath);
  if (!existsSync(absoluteSource)) {
    process.stderr.write(`opensilver script: ${filePath} not found (under ${repoRoot})\n`);
    return 1;
  }
  let ctorArgs: Array<string | number | boolean>;
  try {
    ctorArgs = readCtorArgs(flags);
  } catch (err) {
    process.stderr.write(`opensilver script: ${(err as Error).message}\n`);
    return 2;
  }
  try {
    const result = runSilvercCompileSpec(
      {
        binary: 'upstream/silverscript/target/debug/silverc',
        contractPath: filePath,
        constructorArgs: ctorArgs,
        mode: 'compile',
      },
      { repoRoot },
    );
    const script = extractCompiledScript(result.artifact);
    const shape = describeCovenantScriptPublicKey(result.artifact);
    if (flags['hex']) {
      const hex = Array.from(script)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      process.stdout.write(hex + '\n');
      return 0;
    }
    process.stdout.write(
      JSON.stringify(
        {
          encoding: shape.encoding,
          scriptLength: script.length,
          scriptBytes: Array.from(script),
        },
        null,
        2,
      ) + '\n',
    );
    return 0;
  } catch (err) {
    process.stderr.write(`opensilver script: ${(err as Error).message}\n`);
    return 1;
  }
}

export function runCli(argv: string[]): number {
  const parsed = parseArgs(argv);
  switch (parsed.command) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      return 0;
    case 'list':
      return cmdList(parsed.flags);
    case 'get':
      return cmdGet(parsed.positionals, parsed.flags);
    case 'doc':
      return cmdDoc(parsed.positionals);
    case 'compile':
      return cmdCompile(parsed.positionals, parsed.flags);
    case 'compile-pattern':
      return cmdCompilePattern(parsed.positionals, parsed.flags);
    case 'deploy-plan':
      return cmdDeployPlan(parsed.positionals, parsed.flags);
    case 'export-manifest':
      return cmdExportManifest(parsed.flags);
    case 'script':
      return cmdScript(parsed.positionals, parsed.flags);
    default:
      process.stderr.write(
        `opensilver: unknown command '${parsed.command}'. run 'opensilver help' for usage.\n`,
      );
      return 2;
  }
}

// If invoked as the binary, run from argv. If imported (e.g. by tests),
// callers use runCli() directly. The build adds a shebang and bin field
// already, so `node dist/index.js list` works after `npm run build`.
const isMain = (() => {
  try {
    return import.meta.url === `file://${process.argv[1]}`;
  } catch {
    return false;
  }
})();

if (isMain) {
  process.exit(runCli(process.argv.slice(2)));
}
