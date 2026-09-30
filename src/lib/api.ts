import type { PublicPulseReceipt } from './types';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export type Metrics = {
  total_proofs: number;
  unique_workers: number;
  steady: number;
  stretched: number;
  urgent: number;
};

export type ProofPlan = {
  title: string;
  plain_language_summary: string;
  private_inputs: string[];
  public_outputs: string[];
  verifier_note: string;
  source: 'gemini' | 'local-fallback';
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw new Error(`API request failed with ${response.status}`);
  return response.json() as Promise<T>;
};

export const getMetrics = (): Promise<Metrics> => request('/api/v1/metrics');

export const composeProofPlan = (): Promise<ProofPlan> => request('/api/v1/plans', {
  method: 'POST',
  body: JSON.stringify({
    public_requirement: 'Report one weekly student support band from three local 0–4 answers.',
    approved_labels: ['steady', 'stretched', 'urgent', 'one-use nullifier'],
  }),
});

export const registerReceipt = (receipt: PublicPulseReceipt): Promise<void> => request('/api/v1/receipts', {
  method: 'POST',
  body: JSON.stringify({
    network: receipt.network,
    worker_contract_address: receipt.contractAddress,
    deployment_tx_hash: receipt.transactionHash,
    pulse_tx_hash: receipt.pulseTransactionHash,
    signal_band: receipt.signalBand,
    disclosure_scope: receipt.disclosureScope,
  }),
});
