import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCircuitContext,
  emptyZswapLocalState,
} from '@midnight-ntwrk/compact-runtime';

import * as PrivateOps from '../contracts/managed/privateops/contract/index.js';

import {
  createPrivateOpsPrivateState,
  witnesses,
} from '../src/witnesses';

const POLICY_LIMIT = 500n;

const TEST_COIN_PUBLIC_KEY =
  '0000000000000000000000000000000000000000000000000000000000000000';

const TEST_CONTRACT_ADDRESS =
  'e3836a466cf5ee97443fc970d36fddda4fff407707250c9778e723cbbc2d04de';

function createTestContext() {
  const contract = new PrivateOps.Contract(witnesses);

  const initialState = contract.initialState({
    initialPrivateState: createPrivateOpsPrivateState(POLICY_LIMIT),
    initialZswapLocalState: emptyZswapLocalState(
      TEST_COIN_PUBLIC_KEY,
    ),
  });

  return createCircuitContext(
    TEST_CONTRACT_ADDRESS,
    initialState.currentZswapLocalState,
    initialState.currentContractState.data,
    initialState.currentPrivateState,
  );
}

function authorizeAction(
  context: ReturnType<typeof createTestContext>,
  actionAmount: bigint,
) {
  const contract = new PrivateOps.Contract(witnesses);

  return contract.circuits.authorizeAction(
    context,
    actionAmount,
  );
}

test(
  'circuit logic authorizes an action within the private policy',
  () => {
    const context = createTestContext();

    const result = authorizeAction(context, 300n);

    const publicLedger = PrivateOps.ledger(
      result.context.currentQueryContext.state,
    );

    assert.equal(publicLedger.lastActionAmount, 300n);
    assert.equal(publicLedger.lastActionAuthorized, true);
  },
);

test(
  'state transition updates the public authorization result',
  () => {
    const context = createTestContext();

    const firstResult = authorizeAction(context, 300n);

    const firstLedger = PrivateOps.ledger(
      firstResult.context.currentQueryContext.state,
    );

    assert.equal(firstLedger.lastActionAmount, 300n);
    assert.equal(firstLedger.lastActionAuthorized, true);

    const secondResult = authorizeAction(
      firstResult.context,
      700n,
    );

    const secondLedger = PrivateOps.ledger(
      secondResult.context.currentQueryContext.state,
    );

    assert.equal(secondLedger.lastActionAmount, 700n);
    assert.equal(secondLedger.lastActionAuthorized, false);
  },
);

test(
  'private policy is not exposed through the public ledger',
  () => {
    const context = createTestContext();

    const result = authorizeAction(context, 300n);

    const publicLedger = PrivateOps.ledger(
      result.context.currentQueryContext.state,
    );

    assert.deepEqual(publicLedger, {
      lastActionAmount: 300n,
      lastActionAuthorized: true,
    });

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        publicLedger,
        'policyLimit',
      ),
      false,
    );

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        publicLedger,
        'getPolicyLimit',
      ),
      false,
    );

    assert.equal(
      result.proofData.privateTranscriptOutputs.length,
      1,
    );
  },
);