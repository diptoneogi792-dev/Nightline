export type Network = 'preview' | 'preprod';

export type PulseAnswers = {
  workload: number;
  belonging: number;
  energy: number;
  note: string;
};

export type DeploymentReceipt = {
  network: Network;
  contractAddress: string;
  transactionHash: string;
  transactionId: string;
  blockHeight: number;
  deployedAt: string;
};

export type PublicPulseReceipt = DeploymentReceipt & {
  pulseTransactionHash: string;
  signalBand: 'steady' | 'stretched' | 'urgent';
  disclosureScope: string[];
};

export type WalletSummary = {
  providerId: string;
  name: string;
  rdns: string;
  apiVersion: string;
};

export type OperationPhase =
  | 'idle'
  | 'connecting'
  | 'deploying'
  | 'proving'
  | 'finalizing'
  | 'complete'
  | 'error';
