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
