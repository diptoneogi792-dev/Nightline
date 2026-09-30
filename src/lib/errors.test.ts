import { classifyError } from './errors';

test('maps DUST failures to a student-readable state', () => {
  const error = classifyError(new Error('BalanceCheckOverspend: insufficient DUST'));
  expect(error.kind).toBe('insufficient-dust');
  expect(error.message).toContain('DUST');
});

test('does not describe an unknown failure as a successful transaction', () => {
  const error = classifyError(new Error('unexpected transport state'));
  expect(error.kind).toBe('unknown');
  expect(error.message).toContain('No result was recorded');
});
