// Tiny global store: session, ledger rows, payout tracking, goals. Survives page switches (pushState routing).
import { useSyncExternalStore } from 'react';
import { api } from '../api';
import type { PayoutView, Session, TxRef } from '../api/types';

export type LedgerRow = {
  id: string;
  kind: 'publish' | 'order' | 'approve' | 'payout' | 'withdraw' | 'session';
  title: string;
  detail?: string[];
  amount?: string;
  unit?: 'NEAR' | 'ETH';
  status: 'confirmed' | 'pending' | 'failed';
  statusText?: string;
  tx?: TxRef;
  evmTx?: TxRef;
  payoutId?: string;
  mock: boolean;
  at: number;
};

export type AppState = {
  session: Session | null;
  sessionError: string | null;
  ledger: LedgerRow[];
  payouts: Record<string, PayoutView & { startedAt: number; stepAt: Record<string, number>; relayError?: string }>;
  goals: { stopLosing: 'todo' | 'preview' | 'done'; payEthereum: 'locked' | 'todo' | 'running' | 'done' };
  keptNote: string;
  sound: boolean;
};

let state: AppState = {
  session: null, sessionError: null, ledger: [], payouts: {},
  goals: { stopLosing: 'todo', payEthereum: 'locked' }, keptNote: '', sound: false,
};
const subs = new Set<() => void>();
export function getState() { return state; }
export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach(f => f());
}
export function useApp<T>(sel: (s: AppState) => T): T {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => sel(state));
}

let sessionPromise: Promise<Session | null> | null = null;
export function ensureSession(): Promise<Session | null> {
  if (!sessionPromise) {
    sessionPromise = api.session().then(
      s => { setState({ session: s, sessionError: null }); if (s.tx) addRow({kind:'session', title:'Sponsored testnet session created',amount:(Number(BigInt(s.balance) / 10n**21n)/1000).toString(),status:'confirmed',tx:s.tx}); return s; },
      e => { setState({ sessionError: (e as Error).message || 'Could not create a testnet account.' }); sessionPromise = null; return null; },
    );
  }
  return sessionPromise;
}

let rowSeq = 0;
export function addRow(row: Omit<LedgerRow, 'id' | 'at' | 'mock'>): string {
  const id = `r${++rowSeq}`;
  setState(s => ({ ledger: [{ ...row, id, at: Date.now(), mock: api.mode === 'mock' }, ...s.ledger] }));
  return id;
}
export function updateRow(id: string, patch: Partial<LedgerRow>) {
  setState(s => ({ ledger: s.ledger.map(r => (r.id === id ? { ...r, ...patch } : r)) }));
}

const statusText: Record<PayoutView['status'], string> = {
  waiting_for_earlier_nonce: 'queued behind an earlier payout', awaiting_signature: 'signing on NEAR', signed: 'signed', broadcast: 'sent to Sepolia', confirmed: 'confirmed', signature_failed: 'signature failed',
};

/** Follow a Portal payout to the end: poll, relay once signed, stop at confirmed/failed. Never claims confirmed early. */
export function trackPayout(payoutId: string, rowId: string, onDone?: (v: PayoutView) => void) {
  if (state.payouts[payoutId] && state.payouts[payoutId].status !== 'signature_failed') return;
  const startedAt = Date.now();
  let relayed = false;
  let stopped = false;
  const put = (v: PayoutView, extra: { relayError?: string } = {}) => {
    setState(s => {
      const prev = s.payouts[payoutId];
      const stepAt = { ...(prev?.stepAt ?? { awaiting_signature: startedAt }) };
      if (!stepAt[v.status]) stepAt[v.status] = Date.now();
      const relayError = v.status === 'signed' ? extra.relayError ?? prev?.relayError : undefined;
      return { payouts: { ...s.payouts, [payoutId]: { ...v, startedAt, stepAt, relayError } } };
    });
    updateRow(rowId, {
      status: v.status === 'confirmed' ? 'confirmed' : v.status === 'signature_failed' ? 'failed' : 'pending',
      statusText: statusText[v.status], evmTx: v.evmTx, tx: v.nearTx ?? undefined,
    });
  };
  const tick = async () => {
    if (stopped) return;
    try {
      let v = await api.getPayout(payoutId);
      if (v.status === 'signed' && !relayed) {
        relayed = true;
        put(v);
        try { v = await api.relay(payoutId); }
        catch (e) { relayed = false; put(v, { relayError: (e as Error).message }); }
      }
      if (v.status === 'signed' || v.status === 'waiting_for_earlier_nonce') relayed = false;
      put(v);
      if (v.status === 'confirmed' || v.status === 'signature_failed') { stopped = true; onDone?.(v); return; }
    } catch { /* transient read error: keep polling */ }
    setTimeout(tick, api.mode === 'mock' ? 700 : 2000);
  };
  setState(s => ({ payouts: { ...s.payouts, [payoutId]: { payoutId, status: 'awaiting_signature', recipient: '', wei: '0', portalAddress: '', nonce: 0, startedAt, stepAt: { awaiting_signature: startedAt } } } }));
  void tick();
}

export function retryRelay(payoutId: string) {
  const row = state.ledger.find(r => r.payoutId === payoutId);
  if (state.payouts[payoutId]?.status === 'signature_failed' && row) { trackPayout(payoutId, row.id); return; }
  setState(s => ({ payouts: { ...s.payouts, [payoutId]: { ...s.payouts[payoutId], relayError: undefined } } }));
  api.relay(payoutId).catch(e => setState(s => ({ payouts: { ...s.payouts, [payoutId]: { ...s.payouts[payoutId], relayError: (e as Error).message } } })));
}
