import { useEffect, useState } from 'react';
import { useApp, retryRelay } from '../lib/store';
import { TxLink } from './bits';
import { eth, shortAddr } from '../lib/units';
import { api } from '../api';
import type { PayoutStatus } from '../api/types';

const ORDER: PayoutStatus[] = ['awaiting_signature', 'signed', 'broadcast', 'confirmed'];

/**
 * The cross-chain wait, shown honestly: four states straight from PayoutView.status, each with its explorer
 * link once it exists. "Confirmed" appears only when the API says confirmed; then both receipts are shown,
 * one on each chain, so anyone can check the payment without trusting this page.
 */
export function PortalSteps({ payoutId, compact }: { payoutId: string; compact?: boolean }) {
  const p = useApp(s => s.payouts[payoutId]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!p || p.status === 'confirmed' || p.status === 'signature_failed') return;
    const t = setInterval(() => tick(x => x + 1), 500);
    return () => clearInterval(t);
  }, [p?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  const failed = p.status === 'signature_failed';
  const queued = p.status === 'waiting_for_earlier_nonce';
  const idx = queued ? 1 : failed ? 0 : Math.max(0, ORDER.indexOf(p.status));
  const done = idx >= 3;
  const now = Date.now();
  const secs = (from?: number, to?: number) => (from ? Math.max(0, Math.round(((to ?? now) - from) / 1000)) : 0);
  const at = p.stepAt;
  const amount = p.wei && p.wei !== '0' ? `${eth(p.wei)} ETH` : 'the payment';

  const steps = [
    {
      key: 'sign', title: 'Signing on NEAR', done: idx >= 1, active: idx === 0 && !failed,
      sub: failed ? 'The signature request failed. No ETH was sent.' : idx === 0 ? `the contract built the Sepolia payment; NEAR Chain Signatures is signing it · usually ~15 s · ${secs(at.awaiting_signature)}s` : `signed in ${secs(at.awaiting_signature, at.signed)}s`,
      link: <TxLink tx={p.nearTx} label="NEAR tx" />,
    },
    {
      key: 'signed', title: 'Signed', done: idx >= 2, active: idx === 1,
      sub: queued ? `Queued behind an earlier payout (${p.waitingPayoutId}). Retrying automatically…` : idx === 1 ? (p.relayError ? `Relay problem: ${p.relayError}` : 'handing the signed bytes to the relayer, which only broadcasts…') : idx > 1 ? 'MPC signature returned to the contract' : 'waiting for the signature',
      extra: idx === 1 && p.relayError ? <button type="button" className="mini" onClick={() => retryRelay(payoutId)}>Try broadcasting again</button> : null,
    },
    {
      key: 'sent', title: 'Broadcast to Sepolia', done: idx >= 3, active: idx === 2,
      sub: idx === 2 ? `waiting for a Sepolia block · usually ~12 s · ${secs(at.broadcast)}s` : idx > 2 ? `mined in ${secs(at.broadcast, at.confirmed)}s` : 'not sent yet',
      link: idx >= 2 ? <TxLink tx={p.evmTx} label="Sepolia tx" /> : null,
    },
    {
      key: 'ok', title: 'Confirmed', done, active: false,
      sub: done ? `${amount} reached ${shortAddr(p.recipient)} on Sepolia` : 'only shown once the Sepolia receipt says success',
    },
  ];

  return (
    <div className={`portal-steps ${compact ? 'compact' : ''} ${failed ? 'failed' : ''} ${done ? 'confirmed' : ''}`} data-testid="portal-steps" data-status={p.status}>
      <div className="track"><div className="fill" style={{ width: `${failed ? 0 : (idx / 3) * 100}%` }} /></div>
      <ol>
        {steps.map(s => (
          <li key={s.key} className={`${s.done ? 'done' : ''} ${s.active ? 'active' : ''}`}>
            <span className="dot">{s.done ? <Check /> : s.active ? <i /> : null}</span>
            <div><b>{s.title}</b><small>{s.sub}</small>{(s.link || s.extra) && <div className="links">{s.link}{s.extra}</div>}</div>
          </li>
        ))}
      </ol>
      {failed && <button type="button" className="mini" onClick={() => retryRelay(payoutId)}>Retry payout signature</button>}
      {!done && !failed && secs(p.startedAt) > 60 && <button type="button" className="mini" onClick={() => retryRelay(payoutId)}>Retry payout</button>}
      {done && (
        <div className="receipts" data-testid="receipts">
          <div className="receipt near">
            <span className="chain">NEAR testnet</span>
            <b>Contract asked for the signature</b>
            <TxLink tx={p.nearTx} label="NEAR receipt" />
          </div>
          <div className="receipt sepolia">
            <span className="chain">Sepolia</span>
            <b>{amount} arrived · nonce {p.nonce}</b>
            <TxLink tx={p.evmTx} label="Sepolia receipt" />
          </div>
          <p className="receipt-note">{api.mode === 'mock' ? 'Mock data: these hashes are made up and link nowhere.' : `Two receipts on two chains. Paid from the Portal treasury ${shortAddr(p.portalAddress)}; check both yourself.`}</p>
        </div>
      )}
      {done && !compact && <Confetti />}
    </div>
  );
}

function Check() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.3l2.3 2.3L9.6 3.6" /></svg>;
}

function Confetti() {
  const bits = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div className="confetti" aria-hidden>
      {bits.map(i => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 40}ms`, background: i % 3 === 0 ? 'var(--color-portal)' : i % 3 === 1 ? 'var(--color-coin)' : 'var(--color-confirmed)', ['--r' as string]: `${i * 29}deg` }} />)}
    </div>
  );
}
