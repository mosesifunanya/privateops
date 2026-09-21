import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generateMnemonic,
  mnemonicToSeedSync,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

export type NetworkId =
  | 'undeployed'
  | 'preview'
  | 'preprod';

export const NETWORK_IDS: readonly NetworkId[] = [
  'undeployed',
  'preview',
  'preprod',
] as const;

export interface NetworkConfig {
  networkId: NetworkId;

  indexer: string;
  indexerWS: string;
  node: string;
  proofServer: string;

  faucet?: string;

  /**
   * Docker Compose services used by the local
   * undeployed network.
   *
   * Public networks do not need local network
   * services, so their arrays are empty.
   */
  composeServices: string[];
}

export interface NetworkState {
  activeNetwork: NetworkId;

  wallets?: Record<
    string,
    {
      seed: string;
      mnemonic?: string | null;
      createdAt?: string;
    }
  >;

  deployments?: Record<
    string,
    {
      address: string;
      deployer?: string;
      deployedAt?: string;
    }
  >;
}

export type ResolveSource =
  | 'flag'
  | 'state'
  | 'env'
  | 'default';

export interface ResolvedNetwork {
  network: NetworkId;
  config: NetworkConfig;
  source: ResolveSource;
}

export interface FsOptions {
  cwd?: string;
}

// ─── Network configuration ────────────────────────────────────────────────────

export const NETWORK_CONFIGS: Record<
  NetworkId,
  NetworkConfig
