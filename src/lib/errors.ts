export type AppErrorKind = 'wallet-rejected' | 'insufficient-dust' | 'proof-service' | 'indexer' | 'wallet-missing' | 'unknown';

export class AppError extends Error {
  readonly detail?: string;

  constructor(public readonly kind: AppErrorKind, message: string, options?: ErrorOptions & { detail?: string }) {
    super(message, options);
    this.detail = options?.detail;
  }
}

const errorText = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return String(error);
};

const diagnosticText = (error: unknown): string => {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    const message = errorText(current).trim();
    if (message && message !== '[object Object]' && !messages.includes(message)) messages.push(message);
    current = current instanceof Error ? current.cause : undefined;
  }
  return messages.join(' — ')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[endpoint hidden]')
    .replace(/\b(authorization|token|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[hidden]')
    .slice(0, 240);
};

export const classifyError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  const detail = diagnosticText(error);
  const raw = `${error instanceof Error ? error.name : ''} ${detail}`;
  const message = raw.toLowerCase();
  if (message.includes('permission') || message.includes('reject') || message.includes('denied')) {
    return new AppError('wallet-rejected', '1AM did not approve the request. Check the wallet before trying again.', { cause: error, detail });
  }
  if (message.includes('dust') || message.includes('balance') || message.includes('overspend')) {
    return new AppError('insufficient-dust', 'This wallet may need more spendable DUST before it can submit the transaction.', { cause: error, detail });
  }
  if (message.includes('proof') || message.includes('prover') || message.includes('6300')) {
    return new AppError('proof-service', 'The proof service could not complete the request. Your private answers are still on this device.', { cause: error, detail });
  }
  if (message.includes('indexer') || message.includes('graphql') || message.includes('websocket')) {
    return new AppError('indexer', 'The Midnight indexer did not finalize the request. Check the wallet and network before retrying.', { cause: error, detail });
  }
  if (message.includes('wallet') || message.includes('midnight')) {
    return new AppError('wallet-missing', 'The wallet connection could not complete. Check that 1AM is connected to the selected network.', { cause: error, detail });
  }
  return new AppError('unknown', 'The operation did not finish. Check your wallet and network before retrying.', { cause: error, detail });
};
