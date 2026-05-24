import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

export type PatternPhase = 'core' | 'krc20' | 'zk-aware';

export interface PatternManifestEntry {
  id: string;
  title: string;
  phase: PatternPhase;
  stateful: boolean;
  status: 'planned' | 'scaffolded' | 'implemented' | 'audited';
  summary: string;
  contractPath?: string;
  docPath?: string;
}

export const patternManifest: PatternManifestEntry[] = [
  {
    id: 'core.ownable',
    title: 'Ownable',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Single-owner covenant with explicit transfer semantics and KIP-20-safe state rotation.',
    contractPath: 'contracts/core/ownable.sil',
    docPath: 'docs/patterns/core/ownable.md',
  },
  {
    id: 'core.multisig',
    title: 'MultiSig',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Configurable threshold policy over three explicit signers with a stateful reconfiguration path.',
    contractPath: 'contracts/core/multisig.sil',
    docPath: 'docs/patterns/core/multisig.md',
  },
  {
    id: 'core.timelock',
    title: 'TimeLock',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Time-locked release scaffold with hard/soft cancel modes and a forward-only lock extension path.',
    contractPath: 'contracts/core/timelock.sil',
    docPath: 'docs/patterns/core/timelock.md',
  },
  {
    id: 'core.vault',
    title: 'Vault',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Enterprise-treasury scaffold combining owner rotation, signer quorum, and timelocked release.',
    contractPath: 'contracts/core/vault.sil',
    docPath: 'docs/patterns/core/vault.md',
  },
  {
    id: 'core.escrow-bilateral',
    title: 'Escrow (bilateral)',
    phase: 'core',
    stateful: false,
    status: 'scaffolded',
    summary: 'Three-party bilateral escrow scaffold with arbiter-approved release/refund and buyer timeout reclaim.',
    contractPath: 'contracts/core/escrow-bilateral.sil',
    docPath: 'docs/patterns/core/escrow-bilateral.md',
  },
  {
    id: 'core.escrow-milestone',
    title: 'Escrow (milestone)',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Stateful milestone escrow scaffold with monotonic progress, final release, dispute refund, and timeout reclaim.',
    contractPath: 'contracts/core/escrow-milestone.sil',
    docPath: 'docs/patterns/core/escrow-milestone.md',
  },
  {
    id: 'core.streaming-payment',
    title: 'Streaming Payment',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Recurring-payment scaffold with recipient withdrawals, remaining allowance tracking, and sender cancellation.',
    contractPath: 'contracts/core/streaming-payment.sil',
    docPath: 'docs/patterns/core/streaming-payment.md',
  },
  {
    id: 'core.vesting',
    title: 'Vesting',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Discrete-step vesting scaffold with cliff gating, claimed-amount tracking, and optional admin revocation.',
    contractPath: 'contracts/core/vesting.sil',
    docPath: 'docs/patterns/core/vesting.md',
  },
  {
    id: 'core.dead-mans-switch',
    title: "Dead Man's Switch",
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Inheritance/recovery scaffold with owner keepalive, fallback claim, and beneficiary rotation.',
    contractPath: 'contracts/core/dead-man-switch.sil',
    docPath: 'docs/patterns/core/dead-man-switch.md',
  },
  {
    id: 'core.social-recovery',
    title: 'Social Recovery',
    phase: 'core',
    stateful: true,
    status: 'scaffolded',
    summary: 'Guardian-quorum recovery scaffold with delayed activation and owner cancellation.',
    contractPath: 'contracts/core/social-recovery.sil',
    docPath: 'docs/patterns/core/social-recovery.md',
  },
  {
    id: 'core.atomic-swap-htlc',
    title: 'Atomic Swap (HTLC)',
    phase: 'core',
    stateful: false,
    status: 'scaffolded',
    summary: 'Hash time-locked contract scaffold with recipient claim and timeout refund paths.',
    contractPath: 'contracts/core/atomic-swap-htlc.sil',
    docPath: 'docs/patterns/core/atomic-swap-htlc.md',
  },
  {
    id: 'core.freelance-payroll',
    title: 'Freelance / Payroll',
    phase: 'core',
    stateful: false,
    status: 'scaffolded',
    summary: 'Client/worker/arbiter payment scaffold with mutual release, arbiter dispute paths, and timeout reclaim.',
    contractPath: 'contracts/core/freelance-payroll.sil',
    docPath: 'docs/patterns/core/freelance-payroll.md',
  },
  {
    id: 'krc20.kcc20-reference',
    title: 'KCC20 reference',
    phase: 'krc20',
    stateful: true,
    status: 'scaffolded',
    summary: 'Stable KCC20 asset contract with three ownership modes and non-minter supply-conservation invariants.',
    contractPath: 'contracts/tokens/kcc20.sil',
    docPath: 'docs/patterns/tokens/kcc20.md',
  },
  {
    id: 'krc20.kcc20-ownable',
    title: 'KCC20Ownable',
    phase: 'krc20',
    stateful: true,
    status: 'scaffolded',
    summary: 'Controller covenant that rotates KCC20 mint authority through an Ownable-style two-step admin handoff.',
    contractPath: 'contracts/tokens/kcc20-ownable.sil',
    docPath: 'docs/patterns/tokens/kcc20-ownable.md',
  },
  {
    id: 'krc20.kcc20-pausable',
    title: 'KCC20Pausable',
    phase: 'krc20',
    stateful: true,
    status: 'scaffolded',
    summary: 'Controller covenant that halts new KCC20 issuance while paused without freezing existing holder transfers.',
    contractPath: 'contracts/tokens/kcc20-pausable.sil',
    docPath: 'docs/patterns/tokens/kcc20-pausable.md',
  },
  {
    id: 'krc20.kcc20-capped',
    title: 'KCC20Capped',
    phase: 'krc20',
    stateful: true,
    status: 'scaffolded',
    summary: 'Controller covenant that caps KCC20 issuance through a decremented remaining-allowance state budget.',
    contractPath: 'contracts/tokens/kcc20-capped.sil',
    docPath: 'docs/patterns/tokens/kcc20-capped.md',
  },
  {
    id: 'krc20.kcc20-vesting',
    title: 'KCC20Vesting',
    phase: 'krc20',
    stateful: true,
    status: 'scaffolded',
    summary: 'Controller covenant that releases KCC20 issuance on a beneficiary-signed vesting schedule.',
    contractPath: 'contracts/tokens/kcc20-vesting.sil',
    docPath: 'docs/patterns/tokens/kcc20-vesting.md',
  },
  {
    id: 'zk-aware.verified-computation',
    title: 'Verified Computation',
    phase: 'zk-aware',
    stateful: false,
    status: 'planned',
    summary: 'Covenant releasing funds on a valid Groth16 proof. Phase 5 reference pattern; pins canonical OpZkPrecompile stack order.',
    docPath: 'docs/patterns/zk/verified-computation.md',
  },
  {
    id: 'zk-aware.private-asset-transfer',
    title: 'Private Asset Transfer',
    phase: 'zk-aware',
    stateful: true,
    status: 'planned',
    summary: 'Commitment + nullifier accumulator + Groth16 verification for confidential transfers; trust model is selective-disclosure.',
    docPath: 'docs/patterns/zk/private-asset-transfer.md',
  },
  {
    id: 'zk-aware.zk-verified-oracle',
    title: 'ZK-Verified Oracle',
    phase: 'zk-aware',
    stateful: true,
    status: 'planned',
    summary: 'M-of-N committee + Groth16 proof of correct computation over a committed data source.',
    docPath: 'docs/patterns/zk/zk-verified-oracle.md',
  },
  {
    id: 'zk-aware.proof-stitched-multi-pattern',
    title: 'Proof-Stitched Multi-Pattern',
    phase: 'zk-aware',
    stateful: true,
    status: 'planned',
    summary: 'One Groth16 verification shared across N covenant inputs via KIP-20 covenant context. vProgs forward-compat target.',
    docPath: 'docs/patterns/zk/proof-stitched-multi-pattern.md',
  },
];

