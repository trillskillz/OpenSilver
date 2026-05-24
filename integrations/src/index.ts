import { createRequire } from 'node:module';
import {
  type Kcc20BroadcastReadyFlow,
  type Kcc20ControllerKind,
  type PatternManifestEntry,
} from '@opensilver/sdk';

const require = createRequire(import.meta.url);

export interface IntegrationManifest {
  consumer: 'wallet' | 'ide' | 'mcp';
  patterns: PatternManifestEntry[];
}

export function buildIntegrationManifest(
  consumer: IntegrationManifest['consumer'],
  patterns: PatternManifestEntry[],
): IntegrationManifest {
  return { consumer, patterns };
}

export interface KaspaBuilderInput {
  role: 'funding' | 'controller' | 'asset';
  ref: string;
  amountSompi?: number;
  covenantId?: string;
}

export interface KaspaBuilderOutput {
  role: 'controller' | 'asset-minter' | 'asset-recipient';
  amountSompi: number | '<caller-specified>' | '<minted-amount>';
  owner: string;
  covenantBound: boolean;
}

export interface KaspaBuilderStage {
  stage: 'controllerGenesis' | 'assetGenesis' | 'controllerInitialized';
  entrypoint?: string;
  requiredSigners: string[];
  inputs: KaspaBuilderInput[];
  outputs: KaspaBuilderOutput[];
  notes: string[];
}

export interface KaspaKcc20TransactionPackage<TArtifact = unknown> {
  controllerKind: Kcc20ControllerKind;
  stages: {
    controllerGenesis: KaspaBuilderStage & { compiledArtifact: TArtifact };
    assetGenesis: KaspaBuilderStage & { compiledArtifact: TArtifact };
    controllerInitialized: KaspaBuilderStage & { compiledArtifact: TArtifact };
  };
}

function mapInputs(
  inputs: Kcc20BroadcastReadyFlow['assemblies']['controllerGenesis']['inputs'],
): KaspaBuilderInput[] {
  return inputs.map((input) => ({
    role: input.role,
    ref: input.source,
    ...(typeof input.amount === 'number' ? { amountSompi: input.amount } : {}),
    ...(input.covenantId ? { covenantId: input.covenantId } : {}),
  }));
}

function mapOutputs(
  outputs: Kcc20BroadcastReadyFlow['assemblies']['controllerGenesis']['outputs'],
): KaspaBuilderOutput[] {
  return outputs.map((output) => ({
    role: output.role,
    amountSompi: output.amount,
    owner: output.owner,
    covenantBound: output.covenantBound,
  }));
}

export function buildKaspaKcc20TransactionPackage<TArtifact = unknown>(
  flow: Kcc20BroadcastReadyFlow<TArtifact>,
): KaspaKcc20TransactionPackage<TArtifact> {
  return {
    controllerKind: flow.controllerKind,
    stages: {
      controllerGenesis: {
        stage: flow.assemblies.controllerGenesis.stage,
        requiredSigners: flow.assemblies.controllerGenesis.requiredSigners,
        inputs: mapInputs(flow.assemblies.controllerGenesis.inputs),
        outputs: mapOutputs(flow.assemblies.controllerGenesis.outputs),
        notes: flow.assemblies.controllerGenesis.notes,
        compiledArtifact: flow.assemblies.controllerGenesis.compiled.artifact,
      },
      assetGenesis: {
        stage: flow.assemblies.assetGenesis.stage,
        ...(flow.assemblies.assetGenesis.entrypoint ? { entrypoint: flow.assemblies.assetGenesis.entrypoint } : {}),
        requiredSigners: flow.assemblies.assetGenesis.requiredSigners,
        inputs: mapInputs(flow.assemblies.assetGenesis.inputs),
        outputs: mapOutputs(flow.assemblies.assetGenesis.outputs),
        notes: flow.assemblies.assetGenesis.notes,
        compiledArtifact: flow.assemblies.assetGenesis.compiled.artifact,
      },
      controllerInitialized: {
        stage: flow.assemblies.controllerInitialized.stage,
        ...(flow.assemblies.controllerInitialized.entrypoint ? { entrypoint: flow.assemblies.controllerInitialized.entrypoint } : {}),
        requiredSigners: flow.assemblies.controllerInitialized.requiredSigners,
        inputs: mapInputs(flow.assemblies.controllerInitialized.inputs),
        outputs: mapOutputs(flow.assemblies.controllerInitialized.outputs),
        notes: flow.assemblies.controllerInitialized.notes,
        compiledArtifact: flow.assemblies.controllerInitialized.compiled.artifact,
      },
    },
  };
}

