/**
 * Deploy PrivateOps contract to a Midnight network.
 *
 * PrivateOps proves whether an action is authorized by a private policy
 * without storing the private policy limit on the public ledger.
 *
 * Non-interactive deployment.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveNetwork,
  getOrCreateWallet,
  formatWalletBackupNotice,
  recordDeployment,
} from './network';

import {
  createWallet,
  persistWalletState,
  unshieldedToken,
  type WalletContext,
} from './wallet';

import {
  createPrivateOpsPrivateState,
  witnesses,
} from './witnesses.js';

import { WebSocket } from 'ws';
import * as Rx from 'rxjs';

// Midnight SDK imports
import { deployContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

// Generated PrivateOps contract
import * as PrivateOps from '../contracts/managed/privateops/contract/index.js';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

// Identifier under which PrivateOps private state is stored.
const PRIVATE_STATE_ID = 'privateOpsPrivateState';

// Upper bound on the DUST wait.
const DUST_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

// Preprod synchronization window.
//
// The Preprod network can report a very large synchronization target.
// We use the wallet state's own progress predicate rather than calling
// waitForSyncedState() on the individual child wallet classes.
const PREPROD_ALLOWED_SYNC_GAP = 1_600_000n;

// ─── Network configuration ────────────────────────────────────────────────────

const { network, config: networkConfig } = resolveNetwork();

const WALLET = getOrCreateWallet(network);

const SEED = WALLET.seed;

{
  const notice = formatWalletBackupNotice(
    WALLET,
    network,
  );

  if (notice) {
    console.log(notice);
  }
}

// ─── Preprod wallet synchronization ──────────────────────────────────────────

async function waitForPreprodWalletState(
  walletCtx: WalletContext,
) {
  return Rx.firstValueFrom(
    walletCtx.wallet
      .state()
      .pipe(
        Rx.filter((state) => {
          const shieldedReady =
            state.shielded.progress.isCompleteWithin(
              PREPROD_ALLOWED_SYNC_GAP,
            );

          const unshieldedReady =
            state.unshielded.progress.isCompleteWithin(
              PREPROD_ALLOWED_SYNC_GAP,
            );

          const dustReady =
            state.dust.progress.isCompleteWithin(
              PREPROD_ALLOWED_SYNC_GAP,
            );

          return (
            shieldedReady &&
            unshieldedReady &&
            dustReady
          );
        }),
      ),
  );
}

// ─── Proof server readiness ───────────────────────────────────────────────────

async function waitForProofServer(
  maxAttempts = 60,
  delayMs = 2000,
): Promise<boolean> {
  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      await fetch(
        networkConfig.proofServer,
        {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        },
      );

      return true;
    } catch (err: any) {
      const code =
        err?.cause?.code ||
        err?.code ||
        '';

      if (
        code !== 'ECONNREFUSED' &&
        code !== 'UND_ERR_CONNECT_TIMEOUT' &&
        code !== 'UND_ERR_SOCKET'
      ) {
        return true;
      }
    }

    if (attempt < maxAttempts) {
      process.stdout.write(
        `\r  Waiting for proof server... (${attempt}/${maxAttempts})   `,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, delayMs),
      );
    }
  }

  return false;
}

// ─── Compiled contract loading ────────────────────────────────────────────────

const __dirname = path.dirname(
  fileURLToPath(import.meta.url),
);

const zkConfigPath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'managed',
  'privateops',
);

const contractPath = path.join(
  zkConfigPath,
  'contract',
  'index.js',
);

if (!fs.existsSync(contractPath)) {
  console.error(
    '\n❌ PrivateOps contract not compiled! Run: npm run compile\n',
  );

  process.exit(1);
}

const compiledContract =
  CompiledContract.make(
    'privateops',
    PrivateOps.Contract,
  ).pipe(
    CompiledContract.withWitnesses(
      witnesses,
    ),
    CompiledContract.withCompiledFileAssets(
      zkConfigPath,
    ),
  );

// ─── Providers ────────────────────────────────────────────────────────────────

async function createProviders(
  walletCtx: WalletContext,
) {
  const privateStatePassword =
    process.env.PRIVATE_STATE_PASSWORD?.trim() ||
    'Local-Devnet-Development-Placeholder-1';

  const walletProvider = {
    getCoinPublicKey: () =>
      walletCtx.shieldedSecretKeys.coinPublicKey,

    getEncryptionPublicKey: () =>
      walletCtx.shieldedSecretKeys
        .encryptionPublicKey,

    async balanceTx(
      tx: any,
      ttl?: Date,
    ) {
      const recipe =
        await walletCtx.wallet.balanceUnboundTransaction(
          tx,
          {
            shieldedSecretKeys:
              walletCtx.shieldedSecretKeys,

            dustSecretKey:
              walletCtx.dustSecretKey,
          },
          {
            ttl:
              ttl ??
              new Date(
                Date.now() +
                  30 * 60 * 1000,
              ),
          },
        );

      return walletCtx.wallet.finalizeRecipe(
        recipe,
      );
    },

    submitTx: (tx: any) =>
      walletCtx.wallet.submitTransaction(
        tx,
      ) as any,
  };

  const zkConfigProvider =
    new NodeZkConfigProvider(
      zkConfigPath,
    );

  const accountId =
    walletCtx.unshieldedKeystore
      .getBech32Address()
      .toString();

  return {
    privateStateProvider:
      levelPrivateStateProvider({
        privateStateStoreName:
          'privateops-state',

        accountId,

        privateStoragePasswordProvider:
          () => privateStatePassword,
      }),

    publicDataProvider:
      indexerPublicDataProvider(
        networkConfig.indexer,
        networkConfig.indexerWS,
      ),

    zkConfigProvider,

    proofProvider:
      httpClientProofProvider(
        networkConfig.proofServer,
        zkConfigProvider,
      ),

    walletProvider,

    midnightProvider:
      walletProvider,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    '\n╔══════════════════════════════════════════════════════════════╗',
  );

  console.log(
    `║  Deploy PrivateOps to ${network}`,
  );

  console.log(
    '╚══════════════════════════════════════════════════════════════╝\n',
  );

  const seed = SEED;

  // ─── Wallet setup ───────────────────────────────────────────────────────────

  console.log(
    '─── Wallet setup ───────────────────────────────────────────────\n',
  );

  console.log(
    '  Creating wallet...',
  );

  const walletCtx =
    await createWallet({
      network,
      networkConfig,
      seed,
    });

  const restoredCount =
    Object.values(
      walletCtx.restored,
    ).filter(Boolean).length;

  if (restoredCount > 0) {
    console.log(
      `  Restored ${restoredCount}/3 child wallets from .midnight-wallet-state — sync will resume from saved point.`,
    );
  }

  console.log(
    '  Syncing with network...',
  );

  console.log(
    '  ℹ  This may take several minutes depending on network size.',
  );

  console.log(
    '     RPC disconnection messages during sync are normal and can be safely ignored.\n',
  );

  const syncStart = Date.now();

  const syncInterval =
    setInterval(() => {
      const elapsed =
        Math.round(
          (Date.now() -
            syncStart) /
            1000,
        );

      process.stdout.write(
        `\r  ⏳ Still syncing... (${elapsed}s elapsed)   `,
      );
    }, 5000);

  // ─── Wallet synchronization ────────────────────────────────────────────────

  let state;

  if (network === 'preprod') {
    console.log(
      '\n  ℹ  Waiting for Preprod wallet state...',
    );

    state =
      await waitForPreprodWalletState(
        walletCtx,
      );
  } else {
    state =
      await walletCtx.wallet.waitForSyncedState();
  }

  clearInterval(syncInterval);

  process.stdout.write(
    '\r  ✓ Synced with network.                                      \n',
  );

  await persistWalletState(
    network,
    walletCtx,
  );

  const address =
    walletCtx.unshieldedKeystore
      .getBech32Address();

  const balance =
    state.unshielded.balances[
      unshieldedToken().raw
    ] ?? 0n;

  console.log(
    `\n  Wallet Address: ${address}`,
  );

  console.log(
    `  Balance: ${balance.toLocaleString()} tNight\n`,
  );

  if (
    network === 'undeployed' &&
    balance === 0n
  ) {
    console.error(
      '\n❌ Genesis-seed wallet has zero NIGHT. The devnet preset may not have minted to it.\n' +
        '   Check `docker compose ps` and `docker compose logs node`.\n',
    );

    await walletCtx.wallet.stop();

    process.exit(1);
  }

  // ─── Public network funding ─────────────────────────────────────────────────

  if (
    network !== 'undeployed' &&
    networkConfig.faucet
  ) {
    const initialBalance =
      await Rx.firstValueFrom(
        walletCtx.wallet
          .state()
          .pipe(
            Rx.filter(
              (s) => s.isSynced,
            ),
          ),
      );

    const initialTNight =
      initialBalance.unshielded
        .balances[
          unshieldedToken().raw
        ] ?? 0n;

    if (initialTNight === 0n) {
      console.log(
        '─── Fund Wallet ────────────────────────────────────────────────\n',
      );

      console.log(
        `  Wallet address: ${address}`,
      );

      console.log(
        `  Faucet:         ${networkConfig.faucet}`,
      );

      console.log('');

      console.log(
        '  Waiting for tNIGHT to arrive (poll every 10s)...',
      );

      const rawTimeout =
        Number(
          process.env
            .MIDNIGHT_FAUCET_TIMEOUT_MS,
        );

      const timeoutMs =
        Number.isFinite(
          rawTimeout,
        ) &&
        rawTimeout > 0
          ? rawTimeout
          : 600_000;

      const start =
        Date.now();

      while (true) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              10_000,
            ),
        );

        const s =
          await Rx.firstValueFrom(
            walletCtx.wallet
              .state()
              .pipe(
                Rx.filter(
                  (x) =>
                    x.isSynced,
                ),
              ),
          );

        const tn =
          s.unshielded.balances[
            unshieldedToken().raw
          ] ?? 0n;

        if (tn > 0n) {
          console.log(
            `\n  Funded! tNIGHT balance: ${tn.toLocaleString()}\n`,
          );

          break;
        }

        if (
          Date.now() -
            start >
          timeoutMs
        ) {
          console.log(
            `\n  ❌ Funding not received within ${Math.round(
              timeoutMs /
                60_000,
            )} min.`,
          );

          console.log(
            `  Address: ${address}`,
          );

          console.log(
            `  Faucet:  ${networkConfig.faucet}`,
          );

          await walletCtx.wallet.stop();

          process.exit(1);
        }

        const elapsed =
          Math.round(
            (Date.now() -
              start) /
              1000,
          );

        process.stdout.write(
          `\r  ...still waiting (${elapsed}s elapsed)`,
        );
      }
    }
  }

  // ─── DUST setup ─────────────────────────────────────────────────────────────

  console.log(
    '─── DUST Token Setup ───────────────────────────────────────────\n',
  );

  const dustState =
    await Rx.firstValueFrom(
      walletCtx.wallet
        .state()
        .pipe(
          Rx.filter(
            (s) => s.isSynced,
          ),
        ),
    );

  const unregisteredUtxos =
    dustState.unshielded.availableCoins.filter(
      (c: any) =>
        !c.meta
          ?.registeredForDustGeneration,
    );

  if (
    unregisteredUtxos.length > 0
  ) {
    console.log(
      `  Registering ${unregisteredUtxos.length} NIGHT UTXOs for DUST generation...`,
    );

    const recipe =
      await walletCtx.wallet.registerNightUtxosForDustGeneration(
        unregisteredUtxos,

        walletCtx.unshieldedKeystore
          .getPublicKey(),

        (payload) =>
          walletCtx.unshieldedKeystore
            .signData(payload),
      );

    const finalized =
      await walletCtx.wallet.finalizeRecipe(
        recipe,
      );

    await walletCtx.wallet.submitTransaction(
      finalized,
    );
  }

  if (
    dustState.dust.balance(
      new Date(),
    ) === 0n
  ) {
    console.log(
      '  Waiting for DUST tokens...',
    );

    try {
      await Rx.firstValueFrom(
        walletCtx.wallet
          .state()
          .pipe(
            Rx.throttleTime(
              5000,
            ),

            Rx.filter(
              (s) =>
                s.isSynced,
            ),

            Rx.filter(
              (s) =>
                s.dust.balance(
                  new Date(),
                ) > 0n,
            ),

            Rx.timeout({
              first:
                DUST_WAIT_TIMEOUT_MS,
            }),
          ),
      );
    } catch {
      const minutes =
        Math.round(
          DUST_WAIT_TIMEOUT_MS /
            60_000,
        );

      console.log(
        `\n  ❌ No DUST generated after ${minutes} minutes.\n`,
      );

      console.log(
        '  Check: docker compose ps',
      );

      console.log(
        '  Check: npm run check-balance\n',
      );

      await walletCtx.wallet.stop();

      process.exit(1);
    }
  }

  console.log(
    '  DUST tokens ready!\n',
  );

  // ─── Deployment ─────────────────────────────────────────────────────────────

  console.log(
    '─── Deploy PrivateOps Contract ─────────────────────────────────\n',
  );

  console.log(
    '  Checking proof server...',
  );

  const proofServerReady =
    await waitForProofServer();

  if (!proofServerReady) {
    console.log(
      '\n  ❌ Proof server not responding. Run: docker compose up -d\n',
    );

    await walletCtx.wallet.stop();

    process.exit(1);
  }

  process.stdout.write(
    '\r  Proof server ready!                                 \n',
  );

  console.log(
    '  Setting up providers...',
  );

  const providers =
    await createProviders(
      walletCtx,
    );

  console.log(
    '  Generating DUST...',
  );

  await new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        6000,
      ),
  );

  console.log(
    '  Deploying contract...\n',
  );

  const MAX_RETRIES = 20;
  const RETRY_DELAY_MS = 5000;

  let deployed:
    Awaited<
      ReturnType<
        typeof deployContract
      >
    > | undefined;

  for (
    let attempt = 1;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      /*
       * PrivateOps Level 1 demo policy:
       *
       * Private policy limit = 500.
       *
       * This value is kept in private state and
       * supplied to the Compact witness:
       *
       *     getPolicyLimit()
       *
       * It is NOT stored as public ledger state.
       */
      const initialPrivateState =
        createPrivateOpsPrivateState(
          500n,
        );

      deployed =
        await deployContract(
          providers,
          {
            compiledContract:
              compiledContract as any,

            args: [],

            privateStateId:
              PRIVATE_STATE_ID,

            initialPrivateState,
          },
        );

      break;
    } catch (err: any) {
      const errMsg =
        err?.message ||
        err?.toString() ||
        '';

      const errCause =
        err?.cause?.message ||
        err?.cause?.toString() ||
        '';

      const fullError =
        `${errMsg} ${errCause}`;

      const isDustShortage =
        fullError.includes(
          'Not enough Dust',
        ) ||
        fullError.includes(
          'Insufficient Funds',
        ) ||
        fullError.includes(
          'could not balance dust',
        );

      if (
        !(
          isDustShortage &&
          attempt === 1
        )
      ) {
        console.error(
          `\n  Attempt ${attempt} error: ${errMsg}`,
        );

        if (
          errCause &&
          errCause !== errMsg
        ) {
          console.error(
            `  Cause: ${errCause}`,
          );
        }
      }

      if (
        !isDustShortage &&
        (
          fullError.includes(
            'Failed to connect to Proof Server',
          ) ||
          fullError.includes(
            'connect ECONNREFUSED 127.0.0.1:6300',
          )
        )
      ) {
        console.log(
          '  ❌ Proof server unreachable. Run: docker compose up -d\n',
        );

        await walletCtx.wallet.stop();

        process.exit(1);
      }

      if (isDustShortage) {
        let currentState;

        if (network === 'preprod') {
          currentState =
            await waitForPreprodWalletState(
              walletCtx,
            );
        } else {
          currentState =
            await walletCtx.wallet
              .waitForSyncedState();
        }

        const dustBalance =
          currentState.dust.balance(
            new Date(),
          );

        if (
          attempt <
          MAX_RETRIES
        ) {
          console.log(
            `  ⏳ DUST balance: ${dustBalance.toLocaleString()} (attempt ${attempt}/${MAX_RETRIES}); retrying in ${RETRY_DELAY_MS / 1000}s...`,
          );

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                RETRY_DELAY_MS,
              ),
          );
        } else {
          console.log(
            `  ❌ Not enough DUST after ${MAX_RETRIES} retries (current: ${dustBalance.toLocaleString()})`,
          );

          await walletCtx.wallet.stop();

          process.exit(1);
        }
      } else {
        throw err;
      }
    }
  }

  if (!deployed) {
    throw new Error(
      'Deployment failed after all retries',
    );
  }

  const contractAddress =
    deployed.deployTxData.public
      .contractAddress;

  console.log(
    '  ✅ PrivateOps contract deployed successfully!\n',
  );

  console.log(
    `  Contract Address: ${contractAddress}\n`,
  );

  recordDeployment(
    network,
    contractAddress,
    address.toString(),
  );

  console.log(
    '  Saved to .midnight-state.json\n',
  );

  await persistWalletState(
    network,
    walletCtx,
  );

  await walletCtx.wallet.stop();

  console.log(
    '─── Deployment complete ────────────────────────────────────────\n',
  );

  console.log(
    '  Next: npm run cli\n',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});