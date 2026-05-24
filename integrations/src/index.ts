import {
  type Kcc20BroadcastReadyFlow,
  type Kcc20ControllerKind,
  type PatternManifestEntry,
} from '@opensilver/sdk';

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
