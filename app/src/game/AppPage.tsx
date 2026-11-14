// /m/:machineId — any published machine as a standalone checkout: the same island in the game's visual language,
// a pay button that places a REAL order from a sponsored testnet session, and the same Portal sequence.
import { useEffect, useMemo, useRef, useState } from 'react';
import { submitOrder, finishOrder, pendingOrder, canPay, fundingMessage } from '../lib/orders';
import { api } from '../api';
import type { MachineDoc, OrderResult, TxRef } from '../api/types';
import { addRow, recordNearEffects, ensureSession, getState, retryRelay, updateRow, trackPayout, useApp } from '../lib/store';
import { loadLimits, useLimits } from '../lib/limits';
import { navigate } from '../lib/router';
import { describe, hasPortal, price, PREVIEW_RECIPIENT, type Machine } from '../lib/machine';
import { eth, isEvmAddress, near, shortAddr } from '../lib/units';
import { createWorld, type World } from './world';
import { displayName, flowFromEffects, liveKind } from './model';
import { ModePills, PortalCard, Tx, usePortalSync } from './hud';
import './game.css';
import './jobs/jobs.css';
import { Face } from './jobs/Face';
import { checkPortalGas, portalAdmission, checkoutRecipient, checkoutPortalRoutes } from './jobs/portalPreflight';
import { approvalIntent, submitApproval, finishApproval } from '../lib/approvals';
import { PEOPLE, CHI_EVM, isJobMachine, shopPeople } from './jobs/jobs';

type Loaded = { doc: MachineDoc; owner: string; vaults: Record<string, string> };
type Receipt = { result: OrderResult; at: number; recipient?: string; payoutId?: string; approved?: TxRef; approveErr?: string };
const DEMO_RECIPIENT = CHI_EVM;

