/// <reference types="vite/client" />
// Picks the API implementation once at startup.
// live.ts (written separately) is loaded lazily and only when VITE_CONTRACT_ID is set; if it does not
// exist yet, import.meta.glob returns nothing and we fall back to the mock, which the UI labels "MOCK DATA".
import init from '../engine/pkg/worldworks_engine_wasm.js';
import { mockApi } from './mock.js';
import type { WorldworksApi } from './types.js';
import type { Limits } from '../lib/limits.js';

/** Optional methods added by specs/G4b-adopt-g5.md; read defensively until types.ts carries them. */
type Extras = { limits?: () => Promise<Limits> };

export type { WorldworksApi } from './types.js';

let impl: WorldworksApi = mockApi;
let fallbackReason = '';

const liveModules = import.meta.env ? import.meta.glob('./live.ts') : {};

function pickLive(mod: Record<string, unknown>): WorldworksApi | null {
  const isApi = (x: unknown): x is WorldworksApi => !!x && typeof x === 'object' && typeof (x as WorldworksApi).order === 'function';
  for (const key of ['default', 'liveApi', 'api']) if (isApi(mod[key])) return mod[key] as WorldworksApi;
  for (const key of ['createLiveApi', 'default']) {
    const f = mod[key];
    if (typeof f === 'function') { try { const made = (f as () => unknown)(); if (isApi(made)) return made; } catch { /* fall through */ } }
  }
  return null;
}

/** Call once before rendering: loads the wasm engine (validate/preview are synchronous) and the live adapter if configured. */
export async function initApi(): Promise<WorldworksApi> {
  await init();
  if (import.meta.env.VITE_CONTRACT_ID) {
    const loader = liveModules['./live.ts'];
    if (!loader) fallbackReason = 'VITE_CONTRACT_ID is set but the live adapter is not in this build.';
    else {
      try {
        const live = pickLive((await loader()) as Record<string, unknown>);
        if (live) impl = live;
        else fallbackReason = 'The live adapter did not export an API.';
      } catch (e) {
        if(/dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|Failed to load module script/i.test(String(e))) throw e;
        fallbackReason = `The live adapter failed to load: ${(e as Error).message}`;
      }
    }
  }
  if (fallbackReason) console.warn(`[worldworks] using MOCK data. ${fallbackReason}`);
  return impl;
}

export const apiFallbackReason = () => fallbackReason;

/** Stable facade so modules can import `api` before initApi() resolves. */
export const api: WorldworksApi & Required<Extras> = {
  get mode() { return impl.mode; },
  session: () => impl.session(),
  getUnclaimed: () => impl.getUnclaimed?.() ?? Promise.resolve('0'),
  withdrawVault: (id, name, amount) => impl.withdrawVault?.(id, name, amount) ?? Promise.reject(Error('Vault withdrawal unavailable')),
  withdrawUnclaimed: () => impl.withdrawUnclaimed?.() ?? Promise.reject(Error('Withdrawal unavailable')),
  validate: doc => impl.validate(doc),
  preview: (doc, recipient) => impl.preview(doc, recipient),
  publish: (id, doc) => impl.publish(id, doc),
  getMachine: id => impl.getMachine(id),
  order: (id, recipient, orderId) => impl.order(id, recipient, orderId),
  customerOrder: (id, orderId, recipient) => impl.customerOrder(id, orderId, recipient),
  approve: (id, orderId) => impl.approve(id, orderId),
  expiry: (id, orderId) => impl.expiry?.(id, orderId) ?? Promise.reject(Error('Expiry unavailable')),
  expire: (id, orderId) => impl.expire?.(id, orderId) ?? Promise.reject(Error('Expiry unavailable')),
  balance: () => impl.balance(),
  getOrder: (id, orderId) => impl.getOrder(id,orderId),
  retrySignature: id => impl.retrySignature?.(id) ?? Promise.resolve(),
  getPayout: id => impl.getPayout(id),
  relay: id => impl.relay(id),
  contractInfo: () => impl.contractInfo(),
  limits: () => {
    const f = (impl as WorldworksApi & Extras).limits;
    return typeof f === 'function' ? f.call(impl) : Promise.reject(new Error('This API build does not report contract limits yet.'));
  },
};
