import { describe, expect, it } from 'vitest';
import { buildKcc20BroadcastReadyFlow, buildKcc20DeployFlow } from '../sdk/src/index.js';
import { buildKaspaKcc20TransactionPackage } from '../integrations/src/index.js';

const template = {
  prefixLength: 12,
  suffixLength: 8,
  expectedTemplateHash: 'ab'.repeat(32),
  templatePrefix: '01ff',
  templateSuffix: '02ee',
};

describe('kcc20 integrations', () => {
  it('maps a broadcast-ready flow into a Kaspa transaction package', () => {
    const repoRoot = process.cwd();
    const deployFlow = buildKcc20DeployFlow<Record<string, unknown>>(
      {
        kind: 'capped',
        admin: '11'.repeat(32),
        totalCap: 1_000,
      },
      template,
      { repoRoot, mode: 'ast-only' },
    );

    const broadcastReady = buildKcc20BroadcastReadyFlow(deployFlow, {
      controllerFundingSource: 'funding:0',
      controllerFundingAmount: 123_456,
      controllerOutpointRef: 'controller:0',
      assetOutpointRef: 'asset:0',
      controllerCovenantId: 'aa'.repeat(32),
      assetCovenantId: 'bb'.repeat(32),
      recipientOwner: 'cc'.repeat(32),
    });

    const pkg = buildKaspaKcc20TransactionPackage(broadcastReady);

    expect(pkg.controllerKind).toBe('capped');
    expect(pkg.stages.controllerGenesis.inputs).toEqual([
      { role: 'funding', ref: 'funding:0', amountSompi: 123_456 },
    ]);
    expect(pkg.stages.assetGenesis.entrypoint).toBe('init');
    expect(pkg.stages.assetGenesis.inputs).toEqual([
      { role: 'controller', ref: 'controller:0', covenantId: 'aa'.repeat(32) },
    ]);
    expect(pkg.stages.controllerInitialized.outputs[1]).toEqual({
      role: 'asset-recipient',
      amountSompi: '<minted-amount>',
      owner: 'cc'.repeat(32),
      covenantBound: true,
    });

    const printed = JSON.stringify(pkg.stages.controllerGenesis.compiledArtifact);
    expect(printed).toContain('remainingAllowance');
  });
});
