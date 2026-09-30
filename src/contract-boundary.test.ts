// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('contract/src/nightline.compact'), 'utf8');

test('contract has two provable circuits and genuine private witnesses', () => {
  expect(source).toContain('witness localSecretKey()');
  expect(source).toContain('witness privatePulse()');
  expect(source).toContain('export circuit submitPulse()');
  expect(source).toContain('export circuit rotateWorkerKey()');
});

test('contract documents deliberate disclosures and replay prevention', () => {
  expect(source).toContain('usedNullifiers');
  expect(source).toContain('pulse already submitted');
  expect(source.match(/disclose\(/g)?.length).toBeGreaterThanOrEqual(8);
  expect(source).toContain('disclose() is deliberate');
});
