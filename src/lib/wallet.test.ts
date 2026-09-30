import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { discoverWallets } from './wallet';

const wallet = (name: string, rdns: string, apiVersion = '4.0.1'): InitialAPI => ({
  name,
  rdns,
  apiVersion,
  icon: 'data:image/png;base64,AA==',
  connect: vi.fn(),
});

test('discovers UUID-keyed wallet providers and prefers 1AM', () => {
  window.midnight = {
    '0f108166-0fe8-4f8d-9578-81c1de7db100': wallet('Midnight Wallet', 'wallet.example'),
    '1599fc53-fdf1-453e-a0c8-831d5f249100': wallet('1AM', 'xyz.oneam.wallet'),
  };
  expect(discoverWallets().map((entry) => entry.name)).toEqual(['1AM', 'Midnight Wallet']);
});

test('ignores incompatible connector API versions', () => {
  window.midnight = {
    old: wallet('Old wallet', 'wallet.old', '3.0.0'),
    current: wallet('1AM', 'xyz.oneam.wallet'),
  };
  expect(discoverWallets()).toHaveLength(1);
});