export function AppPage({ machineId }: { machineId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const session = useApp(s => s.session);
  const sessionError = useApp(s => s.sessionError);
  const { limits, error: limitsError } = useLimits();
  const [m, setM] = useState<Loaded | null | 'loading' | { error: string }>('loading');
  const [contract, setContract] = useState<{ contractId: string; portalAddress: string; explorer: string } | null>(null);
  const [recipient, setRecipient] = useState(() => { const to = new URLSearchParams(location.search).get('to') ?? ''; return checkoutRecipient(machineId,to,DEMO_RECIPIENT); });
  const suggestion = new URLSearchParams(location.search).get('to');
  const [expiryAllowed,setExpiryAllowed]=useState<Record<string,boolean>>({});
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const receiptKey=`ww-receipts-${api.mode}-${machineId}`;
  const [receipts, setReceipts] = useState<Receipt[]>(()=>{try{return JSON.parse(localStorage.getItem(receiptKey) ?? '[]');}catch{return [];}});
  useEffect(()=>{localStorage.setItem(receiptKey,JSON.stringify(receipts));for(const r of receipts)if(!r.result.observation)finishOrder(r.result.orderId);},[receipts]);

  useEffect(() => {
    const w = createWorld(canvasRef.current!, tagsRef.current!, {
      variant: 'app',
      margins: (w0, h0, portrait) => (portrait || w0 < 900 ? { t: 64, b: Math.round(h0 * 0.52) + 8, l: 4, r: 4 } : { t: 70, b: 30, l: 20, r: 440 }),
    });
    setWorld(w);
    return () => w.dispose();
  }, []);

  const reload = () => api.getMachine(machineId).then(r => setM(r), e => setM({ error: (e as Error).message }));
  useEffect(() => {
    void reload();
    void loadLimits();
    api.contractInfo().then(setContract, () => setContract(null));
  }, [machineId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loaded = m && typeof m === 'object' && 'doc' in m ? m : null;
  const machine = loaded ? (loaded.doc.machine as Machine) : null;
  const total = machine ? BigInt(price(machine)) : 0n;
  const fee = limits ? BigInt(limits.orderFee) : null;
  const jobShop = isJobMachine(machineId);
  const ownShop = machineId.startsWith('shop-');
  const people = machine && loaded && jobShop ? shopPeople(machine, loaded.owner) : [];
  const portal = machine ? hasPortal(machine) : false;
  const preview = useMemo(() => { if (!loaded) return null; try { return api.preview(loaded.doc, portal ? PREVIEW_RECIPIENT : undefined); } catch { return null; } }, [loaded, portal]);
  const rules = useMemo(() => (machine && loaded ? describe(machine, loaded.owner) : []), [machine, loaded]);
  const recipientOk = !portal || isEvmAddress(recipient);
  const workerRole = loaded && session ? Object.entries(loaded.doc.workers).find(([, a]) => a === session.accountId)?.[0] : undefined;

  useEffect(() => {
    if (!world || !machine) return;
    const types = new Set(Object.values(machine.nodes).map(p => p.type));
    const vaultNode = Object.values(machine.nodes).find(p => p.type === 'Vault') as { name: string } | undefined;
    let vaultY = 0n;
    for (const e of preview?.effects ?? []) if (e.kind === 'vault') vaultY += BigInt(e.amount);
    const share = total > 0n ? Number((vaultY * 100n) / total) / 100 : 0;
    const sinks = ['Vault', 'Portal', 'Payout'].filter(t => types.has(t as never)).length;
    world.setParts({ splitter: types.has('Splitter') || sinks > 1, vault: types.has('Vault'), portal: types.has('Portal'), payout: types.has('Payout'), vaultShare: share, splitLabel: types.has('Splitter') ? `${Math.round(share * 100)}% kept` : 'routes', priceLabel: `${near(total)} NEAR`, vaultName: vaultNode?.name });
  }, [world, machine, preview, total]);

  const pay = async (resend = false) => {
    if (!machine || paying || (!recipientOk && !pendingOrder()) || !world) return;
    setPaying(true); setErr(null);
    world.callRealCustomer(liveKind() === 'mock' ? 'you · MOCK' : 'you · REAL');
    try {
      const s = await ensureSession();
      if (!s) throw new Error(getState().sessionError ?? 'No testnet account yet. Retry to try again.');
      const rec = pendingOrder()?.recipient ?? (portal ? recipient.trim() : undefined);
      if(!pendingOrder() && (!fee || !canPay(await api.balance(),total,fee))) throw Error(fundingMessage);
      if(portal && (!pendingOrder() || resend)) {
        const freshLimits=await loadLimits(true);if(!freshLimits)throw Error('Cannot read Portal limits. Retry before paying.');
        const info=await api.contractInfo();setContract(info);
        const routes=checkoutPortalRoutes(machine);
        let budget=BigInt(freshLimits.epochRemainingWei);
        for(const route of routes) {
          portalAdmission(route.wei,route.fee,{...freshLimits,epochRemainingWei:String(budget)});
          budget-=BigInt(route.wei)+21000n*100_000_000_000n;
          if(api.mode==='live')await checkPortalGas(info.portalAddress,rec!,route.wei,fetch,'The recipient’s');
        }
      }
      const result = await submitOrder(machineId,false,rec,r=>{setErr('Outcome unknown — checking…');if(r) setReceipts(rs=>[{result:r,at:Date.now()},...rs.filter(x=>x.result.orderId!==r.orderId)]);},{resend});
      setErr(null);
      recordNearEffects(result);
      addRow({ kind: 'order', orderId:result.orderId, title: `Bought from ${displayName(machineId)}`, detail: [`machine ${machineId}`, ...(fee !== null ? [`price ${near(total)} + storage fee ${near(fee)}`] : [])], amount: near(fee !== null ? total + fee : total), status: result.observation === 'unknown' ? 'unknown' : 'confirmed', statusText: result.observation === 'unknown' ? 'sent · outcome unknown' : 'confirmed', tx: result.tx });
      let payoutId: string | undefined;
      if (result.observation === 'unknown') world.realCustomerLeave();
      else {
        world.payReal(flowFromEffects(result.orderId, liveKind(), result.effects, total, result.pending));
        for (const e of result.effects) {
          if (e.kind !== 'external') continue;
          payoutId = e.payoutId;
          const row = addRow({ kind: 'payout', title: 'Portal → Sepolia', detail: [`to ${shortAddr(e.recipient)}`], amount: eth(e.wei), unit: 'ETH', status: 'pending', statusText: 'signing on NEAR', tx: result.tx, payoutId: e.payoutId });
          trackPayout(e.payoutId, row);
        }
      }
      setReceipts(r => [{ result, at: Date.now(), recipient: rec, payoutId }, ...r.filter(x=>x.result.orderId!==result.orderId)]);
      void reload();
    } catch (e) {
      world.realCustomerLeave();
      setErr((e as Error).message || 'The payment did not go through.');
    }
    setPaying(false);
  };

  useEffect(()=>{if(machine && world && pendingOrder()?.machineId===machineId) void pay();},[machine,world]);

  const approve = async (orderId: string, action:'approve'|'expire'='approve') => {
    try {
      const res = await submitApproval(machineId, orderId,action);
      const tx = (res as { tx?: TxRef }).tx ?? (res as unknown as TxRef);
      const effects = (res as { effects?: OrderResult['effects'] }).effects ?? [];
      if(res.observation === 'unknown') {
        const row=addRow({kind:'approve',title:`Approval submitted for ${orderId}`,status:'unknown',statusText:'Submitted — result not confirmed yet',tx});
        setReceipts(rs=>rs.map(r=>r.result.orderId===orderId?{...r,result:{...r.result,observation:'unknown'},approved:tx}:r));
        void row;return;
      }
      recordNearEffects({orderId,tx,pending:res.pending,effects:[...(receipts.find(r=>r.result.orderId===orderId)?.result.effects ?? []),...effects],trace:[]});
      world?.releaseHeld();
      for (const e of effects) {
        if (e.kind !== 'external') continue;
        const row = addRow({ kind: 'payout', title: 'Portal → Sepolia', detail: [`to ${shortAddr(e.recipient)}`], amount: eth(e.wei), unit: 'ETH', status: 'pending', statusText: 'signing on NEAR', tx, payoutId: e.payoutId });
        trackPayout(e.payoutId, row);
      }
      addRow({ kind: 'approve', title: `Approved order ${orderId}`, status: 'confirmed', statusText: 'confirmed', tx });
      const pid = effects.find(e => e.kind === 'external') as { payoutId: string } | undefined;
      setReceipts(rs => {const next=rs.map(r => (r.result.orderId === orderId ? { ...r, result:{...r.result,pending:res.pending,observation:undefined,resolution:res.pending?'pending' as const:action==='expire'?'expired' as const:'approved' as const,effects:[...r.result.effects,...effects]}, approved: tx, payoutId: r.payoutId ?? pid?.payoutId } : r));localStorage.setItem(receiptKey,JSON.stringify(next));finishApproval(machineId,orderId);return next;});
      void reload();
    } catch (e) { setReceipts(rs => rs.map(r => (r.result.orderId === orderId ? { ...r, approveErr: (e as Error).message } : r))); }
  };

  useEffect(()=>{
    const unresolved=receipts.filter(r=>approvalIntent(machineId,r.result.orderId) || (r.approved && r.result.observation==='unknown'));
    if(!unresolved.length)return;
    let cancelled=false;
    const timer=setInterval(async()=>{
      for(const receipt of unresolved) {
        try {
          const found=await api.getOrder(machineId,receipt.result.orderId);
          if(cancelled || !found || !['approved','expired'].includes(found.resolution ?? ''))continue;
          const approvalTx=approvalIntent(machineId,found.orderId)?.tx;
          recordNearEffects(found);
          for(const effect of found.effects)if(effect.kind==='external') {
            const existing=getState().ledger.find(r=>r.payoutId===effect.payoutId);
            const row=existing?.id ?? addRow({kind:'payout',title:'Portal → Sepolia',status:'pending',payoutId:effect.payoutId,tx:receipt.approved});trackPayout(effect.payoutId,row);
          }
          for(const row of getState().ledger)if(row.kind==='approve' && row.tx?.hash===receipt.approved?.hash)updateRow(row.id,{status:'confirmed',statusText:found.resolution==='expired'?'Expired — refund transfer requested':'Approval observed on chain'});
          setReceipts(rs=>{const next=rs.map(r=>r.result.orderId===found.orderId?{...r,approved:r.approved ?? approvalTx,result:{...found,tx:r.result.tx},payoutId:found.effects.find(e=>e.kind==='external')?.payoutId}:r);localStorage.setItem(receiptKey,JSON.stringify(next));finishApproval(machineId,found.orderId);return next;});
        } catch {}
      }
    },2000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[receipts,machineId]);

  useEffect(()=>{
    const check=async()=>{for(const r of receipts)if(r.result.pending && api.expiry) {
      try{const e=await api.expiry(machineId,r.result.orderId);setExpiryAllowed(v=>({...v,[r.result.orderId]:e.eligible}));}catch{setExpiryAllowed(v=>({...v,[r.result.orderId]:false}));}
    }};
    void check();const timer=setInterval(check,10000);return()=>clearInterval(timer);
  },[receipts,machineId]);
  const retryReads=()=>{void reload();void loadLimits(true);if(sessionError)void ensureSession();api.contractInfo().then(setContract,()=>setContract(null));};

  const vaultTotal = loaded ? Object.values(loaded.vaults).reduce((a, v) => a + BigInt(v), 0n) : 0n;
  const shares = (preview?.effects ?? []).map(e => ({
    label: e.kind === 'vault' ? `kept in “${e.name}”` : e.kind === 'payout' ? (e.account === '$payer' ? 'back to you' : `to ${shortAddr(e.account)}`) : 'Portal fee → Sepolia',
    amount: BigInt(e.kind === 'external' ? e.fee : e.amount), tone: e.kind,
  }));

  return (
    <div className="ww-game ww-app" data-testid="app-page">
      <canvas ref={canvasRef} className="world" aria-label={`3D view of ${displayName(machineId)}`} />
      <div ref={tagsRef} className="tags" aria-hidden />
      <div className="vignette" />
      <header className="g-app-top">
        <button type="button" className="g-app-brand" onClick={() => navigate('/')}><img src="/brand/mark-64.png" alt="" width="32" height="32" /><span>Built in <b>WORLDWORKS</b></span></button>
        <span className="sp" />
        <ModePills />
      </header>

      <aside className="g-checkout g-card" data-testid="checkout">
        {m === 'loading' && <p className="g-muted">Reading the machine from {api.mode === 'mock' ? 'the mock API' : 'NEAR testnet'}…</p>}
        {(!m || (typeof m === 'object' && 'error' in m)) && (
          <div data-testid="app-missing">
            <h1>No machine called “{machineId}”.</h1>
            <p className="g-muted">{m && 'error' in m ? `Could not read it: ${m.error}` : 'It may not be published yet, or the address is mistyped.'}</p>
            <button type="button" className="btn" onClick={()=>void reload()}>Retry</button><button type="button" className="btn" onClick={() => navigate('/')}>Build one in the game</button>
          </div>
        )}
        {loaded && machine && (
          <>
            <p className="g-eyebrow">Standalone app · runs on NEAR testnet</p>
            <h1 data-testid="app-title"><span data-testid="shop-title">{ownShop ? 'A WORLDWORKS shop' : jobShop ? "Ada’s bakery" : displayName(machineId)}</span></h1>
            {jobShop && <><p>{ownShop ? 'A shop built in WORLDWORKS. Pay 0.10 NEAR → it pays these people automatically.' : 'This is Ada’s bakery. Pay 0.10 NEAR → it splits automatically.'}</p><ul className="g-shop-people" data-testid="shop-people">{people.map(e => <li key={e.key}><Face id={e.face} size={28} /><b>{e.name}</b> · {e.pct}% {e.how === 'eth' ? `pays the Portal → Sepolia ETH${ownShop ? '' : ' to Chi'}` : e.how === 'after' ? 'after delivery' : 'on NEAR'}</li>)}</ul></>}
            <div className="g-price-row"><b data-testid="app-price">{near(total)}</b><span>NEAR</span></div>
            {shares.length > 0 && !preview?.pending && (
              <>
                <div className="g-share-bar" aria-hidden>{shares.map((s, i) => <i key={i} className={`g-seg ${s.tone}`} style={{ flexGrow: Number((s.amount * 1000n) / (total || 1n)) || 1 }} />)}</div>
                <ul className="g-share-legend">{shares.map((s, i) => <li key={i}><i className={`g-seg ${s.tone}`} />{near(s.amount)} {s.label}</li>)}</ul>
              </>
            )}
            <div className="g-line"><span>Price</span><span className="mono">{near(total)} NEAR</span></div>
            <details><summary>Payment details · total {fee !== null ? near(total + fee) : '…'} NEAR</summary>
            <div className="g-line"><span>Storage fee <small>kept by the contract</small></span><span className="mono">{fee !== null ? `${near(fee)} NEAR` : limitsError ? 'unknown' : '…'}</span></div>
            <div className="g-line total"><span>Total</span><span className="mono" data-testid="app-total">{fee !== null ? `${near(total + fee)} NEAR` : `${near(total)} NEAR + fee`}</span></div>
            </details>
            {portal && (
              <label className="g-evm-field">
                <span>Ethereum wallet chosen by the payer</span>
                <small>The payer chooses the Ethereum wallet; {suggestion && isEvmAddress(suggestion) ? `this link suggested ${suggestion}. ${recipient.toLowerCase()!==suggestion.toLowerCase()?'The field differs from the link’s suggestion.':''}` : 'this link did not suggest a valid wallet.'}</small>
                <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x…" spellCheck={false} data-testid="app-recipient" className={recipient && !isEvmAddress(recipient) ? 'bad' : ''} />
                <small>{recipient && !isEvmAddress(recipient) ? 'Not a 0x address with 40 hex characters.' : recipient.toLowerCase() === DEMO_RECIPIENT.toLowerCase() ? 'Chi’s wallet (demo). You can use your own Sepolia wallet.' : `This machine pays ${preview?.effects.filter(e => e.kind === 'external').map(e => `${eth((e as { wei: string }).wei)} Sepolia ETH`).join(', ') || 'Sepolia ETH'} here.`}</small>
              </label>
            )}
            <button type="button" className="btn pay" onClick={()=>void pay()} disabled={paying || !recipientOk || !limits} data-testid="app-pay">
              {paying ? 'Paying on NEAR testnet…' : `Pay ${fee !== null ? near(total + fee) : near(total)} NEAR`}
            </button>
            {(limitsError || sessionError || !contract) && <p role="status">{limitsError ?? sessionError ?? 'Contract details unavailable.'} <button className="g-mini" onClick={retryReads}>Retry</button></p>}
            {pendingOrder()?.machineId===machineId && !paying && <p><button className="g-mini" onClick={()=>void pay()}>Check again</button> <button className="g-mini" onClick={()=>void pay(true)}>Send again with the same order id</button></p>}
            <p className="g-payer g-muted">{session ? <>Paying from <b className="mono">{shortAddr(session.accountId)}</b>, a sponsored testnet account made for this browser. No wallet, no real money.</> : sessionError ? <>Could not create a testnet account: {sessionError}</> : 'A sponsored testnet account is created on your first payment. No wallet.'}</p>
            {err && <p className="warn" role="alert">{err}</p>}

            {receipts.length > 0 && (
              <section className="g-receipts" data-testid="app-receipts">
                {receipts.map(r => <ReceiptView key={r.result.orderId} r={r} world={world} total={total} fee={fee} workerRole={workerRole} onApprove={approve} approvalPending={!!approvalIntent(machineId,r.result.orderId)} expiryAllowed={!!expiryAllowed[r.result.orderId]} onExpire={id=>void approve(id,'expire')} sessionAccount={session?.accountId} />)}
              </section>
            )}

            <details className="g-rules">
              <summary>How this machine works</summary>
              <ol data-testid="rules">{rules.map((l, i) => <li key={i}>{l}</li>)}{fee !== null && <li>Each order also pays a {near(fee)} NEAR storage fee, kept by the contract.</li>}</ol>
              <dl className="g-facts">
                <div><dt>Machine</dt><dd className="mono">{machineId}</dd></div>
                <div><dt>Owner</dt><dd className="mono">{loaded.owner}</dd></div>
                <div><dt>In its vaults</dt><dd className="mono" data-testid="app-vaults">{near(vaultTotal)} NEAR</dd></div>
                {contract && <div><dt>Contract</dt><dd className="mono">{api.mode === 'mock' ? contract.contractId : <a href={`https://testnet.nearblocks.io/address/${contract.contractId}`} target="_blank" rel="noreferrer">{contract.contractId} ↗</a>}</dd></div>}
              </dl>
              <p className="g-muted">Any NEAR account can buy without this page: call <code>submit_order</code> on the contract with exactly price + storage fee attached.</p>
            </details>
          </>
        )}
        <footer className="g-app-foot"><button type="button" className="g-link" onClick={() => navigate('/')}>Built in WORLDWORKS</button> · <button type="button" className="g-link" onClick={() => navigate('/verify')}>What is real here?</button></footer>
      </aside>
    </div>
  );
}

function ReceiptView({ r, world, total, fee, workerRole, onApprove, sessionAccount, onExpire, expiryAllowed, approvalPending }: { r: Receipt; world: World | null; total: bigint; fee: bigint | null; workerRole?: string; onApprove: (id: string) => void; sessionAccount?: string; onExpire:(id:string)=>void; expiryAllowed:boolean; approvalPending:boolean }) {
  usePortalSync(world, r.result.orderId, r.payoutId ?? null);
  const payout=useApp(s=>r.payoutId?s.payouts[r.payoutId]:undefined);
  return (
    <article className="g-receipt" data-testid="app-receipt">
      <header><span className={r.result.observation==='unknown'?'g-neutral-dot':'g-ok-dot'} aria-hidden /><div><b>{r.result.observation === 'unknown' ? 'Submitted — result not confirmed yet' : `Paid ${fee !== null ? near(total + fee) : near(total)} NEAR`}</b><small>order {r.result.orderId} · {new Date(r.at).toLocaleTimeString()}</small></div><Tx tx={r.result.tx} label="NEAR tx" /></header>
      {r.result.observation === 'unknown' && <p className="warn">Submitted — result not confirmed yet. Checking this order before another payment.</p>}
      <ul>
        {r.result.effects.map((e, i) => (
          <li key={i}>
            {e.kind === 'vault' && <>{near(e.amount)} NEAR kept in the “{e.name}” vault</>}
            {e.kind === 'payout' && <>{near(e.amount)} NEAR {e.settled===true?'sent to':e.settled===false?'failed — held for the recipient to claim:':'transfer requested for'} {e.account === sessionAccount ? 'you' : e.account}</>}
            {e.kind === 'external' && <>{near(e.fee)} NEAR Portal fee → {eth(e.wei)} ETH to {shortAddr(e.recipient)} on Sepolia</>}
          </li>
        ))}
        {r.result.pending && !r.approved && !approvalPending && <li className="g-held">The rest is held until the Worker approves.{workerRole && <> You are “{workerRole}”. <button type="button" className="g-mini" onClick={() => onApprove(r.result.orderId)}>Approve as {workerRole}</button></>}</li>}
        {r.result.pending && expiryAllowed && !approvalPending && <li><button className="g-mini" onClick={()=>onExpire(r.result.orderId)}>Refund the customer (time is up)</button></li>}
        {approvalPending && <li>Approval or refund submitted — checking resolution. Reloading keeps this check.</li>}
        {r.result.resolution==='expired' && <li>Expired — refund transfer requested. See transfer status above.</li>}
        {r.approved && <li>{r.result.observation==='unknown'?'Approval submitted — result not confirmed yet.':r.result.resolution==='expired'?'Expired.':'Approved.'} <Tx tx={r.approved} label="approval tx" /></li>}
        {r.approveErr && <li className="warn">Approval failed: {r.approveErr}</li>}
      </ul>
      {r.payoutId && <PortalCard payoutId={r.payoutId} />}
      {r.payoutId && payout?.relayError && payout.status!=='signed' && <p className="g-muted" role="status">{payout.relayError} <button className="g-mini" onClick={()=>retryRelay(r.payoutId!)}>Retry</button></p>}
    </article>
  );
}