export interface KaspaRpcUtxoEntry {
  address: string;
  outpoint: string;
  amountSompi: number;
  scriptPublicKey?: string;
  [key: string]: unknown;
}

export interface KaspaRpcUtxoLookupRequest {
  addresses: string[];
}

export interface KaspaRpcUtxoLookupResponse<TUtxo = KaspaRpcUtxoEntry> {
  entries?: TUtxo[];
  utxos?: TUtxo[];
}

export interface KaspaRpcClientLike<TUtxo = KaspaRpcUtxoEntry> {
  getUtxosByAddresses(
    request: KaspaRpcUtxoLookupRequest,
  ): Promise<KaspaRpcUtxoLookupResponse<TUtxo>> | KaspaRpcUtxoLookupResponse<TUtxo>;
  subscribeUtxosChanged?(addresses: string[]): Promise<unknown> | unknown;
  subscribeUtxosChanges?(addresses: string[]): Promise<unknown> | unknown;
}

export interface KaspaKcc20AddressBook {
  fundingAddress: string;
  controllerAddress: string;
  assetAddress: string;
  recipientAddress: string;
}

export interface KaspaResolvedInput<TUtxo = KaspaRpcUtxoEntry> {
  role: KaspaBuilderInput['role'];
  ref: string;
  address: string;
  covenantId?: string;
  requestedAmountSompi?: number;
  utxos: TUtxo[];
}

export interface KaspaResolvedStage<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry> {
  stage: KaspaBuilderStage['stage'];
  entrypoint?: string;
  requiredSigners: string[];
  inputs: KaspaResolvedInput<TUtxo>[];
  outputs: KaspaBuilderOutput[];
  notes: string[];
  compiledArtifact: TArtifact;
}

export interface KaspaResolvedKcc20TransactionPackage<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry> {
  controllerKind: Kcc20ControllerKind;
  addresses: KaspaKcc20AddressBook;
  subscriptionMethod: 'subscribeUtxosChanged' | 'subscribeUtxosChanges' | 'none';
  stages: {
    controllerGenesis: KaspaResolvedStage<TArtifact, TUtxo>;
    assetGenesis: KaspaResolvedStage<TArtifact, TUtxo>;
    controllerInitialized: KaspaResolvedStage<TArtifact, TUtxo>;
  };
}

export interface KaspaStageBuildRequest<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry> {
  stage: KaspaBuilderStage['stage'];
  entrypoint?: string;
  requiredSigners: string[];
  inputs: KaspaResolvedInput<TUtxo>[];
  outputs: KaspaBuilderOutput[];
  notes: string[];
  compiledArtifact: TArtifact;
}

export interface KaspaBuildableKcc20Deployment<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry> {
  controllerKind: Kcc20ControllerKind;
  subscriptionMethod: KaspaResolvedKcc20TransactionPackage<TArtifact, TUtxo>['subscriptionMethod'];
  addresses: KaspaKcc20AddressBook;
  buildRequests: {
    controllerGenesis: KaspaStageBuildRequest<TArtifact, TUtxo>;
    assetGenesis: KaspaStageBuildRequest<TArtifact, TUtxo>;
    controllerInitialized: KaspaStageBuildRequest<TArtifact, TUtxo>;
  };
}

function getAddressForInput(
  input: KaspaBuilderInput,
  addressBook: KaspaKcc20AddressBook,
): string {
  switch (input.role) {
    case 'funding':
      return addressBook.fundingAddress;
    case 'controller':
      return addressBook.controllerAddress;
    case 'asset':
      return addressBook.assetAddress;
  }
}

function toUtxoMap<TUtxo>(
  utxos: TUtxo[],
  selectAddress: (utxo: TUtxo) => string,
): Record<string, TUtxo[]> {
  return utxos.reduce<Record<string, TUtxo[]>>((acc, utxo) => {
    const address = selectAddress(utxo);
    if (!acc[address]) {
      acc[address] = [];
    }
    acc[address].push(utxo);
    return acc;
  }, {});
}

function normalizeLookupResponse<TUtxo>(response: KaspaRpcUtxoLookupResponse<TUtxo>): TUtxo[] {
  if (response.entries) {
    return response.entries;
  }
  if (response.utxos) {
    return response.utxos;
  }
  return [];
}