export function listPatterns(): PatternManifestEntry[] {
  return [...patternManifest];
}

export function listPatternsByPhase(phase: PatternPhase): PatternManifestEntry[] {
  return patternManifest.filter((pattern) => pattern.phase === phase);
}

export function getPatternById(id: string): PatternManifestEntry | undefined {
  return patternManifest.find((pattern) => pattern.id === id);
}

export const KCC20_IDENTIFIER_TYPE = {
  pubkey: 0x00,
  scriptHash: 0x01,
  covenantId: 0x02,
} as const;

export type Kcc20IdentifierTypeName = keyof typeof KCC20_IDENTIFIER_TYPE;
export type Kcc20IdentifierTypeValue = (typeof KCC20_IDENTIFIER_TYPE)[Kcc20IdentifierTypeName];
export type Kcc20ControllerKind = 'ownable' | 'pausable' | 'capped' | 'vesting';

export interface Kcc20TemplateParts {
  prefixLength: number;
  suffixLength: number;
  expectedTemplateHash: string;
  templatePrefix: string;
  templateSuffix: string;
}

export interface Kcc20AssetConfig {
  ownerIdentifier: string;
  amount: number;
  identifierType: Kcc20IdentifierTypeValue;
  isMinter: boolean;
  maxCovenantInputs: number;
  maxCovenantOutputs: number;
}

export interface Kcc20AssetState extends Pick<Kcc20AssetConfig, 'ownerIdentifier' | 'amount' | 'identifierType' | 'isMinter'> {}

export interface Kcc20OwnableControllerConfig {
  kind: 'ownable';
  admin: string;
  hasPendingAdmin?: boolean;
  pendingAdmin?: string;
  initialized?: boolean;
}

export interface Kcc20PausableControllerConfig {
  kind: 'pausable';
  admin: string;
  paused?: boolean;
  initialized?: boolean;
}

export interface Kcc20CappedControllerConfig {
  kind: 'capped';
  admin: string;
  totalCap: number;
  remainingAllowance?: number;
  initialized?: boolean;
}

export interface Kcc20VestingControllerConfig {
  kind: 'vesting';
  admin: string;
  beneficiary: string;
  totalAllocation: number;
  mintedAmount?: number;
  cliffTime: number;
  period: number;
  releasePerPeriod: number;
  initialized?: boolean;
}

export type Kcc20ControllerConfig =
  | Kcc20OwnableControllerConfig
  | Kcc20PausableControllerConfig
  | Kcc20CappedControllerConfig
  | Kcc20VestingControllerConfig;

export interface Kcc20OwnableControllerState {
  admin: string;
  hasPendingAdmin: boolean;
  pendingAdmin: string;
  kcc20Covid: string;
  initialized: boolean;
}

export interface Kcc20PausableControllerState {
  paused: boolean;
  kcc20Covid: string;
  initialized: boolean;
}

export interface Kcc20CappedControllerState {
  totalCap: number;
  remainingAllowance: number;
  kcc20Covid: string;
  initialized: boolean;
}

export interface Kcc20VestingControllerState {
  totalAllocation: number;
  mintedAmount: number;
  cliffTime: number;
  period: number;
  releasePerPeriod: number;
  kcc20Covid: string;
  initialized: boolean;
}

export type Kcc20ControllerState =
  | Kcc20OwnableControllerState
  | Kcc20PausableControllerState
  | Kcc20CappedControllerState
  | Kcc20VestingControllerState;

export interface Kcc20ContractPaths {
  asset: string;
  controller: string;
  controllerDoc: string;
}

export interface Kcc20LifecycleStep {
  name: 'controller-genesis' | 'asset-genesis' | 'issuance';
  description: string;
  requires: string[];
}

export interface Kcc20LifecyclePlan {
  controllerKind: Kcc20ControllerKind;
  paths: Kcc20ContractPaths;
  controllerState: Kcc20ControllerState;
  assetState: Kcc20AssetState;
  steps: Kcc20LifecycleStep[];
}

export interface Kcc20TransactionInputPlan {
  role: 'funding' | 'controller' | 'asset';
  covenantBound: boolean;
  description: string;
}

export interface Kcc20TransactionOutputPlan {
  role: 'controller' | 'asset-minter' | 'asset-recipient';
  covenantBound: boolean;
  amountSource: 'fixed-zero' | 'caller-specified' | 'minted-amount';
  description: string;
}

export interface Kcc20TransactionPlan {
  kind: 'controller-genesis' | 'asset-genesis' | 'mint';
  contractPath: string;
  entrypoint?: string;
  inputs: Kcc20TransactionInputPlan[];
  outputs: Kcc20TransactionOutputPlan[];
  requiredSigners: string[];
  notes: string[];
}

