import { api, apiFallbackReason } from '../api';
import type { TxRef } from '../api/types';
import { shortHash } from '../lib/units';

/** Explorer link. In mock mode the hash is fabricated, so it is shown as text, never as a link. */
export function TxLink({ tx, label, mock }: { tx?: TxRef; label?: string; mock?: boolean }) {
  if (!tx || !tx.hash || tx.hash === 'preview') return null;
  const isMock = mock ?? api.mode === 'mock';
  if (isMock || !tx.explorerUrl) return <span className="tx mock" title="Fabricated by the mock API; not on any chain">{label ?? shortHash(tx.hash, 4, 4)} <i>mock</i></span>;
  return <a className="tx" href={tx.explorerUrl} target="_blank" rel="noreferrer">{label ?? shortHash(tx.hash, 4, 4)} ↗</a>;
}

export function MockBadge({ compact }: { compact?: boolean }) {
  if (api.mode !== 'mock') return null;
  const why = apiFallbackReason();
  return (
    <div className={`mock-badge ${compact ? 'compact' : ''}`} role="status" data-testid="mock-badge" title={why || 'No contract configured (VITE_CONTRACT_ID unset). Nothing here touches a chain; hashes are fabricated.'}>
      <b>MOCK DATA</b>{!compact && <span>no chain calls · fake hashes</span>}
    </div>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 30 30" width="30" height="30" aria-hidden><rect x="1" y="4" width="28" height="25" rx="8" fill="var(--color-ink)" /><rect x="1" y="1" width="28" height="25" rx="8" fill="var(--color-coin)" /><circle cx="11" cy="13" r="2.4" fill="var(--color-ink)" /><circle cx="19" cy="13" r="2.4" fill="var(--color-ink)" /><path d="M11 19 q4 3 8 0" stroke="var(--color-ink)" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>
      worldworks
    </span>
  );
}

export function Elapsed({ since, until }: { since: number; until?: number }) {
  const s = Math.max(0, Math.floor(((until ?? Date.now()) - since) / 1000));
  return <span className="elapsed">{s}s</span>;
}
