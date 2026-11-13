// Glue between WorldworksApi results and the world: effects -> coins, status -> Portal phase.
import type { OrderResult, PayoutStatus } from '../api/types';
import { api } from '../api';
import { lemonadeBroken, lemonadeFixed, price, PREVIEW_RECIPIENT, toDoc, type Machine } from '../lib/machine';
import { COIN_YOCTO, type Flow, type FlowKind, type PortalPhase } from './world';

export const liveKind = (): FlowKind => (api.mode === 'mock' ? 'mock' : 'real');

/** Coins for one order. 1 coin = 0.01 NEAR, coarser for big prices so an order stays ≤ ~24 coins. */
export function flowFromEffects(key: string, kind: FlowKind, effects: OrderResult['effects'], priceYocto: bigint, pending: boolean): Flow {
  let vaultYocto = 0n, feeYocto = 0n, payoutYocto = 0n, wei = 0n, payoutTo: string | undefined;
  for (const e of effects) {
    if (e.kind === 'vault') vaultYocto += BigInt(e.amount);
    else if (e.kind === 'payout') { payoutYocto += BigInt(e.amount); payoutTo = payoutTo ?? e.account; }
    else { feeYocto += BigInt(e.fee); wei += BigInt(e.wei); }
  }
  const total = priceYocto > 0n ? priceYocto : vaultYocto + feeYocto + payoutYocto;
  const unit = total / COIN_YOCTO > 24n ? (total / 20n || 1n) : COIN_YOCTO;
  const coins = (y: bigint) => (y > 0n ? Math.max(1, Math.round(Number((y * 100n) / unit) / 100)) : 0);
  const heldYocto = pending ? total - vaultYocto - feeYocto - payoutYocto : 0n;
  return { key, kind, vault: coins(vaultYocto), portal: coins(feeYocto), payout: coins(payoutYocto), held: coins(heldYocto > 0n ? heldYocto : 0n), vaultYocto, feeYocto, payoutYocto, wei, priceYocto: total, payoutTo };
}

let simSeq = 0;
export function simFlow(m: Machine): Flow | null {
  try {
    const r = api.preview(toDoc(m, {}), PREVIEW_RECIPIENT);
    if (r.trace.some(t => t.startsWith('error'))) return null;
    return flowFromEffects(`sim-${++simSeq}`, 'sim', r.effects, BigInt(price(m)), r.pending);
  } catch { return null; }
}

export const levelMachine = (fixed: boolean): Machine => (fixed ? lemonadeFixed() : lemonadeBroken());

export function phaseOf(s: PayoutStatus | undefined): PortalPhase {
  if (s === 'broadcast') return 'beam';
  if (s === 'confirmed') return 'pop';
  if (s === 'signature_failed') return 'failed';
  return 'swirl';
}

/** FNV-1a, 8 hex chars. The machine id is unique per session account and per machine content. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
export function machineIdFor(m: Machine, account: string): string {
  const acct = account.split('.')[0].replace(/[^a-z0-9]/g, '').slice(-12) || 'guest';
  return `lemon-${fnv(JSON.stringify(m))}-${acct}`;
}

export function displayName(id: string): string {
  if (/^lemon(ade)?(-|$)/.test(id)) return 'Lemonade Stand';
  if (/^escrow(-|$)/.test(id)) return 'Escrow with an Inspector';
  if (/^(cross-chain-)?vending(-|$)/.test(id)) return 'Cross-chain Vending';
  return id.replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
}
