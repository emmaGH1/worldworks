// HUD pieces shared by the game (/) and the standalone machine app (/m/:id).
import { useEffect, useState } from 'react';
import { api, apiFallbackReason } from '../api';
import type { PayoutStatus, TxRef } from '../api/types';
import { useApp, retryRelay, type LedgerRow } from '../lib/store';
import { eth, near, shortAddr, shortHash } from '../lib/units';
import type { World } from './world';
import { phaseOf } from './model';

export function useTick(on: boolean, ms = 500) {
  const [, set] = useState(0);
  useEffect(() => { if (!on) return; const t = setInterval(() => set(x => x + 1), ms); return () => clearInterval(t); }, [on, ms]);
}

/** Explorer link. Mock hashes are fabricated: shown as text with a MOCK tag, never linked. */
export function Tx({ tx, label }: { tx?: TxRef; label: string }) {
  if (!tx || !tx.hash || tx.hash === 'preview') return null;
  if (api.mode === 'mock' || !tx.explorerUrl) return <span className="txl mock" title="Fabricated by the mock API; not on any chain">{label} {shortHash(tx.hash)} <i>mock</i></span>;
  return <a className="txl" href={tx.explorerUrl} target="_blank" rel="noreferrer">{label} {shortHash(tx.hash)} ↗</a>;
}

export function ModePills({ sim }: { sim?: boolean }) {
  return (
    <>
      {api.mode === 'mock' && (
        <span className="g-pill mock" data-testid="mock-badge" role="status" title={apiFallbackReason() || 'No contract configured (VITE_CONTRACT_ID unset). Nothing touches a chain; hashes are fabricated.'}>
          <i />MOCK DATA<em>no chain · fake hashes</em>
        </span>
      )}
      {sim && (
        <span className="g-pill sim" title="Customers here are simulated in your browser by the same wasm engine the contract uses. Nothing simulated touches a chain or the ledger.">
          <i />SIMULATED<em>customers · browser engine</em>
        </span>
      )}
      {api.mode === 'live' && <span className="g-pill live" title="Real transactions on NEAR testnet and Sepolia"><i />TESTNET<em>real txs</em></span>}
    </>
  );
}

const COPY: Record<PayoutStatus, { title: string; sub: string }> = {
  awaiting_signature: { title: 'NEAR network signing…', sub: 'NEAR Chain Signatures (MPC) is signing the Sepolia payment · usually ~15 s' },
  waiting_for_signature: { title: 'NEAR network signing…', sub: 'the MPC signature is not back yet · usually ~15 s' },
  signed: { title: 'Signed · handing to the relayer…', sub: 'the relayer only broadcasts the signed bytes; it cannot change them' },
  waiting_for_earlier_nonce: { title: 'Queued behind an earlier payout…', sub: 'Portal payouts go out in nonce order' },
  broadcast: { title: 'Sent to Sepolia · waiting for 3 blocks…', sub: 'waiting for inclusion plus 3 more blocks on two RPCs · usually ~15–45 s' },
  confirmed: { title: 'Confirmed on Sepolia', sub: '' },
  signature_failed: { title: 'Signature failed · no ETH was sent', sub: 'the signature request did not complete; you can retry it' },
};