export interface Kcc20LifecycleTransactionPlans {
  controllerGenesis: Kcc20TransactionPlan;
  assetGenesis: Kcc20TransactionPlan;
  mint: Kcc20TransactionPlan;
}

export interface SilvercCompileSpec {
  binary: string;
  contractPath: string;
  constructorArgs: Array<string | number | boolean>;
  mode: 'ast-only' | 'compile';
}

export interface SilvercCommandPlan {
  binary: string;
  args: string[];
  constructorArgsPath?: string;
  outputPath?: string;
}

export interface SilvercRunResult<TArtifact = unknown> {
  spec: SilvercCompileSpec;
  command: SilvercCommandPlan;
  artifact: TArtifact;
}

export interface Kcc20DeploymentBundle {
  controllerPreInit: SilvercCompileSpec;
  assetGenesis: SilvercCompileSpec;
  controllerInitialized: SilvercCompileSpec;
}

export interface Kcc20MintCompileBundle {
  continuedAsset: SilvercCompileSpec;
  recipientAsset: SilvercCompileSpec;
  nextController: SilvercCompileSpec;
}

export interface Kcc20CompiledStage<TArtifact = unknown> {
  transaction: Kcc20TransactionPlan;
  compileSpec: SilvercCompileSpec;
  compiled: SilvercRunResult<TArtifact>;
}

export interface Kcc20DeployFlow<TArtifact = unknown> {
  lifecycle: Kcc20LifecyclePlan;
  transactions: Kcc20LifecycleTransactionPlans;
  deploymentBundle: Kcc20DeploymentBundle;
  stages: {
    controllerGenesis: Kcc20CompiledStage<TArtifact>;
    assetGenesis: Kcc20CompiledStage<TArtifact>;
    controllerInitialized: Kcc20CompiledStage<TArtifact>;
  };
}

export interface Kcc20AssemblyInputRef {
  role: 'funding' | 'controller' | 'asset';
  source: string;
  amount?: number;
  covenantId?: string;
}

export interface Kcc20AssemblyOutputRef {
  role: 'controller' | 'asset-minter' | 'asset-recipient';
  amount: number | '<caller-specified>' | '<minted-amount>';
  owner: string;
  covenantBound: boolean;
}

export interface Kcc20TransactionAssembly<TArtifact = unknown> {
  stage: 'controllerGenesis' | 'assetGenesis' | 'controllerInitialized';
  entrypoint?: string;
  requiredSigners: string[];
  inputs: Kcc20AssemblyInputRef[];
  outputs: Kcc20AssemblyOutputRef[];
  compiled: SilvercRunResult<TArtifact>;
  notes: string[];
}

export interface Kcc20BroadcastReadyFlow<TArtifact = unknown> {
  controllerKind: Kcc20ControllerKind;
  assemblies: {
    controllerGenesis: Kcc20TransactionAssembly<TArtifact>;
    assetGenesis: Kcc20TransactionAssembly<TArtifact>;
    controllerInitialized: Kcc20TransactionAssembly<TArtifact>;
  };
}

const KCC20_ASSET_CONTRACT_PATH = 'contracts/tokens/kcc20.sil';
const KCC20_ASSET_DOC_PATH = 'docs/patterns/tokens/kcc20.md';
const DEFAULT_SILVERC_BINARY = 'upstream/silverscript/target/debug/silverc';

const KCC20_CONTROLLER_PATHS: Record<Kcc20ControllerKind, Kcc20ContractPaths> = {
  ownable: {
    asset: KCC20_ASSET_CONTRACT_PATH,
    controller: 'contracts/tokens/kcc20-ownable.sil',
    controllerDoc: 'docs/patterns/tokens/kcc20-ownable.md',
  },
  pausable: {
    asset: KCC20_ASSET_CONTRACT_PATH,
    controller: 'contracts/tokens/kcc20-pausable.sil',
    controllerDoc: 'docs/patterns/tokens/kcc20-pausable.md',
  },
  capped: {
    asset: KCC20_ASSET_CONTRACT_PATH,
    controller: 'contracts/tokens/kcc20-capped.sil',
    controllerDoc: 'docs/patterns/tokens/kcc20-capped.md',
  },
  vesting: {
    asset: KCC20_ASSET_CONTRACT_PATH,
    controller: 'contracts/tokens/kcc20-vesting.sil',
    controllerDoc: 'docs/patterns/tokens/kcc20-vesting.md',
  },
};

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function assertNonEmpty(value: string, label: string): void {
  if (!value) {
    throw new Error(`${label} is required`);
  }
}

export function getKcc20ControllerPaths(kind: Kcc20ControllerKind): Kcc20ContractPaths {
  return { ...KCC20_CONTROLLER_PATHS[kind] };
}

export function buildKcc20AssetConfig(config: Kcc20AssetConfig): Kcc20AssetConfig {
  assertNonEmpty(config.ownerIdentifier, 'ownerIdentifier');
  assertNonNegativeInteger(config.amount, 'amount');
  assertPositiveInteger(config.maxCovenantInputs, 'maxCovenantInputs');
  assertPositiveInteger(config.maxCovenantOutputs, 'maxCovenantOutputs');

  return { ...config };
}

export function buildKcc20AssetConstructorArgs(config: Kcc20AssetConfig): Array<string | number | boolean> {
  const validated = buildKcc20AssetConfig(config);
  return [
    validated.ownerIdentifier,
    validated.amount,
    validated.identifierType,
    validated.isMinter,
    validated.maxCovenantInputs,
    validated.maxCovenantOutputs,
  ];
}

