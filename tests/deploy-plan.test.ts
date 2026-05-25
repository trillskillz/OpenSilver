import { describe, expect, it } from 'vitest';
import { buildPatternDeployPlan } from '@opensilver/sdk';
import { runCli } from '@opensilver/cli';

const repoRoot = process.cwd();

interface CapturedOutput {
  stdout: string;
  stderr: string;
}

function captureCli(argv: string[]): { exitCode: number; out: CapturedOutput } {
  const out: CapturedOutput = { stdout: '', stderr: '' };
  const realOutWrite = process.stdout.write.bind(process.stdout);
  const realErrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    out.stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    out.stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  try {
    const exitCode = runCli(argv);
    return { exitCode, out };
  } finally {
    process.stdout.write = realOutWrite;
    process.stderr.write = realErrWrite;
  }
}

const ownableCtor: Array<string | number | boolean> = [
  '00'.repeat(31) + '01', // init_owner pubkey
  false, // init_has_pending_owner
  '00'.repeat(31) + '01', // init_pending_owner placeholder
];

describe('SDK buildPatternDeployPlan', () => {
  it('produces a complete deploy plan for a core pattern', () => {
    const plan = buildPatternDeployPlan('core.ownable', ownableCtor, { repoRoot });

    expect(plan.patternId).toBe('core.ownable');
    expect(plan.patternTitle).toBe('Ownable');
    expect(plan.phase).toBe('core');

    // Real compile happened: scriptHex is non-empty hex, scriptLength > 0.
    expect(plan.compiled.scriptHex).toMatch(/^[0-9a-f]+$/);
    expect(plan.compiled.scriptLength).toBeGreaterThan(0);
    expect(plan.compiled.scriptHex.length).toBe(plan.compiled.scriptLength * 2);
    expect(plan.compiled.contractName).toBe('Ownable');

    // P2SH commitment carries the same script.
    expect(plan.p2shCommitment.scheme).toBe('p2sh');
    expect(plan.p2shCommitment.redeemScriptHex).toBe(plan.compiled.scriptHex);

    // Deployment instructions + network hints present.
    expect(plan.deployment.instructions.length).toBeGreaterThan(0);
    expect(plan.deployment.networkHints[0]).toContain('kaspa:testnet-12');

    // Verification + compiler metadata propagated.
    expect(plan.verification.compileValidated).toBe(true);
    expect(plan.compiler.bootstrap).toBe('pinned-upstream');

    // Entrypoints discovered from the artifact's abi.
    expect(plan.deployment.entrypoints).toEqual(
      expect.arrayContaining(['propose_transfer', 'accept_transfer', 'cancel_transfer']),
    );
  });

  it('honors the network option', () => {
    const plan = buildPatternDeployPlan('core.ownable', ownableCtor, {
      repoRoot,
      network: 'kaspa:mainnet',
    });
    expect(plan.deployment.networkHints[0]).toContain('kaspa:mainnet');
  });

  it('rejects unknown pattern ids', () => {
    expect(() => buildPatternDeployPlan('no.such.pattern', [], { repoRoot })).toThrow(
      /unknown pattern id/,
    );
  });

  it('surfaces patched-silverc requirement for zk patterns', () => {
    // Phase-5 patterns require npm run patch:silverc:zk. The plan's
    // networkHints includes a NOTE line pointing at the right command.
    // Use the verified-computation contract; its ctor is
    // (verifying_key: byte[], recipient: pubkey, prover: pubkey).
    // A 1-byte placeholder VK is enough for the compile-shape probe;
    // the verifier itself won't run during compile.
    const plan = buildPatternDeployPlan(
      'zk-aware.verified-computation',
      ['00', '00'.repeat(31) + 'aa', '00'.repeat(31) + 'bb'],
      { repoRoot },
    );
    expect(plan.compiler.requiresPatchedSilverc).toBe(true);
    const noteHint = plan.deployment.networkHints.find((hint) =>
      hint.includes('npm run patch:silverc:zk'),
    );
    expect(noteHint).toBeDefined();
  });
});

describe('opensilver deploy-plan CLI', () => {
  it('emits a deploy plan JSON for a core pattern', () => {
    const { exitCode, out } = captureCli([
      'deploy-plan',
      'core.ownable',
      '--ctor',
      JSON.stringify(ownableCtor),
      '--repo-root',
      repoRoot,
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(out.stdout);
    expect(parsed.patternId).toBe('core.ownable');
    expect(parsed.compiled.scriptLength).toBeGreaterThan(0);
    expect(parsed.deployment.entrypoints).toContain('propose_transfer');
  });

  it('returns 2 when pattern id is missing', () => {
    const { exitCode, out } = captureCli(['deploy-plan']);
    expect(exitCode).toBe(2);
    expect(out.stderr).toContain('pattern id required');
  });

  it('returns 1 for unknown pattern', () => {
    const { exitCode, out } = captureCli([
      'deploy-plan',
      'no.such.pattern',
      '--repo-root',
      repoRoot,
    ]);
    expect(exitCode).toBe(1);
    expect(out.stderr).toContain('unknown pattern id');
  });

  it('returns 2 for unknown network', () => {
    const { exitCode, out } = captureCli([
      'deploy-plan',
      'core.ownable',
      '--ctor',
      JSON.stringify(ownableCtor),
      '--network',
      'eth:mainnet',
      '--repo-root',
      repoRoot,
    ]);
    expect(exitCode).toBe(2);
    expect(out.stderr).toContain('unknown network');
  });

  it('honors --network kaspa:mainnet', () => {
    const { exitCode, out } = captureCli([
      'deploy-plan',
      'core.ownable',
      '--ctor',
      JSON.stringify(ownableCtor),
      '--network',
      'kaspa:mainnet',
      '--repo-root',
      repoRoot,
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(out.stdout);
    expect(parsed.deployment.networkHints[0]).toContain('kaspa:mainnet');
  });

  it('lists the new command in help output', () => {
    const { exitCode, out } = captureCli(['help']);
    expect(exitCode).toBe(0);
    expect(out.stdout).toContain('opensilver deploy-plan <pattern-id>');
  });
});
