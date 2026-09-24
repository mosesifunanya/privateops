// Wallet construction + sync-state restore.
//
// Mirrors network.ts in structure. The on-disk format and pure I/O live in
// wallet-state.ts; this file is the glue between that format and the wallet SDK.

import { Buffer } from 'buffer';

import * as ledger from '@midnight-ntwrk/midnight-js-protocol/ledger';

import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';

import {
  setNetworkId,
  getNetworkId,
} from '@midnight-ntwrk/midnight-js-network-id';

import {
  WalletFacade,
  DustWallet,
  HDWallet,
  Roles,
  ShieldedWallet,
  createKeystore,
  NoOpTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk';

import type {
  NetworkConfig,
  NetworkId,
} from './network';

import {
  CHILD_KINDS,
  loadWalletState,
  saveWalletState,
  clearWalletState,
  WALLET_STATE_DIR,
  WALLET_STATE_VERSION,
  type ChildKind,
  type PersistedWalletState,
} from './wallet-state';

export { unshieldedToken };

export type {
  PersistedWalletState,
};

export {
  loadWalletState,
  saveWalletState,
  clearWalletState,
  WALLET_STATE_DIR,
  WALLET_STATE_VERSION,
} from './wallet-state';

// ─── Key derivation ───────────────────────────────────────────────────────────

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(
    Buffer.from(seed, 'hex'),
  );

  if (hdWallet.type !== 'seedOk') {
    throw new Error('Invalid seed');
  }

  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([
      Roles.Zswap,
      Roles.NightExternal,
      Roles.Dust,
    ])
    .deriveKeysAt(0);

  if (result.type !== 'keysDerived') {
    throw new Error('Key derivation failed');
  }

  hdWallet.hdWallet.clear();

  return result.keys;
}

// ─── Wallet child types ───────────────────────────────────────────────────────

type WalletFacadeInstance =
  Awaited<
    ReturnType<typeof WalletFacade.init>
  >;

type ShieldedWalletInstance =
  Awaited<
    ReturnType<
      typeof ShieldedWallet
    >
  >;

type UnshieldedWalletInstance =
  Awaited<
    ReturnType<
      typeof UnshieldedWallet
    >
  >;

type DustWalletInstance =
  Awaited<
    ReturnType<
      typeof DustWallet
    >
  >;

// ─── Wallet context ───────────────────────────────────────────────────────────

export interface WalletContext {
  wallet: WalletFacadeInstance;

  shielded: ShieldedWalletInstance;

  unshielded: UnshieldedWalletInstance;

  dust: DustWalletInstance;

  shieldedSecretKeys: ReturnType<
    typeof ledger.ZswapSecretKeys.fromSeed
  >;

  dustSecretKey: ReturnType<
    typeof ledger.DustSecretKey.fromSeed
  >;

  unshieldedKeystore: ReturnType<
    typeof createKeystore
  >;

  restored: {
    shielded: boolean;
    unshielded: boolean;
    dust: boolean;
  };
}

export interface CreateWalletOptions {
  network: NetworkId;

  networkConfig: NetworkConfig;

  seed: string;

  /**
   * Whether to attempt to restore each child wallet from saved state.
   * Defaults to true.
   */
  restore?: boolean;

  cwd?: string;
}

// ─── Restore helpers ──────────────────────────────────────────────────────────

function warnRestoreFailure(
  kind: ChildKind,
  err: unknown,
): void {
  const msg =
    err instanceof Error
      ? err.message
      : String(err);

  process.stderr.write(
    `  ⚠ Could not restore ${kind} wallet state (${msg}); falling back to fresh sync.\n`,
  );
}

// ─── Wallet creation ──────────────────────────────────────────────────────────