export function buildKcc20ControllerState(config: Kcc20ControllerConfig, kcc20Covid: string): Kcc20ControllerState {
  assertNonEmpty(kcc20Covid, 'kcc20Covid');
  assertNonEmpty(config.admin, 'admin');

  switch (config.kind) {
    case 'ownable': {
      const hasPendingAdmin = config.hasPendingAdmin ?? false;
      const pendingAdmin = config.pendingAdmin ?? config.admin;
      assertNonEmpty(pendingAdmin, 'pendingAdmin');
      return {
        admin: config.admin,
        hasPendingAdmin,
        pendingAdmin,
        kcc20Covid,
        initialized: config.initialized ?? false,
      };
    }
    case 'pausable':
      return {
        paused: config.paused ?? false,
        kcc20Covid,
        initialized: config.initialized ?? false,
      };
    case 'capped': {
      assertNonNegativeInteger(config.totalCap, 'totalCap');
      const remainingAllowance = config.remainingAllowance ?? config.totalCap;
      assertNonNegativeInteger(remainingAllowance, 'remainingAllowance');
      if (remainingAllowance > config.totalCap) {
        throw new Error('remainingAllowance cannot exceed totalCap');
      }
      return {
        totalCap: config.totalCap,
        remainingAllowance,
        kcc20Covid,
        initialized: config.initialized ?? false,
      };
    }
    case 'vesting': {
      assertPositiveInteger(config.totalAllocation, 'totalAllocation');
      const mintedAmount = config.mintedAmount ?? 0;
      assertNonNegativeInteger(mintedAmount, 'mintedAmount');
      assertNonNegativeInteger(config.cliffTime, 'cliffTime');
      assertNonNegativeInteger(config.period, 'period');
      assertPositiveInteger(config.releasePerPeriod, 'releasePerPeriod');
      assertNonEmpty(config.beneficiary, 'beneficiary');
      if (mintedAmount > config.totalAllocation) {
        throw new Error('mintedAmount cannot exceed totalAllocation');
      }
      return {
        totalAllocation: config.totalAllocation,
        mintedAmount,
        cliffTime: config.cliffTime,
        period: config.period,
        releasePerPeriod: config.releasePerPeriod,
        kcc20Covid,
        initialized: config.initialized ?? false,
      };
    }
  }
}

export function buildKcc20ControllerConstructorArgs(
  config: Kcc20ControllerConfig,
  kcc20Covid: string,
  template: Kcc20TemplateParts,
): Array<string | number | boolean> {
  const templateArgs = [
    template.prefixLength,
    template.suffixLength,
    template.expectedTemplateHash,
    template.templatePrefix,
    template.templateSuffix,
  ] as const;

  switch (config.kind) {
    case 'ownable': {
      const state = buildKcc20ControllerState(config, kcc20Covid) as Kcc20OwnableControllerState;
      return [state.admin, state.hasPendingAdmin, state.pendingAdmin, state.kcc20Covid, state.initialized, ...templateArgs];
    }
    case 'pausable': {
      const state = buildKcc20ControllerState(config, kcc20Covid) as Kcc20PausableControllerState;
      return [config.admin, state.paused, state.kcc20Covid, state.initialized, ...templateArgs];
    }
    case 'capped': {
      const state = buildKcc20ControllerState(config, kcc20Covid) as Kcc20CappedControllerState;
      return [config.admin, state.totalCap, state.remainingAllowance, state.kcc20Covid, state.initialized, ...templateArgs];
    }
    case 'vesting': {
      const state = buildKcc20ControllerState(config, kcc20Covid) as Kcc20VestingControllerState;
      return [
        config.admin,
        config.beneficiary,
        state.totalAllocation,
        state.mintedAmount,
        state.cliffTime,
        state.period,
        state.releasePerPeriod,
        state.kcc20Covid,
        state.initialized,
        ...templateArgs,
      ];
    }
  }
}

export function buildKcc20LifecyclePlan(
  controller: Kcc20ControllerConfig,
  template: Kcc20TemplateParts,
  options: {
    placeholderKcc20Covid?: string;
    maxCovenantInputs?: number;
    maxCovenantOutputs?: number;
  } = {},
): Kcc20LifecyclePlan {
  const placeholderKcc20Covid = options.placeholderKcc20Covid ?? '00'.repeat(32);
  const maxCovenantInputs = options.maxCovenantInputs ?? 2;
  const maxCovenantOutputs = options.maxCovenantOutputs ?? 2;

  const controllerState = buildKcc20ControllerState(controller, placeholderKcc20Covid);
  const assetState = buildKcc20AssetConfig({
    ownerIdentifier: '<controller-covenant-id>',
    amount: 0,
    identifierType: KCC20_IDENTIFIER_TYPE.covenantId,
    isMinter: true,
    maxCovenantInputs,
    maxCovenantOutputs,
  });

  // Validate constructor args while we are here so callers fail fast.
  buildKcc20ControllerConstructorArgs(controller, placeholderKcc20Covid, template);
  buildKcc20AssetConstructorArgs(assetState);

  return {
    controllerKind: controller.kind,
    paths: getKcc20ControllerPaths(controller.kind),
    controllerState,
    assetState,
    steps: [
      {
        name: 'controller-genesis',
        description: 'Create the uninitialized controller UTXO so its covenant ID becomes stable and can own the KCC20 minter branch.',
        requires: ['controller funding UTXO', 'controller constructor args'],
      },
      {
        name: 'asset-genesis',
        description: 'Spend the controller genesis output through init and create both the zero-amount KCC20 minter branch and the initialized controller output bound to the asset covenant ID.',
        requires: ['controller covenant ID', 'asset constructor args', 'template parts for validateOutputStateWithTemplate'],
      },
      {
        name: 'issuance',
        description: 'Spend the KCC20 minter branch and controller together on each mint so the asset enforces supply rules while the controller enforces issuance policy.',
        requires: ['asset covenant ID', 'controller state transition', 'recipient state output'],
      },
    ],
  };
}

function getKcc20MintSignerRoles(config: Kcc20ControllerConfig): string[] {
  switch (config.kind) {
    case 'ownable':
    case 'pausable':
    case 'capped':
      return ['controller admin'];
    case 'vesting':
      return ['vesting beneficiary'];
  }
}