/** The Portal sequence, driven only by PayoutView.status from getPayout/relay. */
export function PortalCard({ payoutId }: { payoutId: string }) {
  const p = useApp(s => s.payouts[payoutId]);
  const live = !!p && p.status !== 'confirmed' && p.status !== 'signature_failed';
  useTick(live);
  if (!p) return null;
  const now = Date.now();
  const since = (t?: number, until?: number) => (t ? Math.max(0, Math.floor(((until ?? now) - t) / 1000)) : 0);
  const stepStart = p.stepAt[p.status] ?? p.startedAt;
  const c = COPY[p.status] ?? { title: p.status, sub: '' };
  const rpcs = p.confirmations?.length ?? 0;
  const steps: { k: string; label: string; on: boolean; done: boolean }[] = [
    { k: 'sign', label: 'signing', on: ['awaiting_signature', 'waiting_for_signature'].includes(p.status), done: !!p.stepAt.signed || ['signed', 'broadcast', 'confirmed', 'waiting_for_earlier_nonce'].includes(p.status) },
    { k: 'signed', label: 'signed', on: p.status === 'signed' || p.status === 'waiting_for_earlier_nonce', done: ['broadcast', 'confirmed'].includes(p.status) },
    { k: 'beam', label: 'on Sepolia', on: p.status === 'broadcast', done: p.status === 'confirmed' },
    { k: 'ok', label: 'confirmed', on: false, done: p.status === 'confirmed' },
  ];
  return (
    <div className={`g-portal-card st-${p.status}`} data-testid="portal-card" data-status={p.status} aria-live="polite">
      <div className="pc-head">
        <span className={`pc-orb ${live ? 'spin' : ''}`} aria-hidden />
        <div>
          <b data-testid="portal-title">{p.readFailed?'Cannot read payout status':p.stalled?'Payout stalled — check again':c.title}{live && <span className="secs" data-testid="portal-secs"> {since(stepStart)}s</span>}</b>
          <small>{p.status === 'confirmed' ? `${p.wei && p.wei !== '0' ? `${eth(p.wei)} ETH` : 'the payment'} to ${shortAddr(p.recipient)}${rpcs >= 2 ? ` · seen by ${rpcs} RPCs, 3+ blocks deep` : ''} · ${since(p.startedAt, p.stepAt.confirmed)}s total` : p.waitingPayoutId ? `Waiting behind payout #${p.waitingPayoutId}; this payment will pay after it clears.` : c.sub}</small>
        </div>
      </div>
      {(p.stalled || p.readFailed) && <p role="status">Background checks continue. <button className="g-mini" onClick={()=>retryRelay(payoutId)}>Retry</button></p>}
      <ol className="pc-steps">{steps.map(s => <li key={s.k} className={`${s.done ? 'done' : ''} ${s.on ? 'on' : ''}`}><i />{s.label}</li>)}</ol>
      <div className="pc-links">
        <Tx tx={p.nearTx} label="NEAR tx" />
        <Tx tx={p.evmTx} label="Sepolia tx" />
      </div>
      {p.relayError && p.status === 'signed' && <div className="pc-warn">Relay problem: {p.relayError} <button type="button" className="g-mini" onClick={() => retryRelay(payoutId)}>Try broadcasting again</button></div>}
      {p.status === 'signature_failed' && <button type="button" className="g-mini" onClick={() => retryRelay(payoutId)}>Retry the signature</button>}
      {api.mode === 'mock' && <div className="pc-mock">MOCK: timings imitate testnet, hashes are fake.</div>}
    </div>
  );
}

/** Pushes PayoutView.status into the world's Portal. The world never advances the Portal on its own. */
export function usePortalSync(world: World | null, flowKey: string | null, payoutId: string | null) {
  const status = useApp(s => (payoutId ? s.payouts[payoutId]?.status : undefined));
  useEffect(() => { if (world && flowKey && payoutId) world.setPortal(flowKey, phaseOf(status)); }, [world, flowKey, payoutId, status]);
  return status;
}

function ago(t: number) { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`; }

function LRow({ r }: { r: LedgerRow }) {
  return (
    <li className={`lr ${r.status}`} data-testid={`ledger-${r.kind}`} data-status={r.status}>
      <div className="lr-main"><b>{r.title}</b>{r.mock && <em className="g-mock-tag">mock</em>}<span className="lr-amt">{r.amount ? `${r.amount} ${r.unit ?? 'NEAR'}` : ''}</span></div>
      <div className="lr-sub">
        <Tx tx={r.tx} label="NEAR" />{r.evmTx && <Tx tx={r.evmTx} label="Sepolia" />}
        <span className={`lr-st ${r.status}`}>{r.statusText ?? r.status}</span><span className="lr-ago">{ago(r.at)}</span>
      </div>
    </li>
  );
}

export function LedgerPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows = useApp(s => s.ledger);
  const session = useApp(s => s.session);
  useTick(open, 5000);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [open, onClose]);
  if (!open) return null;
  return (
    <aside className="ledger g-card" data-testid="ledger" aria-label="Ledger">
      <header><b>Ledger</b><small>{api.mode === 'mock' ? 'mock API · not on chain' : 'real testnet transactions only'}</small><button type="button" className="g-x" onClick={onClose} aria-label="Close ledger">×</button></header>
      {session && <div className="lr-acct">you: <b>{session.accountId}</b> · sponsored testnet account, no wallet</div>}
      {rows.length ? <ul>{rows.map(r => <LRow key={r.id} r={r} />)}</ul> : <p className="lr-empty">Nothing real yet. Simulated customers never appear here; run a real order to see transactions with explorer links.</p>}
    </aside>
  );
}

export const fmtNear = near;