export async function subscribeKaspaAddresses<TUtxo = KaspaRpcUtxoEntry>(
  client: KaspaRpcClientLike<TUtxo>,
  addresses: string[],
): Promise<'subscribeUtxosChanged' | 'subscribeUtxosChanges' | 'none'> {
  if (client.subscribeUtxosChanged) {
    await client.subscribeUtxosChanged(addresses);
    return 'subscribeUtxosChanged';
  }
  if (client.subscribeUtxosChanges) {
    await client.subscribeUtxosChanges(addresses);
    return 'subscribeUtxosChanges';
  }
  return 'none';
}

export async function resolveKaspaKcc20TransactionPackage<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry>(
  txPackage: KaspaKcc20TransactionPackage<TArtifact>,
  options: {
    client: KaspaRpcClientLike<TUtxo>;
    addresses: KaspaKcc20AddressBook;
    selectAddress?: (utxo: TUtxo) => string;
    subscribe?: boolean;
  },
): Promise<KaspaResolvedKcc20TransactionPackage<TArtifact, TUtxo>> {
  const { client, addresses, subscribe = true } = options;
  const selectAddress = options.selectAddress ?? ((utxo: TUtxo) => (utxo as { address: string }).address);
  const uniqueAddresses = [
    addresses.fundingAddress,
    addresses.controllerAddress,
    addresses.assetAddress,
    addresses.recipientAddress,
  ].filter((address, index, values) => values.indexOf(address) === index);

  const subscriptionMethod = subscribe ? await subscribeKaspaAddresses(client, uniqueAddresses) : 'none';
  const lookup = await client.getUtxosByAddresses({ addresses: uniqueAddresses });
  const utxoMap = toUtxoMap(normalizeLookupResponse(lookup), selectAddress);

  const resolveStage = (
    stage: KaspaKcc20TransactionPackage<TArtifact>['stages']['controllerGenesis'],
  ): KaspaResolvedStage<TArtifact, TUtxo> => ({
    stage: stage.stage,
    ...(stage.entrypoint ? { entrypoint: stage.entrypoint } : {}),
    requiredSigners: stage.requiredSigners,
    inputs: stage.inputs.map((input) => {
      const address = getAddressForInput(input, addresses);
      return {
        role: input.role,
        ref: input.ref,
        address,
        ...(input.covenantId ? { covenantId: input.covenantId } : {}),
        ...(typeof input.amountSompi === 'number' ? { requestedAmountSompi: input.amountSompi } : {}),
        utxos: utxoMap[address] ?? [],
      };
    }),
    outputs: stage.outputs,
    notes: stage.notes,
    compiledArtifact: stage.compiledArtifact,
  });

  return {
    controllerKind: txPackage.controllerKind,
    addresses,
    subscriptionMethod,
    stages: {
      controllerGenesis: resolveStage(txPackage.stages.controllerGenesis),
      assetGenesis: resolveStage(txPackage.stages.assetGenesis),
      controllerInitialized: resolveStage(txPackage.stages.controllerInitialized),
    },
  };
}

export function buildKaspaKcc20DeploymentRequests<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry>(
  resolved: KaspaResolvedKcc20TransactionPackage<TArtifact, TUtxo>,
): KaspaBuildableKcc20Deployment<TArtifact, TUtxo> {
  return {
    controllerKind: resolved.controllerKind,
    subscriptionMethod: resolved.subscriptionMethod,
    addresses: resolved.addresses,
    buildRequests: {
      controllerGenesis: resolved.stages.controllerGenesis,
      assetGenesis: resolved.stages.assetGenesis,
      controllerInitialized: resolved.stages.controllerInitialized,
    },
  };
}

export interface KaspaGeneratorOutput {
  address: string;
  amount: bigint;
}

export interface KaspaGeneratorSettings<TUtxo = KaspaRpcUtxoEntry> {
  utxoEntries: TUtxo[];
  changeAddress: string;
  outputs: KaspaGeneratorOutput[];
  priorityFee?: bigint;
}

export interface KaspaPendingTransactionLike {
  id?: string;
  sign(signers: unknown[] | unknown, checkFullySigned?: boolean): Promise<void> | void;
  submit?(rpc: unknown): Promise<string> | string;
  serializeToSafeJSON?(): string;
  serializeToJSON?(): string;
  toJSON?(): unknown;
}

export interface KaspaGeneratorLike {
  next(): Promise<KaspaPendingTransactionLike | null | undefined>;
  estimate?(): Promise<unknown>;
  summary?(): unknown;
}