export function buildKcc20LifecycleTransactionPlans(
  controller: Kcc20ControllerConfig,
  template: Kcc20TemplateParts,
  options: {
    placeholderKcc20Covid?: string;
    maxCovenantInputs?: number;
    maxCovenantOutputs?: number;
  } = {},
): Kcc20LifecycleTransactionPlans {
  const lifecycle = buildKcc20LifecyclePlan(controller, template, options);

  return {
    controllerGenesis: {
      kind: 'controller-genesis',
      contractPath: lifecycle.paths.controller,
      inputs: [
        {
          role: 'funding',
          covenantBound: false,
          description: 'Plain funding UTXO used to create the uninitialized controller covenant output.',
        },
      ],
      outputs: [
        {
          role: 'controller',
          covenantBound: true,
          amountSource: 'caller-specified',
          description: 'Uninitialized controller output whose covenant ID becomes the stable controller identity.',
        },
      ],
      requiredSigners: [],
      notes: ['No covenant entrypoint runs yet; this step only establishes the controller covenant ID.'],
    },
    assetGenesis: {
      kind: 'asset-genesis',
      contractPath: lifecycle.paths.controller,
      entrypoint: 'init',
      inputs: [
        {
          role: 'controller',
          covenantBound: true,
          description: 'Spend the uninitialized controller genesis output.',
        },
      ],
      outputs: [
        {
          role: 'asset-minter',
          covenantBound: true,
          amountSource: 'fixed-zero',
          description: 'Zero-amount KCC20 minter branch owned by the controller covenant ID.',
        },
        {
          role: 'controller',
          covenantBound: true,
          amountSource: 'caller-specified',
          description: 'Initialized controller state rebound to the newly created asset covenant ID.',
        },
      ],
      requiredSigners: ['controller admin'],
      notes: [
        'Controller constructor args must include template parts for validateOutputStateWithTemplate.',
        'The first output covenant ID becomes kcc20Covid inside the controller state.',
      ],
    },
    mint: {
      kind: 'mint',
      contractPath: lifecycle.paths.controller,
      entrypoint: 'mint',
      inputs: [
        {
          role: 'asset',
          covenantBound: true,
          description: 'Current KCC20 minter branch input proving asset-side mint authorization.',
        },
        {
          role: 'controller',
          covenantBound: true,
          description: 'Controller input enforcing issuance policy for the selected variant.',
        },
      ],
      outputs: [
        {
          role: 'asset-minter',
          covenantBound: true,
          amountSource: 'caller-specified',
          description: 'Continued KCC20 minter branch preserving controller ownership.',
        },
        {
          role: 'asset-recipient',
          covenantBound: true,
          amountSource: 'minted-amount',
          description: 'Fresh recipient asset branch holding the newly minted tokens.',
        },
        {
          role: 'controller',
          covenantBound: true,
          amountSource: 'caller-specified',
          description: 'Next controller state after pause/cap/ownership/vesting policy checks.',
        },
      ],
      requiredSigners: getKcc20MintSignerRoles(controller),
      notes: [
        'The KCC20 asset validates supply rules and recipient/minter output templates.',
        'The controller validates the issuance policy and must stay bound to the same asset covenant ID.',
      ],
    },
  };
}

function normalizeCompileMode(mode: 'ast-only' | 'compile' | undefined): 'ast-only' | 'compile' {
  return mode ?? 'compile';
}

export function buildSilvercCompileSpec(
  contractPath: string,
  constructorArgs: Array<string | number | boolean>,
  options: { silvercBinary?: string; mode?: 'ast-only' | 'compile' } = {},
): SilvercCompileSpec {
  return {
    binary: options.silvercBinary ?? DEFAULT_SILVERC_BINARY,
    contractPath,
    constructorArgs,
    mode: normalizeCompileMode(options.mode),
  };
}

export function buildSilvercCommandPlan(
  spec: SilvercCompileSpec,
  options: {
    repoRoot?: string;
    constructorArgsPath?: string;
    outputPath?: string;
    stdout?: boolean;
  } = {},
): SilvercCommandPlan {
  const binary = options.repoRoot ? resolve(options.repoRoot, spec.binary) : spec.binary;
  const contractPath = options.repoRoot ? resolve(options.repoRoot, spec.contractPath) : spec.contractPath;
  const args: string[] = [];

  if (options.constructorArgsPath) {
    args.push('--constructor-args', options.constructorArgsPath);
  }

  if (spec.mode === 'ast-only') {
    args.push('--ast-only');
  }

  args.push(contractPath);

  if (options.stdout) {
    args.push('--stdout');
  } else if (options.outputPath) {
    args.push('--output', options.outputPath);
  }

  return {
    binary,
    args,
    ...(options.constructorArgsPath ? { constructorArgsPath: options.constructorArgsPath } : {}),
    ...(!options.stdout && options.outputPath ? { outputPath: options.outputPath } : {}),
  };
}

