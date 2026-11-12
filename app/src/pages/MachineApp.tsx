// /m/:machineId: the machine as a standalone payment page. It reads the published machine from the API,
// explains the rules in plain words generated from the machine JSON, and pays through api.order.
// It deliberately does not look like the game: one colour, one mark, generous whitespace.
import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { MachineDoc, OrderResult } from '../api/types';
import { describe, hasPortal, price, PREVIEW_RECIPIENT, type Machine } from '../lib/machine';
import { addRow, ensureSession, trackPayout, useApp } from '../lib/store';
import { loadLimits, useLimits } from '../lib/limits';
import { linkProps } from '../lib/router';
import { eth, isEvmAddress, near, shortAddr } from '../lib/units';
import { MockBadge, TxLink } from '../components/bits';
import { PortalSteps } from '../components/PortalSteps';
import { PartArt } from '../components/PartArt';

type Loaded = { doc: MachineDoc; owner: string; vaults: Record<string, string> };
type Receipt = { result: OrderResult; at: number; recipient?: string; approvedTx?: OrderResult['tx'] };

const KNOWN: Record<string, string> = { lemonade: 'Lemonade Machine', escrow: 'Escrow with an Inspector', vending: 'Cross-chain Vending', 'cross-chain-vending': 'Cross-chain Vending' };
export function displayName(id: string): string {
  const head = Object.keys(KNOWN).sort((a, b) => b.length - a.length).find(k => id === k || id.startsWith(`${k}-`));
  if (head) return KNOWN[head];
  return id.replace(/[-_]+/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export function MachineApp({ machineId }: { machineId: string }) {
  const session = useApp(s => s.session);
  const sessionError = useApp(s => s.sessionError);
  const { limits, error: limitsError } = useLimits();
  const [m, setM] = useState<Loaded | null | 'loading' | { error: string }>('loading');
  const [contract, setContract] = useState<{ contractId: string; portalAddress: string; explorer: string } | null>(null);
  const [recipient, setRecipient] = useState('');
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  const reload = () => api.getMachine(machineId).then(r => setM(r), e => setM({ error: (e as Error).message }));
  useEffect(() => {
    void reload();
    void ensureSession().then(() => loadLimits());
    api.contractInfo().then(setContract, () => setContract(null));
  }, [machineId]); // eslint-disable-line react-hooks/exhaustive-deps

  const machine = m && typeof m === 'object' && 'doc' in m ? (m.doc.machine as Machine) : null;
  const total = machine ? BigInt(price(machine)) : 0n;
  const fee = limits ? BigInt(limits.orderFee) : null;
  const portal = machine ? hasPortal(machine) : false;
  const preview = useMemo(() => {
    if (!machine || typeof m !== 'object' || !m || !('doc' in m)) return null;
    try { return api.preview(m.doc, portal ? PREVIEW_RECIPIENT : undefined); } catch { return null; }
  }, [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = useMemo(() => (machine ? describe(machine, (m as Loaded).owner) : []), [m]); // eslint-disable-line react-hooks/exhaustive-deps
  const recipientOk = !portal || isEvmAddress(recipient);
  const workerRole = machine && session && typeof m === 'object' && m && 'doc' in m
    ? Object.entries(m.doc.workers).find(([, acct]) => acct === session.accountId)?.[0] : undefined;

  const pay = async () => {
    if (!machine || paying || !recipientOk) return;
    setPaying(true); setErr(null);
    try {
      const s = await ensureSession();
      if (!s) throw new Error('No testnet account yet. Reload to try again.');
      const rec = portal ? recipient.trim() : undefined;
      const result = await api.order(machineId, rec);
      addRow({ kind: 'order', title: `Bought from ${displayName(machineId)}`, detail: [`machine ${machineId}`, ...(fee !== null ? [`price ${near(total)} + storage fee ${near(fee)}`] : [])], amount: near(fee !== null ? total + fee : total), status: 'confirmed', statusText: 'confirmed', tx: result.tx });
      for (const e of result.effects) {
        if (e.kind !== 'external') continue;
        const row = addRow({ kind: 'payout', title: 'Portal → Sepolia', detail: [`to ${shortAddr(e.recipient)}`], amount: eth(e.wei), unit: 'ETH', status: 'pending', statusText: 'signing on NEAR', tx: result.tx, payoutId: e.payoutId });
        trackPayout(e.payoutId, row);
      }
      setReceipts(r => [{ result, at: Date.now(), recipient: rec }, ...r]);
      void reload();
    } catch (e) {
      setErr((e as Error).message || 'The payment did not go through.');
    }
    setPaying(false);
  };

  const approve = async (orderId: string) => {
    try {
      const tx = await api.approve(machineId, orderId);
      setReceipts(rs => rs.map(r => (r.result.orderId === orderId ? { ...r, approvedTx: tx } : r)));
      void reload();
    } catch (e) { setErr((e as Error).message); }
  };

  if (m === 'loading') return <Shell machineId={machineId}><div className="app-loading">Reading the machine from {api.mode === 'mock' ? 'the mock API' : 'NEAR testnet'}…</div></Shell>;
  if (!m || 'error' in m) {
    return (
      <Shell machineId={machineId}>
        <section className="app-missing">
          <h1>No machine called “{machineId}”.</h1>
          <p>{m && 'error' in m ? `Could not read it: ${m.error}` : 'It may not be published yet, or the address is mistyped.'}</p>
          <a className="app-btn ghost" {...linkProps('/')}>Build one in the workshop</a>
        </section>
      </Shell>
    );
  }

  const vaultTotal = Object.values(m.vaults).reduce((a, v) => a + BigInt(v), 0n);
  const shares = (preview?.effects ?? []).map(e => ({
    label: e.kind === 'vault' ? `kept in “${e.name}”` : e.kind === 'payout' ? (e.account === '$payer' ? 'back to you' : `to ${shortAddr(e.account)}`) : 'Portal fee',
    amount: BigInt(e.kind === 'external' ? e.fee : e.amount),
    tone: e.kind === 'vault' ? 'vault' : e.kind === 'payout' ? 'payout' : 'portal',
  }));

  return (
    <Shell machineId={machineId} contractId={contract?.contractId}>
      <section className="app-hero">
        <div className="app-info">
          <p className="eyebrow">Payment page · NEAR testnet</p>
          <h1 data-testid="app-title">{displayName(machineId)}</h1>
          <p className="app-price"><b data-testid="app-price">{near(total)}</b> <span>NEAR</span></p>
          {shares.length > 0 && !preview?.pending && (
            <div className="share-bar" aria-label="Where each payment goes">
              {shares.map((s, i) => <i key={i} className={`seg ${s.tone}`} style={{ flexGrow: Number(s.amount * 1000n / (total || 1n)) || 1 }} title={`${near(s.amount)} NEAR ${s.label}`} />)}
            </div>
          )}
          {shares.length > 0 && !preview?.pending && (
            <ul className="share-legend">
              {shares.map((s, i) => <li key={i}><i className={`seg ${s.tone}`} />{near(s.amount)} {s.label}</li>)}
            </ul>
          )}
          <h2>How it works</h2>
          <ol className="rules" data-testid="rules">
            {lines.map((l, i) => <li key={i}>{l}</li>)}
            {fee !== null && <li>Each order also pays a {near(fee)} NEAR storage fee, kept by the contract to store the order.</li>}
          </ol>
          <dl className="facts">
            <div><dt>Machine</dt><dd className="mono">{machineId}</dd></div>
            <div><dt>Owner</dt><dd className="mono">{m.owner}</dd></div>
            <div><dt>In its vaults</dt><dd className="mono" data-testid="app-vaults">{near(vaultTotal)} NEAR</dd></div>
            {contract && <div><dt>Runs on</dt><dd className="mono">{api.mode === 'mock' ? contract.contractId : <a href={`https://testnet.nearblocks.io/address/${contract.contractId}`} target="_blank" rel="noreferrer">{contract.contractId} ↗</a>}</dd></div>}
          </dl>
        </div>

        <aside className="checkout" data-testid="checkout">
          <div className="checkout-head"><PartArt type="CoinSlot" size={40} /><b>Checkout</b></div>
          <div className="line"><span>Price</span><span className="mono">{near(total)} NEAR</span></div>
          <div className="line"><span>Storage fee <small>kept by the contract</small></span><span className="mono">{fee !== null ? `${near(fee)} NEAR` : limitsError ? 'unknown' : '…'}</span></div>
          <div className="line total"><span>Total</span><span className="mono" data-testid="app-total">{fee !== null ? `${near(total + fee)} NEAR` : `${near(total)} NEAR + fee`}</span></div>
          {portal && (
            <label className="evm-field">
              <span>Your Ethereum address <small>Sepolia testnet</small></span>
              <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x…" spellCheck={false} data-testid="app-recipient" className={recipient && !isEvmAddress(recipient) ? 'bad' : ''} />
              <small>{recipient && !isEvmAddress(recipient) ? 'That is not a 0x address with 40 hex characters.' : `This machine pays ${preview?.effects.filter(e => e.kind === 'external').map(e => `${eth((e as { wei: string }).wei)} Sepolia ETH`).join(', ') || 'Sepolia ETH'} to this address.`}</small>
            </label>
          )}
          <button type="button" className="app-btn" onClick={pay} disabled={paying || !session || !recipientOk} data-testid="app-pay">
            {paying ? 'Paying on NEAR testnet…' : `Pay ${fee !== null ? near(total + fee) : near(total)} NEAR`}
          </button>
          <p className="payer">
            {session ? <>Paying from <b className="mono">{session.accountId}</b>, a testnet account made for this browser. No wallet, no real money.</> : sessionError ? <>Could not create a testnet account: {sessionError}</> : 'Creating a testnet account for this browser…'}
          </p>
          {err && <p className="app-err" role="alert">{err}</p>}
        </aside>
      </section>

      {receipts.length > 0 && (
        <section className="app-receipts" data-testid="app-receipts">
          <h2>Your receipts</h2>
          {receipts.map(r => (
            <article key={r.result.orderId} className="app-receipt">
              <header>
                <span className="ok-dot" />
                <div><b>Paid {fee !== null ? near(total + fee) : near(total)} NEAR</b><small>order {r.result.orderId} · {new Date(r.at).toLocaleTimeString()}</small></div>
                <TxLink tx={r.result.tx} label="NEAR receipt" />
              </header>
              <ul>
                {r.result.effects.map((e, i) => (
                  <li key={i}>
                    {e.kind === 'vault' && <>{near(e.amount)} NEAR kept in the “{e.name}” vault</>}
                    {e.kind === 'payout' && <>{near(e.amount)} NEAR paid to {e.account === session?.accountId ? 'you' : e.account}</>}
                    {e.kind === 'external' && <>{near(e.fee)} NEAR Portal fee → {eth(e.wei)} ETH to {shortAddr(e.recipient)} on Sepolia</>}
                  </li>
                ))}
                {r.result.pending && !r.approvedTx && <li className="held">The rest is held until the Worker approves.{workerRole && <> You are “{workerRole}”. <button type="button" className="app-btn small" onClick={() => approve(r.result.orderId)}>Approve as {workerRole}</button></>}</li>}
                {r.approvedTx && <li>Approved. <TxLink tx={r.approvedTx} label="approval receipt" /></li>}
              </ul>
              {r.result.effects.filter(e => e.kind === 'external').map(e => <PortalSteps key={(e as { payoutId: string }).payoutId} payoutId={(e as { payoutId: string }).payoutId} compact />)}
            </article>
          ))}
        </section>
      )}

      <section className="app-dev">
        <details>
          <summary>For developers: call this machine without this page</summary>
          <p>Any NEAR account can buy by calling the contract directly. Attach exactly price + storage fee{fee !== null ? ` (${near(total + fee)} NEAR)` : ''}.</p>
          <pre className="mono">{`near contract call-function as-transaction ${contract?.contractId ?? '<contract>'} submit_order \\
  json-args '{"machine_id":"${machineId}","order_id":"<unique id>"${portal ? ',"external_recipient":"0x<your address>"' : ''}}' \\
  prepaid-gas '300.0 Tgas' attached-deposit '${fee !== null ? near(total + fee) : '<price + fee>'} NEAR' \\
  sign-as <your-account>.testnet network-config testnet sign-with-keychain send`}</pre>
          <p>The machine itself, exactly as published:</p>
          <pre className="mono json">{JSON.stringify(m.doc.machine, null, 2)}</pre>
        </details>
      </section>
    </Shell>
  );
}

function Shell({ machineId, contractId, children }: { machineId: string; contractId?: string; children: React.ReactNode }) {
  return (
    <div className="app-page" data-testid="app-page">
      <header className="app-top">
        <a className="app-mark" href={`/m/${encodeURIComponent(machineId)}`} onClick={e => e.preventDefault()}>
          <span className="mark-dot" aria-hidden /> {displayName(machineId)}
        </a>
        <div className="sp" />
        <MockBadge compact />
        <span className="app-pill">testnet</span>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-foot">
        <span>Built with <a {...linkProps('/')}>worldworks</a>, a testnet prototype.{contractId ? ` Contract ${contractId}.` : ''}</span>
        <a {...linkProps('/verify')}>What is real here?</a>
      </footer>
    </div>
  );
}

