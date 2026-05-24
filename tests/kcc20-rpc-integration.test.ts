import { describe, expect, it, vi } from 'vitest';
import { buildKcc20BroadcastReadyFlow, buildKcc20DeployFlow } from '../sdk/src/index.js';
import {
  buildKaspaKcc20DeploymentRequests,
  buildKaspaKcc20TransactionPackage,
  resolveKaspaKcc20TransactionPackage,
} from '../integrations/src/index.js';

const template = {
  prefixLength: 12,
  suffixLength: 8,
  expectedTemplateHash: 'ab'.repeat(32),
  templatePrefix: '01ff',
  templateSuffix: '02ee',
};

describe('kcc20 rpc integration', () => {
  it('resolves package inputs through the documented Kaspa RPC utxo surface', async () => {
    const repoRoot = process.cwd();
    const deployFlow = buildKcc20DeployFlow<Record<string, unknown>>(
      {
        kind: 'pausable',
        admin: '11'.repeat(32),
      },
      template,
      { repoRoot, mode: 'ast-only' },
    );

    const txPackage = buildKaspaKcc20TransactionPackage(
      buildKcc20BroadcastReadyFlow(deployFlow, {
        controllerFundingSource: 'funding:0',
        controllerFundingAmount: 123_456,
        controllerOutpointRef: 'controller:0',
        assetOutpointRef: 'asset:0',
        controllerCovenantId: 'aa'.repeat(32),
        assetCovenantId: 'bb'.repeat(32),
        recipientOwner: 'cc'.repeat(32),
      }),
    );

    const subscribeUtxosChanged = vi.fn(async (_addresses: string[]) => undefined);
    const getUtxosByAddresses = vi.fn(async ({ addresses }: { addresses: string[] }) => ({
      entries: [
        { address: addresses[0], outpoint: 'funding-utxo', amountSompi: 200_000 },
        { address: addresses[1], outpoint: 'controller-utxo', amountSompi: 50_000 },
        { address: addresses[2], outpoint: 'asset-utxo', amountSompi: 10_000 },
      ],
    }));

    const resolved = await resolveKaspaKcc20TransactionPackage(txPackage, {
      client: {
        subscribeUtxosChanged,
        getUtxosByAddresses,
      },
      addresses: {
        fundingAddress: 'kaspa:qfunding',
        controllerAddress: 'kaspa:qcontroller',
        assetAddress: 'kaspa:qasset',
        recipientAddress: 'kaspa:qrecipient',
      },
    });

    expect(subscribeUtxosChanged).toHaveBeenCalledWith([
      'kaspa:qfunding',
      'kaspa:qcontroller',
      'kaspa:qasset',
      'kaspa:qrecipient',
    ]);
    expect(getUtxosByAddresses).toHaveBeenCalledWith({
      addresses: ['kaspa:qfunding', 'kaspa:qcontroller', 'kaspa:qasset', 'kaspa:qrecipient'],
    });
    expect(resolved.subscriptionMethod).toBe('subscribeUtxosChanged');
    expect(resolved.stages.controllerGenesis.inputs[0]).toMatchObject({
      role: 'funding',
      address: 'kaspa:qfunding',
      requestedAmountSompi: 123_456,
    });
    expect(resolved.stages.assetGenesis.inputs[0].utxos).toEqual([
      { address: 'kaspa:qcontroller', outpoint: 'controller-utxo', amountSompi: 50_000 },
    ]);
    expect(resolved.stages.controllerInitialized.inputs[0].utxos).toEqual([
      { address: 'kaspa:qasset', outpoint: 'asset-utxo', amountSompi: 10_000 },
    ]);

    const deployment = buildKaspaKcc20DeploymentRequests(resolved);
    expect(deployment.buildRequests.assetGenesis.entrypoint).toBe('init');
    expect(deployment.buildRequests.controllerInitialized.entrypoint).toBe('init');
    expect(deployment.buildRequests.controllerInitialized.requiredSigners).toEqual(['controller admin']);
  });
});
