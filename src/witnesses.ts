import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from '../contracts/managed/privateops/contract/index.js';

export type PrivateOpsPrivateState = {
  readonly policyLimit: bigint;
};

export const createPrivateOpsPrivateState = (
  policyLimit: bigint,
): PrivateOpsPrivateState => ({
  policyLimit,
});

export const witnesses = {
  getPolicyLimit: ({
    privateState,
  }: WitnessContext<Ledger, PrivateOpsPrivateState>): [
    PrivateOpsPrivateState,
    bigint,
  ] => [privateState, privateState.policyLimit],
};