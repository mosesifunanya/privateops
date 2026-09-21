/**
 * CLI for interacting with the PrivateOps contract.
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

// Midnight SDK imports
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import {
  resolveNetwork,
  getOrCreateWallet,
  formatWalletBackupNotice,
  getDeployment,
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
} from './witnesses';

import * as PrivateOps from '../contracts/managed/privateops/contract/index.js';

// Enable WebSocket for wallet sync and GraphQL subscriptions.
// @ts-expect-error Required by the Midnight wallet SDK.
globalThis.WebSocket = WebSocket;

// This MUST match the privateStateId used during deployment.
const PRIVATE_STATE_ID = 'privateOpsPrivateState';

// The same private policy used during deployment.
// The policy limit remains private and is supplied through the witness.
const INITIAL_POLICY_LIMIT = 500n;

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

// Check whether the PrivateOps contract was compiled.
if (!fs.existsSync(contractPath)) {
  console.error(
    '\n❌ PrivateOps contract not compiled! Run: npm run compile\n',
  );

  process.exit(1);
}

// The generated PrivateOps contract is used directly.
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
      walletCtx.shieldedSecretKeys.encryptionPublicKey,

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

    submitTx: (
      tx: any,
    ) =>
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
          PRIVATE_STATE_ID,

        accountId,

        privateStoragePasswordProvider:
          () =>
            privateStatePassword,
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readContractState(
  providers: any,
  contractAddress: string,
) {
  const contractState =
    await providers.publicDataProvider.queryContractState(
      contractAddress,
    );

  if (!contractState) {
    return null;
  }

  return PrivateOps.ledger(
    contractState.data,
  );
}

// ─── Main CLI ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    '\n╔══════════════════════════════════════════════════════════════╗',
  );

  console.log(
    '║                   PrivateOps CLI                           ║',
  );

  console.log(
    '╚══════════════════════════════════════════════════════════════╝\n',
  );

  const rl =
    createInterface({
      input: stdin,
      output: stdout,
    });

  const deployment =
    getDeployment(network);

  if (!deployment) {
    console.error(
      `No deployment found for network ${network}. Run \`npm run setup -- --network ${network}\` first.`,
    );

    rl.close();
    process.exit(1);
  }

  console.log(
    `  Contract: ${deployment.address}`,
  );

  console.log(
    `  Network: ${network}\n`,
  );

  let walletCtx: WalletContext | null =
    null;

  try {
    console.log(
      '  Connecting to wallet...',
    );

    walletCtx =
      await createWallet({
        network,
        networkConfig,
        seed: SEED,
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
      '\n  Syncing with network...',
    );

    console.log(
      '  ℹ  This may take several minutes depending on network size.',
    );

    console.log(
      '     RPC disconnection messages during sync are normal and can be safely ignored.\n',
    );

    const syncStart =
      Date.now();

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

    const state =
      await walletCtx.wallet.waitForSyncedState();

    clearInterval(
      syncInterval,
    );

    process.stdout.write(
      '\r  ✓ Synced with network.                                      \n',
    );

    await persistWalletState(
      network,
      walletCtx,
    );

    const balance =
      state.unshielded.balances[
        unshieldedToken().raw
      ] ?? 0n;

    console.log(
      `  Balance: ${balance.toLocaleString()} tNight\n`,
    );

    if (
      balance === 0n &&
      network !== 'undeployed' &&
      networkConfig.faucet
    ) {
      const address =
        walletCtx.unshieldedKeystore
          .getBech32Address();

      console.log(
        '  ⚠ Wallet has no tNIGHT. Read-only actions may still work, but transactions require funds.',
      );

      console.log(
        `     Faucet: ${networkConfig.faucet}`,
      );

      console.log(
        `     Wallet address: ${address}\n`,
      );
    }

    console.log(
      '  Connecting to contract...',
    );

    const providers =
      await createProviders(
        walletCtx,
      );

    const deployed =
      await findDeployedContract(
        providers,
        {
          compiledContract:
            compiledContract as any,

          contractAddress:
            deployment.address,

          privateStateId:
            PRIVATE_STATE_ID,

          initialPrivateState:
            createPrivateOpsPrivateState(
              INITIAL_POLICY_LIMIT,
            ),
        },
      );

    console.log(
      '  ✅ Connected!\n',
    );

    let running = true;

    while (running) {
      console.log(
        '─── Menu ───────────────────────────────────────────────────────',
      );

      console.log(
        '  1. Authorize an action',
      );

      console.log(
        '  2. Read current authorization result',
      );

      console.log(
        '  3. Check wallet balance',
      );

      console.log(
        '  4. Show contract address',
      );

      console.log(
        '  5. Exit\n',
      );

      const choice =
        await rl.question(
          '  Your choice: ',
        );

      switch (choice.trim()) {
        case '1': {
          const amountInput =
            await rl.question(
              '  Enter action amount: ',
            );

          const actionAmount =
            BigInt(
              amountInput.trim(),
            );

          console.log(
            '\n  Submitting authorization transaction...',
          );

          console.log(
            '  The policy limit remains private; only the authorization result is disclosed.',
          );

          try {
            const tx =
              await deployed.callTx.authorizeAction(
                actionAmount,
              );

            console.log(
              '\n  ✅ Authorization transaction submitted.',
            );

            if (
              tx?.public?.txId
            ) {
              console.log(
                `  Transaction ID: ${tx.public.txId}`,
              );
            }

            if (
              tx?.public?.blockHeight
            ) {
              console.log(
                `  Block height: ${tx.public.blockHeight}`,
              );
            }

            const ledgerState =
              await readContractState(
                providers,
                deployment.address,
              );

            if (ledgerState) {
              console.log(
                `\n  Action amount: ${ledgerState.lastActionAmount.toString()}`,
              );

              console.log(
                `  Authorized: ${ledgerState.lastActionAuthorized ? 'YES' : 'NO'}\n`,
              );
            }
          } catch (error) {
            console.error(
              '\n  ❌ Authorization failed:',
              error instanceof Error
                ? error.message
                : error,
            );
          }

          break;
        }

        case '2': {
          console.log(
            '\n  Reading PrivateOps state from the blockchain...',
          );

          try {
            const ledgerState =
              await readContractState(
                providers,
                deployment.address,
              );

            if (ledgerState) {
              console.log(
                `\n  Last action amount: ${ledgerState.lastActionAmount.toString()}`,
              );

              console.log(
                `  Last action authorized: ${
                  ledgerState.lastActionAuthorized
                    ? 'YES'
                    : 'NO'
                }\n`,
              );
            } else {
              console.log(
                '\n  No PrivateOps state found.\n',
              );
            }
          } catch (error) {
            console.error(
              '\n  ❌ Failed:',
              error instanceof Error
                ? error.message
                : error,
            );
          }

          break;
        }

        case '3': {
          console.log(
            '\n  Checking balance...',
          );

          try {
            const currentState =
              await walletCtx.wallet.waitForSyncedState();

            const currentBalance =
              currentState.unshielded.balances[
                unshieldedToken().raw
              ] ?? 0n;

            const dustBalance =
              currentState.dust.balance(
                new Date(),
              );

            console.log(
              `\n  tNIGHT: ${currentBalance.toLocaleString()}`,
            );

            console.log(
              `  DUST: ${dustBalance.toLocaleString()}\n`,
            );
          } catch (error) {
            console.error(
              '\n  ❌ Failed:',
              error instanceof Error
                ? error.message
                : error,
            );
          }

          break;
        }

        case '4': {
          console.log(
            `\n  PrivateOps contract address:\n  ${deployment.address}\n`,
          );

          break;
        }

        case '5': {
          running = false;

          console.log(
            '\n  👋 Goodbye!\n',
          );

          break;
        }

        default: {
          console.log(
            '\n  ❌ Invalid choice. Please enter 1-5.\n',
          );
        }
      }
    }

    await persistWalletState(
      network,
      walletCtx,
    );

    await walletCtx.wallet.stop();
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error
        ? error.message
        : error,
    );

    if (walletCtx) {
      try {
        await walletCtx.wallet.stop();
      } catch {
        // Ignore shutdown errors.
      }
    }
  } finally {
    rl.close();
  }
}

main().catch(console.error);