> = {
  undeployed: {
    networkId: 'undeployed',

    indexer:
      'http://127.0.0.1:8088/api/v3/graphql',

    indexerWS:
      'ws://127.0.0.1:8088/api/v3/graphql/ws',

    node:
      'http://127.0.0.1:9944',

    proofServer:
      'http://127.0.0.1:6300',

    composeServices: [
      'node',
      'indexer',
    ],
  },

  preview: {
    networkId: 'preview',

    indexer:
      'https://indexer.preview.midnight.network/api/v4/graphql',

    indexerWS:
      'wss://indexer.preview.midnight.network/api/v4/graphql/ws',

    node:
      'https://rpc.preview.midnight.network',

    proofServer:
      'http://127.0.0.1:6300',

    faucet:
      'https://midnight-tmnight-preview.nethermind.dev',

    composeServices: [],
  },

  preprod: {
    networkId: 'preprod',

    indexer:
      'https://indexer.preprod.midnight.network/api/v4/graphql',

    indexerWS:
      'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',

    node:
      'https://rpc.preprod.midnight.network',

    proofServer:
      'http://127.0.0.1:6300',

    faucet:
      'https://midnight-tmnight-preprod.nethermind.dev',

    composeServices: [],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNetworkId(
  value: string,
): value is NetworkId {
  return (
    NETWORK_IDS as readonly string[]
  ).includes(value);
}

function statePath(
  opts: FsOptions = {},
): string {
  const cwd =
    opts.cwd ?? process.cwd();

  return path.join(
    cwd,
    '.midnight-state.json',
  );
}

// ─── State ────────────────────────────────────────────────────────────────────

function loadState(
  opts: FsOptions = {},
): NetworkState | null {
  const p = statePath(opts);

  if (!fs.existsSync(p)) {
    return null;
  }

  try {
    const raw =
      fs.readFileSync(
        p,
        'utf8',
      );

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== 'object'
    ) {
      return null;
    }

    if (
      !isNetworkId(
        parsed.activeNetwork,
      )
    ) {
      return null;
    }

    return parsed as NetworkState;
  } catch {
    return null;
  }
}

export function saveState(
  state: NetworkState,
  opts: FsOptions = {},
): void {
  const p = statePath(opts);

  /*
   * Write to a temporary sibling file first,
   * then rename it into place.
   *
   * This avoids partially written state files.
   */
  const tmp =
    `${p}.tmp-${process.pid}-${Date.now()}`;

  fs.writeFileSync(
    tmp,
    `${JSON.stringify(
      state,
      null,
      2,
    )}\n`,
    {
      mode: 0o600,
    },
  );

  fs.renameSync(
    tmp,
    p,
  );
}

// ─── Network argument parsing ─────────────────────────────────────────────────

export function parseNetworkFlag(
  argv: string[],
): NetworkId | null {
  for (
    let i = 0;
    i < argv.length;
    i++
  ) {
    const arg =
      argv[i];

    /*
     * Supports:
     *
     * --network preview
     */
    if (
      arg === '--network'
    ) {
      const value =
        argv[i + 1];

      if (
        value === undefined
      ) {
        throw new Error(
          '--network requires a value',
        );
      }

      if (
        !isNetworkId(value)
      ) {
        throw new Error(
          `Unknown network: ${value}. Supported: ${NETWORK_IDS.join(', ')}.`,
        );
      }

      return value;
    }

    /*
     * Supports:
     *
     * --network=preview
     */
    if (
      arg.startsWith(
        '--network=',
      )
    ) {
      const value =
        arg.slice(
          '--network='.length,
        );

      if (
        !isNetworkId(value)
      ) {
        throw new Error(
          `Unknown network: ${value}. Supported: ${NETWORK_IDS.join(', ')}.`,
        );
      }

      return value;
    }
  }

  return null;
}

// ─── Environment overrides ────────────────────────────────────────────────────

function applyEnvOverrides(
  config: NetworkConfig,
  env: NodeJS.ProcessEnv,
): NetworkConfig {
  return {
    ...config,

    indexer:
      env.MIDNIGHT_INDEXER_URL?.trim() ||
      env.INDEXER_URL?.trim() ||
      config.indexer,

    indexerWS:
      env.MIDNIGHT_INDEXER_WS_URL?.trim() ||
      env.INDEXER_WS_URL?.trim() ||
      config.indexerWS,

    node:
      env.MIDNIGHT_NODE_URL?.trim() ||
      env.NODE_URL?.trim() ||
      config.node,

    proofServer:
      env.MIDNIGHT_PROOF_SERVER_URL?.trim() ||
      env.PROOF_SERVER_URL?.trim() ||
      config.proofServer,

    faucet:
      env.MIDNIGHT_FAUCET_URL?.trim() ||
      env.FAUCET_URL?.trim() ||
      config.faucet,

    composeServices:
      config.composeServices,
  };
}

// ─── Resolve active network ────────────────────────────────────────────────────

export interface ResolveOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

export function resolveNetwork(
  opts: ResolveOptions = {},
): ResolvedNetwork {
  const argv =
    opts.argv ?? process.argv;

  const env =
    opts.env ?? process.env;

  const cwd =
    opts.cwd ?? process.cwd();

  const flag =
    parseNetworkFlag(argv);

  let network: NetworkId;
  let source: ResolveSource;

  if (flag) {
    network = flag;
    source = 'flag';
  } else {
    const envNetwork =
      env.MIDNIGHT_NETWORK?.trim() ||
      env.NETWORK?.trim();

    if (
      envNetwork &&
      isNetworkId(envNetwork)
    ) {
      network =
        envNetwork;

      source = 'env';
    } else {
      const state =
        loadState({
          cwd,
        });

      if (state) {
        network =
          state.activeNetwork;

        source = 'state';
      } else {
        network =
          'undeployed';

        source = 'default';
      }
    }
  }

  const config =
    applyEnvOverrides(
      NETWORK_CONFIGS[network],
      env,
    );

  return {
    network,
    config,
    source,
  };
}

// ─── Wallet identity ──────────────────────────────────────────────────────────

export const GENESIS_SEED =
  '0000000000000000000000000000000000000000000000000000000000000001';

export function normalizeMnemonic(
  mnemonic: string,
): string {
  return mnemonic
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join(' ');
}

export interface SeedOptions {
  seed?: string;
  mnemonic?: string;
}

export interface WalletCredentials {
  seed: string;
  mnemonic: string | null;
  created: boolean;
}

/**
 * Creates the message displayed when a new public-network
 * wallet has been generated.
 */
export function formatWalletBackupNotice(
  wallet: WalletCredentials,
  network: NetworkId,
): string {
  if (
    network === 'undeployed' ||
    !wallet.created ||
    !wallet.mnemonic
  ) {
    return '';
  }

  return [
    '',
    '  ╔══════════════════════════════════════════════════════════════╗',
    '  ║                 NEW WALLET CREATED                         ║',
    '  ╚══════════════════════════════════════════════════════════════╝',
    '',
    `  Network: ${network}`,
    '',
    '  Your recovery phrase is:',
    '',
    `  ${wallet.mnemonic}`,
    '',
    '  IMPORTANT: Save this recovery phrase securely.',
    '  Anyone with this phrase can control this wallet.',
    '',
  ].join('\n');
}

export function getOrCreateWallet(
  network: NetworkId,
  opts: SeedOptions = {},
): WalletCredentials {
  /*
   * Explicit seed supplied.
   */
  if (
    opts.seed?.trim()
  ) {
    return {
      seed:
        opts.seed.trim(),

      mnemonic:
        opts.mnemonic
          ? normalizeMnemonic(
              opts.mnemonic,
            )
          : null,

      created: false,
    };
  }

  /*
   * Explicit mnemonic supplied.
   */
  if (
    opts.mnemonic?.trim()
  ) {
    const mnemonic =
      normalizeMnemonic(
        opts.mnemonic,
      );

    const seedBytes =
      mnemonicToSeedSync(
        mnemonic,
      );

    const seed =
      Buffer.from(
        seedBytes,
      ).subarray(
        0,
        32,
      );

    return {
      seed:
        seed.toString('hex'),

      mnemonic,

      created:
        false,
    };
  }

  /*
   * Local undeployed network uses the deterministic
   * development genesis seed.
   */
  if (
    network ===
    'undeployed'
  ) {
    return {
      seed:
        GENESIS_SEED,

      mnemonic:
        null,

      created:
        false,
    };
  }

  /*
   * Look for a previously persisted public-network wallet.
   */
  const existing =
    loadState();

  const persisted =
    existing?.wallets?.[
      network
    ];

  if (
    persisted?.seed
  ) {
    return {
      seed:
        persisted.seed,

      mnemonic:
        persisted.mnemonic
          ? normalizeMnemonic(
              persisted.mnemonic,
            )
          : null,

      created:
        false,
    };
  }

  /*
   * No public-network wallet exists yet.
   *
   * Generate a new 24-word BIP39 recovery phrase.
   */
  const mnemonic =
    generateMnemonic(
      wordlist,
      256,
    );

  /*
   * Convert the mnemonic into a BIP39 seed.
   *
   * wallet.ts expects a hexadecimal seed, so use the
   * first 32 bytes as the wallet seed.
   */
  const seedBytes =
    mnemonicToSeedSync(
      mnemonic,
    );

  const seed =
    Buffer.from(
      seedBytes,
    ).subarray(
      0,
      32,
    );

  const seedHex =
    seed.toString('hex');

  /*
   * Persist the new wallet so subsequent runs reuse
   * the same wallet instead of generating another one.
   */
  const next: NetworkState =
    existing ?? {
      activeNetwork:
        network,

      wallets: {},

      deployments: {},
    };

  next.activeNetwork =
    network;

  next.wallets ??= {};

  next.wallets[network] = {
    seed:
      seedHex,

    mnemonic:
      mnemonic,

    createdAt:
      new Date().toISOString(),
  };

  saveState(
    next,
  );

  return {
    seed:
      seedHex,

    mnemonic:
      mnemonic,

    created:
      true,
  };
}

export function getOrCreateSeed(
  network: NetworkId,
  opts: SeedOptions = {},
): string {
  return getOrCreateWallet(
    network,
    opts,
  ).seed;
}

export function printWalletCreated(
  network: NetworkId,
  mnemonic: string,
): void {
  console.log(
    `\n  New ${network} wallet generated. Its 24-word recovery phrase:\n`,
  );

  console.log(
    `  ${mnemonic}\n`,
  );

  console.log(
    '  IMPORTANT: Save this recovery phrase somewhere secure.\n',
  );
}

// ─── Deployment state ─────────────────────────────────────────────────────────

export function getDeployment(
  network: NetworkId,
  opts: FsOptions = {},
): NonNullable<
  NetworkState['deployments']
>[string] | null {
  const state =
    loadState(opts);

  return (
    state?.deployments?.[
      network
    ] ?? null
  );
}

export function recordDeployment(
  network: NetworkId,
  address: string,
  deployer: string,
  opts: FsOptions = {},
): void {
  const existing =
    loadState(opts);

  const next: NetworkState =
    existing ?? {
      activeNetwork:
        network,

      wallets: {},

      deployments: {},
    };

  next.activeNetwork =
    network;

  next.deployments ??= {};

  next.deployments[
    network
  ] = {
    address,

    deployer,

    deployedAt:
      new Date().toISOString(),
  };

  saveState(
    next,
    opts,
  );
}

export function setActiveNetwork(
  network: NetworkId,
  opts: FsOptions = {},
): void {
  if (
    !isNetworkId(network)
  ) {
    throw new Error(
      `Unknown network: ${network}. Supported: ${NETWORK_IDS.join(', ')}.`,
    );
  }

  const existing =
    loadState(opts);

  if (
    existing &&
    existing.activeNetwork ===
      network
  ) {
    return;
  }

  const next: NetworkState =
    existing ?? {
      activeNetwork:
        network,

      wallets: {},

      deployments: {},
    };

  next.activeNetwork =
    network;

  saveState(
    next,
    opts,
  );
}

// ─── Command-line entry point ─────────────────────────────────────────────────

if (
  path.resolve(
    process.argv[1] ?? '',
  ) ===
  path.resolve(
    fileURLToPath(
      import.meta.url,
    ),
  )
) {
  try {
    const argv =
      process.argv;

    const flag =
      parseNetworkFlag(
        argv,
      );

    if (flag) {
      setActiveNetwork(
        flag,
      );

      process.stdout.write(
        `Active network is now: ${flag}\n`,
      );

      if (
        flag !==
        'undeployed'
      ) {
        process.stdout.write(
          `Indexer: ${NETWORK_CONFIGS[flag].indexer}\n`,
        );

        process.stdout.write(
          `Node: ${NETWORK_CONFIGS[flag].node}\n`,
        );

        process.stdout.write(
          `Proof server: ${NETWORK_CONFIGS[flag].proofServer}\n`,
        );

        if (
          NETWORK_CONFIGS[
            flag
          ].faucet
        ) {
          process.stdout.write(
            `Faucet: ${NETWORK_CONFIGS[flag].faucet}\n`,
          );
        }
      }

      process.exit(0);
    }

    const resolved =
      resolveNetwork();

    process.stdout.write(
      `Active network: ${resolved.network}${
        resolved.source ===
        'default'
          ? ' (default)'
          : ''
      }\n`,
    );
  } catch (err) {
    process.stderr.write(
      `${
        err instanceof Error
          ? err.message
          : String(err)
      }\n`,
    );

    process.exit(1);
  }
}