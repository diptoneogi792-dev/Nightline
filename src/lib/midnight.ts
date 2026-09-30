import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { deployContract, findDeployedContract, type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { fromHex, toHex, type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Binding,
  type FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  type TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { createProofProvider, type MidnightProviders, type UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { CompiledNightlineContract } from '../../contract/src';
import type { NightlinePrivateState } from '../../contract/src/witnesses';
import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider';
import { AppError, classifyError } from './errors';
import type { DeploymentReceipt, Network, WalletSummary } from './types';
import { discoverWallets } from './wallet';

const PRIVATE_STATE_ID = 'nightlinePrivateState';
type PrivateStateId = typeof PRIVATE_STATE_ID;
type CircuitKeys = 'submitPulse' | 'rotateWorkerKey';
type Providers = MidnightProviders<CircuitKeys, PrivateStateId, NightlinePrivateState>;

export type WalletConnection = {
  connected: ConnectedAPI;
  summary: WalletSummary;
  configuration: Awaited<ReturnType<ConnectedAPI['getConfiguration']>>;
  dustBalance: bigint;
};

export type PulseChainReceipt = {
  transactionHash: string;
  transactionId: string;
  blockHeight: number;
};

export const connectPreferredWallet = async (network: Network): Promise<WalletConnection> => {
  const wallet = discoverWallets()[0];
  if (!wallet) throw new AppError('wallet-missing', 'Install or unlock 1AM, then try again.');
  try {
    const connected = await wallet.api.connect(network);
    await connected.hintUsage?.(['getConfiguration', 'getDustBalance', 'getProvingProvider', 'submitTransaction']);
    const [configuration, dust] = await Promise.all([
      connected.getConfiguration(),
      connected.getDustBalance(),
    ]);
    if (configuration.networkId.toLowerCase() !== network) {
      throw new Error(`Wallet connected to ${configuration.networkId}, expected ${network}`);
    }
    return {
      connected,
      configuration,
      dustBalance: dust.balance,
      summary: {
        providerId: wallet.providerId,
        name: wallet.name,
        rdns: wallet.rdns,
        apiVersion: wallet.apiVersion,
      },
    };
  } catch (error) {
    throw classifyError(error);
  }
};

const createProviders = async (connection: WalletConnection, network: Network): Promise<Providers> => {
  setNetworkId(network);
  const { connected, configuration } = connection;
  const shielded = await connected.getShieldedAddresses();
  const zkConfigProvider = new FetchZkConfigProvider<CircuitKeys>(window.location.origin, fetch.bind(window));
  const provingProvider = await connected.getProvingProvider(zkConfigProvider);
  const proofProvider = provingProvider
    ? createProofProvider(provingProvider)
    : httpClientProofProvider(
      configuration.proverServerUri || import.meta.env.VITE_PROOF_SERVER_URL || 'http://localhost:6300',
      zkConfigProvider,
    );

  return {
    privateStateProvider: inMemoryPrivateStateProvider<PrivateStateId, NightlinePrivateState>(),
    zkConfigProvider,
    proofProvider,
    publicDataProvider: indexerPublicDataProvider(configuration.indexerUri, configuration.indexerWsUri, window.WebSocket),
    walletProvider: {
      getCoinPublicKey: () => shielded.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shielded.shieldedEncryptionPublicKey,
      balanceTx: async (transaction: UnboundTransaction): Promise<FinalizedTransaction> => {
        const balanced = await connected.balanceUnsealedTransaction(toHex(transaction.serialize()));
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          'signature',
          'proof',
          'binding',
          fromHex(balanced.tx),
        );
      },
    },
    midnightProvider: {
      submitTx: async (transaction: FinalizedTransaction): Promise<TransactionId> => {
        await connected.submitTransaction(toHex(transaction.serialize()));
        const [identifier] = transaction.identifiers();
        if (!identifier) throw new Error('Finalized transaction has no identifier');
        return identifier;
      },
    },
  };
};

export class NightlineWorker {
  readonly contractAddress: ContractAddress;

  private constructor(
    private readonly deployed: FoundContract<any>,
    private readonly providers: Providers,
  ) {
    this.contractAddress = deployed.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.contractAddress);
  }

  static async deploy(
    connection: WalletConnection,
    network: Network,
    privateState: NightlinePrivateState,
  ): Promise<{ worker: NightlineWorker; receipt: DeploymentReceipt }> {
    try {
      const providers = await createProviders(connection, network);
      const deployed = await deployContract(providers as any, {
        compiledContract: CompiledNightlineContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: privateState,
      });
      const worker = new NightlineWorker(deployed, providers);
      const publicData = deployed.deployTxData.public;
      return {
        worker,
        receipt: {
          network,
          contractAddress: publicData.contractAddress,
          transactionHash: publicData.txHash,
          transactionId: publicData.txId,
          blockHeight: publicData.blockHeight,
          deployedAt: new Date(publicData.blockTimestamp * 1000).toISOString(),
        },
      };
    } catch (error) {
      throw classifyError(error);
    }
  }

  static async join(
    connection: WalletConnection,
    network: Network,
    privateState: NightlinePrivateState,
    contractAddress: string,
  ): Promise<NightlineWorker> {
    try {
      const providers = await createProviders(connection, network);
      const deployed = await findDeployedContract(providers as any, {
        contractAddress: contractAddress as ContractAddress,
        compiledContract: CompiledNightlineContract,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: privateState,
      });
      return new NightlineWorker(deployed, providers);
    } catch (error) {
      throw classifyError(error);
    }
  }

  async submitPulse(privateState: NightlinePrivateState): Promise<PulseChainReceipt> {
    try {
      await this.providers.privateStateProvider.set(PRIVATE_STATE_ID, privateState);
      const result = await (this.deployed as any).callTx.submitPulse();
      return {
        transactionHash: result.public.txHash,
        transactionId: result.public.txId,
        blockHeight: result.public.blockHeight,
      };
    } catch (error) {
      throw classifyError(error);
    }
  }

  async rotateKey(privateState: NightlinePrivateState): Promise<PulseChainReceipt> {
    try {
      await this.providers.privateStateProvider.set(PRIVATE_STATE_ID, privateState);
      const result = await (this.deployed as any).callTx.rotateWorkerKey();
      return {
        transactionHash: result.public.txHash,
        transactionId: result.public.txId,
        blockHeight: result.public.blockHeight,
      };
    } catch (error) {
      throw classifyError(error);
    }
  }
}
