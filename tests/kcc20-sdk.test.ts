import { describe, expect, it } from 'vitest';
import {
  KCC20_IDENTIFIER_TYPE,
  buildKcc20AssetConstructorArgs,
  buildKcc20ControllerConstructorArgs,
  buildKcc20ControllerState,
  buildKcc20LifecyclePlan,
  getKcc20ControllerPaths,
  listPatternsByPhase,
} from '../sdk/src/index.js';

const template = {
  prefixLength: 12,
  suffixLength: 8,
  expectedTemplateHash: 'ab'.repeat(32),
  templatePrefix: '01ff',
  templateSuffix: '02ee',
};

describe('kcc20 sdk helpers', () => {
  it('lists KCC20 pattern entries by phase', () => {
    const patterns = listPatternsByPhase('krc20');
    expect(patterns.map((pattern) => pattern.id)).toEqual([
      'krc20.kcc20-reference',
      'krc20.kcc20-ownable',
      'krc20.kcc20-pausable',
      'krc20.kcc20-capped',
      'krc20.kcc20-vesting',
    ]);
  });

  it('builds ownable controller constructor args and lifecycle plan', () => {
    const plan = buildKcc20LifecyclePlan(
      {
        kind: 'ownable',
        admin: '11'.repeat(32),
        pendingAdmin: '22'.repeat(32),
      },
      template,
    );

    expect(plan.paths).toEqual(getKcc20ControllerPaths('ownable'));
    expect(plan.assetState).toMatchObject({
      ownerIdentifier: '<controller-covenant-id>',
      amount: 0,
      identifierType: KCC20_IDENTIFIER_TYPE.covenantId,
      isMinter: true,
    });
    expect(plan.controllerState).toEqual({
      admin: '11'.repeat(32),
      hasPendingAdmin: false,
      pendingAdmin: '22'.repeat(32),
      kcc20Covid: '00'.repeat(32),
      initialized: false,
    });
    expect(plan.steps.map((step) => step.name)).toEqual(['controller-genesis', 'asset-genesis', 'issuance']);

    const args = buildKcc20ControllerConstructorArgs(
      {
        kind: 'ownable',
        admin: '11'.repeat(32),
        hasPendingAdmin: true,
        pendingAdmin: '22'.repeat(32),
        initialized: true,
      },
      '33'.repeat(32),
      template,
    );

    expect(args).toEqual([
      '11'.repeat(32),
      true,
      '22'.repeat(32),
      '33'.repeat(32),
      true,
      12,
      8,
      'ab'.repeat(32),
      '01ff',
      '02ee',
    ]);
  });

  it('builds capped and vesting state with invariants', () => {
    expect(
      buildKcc20ControllerState(
        {
          kind: 'capped',
          admin: '11'.repeat(32),
          totalCap: 1_000,
          remainingAllowance: 250,
          initialized: true,
        },
        '44'.repeat(32),
      ),
    ).toEqual({
      totalCap: 1_000,
      remainingAllowance: 250,
      kcc20Covid: '44'.repeat(32),
      initialized: true,
    });

    expect(
      buildKcc20ControllerState(
        {
          kind: 'vesting',
          admin: '11'.repeat(32),
          beneficiary: '55'.repeat(32),
          totalAllocation: 500,
          cliffTime: 100,
          period: 10,
          releasePerPeriod: 75,
        },
        '66'.repeat(32),
      ),
    ).toEqual({
      totalAllocation: 500,
      mintedAmount: 0,
      cliffTime: 100,
      period: 10,
      releasePerPeriod: 75,
      kcc20Covid: '66'.repeat(32),
      initialized: false,
    });

    expect(() =>
      buildKcc20ControllerState(
        {
          kind: 'capped',
          admin: '11'.repeat(32),
          totalCap: 100,
          remainingAllowance: 101,
        },
        '44'.repeat(32),
      ),
    ).toThrow('remainingAllowance cannot exceed totalCap');
  });

  it('builds asset constructor args', () => {
    expect(
      buildKcc20AssetConstructorArgs({
        ownerIdentifier: '77'.repeat(32),
        amount: 0,
        identifierType: KCC20_IDENTIFIER_TYPE.covenantId,
        isMinter: true,
        maxCovenantInputs: 2,
        maxCovenantOutputs: 2,
      }),
    ).toEqual(['77'.repeat(32), 0, 0x02, true, 2, 2]);
  });
});