export type KaspaGeneratorFactory<TUtxo = KaspaRpcUtxoEntry> = (
  settings: KaspaGeneratorSettings<TUtxo>,
) => KaspaGeneratorLike;

export interface KaspaStageAmountOverrides {
  controller?: bigint | number;
  assetMinter?: bigint | number;
  assetRecipient?: bigint | number;
}

export interface KaspaStageExecutionOptions {
  changeAddress: string;
  priorityFee?: bigint | number;
  amounts?: KaspaStageAmountOverrides;
  signers?: Record<string, unknown[] | unknown>;
  submit?: boolean;
  rpc?: unknown;
  checkFullySigned?: boolean;
}

export interface KaspaStageExecutionPlan<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry> {
  request: KaspaStageBuildRequest<TArtifact, TUtxo>;
  generatorSettings: KaspaGeneratorSettings<TUtxo>;
  signerPayloads: Array<unknown[] | unknown>;
}

export interface KaspaExecutedPendingTransaction {
  id?: string;
  serialized?: string;
}

export interface KaspaExecutedStage<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry> {
  stage: KaspaStageBuildRequest<TArtifact, TUtxo>['stage'];
  entrypoint?: string;
  request: KaspaStageBuildRequest<TArtifact, TUtxo>;
  generatorSettings: KaspaGeneratorSettings<TUtxo>;
  pendingTransactions: KaspaExecutedPendingTransaction[];
  submittedTxIds: string[];
}

export interface KaspaExecutedDeployment<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry> {
  controllerKind: Kcc20ControllerKind;
  stages: {
    controllerGenesis: KaspaExecutedStage<TArtifact, TUtxo>;
    assetGenesis: KaspaExecutedStage<TArtifact, TUtxo>;
    controllerInitialized: KaspaExecutedStage<TArtifact, TUtxo>;
  };
}

function toBigIntAmount(value: bigint | number, label: string): bigint {
  const result = typeof value === 'bigint' ? value : BigInt(value);
  if (result < 0n) {
    throw new Error(`${label} cannot be negative`);
  }
  return result;
}

function resolveStageOutputAmount(
  output: KaspaBuilderOutput,
  amounts: KaspaStageAmountOverrides | undefined,
): bigint {
  if (typeof output.amountSompi === 'number') {
    return BigInt(output.amountSompi);
  }

  if (output.amountSompi === '<caller-specified>') {
    if (output.role === 'controller') {
      if (amounts?.controller === undefined) {
        throw new Error('controller output amount is required');
      }
      return toBigIntAmount(amounts.controller, 'controller output amount');
    }

    if (output.role === 'asset-minter') {
      if (amounts?.assetMinter === undefined) {
        throw new Error('asset minter output amount is required');
      }
      return toBigIntAmount(amounts.assetMinter, 'asset minter output amount');
    }
  }

  if (output.amountSompi === '<minted-amount>') {
    if (amounts?.assetRecipient === undefined) {
      throw new Error('asset recipient output amount is required');
    }
    return toBigIntAmount(amounts.assetRecipient, 'asset recipient output amount');
  }

  throw new Error(`unsupported output amount placeholder: ${String(output.amountSompi)}`);
}

function flattenStageUtxos<TUtxo>(inputs: KaspaResolvedInput<TUtxo>[]): TUtxo[] {
  return inputs.flatMap((input) => input.utxos);
}

function getStageSignerPayloads<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry>(
  request: KaspaStageBuildRequest<TArtifact, TUtxo>,
  signers: Record<string, unknown[] | unknown> | undefined,
): Array<unknown[] | unknown> {
  return request.requiredSigners.map((label) => {
    const payload = signers?.[label];
    if (payload === undefined) {
      throw new Error(`missing signer payload for required signer: ${label}`);
    }
    return payload;
  });
}

export function buildKaspaStageExecutionPlan<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry>(
  request: KaspaStageBuildRequest<TArtifact, TUtxo>,
  options: KaspaStageExecutionOptions,
): KaspaStageExecutionPlan<TArtifact, TUtxo> {
  const outputs = request.outputs.map((output) => ({
    address: output.owner,
    amount: resolveStageOutputAmount(output, options.amounts),
  }));

  const generatorSettings: KaspaGeneratorSettings<TUtxo> = {
    utxoEntries: flattenStageUtxos(request.inputs),
    changeAddress: options.changeAddress,
    outputs,
    ...(options.priorityFee !== undefined
      ? { priorityFee: toBigIntAmount(options.priorityFee, 'priorityFee') }
      : {}),
  };

  return {
    request,
    generatorSettings,
    signerPayloads: getStageSignerPayloads(request, options.signers),
  };
}