export async function createWallet(
  opts: CreateWalletOptions,
): Promise<WalletContext> {
  setNetworkId(
    opts.networkConfig.networkId,
  );

  const keys = deriveKeys(
    opts.seed,
  );

  const networkId =
    getNetworkId();

  const shieldedSecretKeys =
    ledger.ZswapSecretKeys.fromSeed(
      keys[Roles.Zswap],
    );

  const dustSecretKey =
    ledger.DustSecretKey.fromSeed(
      keys[Roles.Dust],
    );

  const unshieldedKeystore =
    createKeystore(
      keys[Roles.NightExternal],
      networkId,
    );

  const saved: PersistedWalletState =
    opts.restore === false
      ? {}
      : loadWalletState(
          opts.network,
          {
            cwd: opts.cwd,
          },
        );

  const restored = {
    shielded: false,
    unshielded: false,
    dust: false,
  };

  const walletConfig = {
    networkId,

    indexerClientConnection: {
      indexerHttpUrl:
        opts.networkConfig.indexer,

      indexerWsUrl:
        opts.networkConfig.indexerWS,
    },

    provingServerUrl:
      new URL(
        opts.networkConfig.proofServer,
      ),

    relayURL:
      new URL(
        opts.networkConfig.node.replace(
          /^http/,
          'ws',
        ),
      ),

    txHistoryStorage:
      new NoOpTransactionHistoryStorage(),

    costParameters: {
      additionalFeeOverhead:
        300_000_000_000_000n,

      feeBlocksMargin: 5,
    },
  };

  const wallet =
    await WalletFacade.init({
      configuration: walletConfig,

      shielded: async (
        config,
      ) => {
        const cls =
          ShieldedWallet(config);

        if (
          saved.shielded !== undefined
        ) {
          try {
            const restoredWallet =
              await (
                cls as any
              ).restore(
                saved.shielded,
              );

            restored.shielded =
              true;

            restored.shielded =
              true;

            return restoredWallet;
          } catch (err) {
            warnRestoreFailure(
              'shielded',
              err,
            );
          }
        }

        return cls.startWithSecretKeys(
          shieldedSecretKeys,
        );
      },

      unshielded: async (
        config,
      ) => {
        const cls =
          UnshieldedWallet(config);

        if (
          saved.unshielded !== undefined
        ) {
          try {
            const restoredWallet =
              await (
                cls as any
              ).restore(
                saved.unshielded,
              );

            restoredWallet.unshielded =
              true;

            return restoredWallet;
          } catch (err) {
            warnRestoreFailure(
              'unshielded',
              err,
            );
          }
        }

        return cls.startWithPublicKey(
          PublicKey.fromKeyStore(
            unshieldedKeystore,
          ),
        );
      },

      dust: async (
        config,
      ) => {
        const cls =
          DustWallet(config);

        if (
          saved.dust !== undefined
        ) {
          try {
            const restoredWallet =
              await (
                cls as any
              ).restore(
                saved.dust,
              );

            restoredWallet.dust =
              true;

            return restoredWallet;
          } catch (err) {
            warnRestoreFailure(
              'dust',
              err,
            );
          }
        }

        return cls.startWithSecretKey(
          dustSecretKey,
          ledger.LedgerParameters
            .initialParameters()
            .dust,
        );
      },
    });

  await wallet.start(
    shieldedSecretKeys,
    dustSecretKey,
  );

  // The facade exposes the individual child wallets internally.
  // We expose them through WalletContext so deployment can use the
  // SDK-supported allowedGap synchronization methods directly.
  const childWallets =
    wallet as unknown as {
      shielded: ShieldedWalletInstance;
      unshielded: UnshieldedWalletInstance;
      dust: DustWalletInstance;
    };

  console.log(
    '\n─── Wallet sync diagnostics ─────────────────────────',
  );

  wallet.state().subscribe({
    next: (state) => {
      console.log(
        '\nWallet sync update:',
      );

      console.dir(
        {
          allSynced:
            state.isSynced,

          shielded: {
            progress:
              state.shielded.progress,
          },

          unshielded: {
            progress:
              state.unshielded.progress,
          },

          dust: {
            progress:
              state.dust.progress,
          },
        },
        {
          depth: 10,
          colors: false,
        },
      );
    },

    error: (error) => {
      console.error(
        'Wallet state stream error:',
        error,
      );
    },
  });

  console.log(
    '────────────────────────────────────────────────────\n',
  );

  return {
    wallet,

    shielded:
      childWallets.shielded,

    unshielded:
      childWallets.unshielded,

    dust:
      childWallets.dust,

    shieldedSecretKeys,

    dustSecretKey,

    unshieldedKeystore,

    restored,
  };
}

// ─── Wallet state persistence ─────────────────────────────────────────────────

export async function persistWalletState(
  network: NetworkId,
  ctx: WalletContext,
  cwd?: string,
): Promise<void> {
  const next: PersistedWalletState = {};

  for (
    const kind of CHILD_KINDS
  ) {
    try {
      const child =
        (
          ctx.wallet as unknown as Record<
            ChildKind,
            {
              serializeState: () =>
                Promise<unknown>;
            }
          >
        )[kind];

      const serialized =
        await child.serializeState();

      if (
        kind === 'dust'
      ) {
        next.dust =
          serialized as string;
      } else {
        next[kind] =
          serialized;
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : String(err);

      process.stderr.write(
        `  ⚠ Could not serialize ${kind} wallet state (${msg}); next run will re-sync.\n`,
      );
    }
  }

  saveWalletState(
    network,
    next,
    {
      cwd,
    },
  );
}