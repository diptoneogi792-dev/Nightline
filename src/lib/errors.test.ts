import { classifyError } from './errors';

test('maps DUST failures to a student-readable state', () => {
  const error = classifyError(new Error('BalanceCheckOverspend: insufficient DUST'));
  expect(error.kind).toBe('insufficient-dust');
  expect(error.message).toContain('DUST');
});

test('does not describe an unknown failure as a successful transaction', () => {
  const error = classifyError(new Error('unexpected transport state'));
  expect(error.kind).toBe('unknown');
  expect(error.message).toContain('did not finish');
  expect(error.detail).toContain('unexpected transport state');
});

test('preserves the original diagnostic when an already-classified error is caught again', () => {
  const original = classifyError(new Error('provider handshake failed'));

  expect(classifyError(original)).toBe(original);
  expect(original.detail).toContain('provider handshake failed');
});

test('hides endpoint URLs from diagnostics shown in the app', () => {
  const error = classifyError(new Error('request failed at https://proof.example/private/path?token=secret'));

  expect(error.detail).not.toContain('proof.example');
  expect(error.detail).not.toContain('secret');
});
