import { describe, expect, it } from 'vitest';
import { OP_ZK_PRECOMPILE_GROTH16_TAG, buildGroth16WitnessPlan } from '../sdk/src/index.js';

describe('zk sdk helpers', () => {
  it('builds the canonical Groth16 OpZkPrecompile witness order', () => {
    const plan = buildGroth16WitnessPlan({
      verifyingKey: Uint8Array.from([0xaa, 0xbb]),
      proof: Uint8Array.from([0xcc, 0xdd]),
      publicInputs: [Uint8Array.from([0x01]), Uint8Array.from([0x02]), Uint8Array.from([0x03])],
      expectedPublicInputs: 3,
    });

    expect(plan.precompile).toBe('groth16');
    expect(plan.tag).toBe(OP_ZK_PRECOMPILE_GROTH16_TAG);
    expect(plan.pushOrder.map((slot) => slot.label)).toEqual([
      'publicInput[2]',
      'publicInput[1]',
      'publicInput[0]',
      'nPublicInputs',
      'proof',
      'verifyingKey',
    ]);
    expect(plan.stackTopToBottom.map((slot) => slot.label)).toEqual([
      'tag',
      'verifyingKey',
      'proof',
      'nPublicInputs',
      'publicInput[0]',
      'publicInput[1]',
      'publicInput[2]',
    ]);
    expect(plan.stackTopToBottom[0]).toMatchObject({ kind: 'int', value: 0x20 });
  });

  it('defensively clones the provided byte arrays', () => {
    const verifyingKey = Uint8Array.from([0xaa]);
    const proof = Uint8Array.from([0xbb]);
    const publicInput = Uint8Array.from([0xcc]);

    const plan = buildGroth16WitnessPlan({
      verifyingKey,
      proof,
      publicInputs: [publicInput],
    });

    verifyingKey[0] = 0x00;
    proof[0] = 0x00;
    publicInput[0] = 0x00;

    const vkSlot = plan.stackTopToBottom.find((slot) => slot.label === 'verifyingKey');
    const proofSlot = plan.stackTopToBottom.find((slot) => slot.label === 'proof');
    const inputSlot = plan.stackTopToBottom.find((slot) => slot.label === 'publicInput[0]');

    expect(vkSlot && vkSlot.kind === 'bytes' ? Array.from(vkSlot.bytes) : null).toEqual([0xaa]);
    expect(proofSlot && proofSlot.kind === 'bytes' ? Array.from(proofSlot.bytes) : null).toEqual([0xbb]);
    expect(inputSlot && inputSlot.kind === 'bytes' ? Array.from(inputSlot.bytes) : null).toEqual([0xcc]);
  });

  it('rejects invalid inputs early', () => {
    expect(() =>
      buildGroth16WitnessPlan({
        verifyingKey: new Uint8Array(),
        proof: Uint8Array.from([0x01]),
        publicInputs: [],
      }),
    ).toThrow(/verifyingKey/);

    expect(() =>
      buildGroth16WitnessPlan({
        verifyingKey: Uint8Array.from([0x01]),
        proof: Uint8Array.from([0x02]),
        publicInputs: [Uint8Array.from([0x03])],
        expectedPublicInputs: 2,
      }),
    ).toThrow(/publicInputs length mismatch/);
  });
});
