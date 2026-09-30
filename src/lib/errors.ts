export type AppErrorKind = 'wallet-rejected' | 'insufficient-dust' | 'proof-service' | 'indexer' | 'wallet-missing' | 'unknown';

export class AppError extends Error {
  constructor(public readonly kind: AppErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export const classifyError = (error: unknown): AppError => {
  const raw = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  const message = raw.toLowerCase();
  if (message.includes('permission') || message.includes('reject') || message.includes('denied')) {
    return new AppError('wallet-rejected', '1AM did not approve the request. Nothing was submitted.', { cause: error });
  }
  if (message.includes('dust') || message.includes('balance') || message.includes('overspend')) {
    return new AppError('insufficient-dust', 'This wallet needs more DUST before it can submit the transaction.', { cause: error });
  }
  if (message.includes('proof') || message.includes('prover') || message.includes('6300')) {
    return new AppError('proof-service', 'The proof service is unavailable. Your private answers are still on this device.', { cause: error });
  }
  if (message.includes('indexer') || message.includes('graphql') || message.includes('websocket')) {
    return new AppError('indexer', 'The Midnight indexer did not finalize the request. Try again in a moment.', { cause: error });
  }
  if (message.includes('wallet') || message.includes('midnight')) {
    return new AppError('wallet-missing', 'No compatible 1AM wallet was found in this browser.', { cause: error });
  }
  return new AppError('unknown', 'The operation could not be completed. No result was recorded.', { cause: error });
};
