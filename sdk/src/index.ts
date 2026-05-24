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

const KCC20_ASSET_CONTRACT_PATH = 'contracts/tokens/kcc20.sil';
const KCC20_ASSET_DOC_PATH = 'docs/patterns/tokens/kcc20.md';

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

export function getKcc20AssetDocPath(): string {
  return KCC20_ASSET_DOC_PATH;
}
