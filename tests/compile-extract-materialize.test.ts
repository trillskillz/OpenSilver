import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  describeCovenantScriptPublicKey,
  encodeConstructorArgForSilverc,
  encodeConstructorArgsForSilverc,
  extractCompiledScript,
  runSilvercCompileSpec,
} from '@opensilver/sdk';
import { materializeCovenantOutput, type P2shAddressDeriver } from '@opensilver/integrations';

const repoRoot = process.cwd();

describe('silverc constructor-args encoder', () => {
  it('maps booleans to {kind: bool, data}', () => {
    expect(encodeConstructorArgForSilverc(true)).toEqual({ kind: 'bool', data: true });
    expect(encodeConstructorArgForSilverc(false)).toEqual({ kind: 'bool', data: false });
  });

  it('maps integers to {kind: int, data}', () => {
    expect(encodeConstructorArgForSilverc(42)).toEqual({ kind: 'int', data: 42 });
    expect(encodeConstructorArgForSilverc(0)).toEqual({ kind: 'int', data: 0 });
  });

  it('rejects non-integer numbers', () => {
    expect(() => encodeConstructorArgForSilverc(3.14)).toThrow(/must be integers/);
  });

  it('maps a 32-byte hex string to a byte array', () => {
    const hex = '00'.repeat(31) + '01';
    const encoded = encodeConstructorArgForSilverc(hex);
    expect(encoded).toMatchObject({ kind: 'array' });
    expect(Array.isArray((encoded as { data: unknown[] }).data)).toBe(true);
    const data = (encoded as { data: Array<{ kind: string; data: number }> }).data;
    expect(data).toHaveLength(32);
    expect(data[0]).toEqual({ kind: 'byte', data: 0 });
    expect(data[31]).toEqual({ kind: 'byte', data: 1 });
  });

  it('strips 0x prefixes', () => {
    const a = encodeConstructorArgForSilverc('0x' + '00'.repeat(31) + 'ff');
    const b = encodeConstructorArgForSilverc('00'.repeat(31) + 'ff');
    expect(a).toEqual(b);
  });

  it('rejects non-hex strings', () => {
    expect(() => encodeConstructorArgForSilverc('not-hex')).toThrow(/hex-encoded/);
  });

  it('rejects odd-length hex strings', () => {
    expect(() => encodeConstructorArgForSilverc('abc')).toThrow(/hex-encoded/);
  });

  it('batch-encodes a heterogeneous arg list', () => {
    const encoded = encodeConstructorArgsForSilverc([
      '00'.repeat(32),
      false,
      '01'.repeat(32),
    ]);
    expect(encoded).toHaveLength(3);
    expect(encoded[0].kind).toBe('array');
    expect(encoded[1]).toEqual({ kind: 'bool', data: false });
    expect(encoded[2].kind).toBe('array');
  });
});

describe('end-to-end: silverc compile → extract → materialize', () => {
  it('compiles ownable.sil and produces a P2SH-derivable artifact', () => {
    // Three ctor args: (init_owner pubkey, init_has_pending_owner bool,
    // init_pending_owner pubkey). Use distinct 32-byte placeholders so the
    // compiled script's byte sequence reflects the args.
    const ownerPk = '00'.repeat(31) + '01';
    const pendingPk = '00'.repeat(31) + '02';
    const result = runSilvercCompileSpec(
      {
        binary: 'upstream/silverscript/target/debug/silverc',
        contractPath: 'contracts/core/ownable.sil',
        constructorArgs: [ownerPk, false, pendingPk],
        mode: 'compile',
      },
      { repoRoot },
    );

    // The artifact JSON has contract_name + script byte array.
    const artifact = result.artifact as { contract_name: string; script: number[] };
    expect(artifact.contract_name).toBe('Ownable');
    expect(Array.isArray(artifact.script)).toBe(true);
    expect(artifact.script.length).toBeGreaterThan(0);

    // The byte sequence should contain both pubkey constants embedded as
    // 32-byte push immediates somewhere in the script. The compiler emits
    // an OP_DATA_32 (0x20) prefix before each — that's why two distinct
    // 0x20 markers should appear around our pubkey constants.
    const script = artifact.script;
    expect(script.filter((b) => b === 0x20).length).toBeGreaterThanOrEqual(2);

    // extractCompiledScript yields the same bytes as a Uint8Array.
    const bytes = extractCompiledScript(artifact);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(script.length);
    expect(Array.from(bytes)).toEqual(script);

    // describeCovenantScriptPublicKey returns a P2SH shape with the script.
    const shape = describeCovenantScriptPublicKey(artifact);
    expect(shape.encoding).toBe('p2sh');
    expect(Array.from(shape.redeemScript)).toEqual(script);
    expect(shape.scriptPublicKey).toBe(null);
    expect(shape.address).toBe(null);

    // materializeCovenantOutput uses a deriver callback. We stub one that
    // produces a deterministic fake address from blake2b-ish content of the
    // script bytes — verifies the wiring, not real kaspa-bech32 encoding.
    const fakeDeriver: P2shAddressDeriver = (redeemScript, networkType) => {
      // Deterministic but obviously-not-real fake.
      const sum = Array.from(redeemScript).reduce((acc, b) => (acc + b) & 0xffff, 0);
      return `kaspa-${networkType}-p2sh-${sum.toString(16).padStart(4, '0')}`;
    };

    const materialized = materializeCovenantOutput(
      {
        role: 'controller',
        amountSompi: 1_000,
        owner: 'role-label-placeholder',
        covenantBound: true,
      },
      {
        controllerAddress: 'kaspa-role-controller',
        assetAddress: 'kaspa-role-asset',
        recipientAddress: 'kaspa-role-recipient',
      },
      {
        networkType: 'testnet-12',
        deriver: fakeDeriver,
        artifactsByRole: { controller: artifact },
      },
    );

    expect(materialized.role).toBe('controller');
    expect(materialized.covenantBound).toBe(true);
    expect(materialized.address).toMatch(/^kaspa-testnet-12-p2sh-[0-9a-f]{4}$/);
    // The materialised address must NOT equal the role-label fallback —
    // that's the entire point of this end-to-end test.
    expect(materialized.address).not.toBe('kaspa-role-controller');
    expect(materialized.scriptShape?.address).toBe(materialized.address);
  });

  it('falls back to role-label addresses for non-covenant outputs', () => {
    const materialized = materializeCovenantOutput(
      {
        role: 'asset-recipient',
        amountSompi: '<minted-amount>',
        owner: 'role-label-placeholder',
        covenantBound: false,
      },
      {
        controllerAddress: 'kaspa-role-controller',
        assetAddress: 'kaspa-role-asset',
        recipientAddress: 'kaspa-role-recipient',
      },
      {
        networkType: 'testnet-12',
        deriver: () => 'should-not-be-called',
        artifactsByRole: {},
      },
    );
    expect(materialized.covenantBound).toBe(false);
    expect(materialized.address).toBe('kaspa-role-recipient');
    expect(materialized.scriptShape).toBeUndefined();
  });

  it('throws loudly when a covenant-bound output has no registered artifact', () => {
    expect(() =>
      materializeCovenantOutput(
        {
          role: 'asset-minter',
          amountSompi: 0,
          owner: 'role-label-placeholder',
          covenantBound: true,
        },
        {
          controllerAddress: 'kaspa-role-controller',
          assetAddress: 'kaspa-role-asset',
        },
        {
          networkType: 'testnet-12',
          deriver: () => 'should-not-be-called',
          artifactsByRole: {}, // nothing registered for asset-minter
        },
      ),
    ).toThrow(/asset-minter.*no compiled artifact/);
  });
});
