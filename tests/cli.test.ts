import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCli } from '@opensilver/cli';

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

const repoRoot = process.cwd();

describe('opensilver CLI', () => {
  describe('help', () => {
    it('prints usage with no args', () => {
      const { exitCode, out } = captureCli([]);
      expect(exitCode).toBe(0);
      expect(out.stdout).toContain('opensilver — CLI');
      expect(out.stdout).toContain('opensilver list');
      expect(out.stdout).toContain('opensilver get');
    });

    it('prints usage with help command', () => {
      const { exitCode, out } = captureCli(['help']);
      expect(exitCode).toBe(0);
      expect(out.stdout).toContain('opensilver — CLI');
    });

    it('returns 2 on unknown command', () => {
      const { exitCode, out } = captureCli(['nope']);
      expect(exitCode).toBe(2);
      expect(out.stderr).toContain("unknown command 'nope'");
    });
  });

  describe('list', () => {
    it('lists all patterns by default', () => {
      const { exitCode, out } = captureCli(['list']);
      expect(exitCode).toBe(0);
      expect(out.stdout).toContain('OpenSilver patterns');
      expect(out.stdout).toContain('core.ownable');
      expect(out.stdout).toContain('krc20.kcc20-reference');
      expect(out.stdout).toContain('zk-aware.verified-computation');
    });

    it('filters by phase', () => {
      const { exitCode, out } = captureCli(['list', '--phase', 'krc20']);
      expect(exitCode).toBe(0);
      expect(out.stdout).toContain('OpenSilver patterns (phase: krc20)');
      expect(out.stdout).toContain('kcc20-reference');
      // Phase 3 entries must be filtered out
      expect(out.stdout).not.toContain('core.ownable');
    });

    it('rejects unknown phase', () => {
      const { exitCode, out } = captureCli(['list', '--phase', 'not-a-phase']);
      expect(exitCode).toBe(2);
      expect(out.stderr).toContain('unknown phase');
    });

    it('emits JSON when --json passed', () => {
      const { exitCode, out } = captureCli(['list', '--phase', 'zk-aware', '--json']);
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(out.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(4); // four Phase 5 patterns in the manifest
      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0].phase).toBe('zk-aware');
    });
  });

  describe('get', () => {
    it('prints pattern details', () => {
      const { exitCode, out } = captureCli(['get', 'core.timelock']);
      expect(exitCode).toBe(0);
      expect(out.stdout).toContain('TimeLock (core.timelock)');
      expect(out.stdout).toContain('Phase:        core');
      expect(out.stdout).toContain('Stateful:     true');
      expect(out.stdout).toContain('Verification: compile=true runtime=true audit=internal-regression-gated');
      expect(out.stdout).toContain('Compiler:     mode=ast-only patched=false bootstrap=npm run bootstrap:silverc');
      expect(out.stdout).toContain('contracts/core/timelock.sil');
    });

    it('returns 1 for unknown pattern', () => {
      const { exitCode, out } = captureCli(['get', 'core.does-not-exist']);
      expect(exitCode).toBe(1);
      expect(out.stderr).toContain('no pattern with id');
    });

    it('returns 2 with missing id', () => {
      const { exitCode, out } = captureCli(['get']);
      expect(exitCode).toBe(2);
      expect(out.stderr).toContain('pattern id required');
    });

    it('emits JSON when --json passed', () => {
      const { exitCode, out } = captureCli(['get', 'krc20.kcc20-capped', '--json']);
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(out.stdout);
      expect(parsed.id).toBe('krc20.kcc20-capped');
      expect(parsed.contractPath).toBe('contracts/tokens/kcc20-capped.sil');
    });
  });

  describe('doc', () => {
    it('prints doc path for a known pattern', () => {
      const { exitCode, out } = captureCli(['doc', 'core.vault']);
      expect(exitCode).toBe(0);
      expect(out.stdout.trim()).toBe('docs/patterns/core/vault.md');
    });

    it('returns 1 for unknown pattern', () => {
      const { exitCode, out } = captureCli(['doc', 'no.such']);
      expect(exitCode).toBe(1);
      expect(out.stderr).toContain('no pattern with id');
    });
  });

  describe('compile', () => {
    it('returns 1 for missing source file', () => {
      const { exitCode, out } = captureCli(['compile', 'contracts/does-not-exist.sil', '--repo-root', repoRoot]);
      expect(exitCode).toBe(1);
      expect(out.stderr).toContain('not found');
    });

    it('returns 2 when source path is missing', () => {
      const { exitCode, out } = captureCli(['compile']);
      expect(exitCode).toBe(2);
      expect(out.stderr).toContain('source file required');
    });

    it('--ast-only compiles a core contract', () => {
      const { exitCode, out } = captureCli([
        'compile',
        'contracts/core/ownable.sil',
        '--ast-only',
        '--repo-root',
        repoRoot,
      ]);
      expect(exitCode).toBe(0);
      expect(out.stdout).toContain('ok (ast-only)');
    });
  });

  describe('compile-pattern', () => {
    it('compiles a manifest pattern by id using its contract path', () => {
      const { exitCode, out } = captureCli([
        'compile-pattern',
        'core.ownable',
        '--ast-only',
        '--repo-root',
        repoRoot,
      ]);
      expect(exitCode).toBe(0);
      expect(out.stdout).toContain('contracts/core/ownable.sil parses cleanly');
    });

    it('returns 1 for unknown pattern ids', () => {
      const { exitCode, out } = captureCli(['compile-pattern', 'no.such.pattern', '--repo-root', repoRoot]);
      expect(exitCode).toBe(1);
      expect(out.stderr).toContain('unknown pattern id');
    });
  });

  describe('export-manifest', () => {
    it('emits a machine-readable integration manifest to stdout', () => {
      const { exitCode, out } = captureCli(['export-manifest', '--consumer', 'wallet', '--phase', 'krc20']);
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(out.stdout);
      expect(parsed.consumer).toBe('wallet');
      expect(parsed.compilerPolicy.strategy).toBe('pinned-upstream-bootstrap');
      expect(parsed.summary.totalPatterns).toBe(5);
      expect(parsed.patterns.every((pattern: { phase: string }) => pattern.phase === 'krc20')).toBe(true);
    });

    it('writes the manifest artifact to disk when --out is passed', () => {
      const dir = mkdtempSync(join(tmpdir(), 'opensilver-manifest-'));
      try {
        const outPath = join(dir, 'manifest.json');
        const { exitCode, out } = captureCli(['export-manifest', '--out', outPath]);
        expect(exitCode).toBe(0);
        expect(out.stdout.trim()).toBe(outPath);
        const parsed = JSON.parse(readFileSync(outPath, 'utf8'));
        expect(parsed.consumer).toBe('mcp');
        expect(parsed.summary.totalPatterns).toBeGreaterThan(0);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('rejects unknown consumer values', () => {
      const { exitCode, out } = captureCli(['export-manifest', '--consumer', 'nope']);
      expect(exitCode).toBe(2);
      expect(out.stderr).toContain('unknown consumer');
    });
  });

  describe('script', () => {
    // Ownable takes (init_owner: pubkey, init_has_pending_owner: bool,
    // init_pending_owner: pubkey).
    const ownableCtorJson = JSON.stringify(['00'.repeat(31) + '01', false, '00'.repeat(31) + '01']);

    it('extracts the redeem script as hex', () => {
      const { exitCode, out } = captureCli([
        'script',
        'contracts/core/ownable.sil',
        '--hex',
        '--ctor',
        ownableCtorJson,
        '--repo-root',
        repoRoot,
      ]);
      expect(exitCode).toBe(0);
      const hex = out.stdout.trim();
      expect(hex).toMatch(/^[0-9a-f]+$/);
      // Ownable compiles to >100 script bytes
      expect(hex.length).toBeGreaterThan(200);
    });

    it('emits JSON metadata without --hex', () => {
      const { exitCode, out } = captureCli([
        'script',
        'contracts/core/ownable.sil',
        '--ctor',
        ownableCtorJson,
        '--repo-root',
        repoRoot,
      ]);
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(out.stdout);
      expect(parsed.encoding).toBe('p2sh');
      expect(parsed.scriptLength).toBeGreaterThan(0);
      expect(Array.isArray(parsed.scriptBytes)).toBe(true);
      expect(parsed.scriptBytes).toHaveLength(parsed.scriptLength);
    });

    it('rejects malformed ctor JSON', () => {
      const { exitCode, out } = captureCli([
        'script',
        'contracts/core/ownable.sil',
        '--ctor',
        'not-json',
        '--repo-root',
        repoRoot,
      ]);
      expect(exitCode).toBe(2);
      expect(out.stderr).toContain('ctor args JSON is invalid');
    });
  });
});
