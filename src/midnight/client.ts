'use client';

import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

import {
  setNetworkId,
} from '@midnight-ntwrk/midnight-js-network-id';

import {
  dappConnectorProvingProvider,
} from '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider';

import {
  createCircuitCallTxInterface,
  findDeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';

import {
  FetchZkConfigProvider,
} from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';

import {
  levelPrivateStateProvider,
} from '@midnight-ntwrk/midnight-js-level-private-state-provider';

import {
  createProofProvider,
  type UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';

import {
  CompiledContract,
} from '@midnight-ntwrk/midnight-js-protocol/compact-js';

import {
  Binding,
  Proof,
  SignatureEnabled,
  Transaction,
  type FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v8';

import {
  indexerPublicDataProvider,
} from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';

import * as PrivateOps from '../../contracts/managed/privateops/contract/index.js';

import {
  witnesses,
  type PrivateOpsPrivateState,
} from '../witnesses';

setNetworkId('preprod');

const PRIVATE_STATE_ID =
  'privateOpsPrivateState';

const PREPROD_INDEXER_URL =
  'https://indexer.preprod.midnight.network/api/v4/graphql';

const PREPROD_INDEXER_WS_URL =
  'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';

export const PRIVATEOPS_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_PRIVATEOPS_CONTRACT_ADDRESS ?? '';

const compiledContract =
  CompiledContract.make(
    'privateops',
    PrivateOps.Contract,
  ).pipe(
    CompiledContract.withWitnesses(
      witnesses,
    ),
  );

function createZkConfigProvider() {
  if (typeof window === 'undefined') {
    throw new Error(
      'ZK configuration can only be loaded in the browser.',
    );
  }

  return new FetchZkConfigProvider<
    'authorizeAction'
  >(
    window.location.origin,
    fetch.bind(window),
  );
}

function createPublicDataProvider() {
  if (typeof window === 'undefined') {
    throw new Error(
      'Public data provider can only be created in the browser.',
    );
  }

  return indexerPublicDataProvider(
    PREPROD_INDEXER_URL,
    PREPROD_INDEXER_WS_URL,
    WebSocket as never,
  );
}

function createPrivateStateProvider(
  address: string,
) {
  const provider =
    levelPrivateStateProvider<
      typeof PRIVATE_STATE_ID,
      PrivateOpsPrivateState
    >({
      privateStateStoreName:
        'privateops-state',

      accountId:
        address,

      privateStoragePasswordProvider:
        async () =>
          'PrivateOps-Browser-Demo-Password-2026!',
    });

  provider.setContractAddress(
    PRIVATEOPS_CONTRACT_ADDRESS,
  );

  return provider;
}

function bytesToHex(
  bytes: Uint8Array,
): string {
  return Array.from(bytes)
    .map((byte) =>
      byte.toString(16).padStart(2, '0'),
    )
    .join('');
}

function hexToBytes(
  hex: string,
): Uint8Array {
  const cleanHex =
    hex.replace(/^0x/, '');

  if (!cleanHex) {
    return new Uint8Array();
  }

  if (cleanHex.length % 2 !== 0) {
    throw new Error(
      'Invalid serialized transaction hex.',
    );
  }

  const bytes =
    new Uint8Array(
      cleanHex.length / 2,
    );

  for (
    let index = 0;
    index < bytes.length;
    index += 1
  ) {
    bytes[index] =
      Number.parseInt(
        cleanHex.slice(
          index * 2,
          index * 2 + 2,
        ),
        16,
      );
  }

  return bytes;
}

function deserializeFinalizedTransaction(
  serialized: string,
): FinalizedTransaction {
  return Transaction.deserialize<
    SignatureEnabled,
    Proof,
    Binding
  >(
    'signature',
    'proof',
    'binding',
    hexToBytes(serialized),
  );
}

export function createInitialPrivateState(
  policyLimit: bigint,
): PrivateOpsPrivateState {
  return {
    policyLimit,
  };
}

export async function createPrivateOpsProviders(
  api: ConnectedAPI,
  address: string,
) {
  if (!PRIVATEOPS_CONTRACT_ADDRESS) {
    throw new Error(
      'PrivateOps Preprod contract address is not configured.',
    );
  }

  if (!api) {
    throw new Error(
      'Midnight wallet is not connected.',
    );
  }

  if (!address) {
    throw new Error(
      'A connected Midnight wallet address is required.',
    );
  }

  const shieldedAddresses =
    await api.getShieldedAddresses();

  if (
    !shieldedAddresses
      .shieldedCoinPublicKey
  ) {
    throw new Error(
      'Midnight wallet did not provide a shielded coin public key.',
    );
  }

  if (
    !shieldedAddresses
      .shieldedEncryptionPublicKey
  ) {
    throw new Error(
      'Midnight wallet did not provide a shielded encryption public key.',
    );
  }

  const zkConfigProvider =
    createZkConfigProvider();

  const provingProvider =
    await dappConnectorProvingProvider(
      api,
      zkConfigProvider,
    );

  const proofProvider =
    createProofProvider(
      provingProvider,
    );

  const privateStateProvider =
    createPrivateStateProvider(
      address,
    );

  const publicDataProvider =
    createPublicDataProvider();

  const walletProvider = {
    getCoinPublicKey(): string {
      return (
        shieldedAddresses
          .shieldedCoinPublicKey
      );
    },

    getEncryptionPublicKey(): string {
      return (
        shieldedAddresses
          .shieldedEncryptionPublicKey
      );
    },

    async balanceTx(
      tx: UnboundTransaction,
      _ttl?: Date,
    ): Promise<FinalizedTransaction> {
      const serializedTx =
        bytesToHex(
          tx.serialize(),
        );

      const balanced =
        await api.balanceUnsealedTransaction(
          serializedTx,
          {
            payFees: true,
          },
        );

      return deserializeFinalizedTransaction(
        balanced.tx,
      );
    },
  };

  const midnightProvider = {
    async submitTx(
      tx: FinalizedTransaction,
    ): Promise<string> {
      await api.submitTransaction(
        bytesToHex(
          tx.serialize(),
        ),
      );

      const identifiers =
        tx.identifiers();

      if (
        !identifiers ||
        identifiers.length === 0
      ) {
        throw new Error(
          'Midnight submitted the transaction but returned no transaction identifier.',
        );
      }

      return identifiers[0];
    },
  };

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
}

export async function createPrivateOpsCircuit(
  api: ConnectedAPI,
  address: string,
) {
  const providers =
    await createPrivateOpsProviders(
      api,
      address,
    );

  await findDeployedContract(
    providers as never,
    {
      compiledContract:
        compiledContract as never,

      contractAddress:
        PRIVATEOPS_CONTRACT_ADDRESS,

      privateStateId:
        PRIVATE_STATE_ID,

      initialPrivateState:
        createInitialPrivateState(
          1000n,
        ),
    },
  );

  return createCircuitCallTxInterface(
    providers as never,
    compiledContract as never,
    PRIVATEOPS_CONTRACT_ADDRESS,
    PRIVATE_STATE_ID,
  );
}

export async function authorizeAction(
  api: ConnectedAPI,
  address: string,
  actionAmount: bigint,
) {
  if (!api) {
    throw new Error(
      'Midnight wallet is not connected.',
    );
  }

  if (!address) {
    throw new Error(
      'A connected Midnight wallet address is required.',
    );
  }

  if (actionAmount < 0n) {
    throw new Error(
      'Action amount cannot be negative.',
    );
  }

  const circuit =
    await createPrivateOpsCircuit(
      api,
      address,
    );

  return circuit.authorizeAction(
    actionAmount,
  );
}