import {
  loadAnswers,
  loadDeployment,
  loadOrCreatePrivateState,
  rotatePrivateState,
  saveAnswers,
  saveDeployment,
} from './storage';

test('persists private pulse answers on this device', () => {
  saveAnswers({ workload: 4, belonging: 3, energy: 2, note: 'Book an adviser appointment' });
  expect(loadAnswers()).toEqual({ workload: 4, belonging: 3, energy: 2, note: 'Book an adviser appointment' });
});

test('keeps deployment receipts isolated by network', () => {
  saveDeployment({
    network: 'preview',
    contractAddress: 'a'.repeat(64),
    transactionHash: 'b'.repeat(64),
    transactionId: 'c'.repeat(64),
    blockHeight: 42,
    deployedAt: '2026-09-28T00:00:00.000Z',
  });
  expect(loadDeployment('preview')?.blockHeight).toBe(42);
  expect(loadDeployment('preprod')).toBeNull();
});

test('rotating private state promotes the staged key and replaces it', () => {
  const initial = loadOrCreatePrivateState();
  const staged = Array.from(initial.nextSecretKey);
  const rotated = rotatePrivateState(initial);
  expect(Array.from(rotated.secretKey)).toEqual(staged);
  expect(Array.from(rotated.nextSecretKey)).not.toEqual(staged);
});