function formatSilvercInvocationError(err: unknown, binary: string): Error {
  const execErr = err as NodeJS.ErrnoException & { message?: string };
  if (execErr?.code === 'ENOENT') {
    return new Error(
      `silverc binary not found at ${binary}. Run \`npm run bootstrap:silverc\` from the repo root to fetch/build the pinned compiler first.`,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

export function runSilvercCompileSpec<TArtifact = unknown>(
  spec: SilvercCompileSpec,
  options: {
    repoRoot?: string;
    keepTempDir?: boolean;
  } = {},
): SilvercRunResult<TArtifact> {
  const tempDir = mkdtempSync(join(tmpdir(), 'opensilver-sdk-silverc-'));
  const outputPath = join(tempDir, spec.mode === 'ast-only' ? 'artifact-ast.json' : 'artifact.json');

  // silverc's --ast-only mode skips constructor-args entirely. The compile
  // mode reads them via the ExprKind serde-tagged JSON shape, so we encode
  // at the write boundary. The SDK lifecycle planners pass placeholder
  // strings like '<controller-covenant-id>' in constructor lists destined
  // for ast-only runs (they exist only for the manifest's notes/comments),
  // and those placeholders would fail hex validation if we encoded them
  // unconditionally — only encode when the run will actually pass them in.
  let constructorArgsPath: string | undefined;
  if (spec.mode === 'compile') {
    constructorArgsPath = join(tempDir, 'ctor-args.json');
    const encodedArgs = encodeConstructorArgsForSilverc(spec.constructorArgs);
    writeFileSync(constructorArgsPath, JSON.stringify(encodedArgs), 'utf8');
  }

  const command = buildSilvercCommandPlan(spec, {
    ...(options.repoRoot ? { repoRoot: options.repoRoot } : {}),
    ...(constructorArgsPath ? { constructorArgsPath } : {}),
    outputPath,
  });

  try {
    execFileSync(command.binary, command.args, { stdio: 'pipe' });
    const artifact = JSON.parse(readFileSync(outputPath, 'utf8')) as TArtifact;
    return { spec, command, artifact };
  } catch (err) {
    throw formatSilvercInvocationError(err, command.binary);
  } finally {
    if (!options.keepTempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

export function buildKcc20DeploymentBundle(
  controller: Kcc20ControllerConfig,
  template: Kcc20TemplateParts,
  options: {
    placeholderKcc20Covid?: string;
    maxCovenantInputs?: number;
    maxCovenantOutputs?: number;
    silvercBinary?: string;
    mode?: 'ast-only' | 'compile';
    controllerCovenantIdPlaceholder?: string;
    assetCovenantIdPlaceholder?: string;
  } = {},
): Kcc20DeploymentBundle {
  const placeholderKcc20Covid = options.placeholderKcc20Covid ?? '00'.repeat(32);
  const controllerCovenantIdPlaceholder = options.controllerCovenantIdPlaceholder ?? '<controller-covenant-id>';
  const assetCovenantIdPlaceholder = options.assetCovenantIdPlaceholder ?? '<asset-covenant-id>';
  const paths = getKcc20ControllerPaths(controller.kind);

  const controllerPreInitArgs = buildKcc20ControllerConstructorArgs(controller, placeholderKcc20Covid, template);
  const assetGenesisArgs = buildKcc20AssetConstructorArgs({
    ownerIdentifier: controllerCovenantIdPlaceholder,
    amount: 0,
    identifierType: KCC20_IDENTIFIER_TYPE.covenantId,
    isMinter: true,
    maxCovenantInputs: options.maxCovenantInputs ?? 2,
    maxCovenantOutputs: options.maxCovenantOutputs ?? 2,
  });
  const controllerInitializedArgs = buildKcc20ControllerConstructorArgs(
    { ...controller, initialized: true },
    assetCovenantIdPlaceholder,
    template,
  );

  return {
    controllerPreInit: buildSilvercCompileSpec(paths.controller, controllerPreInitArgs, options),
    assetGenesis: buildSilvercCompileSpec(paths.asset, assetGenesisArgs, options),
    controllerInitialized: buildSilvercCompileSpec(paths.controller, controllerInitializedArgs, options),
  };
}

export function buildKcc20MintCompileBundle(
  controller: Kcc20ControllerConfig,
  template: Kcc20TemplateParts,
  params: {
    assetCovenantId: string;
    controllerCovenantId: string;
    recipientIdentifier: string;
    recipientAmount: number;
    nextController: Kcc20ControllerConfig;
    continuedAssetAmount?: number;
    maxCovenantInputs?: number;
    maxCovenantOutputs?: number;
    silvercBinary?: string;
    mode?: 'ast-only' | 'compile';
  },
): Kcc20MintCompileBundle {
  assertNonEmpty(params.assetCovenantId, 'assetCovenantId');
  assertNonEmpty(params.controllerCovenantId, 'controllerCovenantId');
  assertNonEmpty(params.recipientIdentifier, 'recipientIdentifier');
  assertNonNegativeInteger(params.recipientAmount, 'recipientAmount');

  const paths = getKcc20ControllerPaths(controller.kind);
  const continuedAssetAmount = params.continuedAssetAmount ?? 0;
  const continuedAssetArgs = buildKcc20AssetConstructorArgs({
    ownerIdentifier: params.controllerCovenantId,
    amount: continuedAssetAmount,
    identifierType: KCC20_IDENTIFIER_TYPE.covenantId,
    isMinter: true,
    maxCovenantInputs: params.maxCovenantInputs ?? 2,
    maxCovenantOutputs: params.maxCovenantOutputs ?? 2,
  });
  const recipientAssetArgs = buildKcc20AssetConstructorArgs({
    ownerIdentifier: params.recipientIdentifier,
    amount: params.recipientAmount,
    identifierType: KCC20_IDENTIFIER_TYPE.pubkey,
    isMinter: false,
    maxCovenantInputs: params.maxCovenantInputs ?? 2,
    maxCovenantOutputs: params.maxCovenantOutputs ?? 2,
  });
  const nextControllerArgs = buildKcc20ControllerConstructorArgs(params.nextController, params.assetCovenantId, template);

  return {
    continuedAsset: buildSilvercCompileSpec(paths.asset, continuedAssetArgs, params),
    recipientAsset: buildSilvercCompileSpec(paths.asset, recipientAssetArgs, params),
    nextController: buildSilvercCompileSpec(paths.controller, nextControllerArgs, params),
  };
}

export function compileKcc20DeploymentBundle<TArtifact = unknown>(
  bundle: Kcc20DeploymentBundle,
  options: {
    repoRoot?: string;
    keepTempDir?: boolean;
  } = {},
): {
  controllerPreInit: SilvercRunResult<TArtifact>;
  assetGenesis: SilvercRunResult<TArtifact>;
  controllerInitialized: SilvercRunResult<TArtifact>;
} {
  return {
    controllerPreInit: runSilvercCompileSpec<TArtifact>(bundle.controllerPreInit, options),
    assetGenesis: runSilvercCompileSpec<TArtifact>(bundle.assetGenesis, options),
    controllerInitialized: runSilvercCompileSpec<TArtifact>(bundle.controllerInitialized, options),
  };
}

export function buildKcc20DeployFlow<TArtifact = unknown>(
  controller: Kcc20ControllerConfig,
  template: Kcc20TemplateParts,
  options: {
    repoRoot?: string;
    keepTempDir?: boolean;
    placeholderKcc20Covid?: string;
    maxCovenantInputs?: number;
    maxCovenantOutputs?: number;
    silvercBinary?: string;
    mode?: 'ast-only' | 'compile';
    controllerCovenantIdPlaceholder?: string;
    assetCovenantIdPlaceholder?: string;
  } = {},
): Kcc20DeployFlow<TArtifact> {
  const lifecycle = buildKcc20LifecyclePlan(controller, template, options);
  const transactions = buildKcc20LifecycleTransactionPlans(controller, template, options);
  const deploymentBundle = buildKcc20DeploymentBundle(controller, template, options);
  const compiled = compileKcc20DeploymentBundle<TArtifact>(deploymentBundle, options);

  return {
    lifecycle,
    transactions,
    deploymentBundle,
    stages: {
      controllerGenesis: {
        transaction: transactions.controllerGenesis,
        compileSpec: deploymentBundle.controllerPreInit,
        compiled: compiled.controllerPreInit,
      },
      assetGenesis: {
        transaction: transactions.assetGenesis,
        compileSpec: deploymentBundle.assetGenesis,
        compiled: compiled.assetGenesis,
      },
      controllerInitialized: {
        transaction: {
          ...transactions.assetGenesis,
          kind: 'asset-genesis',
          entrypoint: 'init',
          notes: [...transactions.assetGenesis.notes, 'Compiled initialized-controller artifact for the post-init output.'],
        },
        compileSpec: deploymentBundle.controllerInitialized,
        compiled: compiled.controllerInitialized,
      },
    },
  };
}

export function buildKcc20BroadcastReadyFlow<TArtifact = unknown>(
  flow: Kcc20DeployFlow<TArtifact>,
  options: {
    controllerFundingSource?: string;
    controllerFundingAmount?: number;
    controllerOutpointRef?: string;
    assetOutpointRef?: string;
    controllerCovenantId?: string;
    assetCovenantId?: string;
    recipientOwner?: string;
  } = {},
): Kcc20BroadcastReadyFlow<TArtifact> {
  const controllerFundingSource = options.controllerFundingSource ?? '<funding-utxo>';
  const controllerOutpointRef = options.controllerOutpointRef ?? '<controller-genesis-outpoint>';
  const assetOutpointRef = options.assetOutpointRef ?? '<asset-minter-outpoint>';
  const controllerCovenantId = options.controllerCovenantId ?? '<controller-covenant-id>';
  const assetCovenantId = options.assetCovenantId ?? '<asset-covenant-id>';
  const recipientOwner = options.recipientOwner ?? '<recipient-owner>';

  return {
    controllerKind: flow.lifecycle.controllerKind,
    assemblies: {
      controllerGenesis: {
        stage: 'controllerGenesis',
        requiredSigners: flow.stages.controllerGenesis.transaction.requiredSigners,
        inputs: [{ role: 'funding', source: controllerFundingSource, ...(options.controllerFundingAmount !== undefined ? { amount: options.controllerFundingAmount } : {}) }],
        outputs: [{ role: 'controller', amount: '<caller-specified>', owner: controllerCovenantId, covenantBound: true }],
        compiled: flow.stages.controllerGenesis.compiled,
        notes: flow.stages.controllerGenesis.transaction.notes,
      },
      assetGenesis: {
        stage: 'assetGenesis',
        ...(flow.stages.assetGenesis.transaction.entrypoint ? { entrypoint: flow.stages.assetGenesis.transaction.entrypoint } : {}),
        requiredSigners: flow.stages.assetGenesis.transaction.requiredSigners,
        inputs: [{ role: 'controller', source: controllerOutpointRef, covenantId: controllerCovenantId }],
        outputs: [
          { role: 'asset-minter', amount: 0, owner: controllerCovenantId, covenantBound: true },
          { role: 'controller', amount: '<caller-specified>', owner: assetCovenantId, covenantBound: true },
        ],
        compiled: flow.stages.assetGenesis.compiled,
        notes: flow.stages.assetGenesis.transaction.notes,
      },
      controllerInitialized: {
        stage: 'controllerInitialized',
        ...(flow.stages.controllerInitialized.transaction.entrypoint ? { entrypoint: flow.stages.controllerInitialized.transaction.entrypoint } : {}),
        requiredSigners: flow.stages.controllerInitialized.transaction.requiredSigners,
        inputs: [
          { role: 'asset', source: assetOutpointRef, covenantId: assetCovenantId },
          { role: 'controller', source: controllerOutpointRef, covenantId: controllerCovenantId },
        ],
        outputs: [
          { role: 'asset-minter', amount: '<caller-specified>', owner: controllerCovenantId, covenantBound: true },
          { role: 'asset-recipient', amount: '<minted-amount>', owner: recipientOwner, covenantBound: true },
          { role: 'controller', amount: '<caller-specified>', owner: assetCovenantId, covenantBound: true },
        ],
        compiled: flow.stages.controllerInitialized.compiled,
        notes: flow.transactions.mint.notes,
      },
    },
  };
}

export function getDefaultSilvercBinary(): string {
  return DEFAULT_SILVERC_BINARY;
}

export function getKcc20AssetDocPath(): string {
  return KCC20_ASSET_DOC_PATH;
}

// ─── silverc constructor-args bridge ─────────────────────────────────────────
//
// The SDK builds constructor args as raw scalar arrays
// (`Array<string | number | boolean>`) for ergonomic call sites. The silverc
// CLI deserialises ctor args via the `ExprKind` serde tag — every argument
// must be wrapped as `{"kind": "<snake_case>", "data": <payload>}`. We hide
// that translation behind `encodeConstructorArgsForSilverc()` so the rest of
// the SDK never sees the raw JSON shape.
//
// Schema (from `silverscript-lang::ast::ExprKind`):
//   - { kind: 'int',   data: number }          // i64
//   - { kind: 'bool',  data: boolean }
//   - { kind: 'byte',  data: number }          // 0..255
//   - { kind: 'array', data: ExprJson[] }      // arrays of any of the above
// A 32-byte pubkey or hash becomes `{ kind: 'array', data: [{kind:'byte', data:N}, ...] }`.

export type SilvercExprJson =
  | { kind: 'int'; data: number }
  | { kind: 'bool'; data: boolean }
  | { kind: 'byte'; data: number }
  | { kind: 'array'; data: SilvercExprJson[] };

const HEX_PATTERN = /^(0x)?[0-9a-fA-F]+$/;

function isHexString(value: string): boolean {
  if (!HEX_PATTERN.test(value)) return false;
  const body = value.startsWith('0x') ? value.slice(2) : value;
  return body.length % 2 === 0 && body.length > 0;
}

function decodeHexToBytes(value: string): number[] {
  const body = value.startsWith('0x') ? value.slice(2) : value;
  const bytes: number[] = [];
  for (let i = 0; i < body.length; i += 2) {
    bytes.push(parseInt(body.slice(i, i + 2), 16));
  }
  return bytes;
}

export function encodeConstructorArgForSilverc(value: string | number | boolean): SilvercExprJson {
  if (typeof value === 'boolean') {
    return { kind: 'bool', data: value };
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`silverc int args must be integers; got ${value}`);
    }
    return { kind: 'int', data: value };
  }
  if (typeof value === 'string') {
    if (!isHexString(value)) {
      throw new Error(`silverc string ctor args must be hex-encoded byte arrays; got ${JSON.stringify(value)}`);
    }
    const bytes = decodeHexToBytes(value);
    return {
      kind: 'array',
      data: bytes.map((byte) => ({ kind: 'byte', data: byte } as const)),
    };
  }
  throw new Error(`unsupported ctor arg type: ${typeof value}`);
}

export function encodeConstructorArgsForSilverc(args: Array<string | number | boolean>): SilvercExprJson[] {
  return args.map(encodeConstructorArgForSilverc);
}

// ─── Compiled-script extraction + P2SH derivation ───────────────────────────
//
// silverc's compile-mode output is JSON with a `script: number[]` field
// (byte array of the redeem script). For covenant-bound outputs in a
// transaction, the scriptPublicKey is the P2SH-of-this-script, which Kaspa
// derives as `OpBlake2bWithKey("TransactionSigningHash", script)`-prefixed
// blake2b-256 wrapped in the P2SH opcode envelope. The runtime tests
// already use `kaspa_txscript::pay_to_script_hash_script(&script)` for
// this exact derivation.
//
// The SDK side cannot import the Rust crate; instead it exposes the raw
// script bytes via `extractCompiledScript()` and a structured envelope
// description via `describeCovenantScriptPublicKey()`. The integrations
// layer combines `extractCompiledScript()` with `kaspa-wasm`'s ScriptBuilder
// to produce the actual scriptPublicKey + address.

export interface CompiledScriptArtifact {
  contract_name?: string;
  compiler_version?: string;
  script: number[];
}

export function extractCompiledScript(artifact: unknown): Uint8Array {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error('expected silverc compile artifact to be an object');
  }
  const maybe = artifact as { script?: unknown };
  if (!Array.isArray(maybe.script)) {
    throw new Error('silverc compile artifact missing required `script` byte array');
  }
  const bytes = new Uint8Array(maybe.script.length);
  for (let i = 0; i < maybe.script.length; i += 1) {
    const value = (maybe.script as unknown[])[i];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`silverc script byte at index ${i} is not a u8: ${String(value)}`);
    }
    bytes[i] = value;
  }
  return bytes;
}

export interface CovenantScriptPublicKeyShape {
  encoding: 'p2sh';
  redeemScript: Uint8Array;
  // The integrations layer fills these in once kaspa-wasm has materialised
  // the script-public-key + address; the SDK constructor leaves them null
  // so consumers must explicitly look them up.
  scriptPublicKey: Uint8Array | null;
  address: string | null;
}

export function describeCovenantScriptPublicKey(artifact: unknown): CovenantScriptPublicKeyShape {
  return {
    encoding: 'p2sh',
    redeemScript: extractCompiledScript(artifact),
    scriptPublicKey: null,
    address: null,
  };
}

// ─── Phase 5 ZK helper plans ────────────────────────────────────────────────

export const OP_ZK_PRECOMPILE_GROTH16_TAG = 0x20;

export interface ZkStackBytesSlot {
  kind: 'bytes';
  label: string;
  bytes: Uint8Array;
}

export interface ZkStackIntSlot {
  kind: 'int';
  label: string;
  value: number;
}

export type ZkStackSlot = ZkStackBytesSlot | ZkStackIntSlot;

export interface Groth16WitnessBuildOptions {
  verifyingKey: Uint8Array;
  proof: Uint8Array;
  publicInputs: Uint8Array[];
  expectedPublicInputs?: number;
}

export interface Groth16WitnessPlan {
  precompile: 'groth16';
  tag: number;
  // Push these slots in order, then push `tag`, then invoke OpZkPrecompile.
  pushOrder: ZkStackSlot[];
  // Resulting stack at invocation time, top -> bottom.
  stackTopToBottom: ZkStackSlot[];
}

function cloneBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function assertNonEmptyBytes(value: Uint8Array, label: string): void {
  if (!(value instanceof Uint8Array) || value.length === 0) {
    throw new Error(`${label} must be a non-empty Uint8Array`);
  }
}

export function buildGroth16WitnessPlan(opts: Groth16WitnessBuildOptions): Groth16WitnessPlan {
  assertNonEmptyBytes(opts.verifyingKey, 'verifyingKey');
  assertNonEmptyBytes(opts.proof, 'proof');
  assertNonNegativeInteger(opts.publicInputs.length, 'publicInputs.length');

  if (opts.expectedPublicInputs !== undefined) {
    assertNonNegativeInteger(opts.expectedPublicInputs, 'expectedPublicInputs');
    if (opts.publicInputs.length !== opts.expectedPublicInputs) {
      throw new Error(
        `publicInputs length mismatch: expected ${opts.expectedPublicInputs}, got ${opts.publicInputs.length}`,
      );
    }
  }

  const publicInputs = opts.publicInputs.map((input, index) => {
    assertNonEmptyBytes(input, `publicInputs[${index}]`);
    return cloneBytes(input);
  });

  const verifyingKey = cloneBytes(opts.verifyingKey);
  const proof = cloneBytes(opts.proof);
  const nPublicInputs = publicInputs.length;

  return {
    precompile: 'groth16',
    tag: OP_ZK_PRECOMPILE_GROTH16_TAG,
    pushOrder: [
      ...publicInputs
        .map((input, index) => ({ kind: 'bytes', label: `publicInput[${index}]`, bytes: input } as const))
        .reverse(),
      { kind: 'int', label: 'nPublicInputs', value: nPublicInputs },
      { kind: 'bytes', label: 'proof', bytes: proof },
      { kind: 'bytes', label: 'verifyingKey', bytes: verifyingKey },
    ],
    stackTopToBottom: [
      { kind: 'int', label: 'tag', value: OP_ZK_PRECOMPILE_GROTH16_TAG },
      { kind: 'bytes', label: 'verifyingKey', bytes: cloneBytes(verifyingKey) },
      { kind: 'bytes', label: 'proof', bytes: cloneBytes(proof) },
      { kind: 'int', label: 'nPublicInputs', value: nPublicInputs },
      ...publicInputs.map((input, index) => ({ kind: 'bytes', label: `publicInput[${index}]`, bytes: cloneBytes(input) } as const)),
    ],
  };
}
