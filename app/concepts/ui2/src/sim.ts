// Simulated customers, routed by the real engine (same wasm the contract and the app use).
// Nothing here touches a chain. In the shipped game this module is replaced, per real order,
// by WorldworksApi.preview (local) and WorldworksApi.customerOrder / getPayout / relay (testnet).
import init, { validate, preview_order } from '../../../src/engine/pkg/worldworks_engine_wasm.js';

export const COIN_YOCTO = 10n ** 22n; // one visible coin = 0.01 NEAR
export const PRICE = '100000000000000000000000'; // 0.10 NEAR
export const PORTAL_WEI = '100000000000000'; // 0.0001 Sepolia ETH
const PREVIEW_RECIPIENT = '0x0000000000000000000000000000000000000001';

export const LEMONADE = {
  portal_cap_wei: PORTAL_WEI,
  nodes: {
    slot: { type: 'CoinSlot', price: PRICE, output: 'split' },
    split: { type: 'Splitter', outputs: [{ bps: 7000, target: 'reserve' }, { bps: 3000, target: 'portal' }] },
    reserve: { type: 'Vault', name: 'reserve' },
    portal: { type: 'Portal', chain: 'sepolia', wei: PORTAL_WEI },
  },
};

export type SimOrder = { vaultCoins: number; portalCoins: number; vaultYocto: bigint; feeYocto: bigint; wei: bigint; trace: string[] };

let ready = false;
export async function bootEngine(): Promise<void> {
  await init();
  const v = JSON.parse(validate(JSON.stringify(LEMONADE)));
  if (!v.ok) throw new Error('Lemonade machine invalid: ' + JSON.stringify(v.errors));
  ready = true;
}

export function simulateOrder(): SimOrder {
  if (!ready) throw new Error('engine not ready');
  const out = JSON.parse(preview_order(JSON.stringify(LEMONADE), PRICE, PREVIEW_RECIPIENT));
  if (out.ok === false) throw new Error(JSON.stringify(out.errors));
  let vaultYocto = 0n, feeYocto = 0n, wei = 0n;
  for (const e of out.effects) {
    if (e.VaultCredit) vaultYocto += BigInt(e.VaultCredit.amount);
    if (e.ExternalPayout) { feeYocto += BigInt(e.ExternalPayout.fee); wei += BigInt(e.ExternalPayout.wei); }
  }
  return { vaultCoins: Number(vaultYocto / COIN_YOCTO), portalCoins: Number(feeYocto / COIN_YOCTO), vaultYocto, feeYocto, wei, trace: out.trace };
}

export const fmtNear = (y: bigint) => (Number(y / 10n ** 18n) / 1e6).toFixed(2);
export const fmtEth = (w: bigint) => (Number(w / 10n ** 10n) / 1e8).toFixed(4);