function serializePendingTransaction(pending: KaspaPendingTransactionLike): string | undefined {
  if (pending.serializeToSafeJSON) {
    return pending.serializeToSafeJSON();
  }
  if (pending.serializeToJSON) {
    return pending.serializeToJSON();
  }
  if (pending.toJSON) {
    return JSON.stringify(pending.toJSON());
  }
  return undefined;
}

export async function executeKaspaStageBuild<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry>(
  request: KaspaStageBuildRequest<TArtifact, TUtxo>,
  options: KaspaStageExecutionOptions & { generatorFactory: KaspaGeneratorFactory<TUtxo> },
): Promise<KaspaExecutedStage<TArtifact, TUtxo>> {
  const plan = buildKaspaStageExecutionPlan(request, options);
  const generator = options.generatorFactory(plan.generatorSettings);
  const pendingTransactions: KaspaExecutedPendingTransaction[] = [];
  const submittedTxIds: string[] = [];

  while (true) {
    const pending = await generator.next();
    if (!pending) {
      break;
    }

    for (const signerPayload of plan.signerPayloads) {
      await pending.sign(signerPayload, options.checkFullySigned);
    }

    const serialized = serializePendingTransaction(pending);
    pendingTransactions.push({
      ...(pending.id ? { id: pending.id } : {}),
      ...(serialized ? { serialized } : {}),
    });

    if (options.submit) {
      if (!pending.submit) {
        throw new Error(`stage ${request.stage} cannot submit because pending transaction has no submit() method`);
      }
      submittedTxIds.push(await pending.submit(options.rpc));
    }
  }

  return {
    stage: request.stage,
    ...(request.entrypoint ? { entrypoint: request.entrypoint } : {}),
    request,
    generatorSettings: plan.generatorSettings,
    pendingTransactions,
    submittedTxIds,
  };
}

export async function executeKaspaKcc20Deployment<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry>(
  deployment: KaspaBuildableKcc20Deployment<TArtifact, TUtxo>,
  options: {
    generatorFactory: KaspaGeneratorFactory<TUtxo>;
    stages: {
      controllerGenesis: KaspaStageExecutionOptions;
      assetGenesis: KaspaStageExecutionOptions;
      controllerInitialized: KaspaStageExecutionOptions;
    };
  },
): Promise<KaspaExecutedDeployment<TArtifact, TUtxo>> {
  const controllerGenesis = await executeKaspaStageBuild(
    deployment.buildRequests.controllerGenesis,
    {
      ...options.stages.controllerGenesis,
      generatorFactory: options.generatorFactory,
    },
  );

  const assetGenesis = await executeKaspaStageBuild(
    deployment.buildRequests.assetGenesis,
    {
      ...options.stages.assetGenesis,
      generatorFactory: options.generatorFactory,
    },
  );

  const controllerInitialized = await executeKaspaStageBuild(
    deployment.buildRequests.controllerInitialized,
    {
      ...options.stages.controllerInitialized,
      generatorFactory: options.generatorFactory,
    },
  );

  return {
    controllerKind: deployment.controllerKind,
    stages: {
      controllerGenesis,
      assetGenesis,
      controllerInitialized,
    },
  };
}

export interface KaspaWasmAddressLike {
  toString(): string;
  toJSON?(): unknown;
}

export interface KaspaWasmPaymentOutputLike {
  toJSON?(): unknown;
}

export interface KaspaWasmRpcClientLike {
  connect?(): Promise<void> | void;
  disconnect?(): Promise<void> | void;
}

export interface KaspaWasmModule {
  Address: new (value: string) => KaspaWasmAddressLike;
  PaymentOutput: new (address: KaspaWasmAddressLike, amount: bigint) => KaspaWasmPaymentOutputLike;
  PaymentOutputs?: new (outputs: KaspaWasmPaymentOutputLike[]) => unknown;
  Generator: new (settings: Record<string, unknown>) => KaspaGeneratorLike;
  PrivateKey: new (value: string | Uint8Array) => unknown;
  RpcClient: new (config: Record<string, unknown>) => KaspaWasmRpcClientLike;
  initConsolePanicHook?: () => void;
}

