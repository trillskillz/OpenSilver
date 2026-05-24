import { describe, expect, it } from 'vitest';
import {
  KCC20_IDENTIFIER_TYPE,
  buildKcc20AssetConstructorArgs,
  buildKcc20BroadcastReadyFlow,
  buildKcc20ControllerConstructorArgs,
  buildKcc20ControllerState,
  buildKcc20DeployFlow,
  buildKcc20DeploymentBundle,
  buildKcc20LifecyclePlan,
  buildKcc20LifecycleTransactionPlans,
  buildKcc20MintCompileBundle,
  buildSilvercCommandPlan,
  buildSilvercCompileSpec,
  getDefaultSilvercBinary,
  getKcc20ControllerPaths,
  listPatternsByPhase,
  runSilvercCompileSpec,
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

  it('builds transaction-shape helpers for lifecycle flows', () => {
    const plans = buildKcc20LifecycleTransactionPlans(
      {
        kind: 'vesting',
        admin: '11'.repeat(32),
        beneficiary: '22'.repeat(32),
        totalAllocation: 500,
        cliffTime: 100,
        period: 10,
        releasePerPeriod: 50,
      },
      template,
    );

    expect(plans.controllerGenesis).toMatchObject({
      kind: 'controller-genesis',
      contractPath: 'contracts/tokens/kcc20-vesting.sil',
      inputs: [{ role: 'funding', covenantBound: false }],
      outputs: [{ role: 'controller', covenantBound: true, amountSource: 'caller-specified' }],
      requiredSigners: [],
    });

    expect(plans.assetGenesis).toMatchObject({
      kind: 'asset-genesis',
      entrypoint: 'init',
      requiredSigners: ['controller admin'],
    });
    expect(plans.assetGenesis.outputs.map((output) => output.role)).toEqual(['asset-minter', 'controller']);

    expect(plans.mint).toMatchObject({
      kind: 'mint',
      entrypoint: 'mint',
      requiredSigners: ['vesting beneficiary'],
    });
    expect(plans.mint.inputs.map((input) => input.role)).toEqual(['asset', 'controller']);
    expect(plans.mint.outputs.map((output) => output.role)).toEqual(['asset-minter', 'asset-recipient', 'controller']);
  });

  it('builds compile/deploy specs for controller deployment and mint continuations', () => {
    const deployment = buildKcc20DeploymentBundle(
      {
        kind: 'capped',
        admin: '11'.repeat(32),
        totalCap: 1_000,
      },
      template,
      { mode: 'ast-only' },
    );

    expect(deployment.controllerPreInit).toMatchObject({
      binary: getDefaultSilvercBinary(),
      contractPath: 'contracts/tokens/kcc20-capped.sil',
      mode: 'ast-only',
    });
    expect(deployment.assetGenesis).toMatchObject({
      contractPath: 'contracts/tokens/kcc20.sil',
      constructorArgs: ['<controller-covenant-id>', 0, 0x02, true, 2, 2],
    });
    expect(deployment.controllerInitialized.constructorArgs.slice(0, 5)).toEqual([
      '11'.repeat(32),
      1_000,
      1_000,
      '<asset-covenant-id>',
      true,
    ]);

    const mintBundle = buildKcc20MintCompileBundle(
      {
        kind: 'capped',
        admin: '11'.repeat(32),
        totalCap: 1_000,
      },
      template,
      {
        assetCovenantId: 'aa'.repeat(32),
        controllerCovenantId: 'bb'.repeat(32),
        recipientIdentifier: 'cc'.repeat(32),
        recipientAmount: 75,
        nextController: {
          kind: 'capped',
          admin: '11'.repeat(32),
          totalCap: 1_000,
          remainingAllowance: 925,
          initialized: true,
        },
      },
    );

    expect(mintBundle.continuedAsset.constructorArgs).toEqual(['bb'.repeat(32), 0, 0x02, true, 2, 2]);
    expect(mintBundle.recipientAsset.constructorArgs).toEqual(['cc'.repeat(32), 75, 0x00, false, 2, 2]);
    expect(mintBundle.nextController.contractPath).toBe('contracts/tokens/kcc20-capped.sil');
    expect(mintBundle.nextController.constructorArgs.slice(0, 5)).toEqual([
      '11'.repeat(32),
      1_000,
      925,
      'aa'.repeat(32),
      true,
    ]);
  });

  it('builds a silverc command plan and executes a real ast-only compile', () => {
    const repoRoot = process.cwd();
    const spec = buildSilvercCompileSpec(
      'contracts/tokens/kcc20.sil',
      ['00'.repeat(32), 0, 0x02, true, 2, 2],
      { mode: 'ast-only' },
    );

    const plan = buildSilvercCommandPlan(spec, {
      repoRoot,
      constructorArgsPath: '/tmp/ctor.json',
      outputPath: '/tmp/out.json',
    });

    expect(plan.binary).toContain('upstream/silverscript/target/debug/silverc');
    expect(plan.args).toEqual([
      '--constructor-args',
      '/tmp/ctor.json',
      '--ast-only',
      `${repoRoot}/contracts/tokens/kcc20.sil`,
      '--output',
      '/tmp/out.json',
    ]);

    const result = runSilvercCompileSpec<Record<string, unknown>>(spec, { repoRoot });
    const printed = JSON.stringify(result.artifact);
    expect(printed).toContain('IDENTIFIER_COVENANT_ID');
    expect(printed).toContain('checkAmounts');
  });

  it('assembles a deploy-ready flow with compiled stage artifacts', () => {
    const repoRoot = process.cwd();
    const flow = buildKcc20DeployFlow<Record<string, unknown>>(
      {
        kind: 'pausable',
        admin: '11'.repeat(32),
      },
      template,
      { repoRoot, mode: 'ast-only' },
    );

    expect(flow.lifecycle.controllerKind).toBe('pausable');
    expect(flow.transactions.controllerGenesis.kind).toBe('controller-genesis');
    expect(flow.stages.controllerGenesis.compileSpec.contractPath).toBe('contracts/tokens/kcc20-pausable.sil');
    expect(flow.stages.assetGenesis.compileSpec.contractPath).toBe('contracts/tokens/kcc20.sil');
    expect(flow.stages.controllerInitialized.transaction.entrypoint).toBe('init');

    const controllerPrinted = JSON.stringify(flow.stages.controllerGenesis.compiled.artifact);
    const assetPrinted = JSON.stringify(flow.stages.assetGenesis.compiled.artifact);
    expect(controllerPrinted).toContain('pause');
    expect(assetPrinted).toContain('IDENTIFIER_COVENANT_ID');

    const broadcastReady = buildKcc20BroadcastReadyFlow(flow, {
      controllerFundingSource: 'funding:0',
      controllerFundingAmount: 100000,
      controllerOutpointRef: 'controller:0',
      assetOutpointRef: 'asset:0',
      controllerCovenantId: 'aa'.repeat(32),
      assetCovenantId: 'bb'.repeat(32),
      recipientOwner: 'cc'.repeat(32),
    });

    expect(broadcastReady.controllerKind).toBe('pausable');
    expect(broadcastReady.assemblies.controllerGenesis.inputs).toEqual([{ role: 'funding', source: 'funding:0', amount: 100000 }]);
    expect(broadcastReady.assemblies.assetGenesis.inputs).toEqual([{ role: 'controller', source: 'controller:0', covenantId: 'aa'.repeat(32) }]);
    expect(broadcastReady.assemblies.controllerInitialized.outputs.map((output) => output.role)).toEqual([
      'asset-minter',
      'asset-recipient',
      'controller',
    ]);
    expect(broadcastReady.assemblies.controllerInitialized.outputs[1]).toMatchObject({
      owner: 'cc'.repeat(32),
      amount: '<minted-amount>',
    });
  });
});
