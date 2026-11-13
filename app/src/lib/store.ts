// Tiny global store: session, ledger rows, payout tracking, goals. Survives page switches (pushState routing).
import { useSyncExternalStore } from 'react';
import { api } from '../api/index.js';
import type { PayoutView, Session, TxRef } from '../api/types.js';

export type LedgerRow = {
  id: string;
  kind: 'publish' | 'order' | 'approve' | 'payout' | 'withdraw' | 'session';
  title: string;
  detail?: string[];
  amount?: string;
  unit?: 'NEAR' | 'ETH';
  status: 'confirmed' | 'pending' | 'failed' | 'unknown';
  statusText?: string;
  tx?: TxRef;
  evmTx?: TxRef;
  payoutId?: string;
  orderId?: string;
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
  try { localStorage.setItem(`ww-ledger-${api.mode}`,JSON.stringify(state.ledger)); } catch {}
  subs.forEach(f => f());
}
export function subscribeState(listener:()=>void) { subs.add(listener);return()=>{subs.delete(listener);}; }
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

let rowSeq = Date.now();
export function addRow(row: Omit<LedgerRow, 'id' | 'at' | 'mock'>): string {
  const existing=state.ledger.find(r=>(row.payoutId && r.payoutId===row.payoutId) || (row.kind==='order' && row.orderId && r.kind==='order' && r.orderId===row.orderId));
  if(existing) {updateRow(existing.id,row);return existing.id;}
  const id = `r${++rowSeq}`;
  setState(s => ({ ledger: [{ ...row, id, at: Date.now(), mock: api.mode === 'mock' }, ...s.ledger] }));
  return id;
}
export function updateRow(id: string, patch: Partial<LedgerRow>) {
  setState(s => ({ ledger: s.ledger.map(r => (r.id === id ? { ...r, ...patch } : r)) }));
}

const statusText: Record<PayoutView['status'], string> = {
  waiting_for_signature: 'waiting for signature', waiting_for_earlier_nonce: 'queued behind an earlier payout', awaiting_signature: 'signing on NEAR', signed: 'signed', broadcast: 'sent to Sepolia', confirmed: 'confirmed', signature_failed: 'signature failed',
};

/** Follow a Portal payout to the end: poll, relay once signed, stop at confirmed/failed. Never claims confirmed early. */
const active = new Set<string>();
const retries = new Map<string,{count:number;at:number}>();
export async function advancePayout(id:string):Promise<PayoutView> {
  let v = await api.getPayout(id);
  const retry = retries.get(id) ?? {count:0,at:Date.now()};
  retries.set(id,retry);
  if ((v.status === 'signature_failed' || v.retryEligible) && retry.count < 2 && Date.now()-retry.at >= 15000) {
    retry.count++; retry.at=Date.now();
    await api.retrySignature?.(id);
    v=await api.getPayout(id);
  }
  if(v.status === 'signed') v=await api.relay(id);
  return v;
}
export function trackPayout(payoutId:string,rowId:string,onDone?:(v:PayoutView)=>void) {
  if(active.has(payoutId)) return;
  active.add(payoutId);
  let failures=0;
  const startedAt=state.payouts[payoutId]?.startedAt ?? Date.now();
  const tick=async()=>{
    try {
      const v=await advancePayout(payoutId);
      if(v.status === 'waiting_for_earlier_nonce' && v.waitingPayoutId && v.waitingPayoutId !== payoutId) await advancePayout(v.waitingPayoutId);
      failures=0;
      setState(s=>({payouts:{...s.payouts,[payoutId]:{...v,startedAt,stepAt:{...s.payouts[payoutId]?.stepAt,[v.status]:s.payouts[payoutId]?.stepAt[v.status] ?? Date.now()}}}}));
      updateRow(rowId,{status:v.status === 'confirmed'?'confirmed':'pending',statusText:v.status === 'waiting_for_earlier_nonce'?`waiting for an earlier payout #${v.waitingPayoutId}`:statusText[v.status],evmTx:v.evmTx,...(v.nearTx?.hash?{tx:v.nearTx}:{})});
      if(v.status === 'confirmed') {active.delete(payoutId);onDone?.(v);return;}
    } catch {
      if(++failures>=5) {
        const message="Can't read the payout status right now";
        updateRow(rowId,{status:'unknown',statusText:message});
        setState(s=>({payouts:{...s.payouts,[payoutId]:{...s.payouts[payoutId],relayError:message}}}));
        active.delete(payoutId);return;
      }
    }
    setTimeout(tick,api.mode==='mock'?700:2000);
  };
  if(!state.payouts[payoutId]) setState(s=>({payouts:{...s.payouts,[payoutId]:{payoutId,status:'awaiting_signature',recipient:'',wei:'0',portalAddress:'',nonce:0,startedAt,stepAt:{awaiting_signature:startedAt}}}}));
  void tick();
}
const manualRetries=new Set<string>();
export function retryRelay(id:string) {
  const row=state.ledger.find(r=>r.payoutId===id);
  if(row && state.payouts[id]?.status==='signature_failed' && api.retrySignature) {
    if(manualRetries.has(id))return;
    manualRetries.add(id);
    void api.retrySignature(id).then(()=>trackPayout(id,row.id)).catch(error=>setState(s=>({payouts:{...s.payouts,[id]:{...s.payouts[id],relayError:(error as Error).message}}}))).finally(()=>manualRetries.delete(id));
    return;
  }
  if(row) trackPayout(id,row.id);
}
export function restoreLedger() {
  try {
    const ledger=JSON.parse(localStorage.getItem(`ww-ledger-${api.mode}`) ?? '[]') as LedgerRow[];
    setState({ledger});
    for(const row of ledger) if(row.payoutId && row.status!=='confirmed') trackPayout(row.payoutId,row.id);
  } catch {}
}

// Surviving integration surface for the jobs UI. Acknowledge only after persisting its run/receipt.
export { submitOrder, pendingOrder, finishOrder, canPay, GAS_MARGIN } from './orders.js';
