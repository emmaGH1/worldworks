// Contract limits the UI must show honestly: every order costs price + order storage fee, and publishing
// attaches a storage deposit. The live adapter exposes them through the optional `limits()` method that
// specs/G4b-adopt-g5.md adds to WorldworksApi; until types.ts has it, we read it defensively here.
import { useSyncExternalStore } from 'react';
import { api } from '../api';
import type { Yocto } from '../api/types';

export type Limits = { orderFee: Yocto; publishDeposit: Yocto; rate: string; epochBudgetWei: string; epochRemainingWei: string; maxWeiPerPayout?: string };
type WithLimits = { limits?: () => Promise<Limits> };

let current: Limits | null = null;
let error: string | null = null;
let loading: Promise<Limits | null> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

export function loadLimits(force = false): Promise<Limits | null> {
  if (loading && !force) return loading;
  const fn = (api as unknown as WithLimits).limits;
  if (typeof fn !== 'function') { error = 'This API build does not report contract limits yet.'; emit(); return Promise.resolve(null); }
  loading = fn().then(
    l => { current = l; error = null; emit(); return l; },
    e => { error = (e as Error).message || 'Could not read contract limits.'; loading = null; emit(); return null; },
  );
  return loading;
}

export function useLimits(): { limits: Limits | null; error: string | null } {
  const l = useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => current);
  const e = useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => error);
  return { limits: l, error: e };
}

export const getLimits = () => current;

/** Smallest NEAR inflow the contract accepts for a Portal paying `wei` (wei × rate), or null when unknown. */
export function minPortalFee(wei: string, l: Limits | null = current): bigint | null {
  if (!l) return null;
  try { return BigInt(wei) * BigInt(l.rate); } catch { return null; }
}
