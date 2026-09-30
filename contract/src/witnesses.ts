export type PrivatePulse = {
  readonly workload: bigint;
  readonly belonging: bigint;
  readonly energy: bigint;
  readonly nonce: Uint8Array;
};

export type NightlinePrivateState = {
  readonly secretKey: Uint8Array;
  readonly nextSecretKey: Uint8Array;
  readonly pulse: PrivatePulse;
};

export const createWitnesses = () => ({
  localSecretKey: ({ privateState }: { privateState: NightlinePrivateState }): [NightlinePrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
  nextLocalSecretKey: ({ privateState }: { privateState: NightlinePrivateState }): [NightlinePrivateState, Uint8Array] => [
    privateState,
    privateState.nextSecretKey,
  ],
  privatePulse: ({ privateState }: { privateState: NightlinePrivateState }): [NightlinePrivateState, PrivatePulse] => [
    privateState,
    privateState.pulse,
  ],
});
