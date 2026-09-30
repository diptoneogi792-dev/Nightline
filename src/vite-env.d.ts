/// <reference types="vite/client" />

import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

declare global {
  interface Window {
    midnight?: Record<string, InitialAPI>;
  }

  interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    readonly VITE_PROOF_SERVER_URL?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
