import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as NightlineContract from './managed/nightline/contract/index.js';
import { createWitnesses } from './witnesses.js';

export * as Nightline from './managed/nightline/contract/index.js';
export type { NightlinePrivateState, PrivatePulse } from './witnesses.js';
export { createWitnesses } from './witnesses.js';

export const CompiledNightlineContract = CompiledContract.make(
  'nightline',
  NightlineContract.Contract,
).pipe(
  CompiledContract.withWitnesses(createWitnesses()),
  CompiledContract.withCompiledFileAssets('./managed/nightline'),
);
