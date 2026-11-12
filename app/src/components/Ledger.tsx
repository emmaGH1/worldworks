import { AnimatePresence, motion } from 'motion/react';
import { useApp, type LedgerRow } from '../lib/store';
import { TxLink } from './bits';
import { near } from '../lib/units';
import { api } from '../api';

function ago(t: number) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

const ICON: Record<LedgerRow['kind'], string> = { session: '●', withdraw: '●', publish: '⬆', order: '●', approve: '✓', payout: '◎' };

export function Row({ r }: { r: LedgerRow }) {
  return (
    <div className={`lrow ${r.status} k-${r.kind}`} data-testid={`ledger-${r.kind}`} data-status={r.status}>
      <div className="ic">{r.status === 'confirmed' ? <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5l3.2 3.2L14 5.5" /></svg> : <span>{ICON[r.kind]}</span>}</div>
      <div className="mid">
        <div className="t">{r.title}{r.mock && <em className="mock-tag">mock</em>}</div>
        {r.detail?.map(d => <div key={d} className="d">{d}</div>)}
        <div className="s"><TxLink tx={r.tx} mock={r.mock} />{r.evmTx && <> · <TxLink tx={r.evmTx} mock={r.mock} label="Sepolia tx" /></>} · {ago(r.at)}</div>
      </div>
      <div className="amt">{r.amount && <>{r.amount} {r.unit ?? 'NEAR'}</>}<small>{(r.statusText ?? r.status).toUpperCase()}</small></div>
    </div>
  );
}

export function LedgerPeek({ onOpen }: { onOpen: () => void }) {
  const rows = useApp(s => s.ledger);
  if (!rows.length) return null;
  return (
    <div className="ledger-peek card" data-testid="ledger-peek">
      <header><b>Ledger</b><span className="tn">testnet</span><button type="button" className="link" onClick={onOpen}>see all ({rows.length}) ›</button></header>
      {rows.slice(0, 2).map(r => <Row key={r.id} r={r} />)}
    </div>
  );
}

export function LedgerDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows = useApp(s => s.ledger);
  const session = useApp(s => s.session);
  return (
    <AnimatePresence>
      {open && (
        <motion.aside className="ledger-drawer" initial={{ x: 460 }} animate={{ x: 0 }} exit={{ x: 460 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }} data-testid="ledger-drawer">
          <header>
            <div><h2>Ledger</h2><p>Every transaction this session{api.mode === 'mock' ? ', from the mock API (not on chain)' : ', with its explorer link'}.</p></div>
            <button type="button" className="x" onClick={onClose} aria-label="Close ledger">×</button>
          </header>
          {session && (
            <div className="acct">
              <span>You</span><b>{session.accountId}</b><small>{near(session.balance)} NEAR at start · testnet money</small>
            </div>
          )}
          <div className="rows">
            {rows.length ? rows.map(r => <Row key={r.id} r={r} />) : <p className="empty">Nothing yet. Serve a customer to see real transactions here.</p>}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