export interface KaspaWasmOutputAddresses {
  controllerAddress: string;
  assetAddress: string;
  recipientAddress?: string;
}

export interface KaspaWasmOutputBinding {
  role: KaspaBuilderOutput['role'];
  address: string;
  amount: bigint;
  paymentOutput: KaspaWasmPaymentOutputLike;
}

export interface KaspaWasmStageExecutionPlan<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry> {
  request: KaspaStageBuildRequest<TArtifact, TUtxo>;
  generatorSettings: Record<string, unknown>;
  signerPayloads: Array<unknown[] | unknown>;
  outputBindings: KaspaWasmOutputBinding[];
}

export function loadKaspaWasmModule(): KaspaWasmModule {
  return require('kaspa-wasm') as KaspaWasmModule;
}

export function installKaspaNodeWebSocketShim(webSocketImpl: unknown): void {
  globalThis.WebSocket = webSocketImpl as typeof globalThis.WebSocket;
}

export function createKaspaWasmRpcClient(
  module: KaspaWasmModule,
  config: Record<string, unknown>,
): KaspaWasmRpcClientLike {
  return new module.RpcClient(config);
}

export function createKaspaWasmSignerPayload(
  module: KaspaWasmModule,
  signerHexes: Array<string | Uint8Array>,
): unknown[] {
  return signerHexes.map((signer) => new module.PrivateKey(signer));
}

function resolveKaspaWasmOutputAddress(
  output: KaspaBuilderOutput,
  addresses: KaspaWasmOutputAddresses,
): string {
  switch (output.role) {
    case 'controller':
      return addresses.controllerAddress;
    case 'asset-minter':
      return addresses.assetAddress;
    case 'asset-recipient':
      return addresses.recipientAddress ?? output.owner;
  }
}

export function buildKaspaWasmPaymentOutputs<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry>(
  module: KaspaWasmModule,
  request: KaspaStageBuildRequest<TArtifact, TUtxo>,
  options: {
    amounts?: KaspaStageAmountOverrides;
    outputAddresses: KaspaWasmOutputAddresses;
  },
): KaspaWasmOutputBinding[] {
  return request.outputs.map((output) => {
    const address = resolveKaspaWasmOutputAddress(output, options.outputAddresses);
    const amount = resolveStageOutputAmount(output, options.amounts);
    const paymentOutput = new module.PaymentOutput(new module.Address(address), amount);
    return {
      role: output.role,
      address,
      amount,
      paymentOutput,
    };
  });
}

export function createKaspaWasmGeneratorFactory(
  module: KaspaWasmModule,
): KaspaGeneratorFactory {
  return (settings) => {
    const outputs = (settings.outputs as Array<KaspaGeneratorOutput>).map(
      (output) => new module.PaymentOutput(new module.Address(output.address), output.amount),
    );

    const generatorSettings: Record<string, unknown> = {
      utxoEntries: settings.utxoEntries,
      changeAddress: settings.changeAddress,
      outputs: module.PaymentOutputs ? new module.PaymentOutputs(outputs) : outputs,
    };

    if (settings.priorityFee !== undefined) {
      generatorSettings.priorityFee = settings.priorityFee;
    }

    return new module.Generator(generatorSettings);
  };
}

export function buildKaspaWasmStageExecutionPlan<TArtifact = unknown, TUtxo = KaspaRpcUtxoEntry>(
  module: KaspaWasmModule,
  request: KaspaStageBuildRequest<TArtifact, TUtxo>,
  options: KaspaStageExecutionOptions & { outputAddresses: KaspaWasmOutputAddresses },
): KaspaWasmStageExecutionPlan<TArtifact, TUtxo> {
  const outputBindings = buildKaspaWasmPaymentOutputs(module, request, {
    ...(options.amounts ? { amounts: options.amounts } : {}),
    outputAddresses: options.outputAddresses,
  });

  const generatorSettings: Record<string, unknown> = {
    utxoEntries: flattenStageUtxos(request.inputs),
    changeAddress: options.changeAddress,
    outputs: module.PaymentOutputs
      ? new module.PaymentOutputs(outputBindings.map((binding) => binding.paymentOutput))
      : outputBindings.map((binding) => binding.paymentOutput),
  };

  if (options.priorityFee !== undefined) {
    generatorSettings.priorityFee = toBigIntAmount(options.priorityFee, 'priorityFee');
  }

  return {
    request,
    generatorSettings,
    signerPayloads: getStageSignerPayloads(request, options.signers),
    outputBindings,
  };
}
