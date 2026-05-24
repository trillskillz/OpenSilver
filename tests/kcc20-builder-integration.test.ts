import { describe, expect, it, vi } from 'vitest';
import { buildKcc20BroadcastReadyFlow, buildKcc20DeployFlow } from '../sdk/src/index.js';
import {
  buildKaspaKcc20DeploymentRequests,
  buildKaspaKcc20TransactionPackage,
  executeKaspaKcc20Deployment,
  executeKaspaStageBuild,
  resolveKaspaKcc20TransactionPackage,
  type KaspaGeneratorSettings,
  type KaspaPendingTransactionLike,
} from '../integrations/src/index.js';

const template = {
  prefixLength: 12,
  suffixLength: 8,
  expectedTemplateHash: 'ab'.repeat(32),
  templatePrefix: '01ff',
  templateSuffix: '02ee',
};

describe('kcc20 builder integration', () => {
  it('builds and signs a stage through the generator adapter', async () => {
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

    const txPackage = buildKaspaKcc20TransactionPackage(
      buildKcc20BroadcastReadyFlow(deployFlow, {
        controllerFundingSource: 'funding:0',
        controllerFundingAmount: 123_456,
        controllerOutpointRef: 'controller:0',
        assetOutpointRef: 'asset:0',
        controllerCovenantId: 'aa'.repeat(32),
        assetCovenantId: 'bb'.repeat(32),
        recipientOwner: 'kaspa:qrecipient',
      }),
    );

    const resolved = await resolveKaspaKcc20TransactionPackage(txPackage, {
      client: {
        getUtxosByAddresses: async () => ({
          entries: [
            { address: 'kaspa:qcontroller', outpoint: 'controller-utxo', amountSompi: 55_000 },
          ],
        }),
      },
      addresses: {
        fundingAddress: 'kaspa:qfunding',
        controllerAddress: 'kaspa:qcontroller',
        assetAddress: 'kaspa:qasset',
        recipientAddress: 'kaspa:qrecipient',
      },
      subscribe: false,
    });

    const deployment = buildKaspaKcc20DeploymentRequests(resolved);
    const sign = vi.fn(async () => undefined);
    const submit = vi.fn(async () => 'tx-123');
    const generatorFactory = vi.fn((_settings: KaspaGeneratorSettings) => ({
      next: vi
        .fn<() => Promise<KaspaPendingTransactionLike | null>>()
        .mockResolvedValueOnce({
          id: 'pending-1',
          sign,
          submit,
          serializeToSafeJSON: () => '{"id":"pending-1"}',
        })
        .mockResolvedValueOnce(null),
    }));

    const executed = await executeKaspaStageBuild(deployment.buildRequests.assetGenesis, {
      generatorFactory,
      changeAddress: 'kaspa:qchange',
      amounts: {
        assetMinter: 0,
        controller: 77_000,
      },
      signers: {
        'controller admin': ['privkey-admin'],
      },
      submit: true,
      rpc: { label: 'rpc-client' },
    });

    expect(generatorFactory).toHaveBeenCalledWith({
      utxoEntries: [{ address: 'kaspa:qcontroller', outpoint: 'controller-utxo', amountSompi: 55_000 }],
      changeAddress: 'kaspa:qchange',
      outputs: [
        { address: 'aa'.repeat(32), amount: 0n },
        { address: 'bb'.repeat(32), amount: 77_000n },
      ],
    });
    expect(sign).toHaveBeenCalledWith(['privkey-admin'], undefined);
    expect(submit).toHaveBeenCalledWith({ label: 'rpc-client' });
    expect(executed.submittedTxIds).toEqual(['tx-123']);
    expect(executed.pendingTransactions[0]).toEqual({
      id: 'pending-1',
      serialized: '{"id":"pending-1"}',
    });
  });

  it('executes the full three-stage deployment with stage-specific signing inputs', async () => {
    const repoRoot = process.cwd();
    const deployFlow = buildKcc20DeployFlow<Record<string, unknown>>(
      {
        kind: 'pausable',
        admin: '11'.repeat(32),
      },
      template,
      { repoRoot, mode: 'ast-only' },
    );

    const resolved = await resolveKaspaKcc20TransactionPackage(
      buildKaspaKcc20TransactionPackage(
        buildKcc20BroadcastReadyFlow(deployFlow, {
          controllerFundingSource: 'funding:0',
          controllerFundingAmount: 123_456,
          controllerOutpointRef: 'controller:0',
          assetOutpointRef: 'asset:0',
          controllerCovenantId: 'aa'.repeat(32),
          assetCovenantId: 'bb'.repeat(32),
          recipientOwner: 'kaspa:qrecipient',
        }),
      ),
      {
        client: {
          getUtxosByAddresses: async () => ({
            entries: [
              { address: 'kaspa:qfunding', outpoint: 'funding-utxo', amountSompi: 200_000 },
              { address: 'kaspa:qcontroller', outpoint: 'controller-utxo', amountSompi: 100_000 },
              { address: 'kaspa:qasset', outpoint: 'asset-utxo', amountSompi: 50_000 },
            ],
          }),
        },
        addresses: {
          fundingAddress: 'kaspa:qfunding',
          controllerAddress: 'kaspa:qcontroller',
          assetAddress: 'kaspa:qasset',
          recipientAddress: 'kaspa:qrecipient',
        },
        subscribe: false,
      },
    );

    const deployment = buildKaspaKcc20DeploymentRequests(resolved);
    const signedCalls: string[] = [];
    const generatorFactory = vi.fn((_settings: KaspaGeneratorSettings) => ({
      next: vi
        .fn<() => Promise<KaspaPendingTransactionLike | null>>()
        .mockResolvedValueOnce({
          id: `pending-${generatorFactory.mock.calls.length}`,
          sign: async (payload) => {
            signedCalls.push(JSON.stringify(payload));
          },
          serializeToSafeJSON: () => '{"ok":true}',
        })
        .mockResolvedValueOnce(null),
    }));

    const executed = await executeKaspaKcc20Deployment(deployment, {
      generatorFactory,
      stages: {
        controllerGenesis: {
          changeAddress: 'kaspa:qfunding',
          amounts: { controller: 80_000 },
        },
        assetGenesis: {
          changeAddress: 'kaspa:qcontroller',
          amounts: { assetMinter: 0, controller: 80_000 },
          signers: { 'controller admin': ['admin-key'] },
        },
        controllerInitialized: {
          changeAddress: 'kaspa:qasset',
          amounts: { assetMinter: 0, assetRecipient: 25, controller: 80_000 },
          signers: { 'controller admin': ['admin-key'] },
        },
      },
    });

    expect(generatorFactory).toHaveBeenCalledTimes(3);
    expect(signedCalls).toEqual(['["admin-key"]', '["admin-key"]']);
    expect(executed.controllerKind).toBe('pausable');
    expect(executed.stages.controllerGenesis.pendingTransactions).toHaveLength(1);
    expect(executed.stages.assetGenesis.entrypoint).toBe('init');
    expect(executed.stages.controllerInitialized.entrypoint).toBe('init');
    expect(executed.stages.controllerInitialized.generatorSettings.outputs).toEqual([
      { address: 'aa'.repeat(32), amount: 0n },
      { address: 'kaspa:qrecipient', amount: 25n },
      { address: 'bb'.repeat(32), amount: 80_000n },
    ]);
  });
});
