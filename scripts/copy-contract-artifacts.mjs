import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('contract/src/managed/nightline');
const publicDirectory = resolve('public');

if (!existsSync(resolve(source, 'keys')) || !existsSync(resolve(source, 'zkir'))) {
  throw new Error('Compiled contract artifacts are missing. Run npm run contract:compile first.');
}

await mkdir(publicDirectory, { recursive: true });
await Promise.all([
  cp(resolve(source, 'keys'), resolve(publicDirectory, 'keys'), { recursive: true, force: true }),
  cp(resolve(source, 'zkir'), resolve(publicDirectory, 'zkir'), { recursive: true, force: true }),
]);
