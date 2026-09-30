import type { DeploymentReceipt, Network, PulseAnswers } from './types';
import type { NightlinePrivateState } from '../../contract/src/witnesses';

const PULSE_KEY = 'nightline:private-pulse:v1';
const STATE_KEY = 'nightline:worker-state:v1';
const DEPLOYMENT_PREFIX = 'nightline:deployment:v1:';

const memory = new Map<string, string>();

const store = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },
  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memory.delete(key);
    }
  },
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export const randomBytes = (): Uint8Array => crypto.getRandomValues(new Uint8Array(32));

export const defaultAnswers: PulseAnswers = { workload: 2, belonging: 1, energy: 2, note: '' };

export const loadAnswers = (): PulseAnswers => {
  const raw = store.getItem(PULSE_KEY);
  if (!raw) return defaultAnswers;
  try {
    const value = JSON.parse(raw) as Partial<PulseAnswers>;
    return {
      workload: clampScore(value.workload),
      belonging: clampScore(value.belonging),
      energy: clampScore(value.energy),
      note: typeof value.note === 'string' ? value.note.slice(0, 600) : '',
    };
  } catch {
    return defaultAnswers;
  }
};

export const saveAnswers = (answers: PulseAnswers): void => store.setItem(PULSE_KEY, JSON.stringify(answers));

const clampScore = (value: unknown): number => Math.max(0, Math.min(4, Number.isFinite(Number(value)) ? Number(value) : 0));

export const loadOrCreatePrivateState = (answers: PulseAnswers = loadAnswers()): NightlinePrivateState => {
  const raw = store.getItem(STATE_KEY);
  if (raw) {
    try {
      const value = JSON.parse(raw) as { secretKey: string; nextSecretKey: string };
      return withPulse({
        secretKey: fromBase64(value.secretKey),
        nextSecretKey: fromBase64(value.nextSecretKey),
      }, answers);
    } catch {
      store.removeItem(STATE_KEY);
    }
  }
  const state = withPulse({ secretKey: randomBytes(), nextSecretKey: randomBytes() }, answers);
  savePrivateState(state);
  return state;
};

export const savePrivateState = (state: NightlinePrivateState): void => {
  store.setItem(STATE_KEY, JSON.stringify({
    secretKey: toBase64(state.secretKey),
    nextSecretKey: toBase64(state.nextSecretKey),
  }));
};

export const withPulse = (
  keys: Pick<NightlinePrivateState, 'secretKey' | 'nextSecretKey'>,
  answers: PulseAnswers,
): NightlinePrivateState => ({
  ...keys,
  pulse: {
    workload: BigInt(answers.workload),
    belonging: BigInt(answers.belonging),
    energy: BigInt(answers.energy),
    nonce: randomBytes(),
  },
});

export const rotatePrivateState = (state: NightlinePrivateState): NightlinePrivateState => {
  const next = {
    secretKey: state.nextSecretKey,
    nextSecretKey: randomBytes(),
    pulse: { ...state.pulse, nonce: randomBytes() },
  };
  savePrivateState(next);
  return next;
};

export const loadDeployment = (network: Network): DeploymentReceipt | null => {
  const raw = store.getItem(`${DEPLOYMENT_PREFIX}${network}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeploymentReceipt;
    return parsed.network === network && parsed.contractAddress && parsed.transactionHash ? parsed : null;
  } catch {
    return null;
  }
};

export const saveDeployment = (receipt: DeploymentReceipt): void => {
  store.setItem(`${DEPLOYMENT_PREFIX}${receipt.network}`, JSON.stringify(receipt));
};
