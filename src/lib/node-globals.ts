import { Buffer } from 'buffer';

// Midnight's browser dependency graph includes modules that read Node's
// Buffer global. Install the browser implementation before loading them.
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
