import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import semver from 'semver';
import type { WalletSummary } from './types';

const isOneAm = (wallet: Pick<WalletSummary, 'name' | 'rdns'>): boolean => {
  const nameMatches = /(?:^|\s)1\s*am(?:\s+wallet)?(?:$|\s)/i.test(wallet.name.trim());
  const rdnsMatches = /(?:^|[._-])(?:1am|oneam)(?:[._-]|$)/i.test(wallet.rdns);
  return nameMatches || rdnsMatches;
};

export const discoverWallets = (): Array<WalletSummary & { api: InitialAPI }> => {
  const entries = Object.entries(window.midnight ?? {});
  return entries
    .filter(([, api]) => (
      api
      && typeof api === 'object'
      && typeof api.connect === 'function'
      && semver.satisfies(api.apiVersion, '4.x')
    ))
    .map(([providerId, api]) => ({
      providerId,
      name: String(api.name).slice(0, 80),
      rdns: String(api.rdns).slice(0, 120),
      apiVersion: api.apiVersion,
      api,
    }))
    .sort((a, b) => (
      Number(isOneAm(b)) - Number(isOneAm(a))
      || a.name.localeCompare(b.name)
    ));
};
