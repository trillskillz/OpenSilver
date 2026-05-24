import { describe, expect, it, vi } from 'vitest';
import { buildKcc20BroadcastReadyFlow, buildKcc20DeployFlow } from '../sdk/src/index.js';
import {
  buildKaspaKcc20DeploymentRequests,
  buildKaspaKcc20TransactionPackage,
  buildKaspaWasmPaymentOutputs,
  buildKaspaWasmStageExecutionPlan,
  createKaspaWasmGeneratorFactory,
  createKaspaWasmSignerPayload,
  loadKaspaWasmModule,
  resolveKaspaKcc20TransactionPackage,
  type KaspaGeneratorLike,
  type KaspaGeneratorSettings,
  type KaspaWasmModule,
} from '../integrations/src/index.js';

const template = {
  prefixLength: 12,
  suffixLength: 8,
  expectedTemplateHash: 'ab'.repeat(32),
  templatePrefix: '01ff',
  templateSuffix: '02ee',
};

describe('kaspa-wasm integration binding', () => {
  it('loads kaspa-wasm and builds real signer/output objects', async () => {
    const kaspa = loadKaspaWasmModule();
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
          recipientOwner: 'kaspatest:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpqqenm',
        }),
      ),
      {
        client: {
          getUtxosByAddresses: async () => ({
            entries: [{ address: 'kaspatest:qfunding', outpoint: 'funding-utxo', amountSompi: 200_000 }],
          }),
        },
        addresses: {
          fundingAddress: 'kaspatest:qfunding',
          controllerAddress: 'kaspatest:qcontroller',
          assetAddress: 'kaspatest:qasset',
          recipientAddress: 'kaspatest:qrecipient',
        },
        subscribe: false,
      },
    );

    const deployment = buildKaspaKcc20DeploymentRequests(resolved);
    const controllerSigner = createKaspaWasmSignerPayload(kaspa, ['11'.repeat(32)]);
    expect(controllerSigner).toHaveLength(1);

    const controllerAddress = new kaspa.PrivateKey('22'.repeat(32)).toKeypair().toAddress('testnet').toString();
    const assetAddress = new kaspa.PrivateKey('33'.repeat(32)).toKeypair().toAddress('testnet').toString();
    const recipientAddress = new kaspa.PrivateKey('44'.repeat(32)).toKeypair().toAddress('testnet').toString();

    const outputs = buildKaspaWasmPaymentOutputs(kaspa, deployment.buildRequests.controllerInitialized, {
      amounts: { assetMinter: 0, assetRecipient: 25, controller: 80_000 },
      outputAddresses: {
        controllerAddress,
        assetAddress,
        recipientAddress,
      },
    });

    expect(outputs.map((output) => output.address)).toEqual([assetAddress, recipientAddress, controllerAddress]);
    expect(outputs.map((output) => output.amount)).toEqual([0n, 25n, 80_000n]);
    expect(outputs[0].paymentOutput.toJSON?.()).toMatchObject({ amount: 0n });

    const stagePlan = buildKaspaWasmStageExecutionPlan(kaspa, deployment.buildRequests.controllerInitialized, {
      changeAddress: controllerAddress,
      amounts: { assetMinter: 0, assetRecipient: 25, controller: 80_000 },
      signers: { 'controller admin': controllerSigner },
      outputAddresses: {
        controllerAddress,
        assetAddress,
        recipientAddress,
      },
    });

    expect(stagePlan.outputBindings).toHaveLength(3);
    expect(stagePlan.signerPayloads).toEqual([controllerSigner]);
    expect(stagePlan.generatorSettings.changeAddress).toBe(controllerAddress);
  });

  it('creates a concrete generator factory for kaspa-wasm-compatible modules', () => {
    const Generator = vi.fn(function Generator(this: Record<string, unknown>, settings: Record<string, unknown>) {
      this.settings = settings;
      return { next: vi.fn(async () => null) } as unknown as KaspaGeneratorLike;
    });
    const PaymentOutput = vi.fn(function PaymentOutput(this: Record<string, unknown>, address: unknown, amount: bigint) {
      this.address = address;
      this.amount = amount;
    });
    const PaymentOutputs = vi.fn(function PaymentOutputs(this: Record<string, unknown>, outputs: unknown[]) {
      this.outputs = outputs;
    });
    const Address = vi.fn(function Address(this: Record<string, unknown>, value: string) {
      this.value = value;
    });

    const module = {
      Address,
      PaymentOutput,
      PaymentOutputs,
      Generator,
      PrivateKey: vi.fn(),
      RpcClient: vi.fn(),
    } as unknown as KaspaWasmModule;

    const factory = createKaspaWasmGeneratorFactory(module);
    factory({
      utxoEntries: [{ outpoint: 'u1', amountSompi: 100 }],
      changeAddress: 'kaspatest:qchange',
      outputs: [{ address: 'kaspatest:qdest', amount: 50n }],
      priorityFee: 10n,
    } satisfies KaspaGeneratorSettings);

    expect(Address).toHaveBeenCalledWith('kaspatest:qdest');
    expect(PaymentOutput).toHaveBeenCalledTimes(1);
    expect(PaymentOutputs).toHaveBeenCalledTimes(1);
    expect(Generator).toHaveBeenCalledWith({
      utxoEntries: [{ outpoint: 'u1', amountSompi: 100 }],
      changeAddress: 'kaspatest:qchange',
      outputs: expect.any(PaymentOutputs),
      priorityFee: 10n,
    });
  });
});
