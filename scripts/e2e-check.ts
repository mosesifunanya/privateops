/**
 * End-to-end smoke check for PrivateOps.
 *
 * Reconnects to the deployed PrivateOps contract, reads its ledger state,
 * and exits 0 on success. Used by `npm run test:e2e` and by the project's
 * CI workflows.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

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
} from '../src/network';

import {
  createWallet,
  persistWalletState,
} from '../src/wallet';

import {
  createPrivateOpsPrivateState,
  witnesses,
} from '../src/witnesses';

import * as PrivateOps from '../contracts/managed/privateops/contract/index.js';

// @ts-expect-error wallet sync requires WebSocket
globalThis.WebSocket = WebSocket;

// Must match the privateStateId used at deploy time.
const PRIVATE_STATE_ID = 'privateOpsPrivateState';

// ─── Network configuration ─────────────────────────────────────────────────────

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);
const SEED = WALLET.seed;

{
  const notice = formatWalletBackupNotice(WALLET, network);
  if (notice) console.log(notice);
}

function fail(msg: string): never {
  console.error(`❌ e2e-check failed: ${msg}`);
  process.exit(1);
}

function isHexAddress(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    /^[0-9a-fA-F]+$/.test(s) &&
    s.length >= 32
  );
}

async function main() {
  // 1. Deployment sanity
  const deployment = getDeployment(network);

  if (!deployment) {
    console.error(`No deploy on file for network ${network}.`);
    process.exit(1);
  }

  if (!isHexAddress(deployment.address)) {
    fail(
      `Deployment address missing or invalid: ${JSON.stringify(
        deployment,
        null,
        2,
      )}`,
    );
  }

  // 2. Build wallet and providers
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    fail('Compiled contract missing — run `npm run compile`.');
  }

  const compiledContract = CompiledContract.make(
    'privateops',
    PrivateOps.Contract,
  ).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );

  const walletCtx = await createWallet({
    network,
    networkConfig,
    seed: SEED,
  });

  await walletCtx.wallet.waitForSyncedState();

  // Persist the sync state so future e2e checks can resume quickly.
  await persistWalletState(network, walletCtx);

  const zkConfigProvider = new NodeZkConfigProvider(
    zkConfigPath,
  );

  const walletProvider = {
    // Midnight.js 4.1.x returns the key objects
    // (CoinPublicKey / EncPublicKey).
    getCoinPublicKey: () =>
      walletCtx.shieldedSecretKeys.coinPublicKey,

    getEncryptionPublicKey: () =>
      walletCtx.shieldedSecretKeys.encryptionPublicKey,

    async balanceTx() {
      throw new Error(
        'e2e-check is read-only and should not balance transactions',
      );
    },

    submitTx() {
      throw new Error(
        'e2e-check is read-only and should not submit transactions',
      );
    },
  } as any;

  const providers = {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: PRIVATE_STATE_ID,
      accountId:
        walletCtx.unshieldedKeystore.getBech32Address().toString(),

      // SDK requires ≥16 chars.
      // e2e-check is read-only.
      privateStoragePasswordProvider: () =>
        'Local-Devnet-Development-Placeholder-1',
    }),

    publicDataProvider: indexerPublicDataProvider(
      networkConfig.indexer,
      networkConfig.indexerWS,
    ),

    zkConfigProvider,

    proofProvider: httpClientProofProvider(
      networkConfig.proofServer,
      zkConfigProvider,
    ),

    walletProvider,

    midnightProvider: walletProvider,
  };

  // 3. Reconnect to the deployed PrivateOps contract.
  try {
    await findDeployedContract(providers, {
      contractAddress: deployment.address,
      compiledContract: compiledContract as any,
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState:
        createPrivateOpsPrivateState(500n),
    });
  } catch (err: any) {
    await walletCtx.wallet.stop();

    fail(
      `findDeployedContract threw: ${
        err?.message ?? err
      }`,
    );
  }

  // 4. Read the on-chain contract state through the public
  // data provider. This proves that the contract is indexed
  // and queryable on the network.
  const onChainState =
    await providers.publicDataProvider.queryContractState(
      deployment.address,
    );

  if (!onChainState) {
    await walletCtx.wallet.stop();

    fail(
      `queryContractState returned null for ${deployment.address}`,
    );
  }

  console.log(`✅ e2e-check passed`);
  console.log(`   contractAddress: ${deployment.address}`);
  console.log(`   network:         ${network}`);
  console.log(`   privateStateId:  ${PRIVATE_STATE_ID}`);

  await walletCtx.wallet.stop();

  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});