import type { ContractAddress, SigningKey } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type {
  ImportPrivateStatesResult,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';

export const inMemoryPrivateStateProvider = <PSI extends PrivateStateId, PS>(): PrivateStateProvider<PSI, PS> => {
  const privateStates = new Map<ContractAddress, Map<PSI, PS>>();
  const signingKeys = new Map<ContractAddress, SigningKey>();
  let contractAddress: ContractAddress | null = null;

  const requireAddress = (): ContractAddress => {
    if (contractAddress === null) throw new Error('Contract address not set');
    return contractAddress;
  };
  const scoped = (address: ContractAddress): Map<PSI, PS> => {
    const existing = privateStates.get(address);
    if (existing) return existing;
    const created = new Map<PSI, PS>();
    privateStates.set(address, created);
    return created;
  };

  return {
    setContractAddress: (address) => { contractAddress = address; },
    set: async (key, value) => { scoped(requireAddress()).set(key, value); },
    get: async (key) => scoped(requireAddress()).get(key) ?? null,
    remove: async (key) => { scoped(requireAddress()).delete(key); },
    clear: async () => { privateStates.delete(requireAddress()); },
    setSigningKey: async (address, key) => { signingKeys.set(address, key); },
    getSigningKey: async (address) => signingKeys.get(address) ?? null,
    removeSigningKey: async (address) => { signingKeys.delete(address); },
    clearSigningKeys: async () => { signingKeys.clear(); },
    exportPrivateStates: async (): Promise<PrivateStateExport> => ({
      format: 'midnight-private-state-export', encryptedPayload: '', salt: 'in-memory',
    }),
    importPrivateStates: async (): Promise<ImportPrivateStatesResult> => ({
      imported: 0, skipped: 0, overwritten: 0,
    }),
    exportSigningKeys: async (): Promise<SigningKeyExport> => ({
      format: 'midnight-signing-key-export', encryptedPayload: '', salt: 'in-memory',
    }),
    importSigningKeys: async (): Promise<ImportSigningKeysResult> => ({
      imported: 0, skipped: 0, overwritten: 0,
    }),
  };
};
