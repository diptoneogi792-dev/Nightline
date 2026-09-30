import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  localSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  nextLocalSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  privatePulse(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { workload: bigint,
                                                                             belonging: bigint,
                                                                             energy: bigint,
                                                                             nonce: Uint8Array
                                                                           }];
}

export type ImpureCircuits<PS> = {
  submitPulse(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  rotateWorkerKey(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type ProvableCircuits<PS> = {
  submitPulse(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  rotateWorkerKey(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type PureCircuits = {
  commitmentFor(secret_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  commitmentFor(context: __compactRuntime.CircuitContext<PS>,
                secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  submitPulse(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
  rotateWorkerKey(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
}

export type Ledger = {
  readonly workerCommitment: Uint8Array;
  readonly steadySignals: bigint;
  readonly stretchedSignals: bigint;
  readonly urgentSignals: bigint;
  readonly acceptedSignals: bigint;
  readonly keyRotations: bigint;
  usedNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
