// WORLDWORKS game (/): Level 1 fix a leaking Lemonade stand (simulated), Level 2 one REAL order whose Portal
// pays the supplier on Sepolia. Simulated things never enter the ledger; real things always carry explorer links.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { TxRef } from '../api/types';
import { addRow, ensureSession, getState, trackPayout, updateRow, useApp } from '../lib/store';
import { loadLimits } from '../lib/limits';
import { navigate } from '../lib/router';
import { eth, near } from '../lib/units';
import { price, toDoc, type Machine } from '../lib/machine';
import { createWorld, type Anchor, type Focus, type World } from './world';
import { flowFromEffects, levelMachine, liveKind, machineIdFor, simFlow } from './model';
import { LedgerPanel, ModePills, PortalCard, Tx, usePortalSync, useTick } from './hud';
import './game.css';

type Phase = 'idle' | 'session' | 'publish' | 'order' | 'portal' | 'done' | 'error' | 'unknown';
type Run = {
  phase: Phase; t0: number; at: Partial<Record<Phase, number>>;
  account?: string; machineId?: string; publishTx?: TxRef; reused?: boolean; orderTx?: TxRef; customer?: string;
  payoutId?: string; flowKey?: string; error?: string; vault?: bigint; fee?: bigint; wei?: bigint; total?: bigint; orderFee?: bigint;
};
type Progress = { level: 1 | 2; l1done: boolean; l2done?: string };
const PKEY = 'ww-game-v1';
function loadProgress(): Progress {
  let p: Progress = { level: 1, l1done: false };
  try { const raw = localStorage.getItem(PKEY); if (raw) p = { ...p, ...JSON.parse(raw) }; } catch { /* storage off */ }
  const q = new URLSearchParams(location.search).get('level');
  if (q === '1') p = { ...p, level: 1 };
  if (q === '2') p = { ...p, level: 2, l1done: true };
  return p;
}
function saveProgress(p: Progress) { try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch { /* ignore */ } }

const GOAL_SALES = 3;
const INTRO_KEY = 'ww-intro-v1';
type Card = { focus: Focus; title: string; body: React.ReactNode };
const INTRO1: Card[] = [
  { focus: 'stand', title: 'This is your lemonade stand', body: <>Every customer pays <b>0.10 NEAR</b>. NEAR is money on the NEAR blockchain. Each gold coin is <b>0.01 NEAR</b>, so one sale is 10 coins.</> },
  { focus: 'portal', title: 'Right now, you keep nothing', body: <><b>All</b> the coins roll into the <b>Portal</b>, which sends the money to <b>your supplier on Ethereum</b> (another blockchain). Your savings stay empty.</> },
  { focus: 'slot', title: 'Fix it', body: <>Drop a <b>Splitter</b> on the glowing slot. Then <b>70%</b> goes to your savings and 30% still pays the supplier.</> },
];
const INTRO2: Card[] = [
  { focus: 'portal', title: 'Now do it for real', body: <>Everything so far was <b>simulated</b> in your browser. “Run it for real” puts your stand on the real <b>NEAR testnet</b>: a test customer pays real testnet NEAR, and your Portal pays your supplier real test ETH on <b>Ethereum Sepolia</b>. About a minute. No wallet.</> },
];
const TIPS: Partial<Record<Anchor, string>> = {
  stand: 'Your lemonade stand (Coin Slot). Each customer pays 0.10 NEAR = 10 coins.',
  splitter: 'Splitter: splits every payment. 7 coins to your savings, 3 coins to the supplier.',
  vault: 'Your savings (Vault). Money that stays with you, on NEAR.',
  portal: 'Portal: sends a payment to Ethereum, another blockchain. NEAR’s network signs it (Chain Signatures).',
  exit: 'Where the Portal’s payment comes out, on Ethereum.',
  supplier: 'Your supplier. They are on Ethereum, another blockchain, and get paid in ETH.',
  mailbox: 'Payout: pays a NEAR account directly.',
};
type Next = { text: string; dom?: string; world?: Anchor; inline?: boolean } | null;
const DOCK: { id: string; label: string; cls: string; lvl: number; blurb: string }[] = [
  { id: 'slot', label: 'Coin Slot', cls: 'p-slot', lvl: 1, blurb: 'Coin Slot: where customers pay. Yours is the lemonade stand (already placed).' },
  { id: 'split', label: 'Splitter', cls: 'p-split', lvl: 1, blurb: 'Splitter: splits every payment, e.g. 70% to your savings and 30% to the supplier.' },
  { id: 'vault', label: 'Savings', cls: 'p-vault', lvl: 1, blurb: 'Vault = your savings. Money that stays with you (already placed).' },
  { id: 'portal', label: 'Portal', cls: 'p-portal', lvl: 2, blurb: 'Portal: sends a payment to Ethereum, another blockchain.' },
  { id: 'gate', label: 'Gate', cls: 'p-gate', lvl: 3, blurb: 'Gate: holds money until a rule is met. Locked: comes in Level 3 (not in this build yet).' },
  { id: 'worker', label: 'Worker', cls: 'p-worker', lvl: 3, blurb: 'Worker: a helper who can approve held money. Locked: comes in Level 3 (not in this build yet).' },
  { id: 'payout', label: 'Payout', cls: 'p-payout', lvl: 3, blurb: 'Payout: pays a NEAR account directly. Locked: comes in Level 3 (not in this build yet).' },
];

export function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [prog, setProg] = useState<Progress>(loadProgress);
  const [fixed, setFixed] = useState(() => loadProgress().level >= 2);
  const [sales, setSales] = useState({ n: 0, fixedN: 0, lastPct: 0, kept: 0n, gone: 0n });
  const [armed, setArmedS] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; over: boolean } | null>(null);
  const [toast, setToast] = useState<{ text: string; tone?: string } | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [muted, setMuted] = useState(true);
  const [win1, setWin1] = useState(false);
  const [run, setRun] = useState<Run>({ phase: 'idle', t0: 0, at: {} });
  const [intro, setIntro] = useState<Card[] | null>(() => {
    const q = new URLSearchParams(location.search).get('intro');
    let seen = false; try { seen = !!localStorage.getItem(INTRO_KEY); } catch { /* ignore */ }
    if (q === '0') return null;
    if (q === '1' || !seen) return loadProgress().level === 2 ? INTRO2 : INTRO1;
    return null;
  });
  const [introI, setIntroI] = useState(0);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const ledgerCount = useApp(s => s.ledger.length);
  const machineRef = useRef<Machine>(levelMachine(fixed));
  const fixedRef = useRef(fixed);
  const panelRef = useRef(false);
  const slotUi = useRef<HTMLDivElement>(null);
  const level = prog.level;
  const running = !['idle', 'done', 'error', 'unknown'].includes(run.phase);
  const panelOpen = level === 2 && run.phase !== 'idle';
  useTick(running);

  // ---------- world ----------
  useEffect(() => {
    const w = createWorld(canvasRef.current!, tagsRef.current!, {
      variant: 'game',
      nextSimOrder: () => simFlow(machineRef.current),
      onSale: f => {
        const pct = f.priceYocto > 0n ? Number((f.vaultYocto * 1000n) / f.priceYocto) / 10 : 0;
        setSales(s => ({ n: s.n + 1, fixedN: fixedRef.current ? s.fixedN + 1 : 0, lastPct: pct, kept: s.kept + f.vaultYocto, gone: s.gone + f.priceYocto - f.vaultYocto }));
      },
      onFx: lvl => setToast({ text: lvl >= 2 ? 'Low-power graphics on (frame rate stayed under 30).' : 'Lighter shadows on to keep it smooth.' }),
      margins: (w0, h0, portrait) => {
        const panel = panelRef.current;
        if (portrait) return { t: 205, b: panel ? 290 : 150, l: 4, r: 4 };
        return { t: 30, b: 92, l: panel && w0 > 900 ? 380 : 20, r: 20 };
      },
    });
    setWorld(w);
    void loadLimits();
    return () => w.dispose();
  }, []);

  useEffect(() => {
    if (!world) return;
    const m = levelMachine(fixed);
    machineRef.current = m; fixedRef.current = fixed;
    const doc = toDoc(m, {});
    const v = api.validate(doc);
    if (!v.ok) setToast({ text: `Engine rejected the machine: ${v.errors[0]}`, tone: 'bad' });
    const sim = simFlow(m);
    const share = sim && sim.priceYocto > 0n ? Number((sim.vaultYocto * 100n) / sim.priceYocto) / 100 : 0.7;
    world.setParts({ splitter: fixed, vault: true, portal: true, payout: false, vaultShare: share, splitLabel: `${Math.round(share * 100)} / ${100 - Math.round(share * 100)}`, priceLabel: `${near(price(m))} NEAR` });
    world.setArmed(false);
  }, [world, fixed]);

  useEffect(() => { panelRef.current = panelOpen; world?.relayout(); }, [panelOpen, world]);
  useEffect(() => { if (!world) return; world.focus(intro ? intro[introI]?.focus ?? null : null); }, [world, intro, introI]);
  const endIntro = () => { setIntro(null); setIntroI(0); try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* ignore */ } };
  useEffect(() => { if (!tip) return; const t = setTimeout(() => setTip(null), 4500); return () => clearTimeout(t); }, [tip]);

  // Place/coach UI follows the slot tile on screen
  useEffect(() => {
    if (!world) return;
    return world.onFrame(() => {
      const el = slotUi.current; if (!el) return;
      const s = world.screen('slot'); el.style.left = `${s.x}px`; el.style.top = `${s.y}px`;
    });
  }, [world]);

  // ---------- level 1 ----------
  const setArmed = useCallback((on: boolean) => { setArmedS(on); world?.setArmed(on); if (!on) world?.setHover(false); }, [world]);
  const place = useCallback(() => {
    if (!world || fixed) return;
    world.placeSplitter(); setFixed(true); setArmed(false); setDrag(null);
    setToast({ text: 'Splitter placed: 70% now drops into the Vault, 30% still feeds the Portal.', tone: 'ok' });
  }, [world, fixed, setArmed]);
  useEffect(() => {
    if (level === 1 && fixed && sales.fixedN >= GOAL_SALES && !prog.l1done) {
      const p: Progress = { ...prog, l1done: true }; setProg(p); saveProgress(p); setWin1(true);
    }
  }, [level, fixed, sales.fixedN, prog]);
  useEffect(() => { if (!armed) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setArmed(false); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [armed, setArmed]);

  const goLevel = (l: 1 | 2) => {
    if (running) return;
    if (l === 2 && !prog.l1done) { setToast({ text: 'Finish Level 1 first: fix the leak.' }); return; }
    const p = { ...prog, level: l }; setProg(p); saveProgress(p); setWin1(false);
    if (l === 2 && !prog.l2done) { setIntro(INTRO2); setIntroI(0); }
    setFixed(l === 2); setSales({ n: 0, fixedN: 0, lastPct: 0, kept: 0n, gone: 0n });
    setRun({ phase: 'idle', t0: 0, at: {} });
    world?.setSimCustomers(true);
  };

  // drag from the dock (pointer: mouse, pen, touch); tap = arm, then tap the slot or the Place button
  const dragInfo = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const skipClick = useRef(false);
  const onPartDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (fixed || level !== 1) return;
    dragInfo.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPartMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragInfo.current; if (!d || d.id !== e.pointerId || !world) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { d.moved = true; world.setArmed(true); }
    if (d.moved) { const over = world.hitSlot(e.clientX, e.clientY); world.setHover(over); setDrag({ x: e.clientX, y: e.clientY, over }); }
  };
  const onPartUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragInfo.current; dragInfo.current = null; if (!d || !world) return;
    if (d.moved) {
      skipClick.current = true;
      if (world.hitSlot(e.clientX, e.clientY)) place();
      else { setDrag(null); world.setHover(false); world.setArmed(armed); setToast({ text: 'Drop it on the glowing slot on the belt.' }); }
    }
  };
  const tipAt = (id: string, text: string) => { const r = document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect(); setTip({ text, x: r ? r.left + r.width / 2 : innerWidth / 2, y: r ? r.top - 8 : innerHeight - 120 }); };
  const onPartClick = (p: (typeof DOCK)[number]) => {
    if (skipClick.current) { skipClick.current = false; return; }
    if (p.id === 'split' && level === 1 && !fixed) { setArmed(!armed); if (!armed) setToast({ text: 'Now tap the glowing slot, or press “Place Splitter here”.' }); return; }
    if (p.id === 'portal' && level === 1) { tipAt('dock-portal', 'Portal: sends a payment to Ethereum. On the island it runs simulated now; the real one unlocks in Level 2.'); return; }
    tipAt(`dock-${p.id}`, p.blurb);
  };
  const onCanvasUp = (e: React.PointerEvent) => {
    if (!world) return;
    if (level === 1 && !fixed && world.hitSlot(e.clientX, e.clientY)) { if (armed) place(); else { setArmed(true); setTip({ text: 'This empty slot takes a Splitter. Now tap it again, or press “Place Splitter here”.', x: e.clientX, y: e.clientY - 30 }); } return; }
    const a = world.pick(e.clientX, e.clientY);
    if (a && TIPS[a]) { const sp = world.screen(a); setTip({ text: TIPS[a]!, x: sp.x, y: sp.y - 10 }); }
  };

  // ---------- level 2: one REAL order ----------
  usePortalSync(world, run.flowKey ?? null, run.payoutId ?? null);
  const payout = useApp(s => (run.payoutId ? s.payouts[run.payoutId] : undefined));
  useEffect(() => {
    if (!payout || run.phase !== 'portal') return;
    if (payout.status === 'confirmed') {
      setRun(r => ({ ...r, phase: 'done', at: { ...r.at, done: Date.now() } }));
      const p = { ...prog, l2done: run.machineId }; setProg(p); saveProgress(p);
      setTimeout(() => world?.setSimCustomers(true), 6000);
    }
  }, [payout?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const runForReal = async () => {
    if (level !== 2) { setToast({ text: 'Fix the stand in Level 1 first. Then you can run it for real.' }); return; }
    if (running || !world) return;
    const kind = liveKind();
    const t0 = Date.now();
    const step = (phase: Phase, extra: Partial<Run> = {}) => setRun(r => ({ ...r, ...extra, phase, at: { ...r.at, [phase]: Date.now() } }));
    setRun({ phase: 'session', t0, at: { session: t0 } });
    world.setSimCustomers(false);
    try {
      const s = await ensureSession();
      if (!s) throw new Error(`Could not create a sponsored testnet account: ${getState().sessionError ?? 'unknown error'}`);
      const limits = await loadLimits();
      const m = levelMachine(true);
      const doc = toDoc(m, {});
      const id = machineIdFor(m, s.accountId);
      step('publish', { account: s.accountId, machineId: id });
      const existing = await api.getMachine(id);
      if (existing) {
        if (existing.owner !== s.accountId) throw new Error(`Machine id ${id} belongs to another account.`);
        step('order', { reused: true });
      } else {
        const row = addRow({ kind: 'publish', title: 'Published “Lemonade Stand”', detail: [`machine id ${id}`, limits ? `storage deposit ${near(limits.publishDeposit)} NEAR from your sponsored session` : 'with a storage deposit'], amount: limits ? near(limits.publishDeposit) : undefined, status: 'pending', statusText: 'sending' });
        try { const tx = await api.publish(id, doc); updateRow(row, { status: 'confirmed', statusText: 'confirmed', tx }); step('order', { publishTx: tx }); }
        catch (e) { updateRow(row, { status: 'failed', statusText: 'failed' }); throw e; }
      }
      world.callRealCustomer(kind === 'mock' ? 'seeded customer · MOCK' : 'seeded customer · REAL');
      const r = await api.customerOrder(id);
      const total = BigInt(price(m)), orderFee = limits ? BigInt(limits.orderFee) : undefined;
      addRow({ kind: 'order', title: 'Seeded customer bought one lemonade', detail: [`from ${r.customer}`, `machine ${id}`, ...(orderFee !== undefined ? [`+ ${near(orderFee)} NEAR storage fee, kept by the contract`] : [])], amount: near(orderFee !== undefined ? total + orderFee : total), status: 'confirmed', statusText: r.observation === 'unknown' ? 'sent · outcome unknown' : 'confirmed', tx: r.tx });
      if (r.observation === 'unknown') { world.realCustomerLeave(); step('unknown', { orderTx: r.tx, customer: r.customer }); return; }
      const flow = flowFromEffects(r.orderId, kind, r.effects, total, r.pending);
      world.payReal(flow);
      const ext = r.effects.find(e => e.kind === 'external') as Extract<typeof r.effects[number], { kind: 'external' }> | undefined;
      let payoutId: string | undefined;
      if (ext) {
        payoutId = ext.payoutId;
        const row = addRow({ kind: 'payout', title: 'Portal → Sepolia (supplier)', detail: [`to ${ext.recipient}`], amount: eth(ext.wei), unit: 'ETH', status: 'pending', statusText: 'signing on NEAR', tx: r.tx, payoutId: ext.payoutId });
        trackPayout(ext.payoutId, row);
      }
      step(payoutId ? 'portal' : 'done', { orderTx: r.tx, customer: r.customer, payoutId, flowKey: flow.key, vault: flow.vaultYocto, fee: flow.feeYocto, wei: flow.wei, total, orderFee });
    } catch (e) {
      world.realCustomerLeave();
      step('error', { error: (e as Error).message || 'Something went wrong.' });
      setTimeout(() => world.setSimCustomers(true), 2500);
    }
  };

  // ---------- test hooks ----------
  useEffect(() => {
    (window as unknown as { __game: unknown }).__game = {
      slot: () => world?.screen('slot'),
      anchor: (a: Anchor) => world?.screen(a),
      state: () => ({ level, fixed, sales: { ...sales, kept: sales.kept.toString(), gone: sales.gone.toString() }, run: { ...run, vault: run.vault?.toString(), fee: run.fee?.toString(), wei: run.wei?.toString(), total: run.total?.toString(), orderFee: run.orderFee?.toString() }, l1done: prog.l1done, mode: api.mode }),
    };
  });

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3800); return () => clearTimeout(t); }, [toast]);

  // ---------- render ----------
  const pct = level === 1 && !fixed ? 0 : sales.n ? sales.lastPct : fixed ? 70 : 0;
  const broken = level === 1 && !fixed;
  const secs = (a?: number, b?: number) => (a ? Math.max(0, Math.floor(((b ?? Date.now()) - a) / 1000)) : 0);
  const kindWord = api.mode === 'mock' ? 'MOCK' : 'REAL';
  const pst = payout?.status;
  const runCaption = (() => {
    switch (run.phase) {
      case 'session': return `Creating your free test account on NEAR (sponsored, no wallet)… ${secs(run.at.session)}s`;
      case 'publish': return `Putting your lemonade stand on the NEAR blockchain… ${secs(run.at.publish)}s`;
      case 'order': return `A test customer is buying one lemonade with real testnet NEAR… ${secs(run.at.order)}s`;
      case 'portal':
        if (pst === 'broadcast') return `Payment sent to Ethereum Sepolia. Waiting for 3 blocks to confirm it… ${secs(payout?.stepAt.broadcast)}s`;
        if (pst === 'signed') return 'Signed! Handing the payment to Ethereum…';
        if (pst === 'waiting_for_earlier_nonce') return 'Waiting for an earlier payment to Ethereum to go first…';
        if (pst === 'signature_failed') return 'The signature failed, so no ETH was sent. You can retry it.';
        return `${api.mode === 'mock' ? 'Mock' : 'Real'} money split: ${near(run.vault ?? 0n)} NEAR in your savings, ${near(run.fee ?? 0n)} NEAR into the Portal. NEAR’s network is signing the payment to Ethereum… ${secs(payout?.stepAt[pst ?? 'awaiting_signature'] ?? run.at.portal)}s`;
      case 'done': return `Done! Your supplier got paid on Ethereum${api.mode === 'mock' ? ' (mock data)' : ''}. Both receipts are linked below.`;
      case 'error': return `That did not go through: ${run.error}`;
      case 'unknown': return 'The order was sent but its result could not be read. Check the explorer link.';
      default: return '';
    }
  })();
  const next: Next = intro || win1 ? null
    : level === 1 && !fixed ? (armed || drag ? { text: 'Drop it here', world: 'slot' } : { text: 'Drag the Splitter onto the glowing slot (or tap it)', dom: 'dock-split' })
    : level === 1 ? { text: `Watch: 7 of every 10 coins now go to your savings (${Math.min(sales.fixedN, GOAL_SALES)}/${GOAL_SALES} customers)`, world: 'vault' }
    : run.phase === 'idle' || run.phase === 'error' ? { text: run.phase === 'error' ? 'Try again' : 'Run it for real: 1 real order on NEAR testnet + a real payout on Ethereum Sepolia (~1 min). No wallet.', dom: 'run-real' }
    : run.phase === 'portal' ? { text: runCaption, world: pst === 'broadcast' || pst === 'confirmed' ? 'exit' : 'portal' }
    : run.phase === 'done' ? { text: 'Your stand is a real app now. Open it', dom: 'open-app', inline: true }
    : run.phase === 'unknown' ? null : { text: runCaption, world: 'stand' };
  useEffect(() => {
    if (!world) return;
    return world.onFrame(() => {
      const el = hintRef.current; if (!el || !next) return;
      let x = 0, y = 0;
      if (next.dom) { const r = document.querySelector(`[data-testid="${next.dom}"]`)?.getBoundingClientRect(); if (!r) { el.style.visibility = 'hidden'; return; } x = r.left + r.width / 2; y = r.top - 4; }
      else if (next.world) { const p = world.screen(next.world); x = p.x; y = p.y - 6; }
      el.style.visibility = ''; el.style.left = `${x}px`; el.style.top = `${y}px`;
      const b = el.firstElementChild as HTMLElement | null;
      if (b) { const w = b.offsetWidth; const shift = Math.min(innerWidth - 10 - (x + w / 2), Math.max(10 - (x - w / 2), 0)); b.style.transform = `translateX(calc(-50% + ${shift}px))`; }
    });
  }, [world, next?.dom, next?.world, next]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="ww-game" data-testid="game" data-level={level} data-fixed={fixed ? '1' : '0'}>
      <canvas ref={canvasRef} className="world" onPointerUp={onCanvasUp} onPointerMove={e => { if (armed && world) world.setHover(world.hitSlot(e.clientX, e.clientY)); }} aria-label="The factory island. Use the buttons to play." />
      <div ref={tagsRef} className="tags" aria-hidden />
      <div className="vignette" />

      <div ref={slotUi} className="slot-ui">
        {armed && !fixed && <button type="button" className="place-btn" onClick={place} data-testid="place-splitter">Place Splitter here</button>}
      </div>

      <div className="hud">
        <section className={`level g-card ${broken ? 'broken' : ''}`} data-testid="level-card">
          <div className="lvl-row">
            <span className="lvl-num">{level}</span>
            <div className="lvl-text">
              <div className="lvl-title">{level === 1 ? 'Lemonade stand' : 'Pay your supplier on Ethereum'}</div>
              <div className="lvl-goal">{level === 1 ? <>Keep <b>70%</b> of every sale · <b>{GOAL_SALES}</b> customers</> : <>One <b>real</b> order · Portal pays <b>Sepolia ETH</b></>}</div>
            </div>
            <div className="lvl-pick" role="group" aria-label="Levels">
              <button type="button" className={level === 1 ? 'on' : ''} onClick={() => goLevel(1)} aria-pressed={level === 1}>1</button>
              <button type="button" className={level === 2 ? 'on' : ''} onClick={() => goLevel(2)} aria-pressed={level === 2} disabled={!prog.l1done} title={prog.l1done ? 'Level 2' : 'Finish Level 1 first'}>2</button>
            </div>
          </div>
          {level === 1 ? (
            <>
              <div className="keep-row"><span>You keep: <b data-testid="keep-label" className={pct < 70 ? 'bad' : 'good'}>{pct.toFixed(0)}%</b></span><span className="goal-mark">goal 70%</span></div>
              <div className={`meter ${pct < 70 ? 'red' : ''}`} aria-label={`You keep ${pct.toFixed(0)}% of each sale; goal 70%`}><div className="meter-fill" style={{ width: `${Math.max(pct, broken ? 100 : 0)}%` }} /><div className="meter-target" /></div>
              <div className="lvl-stats">
                {broken ? <span className="g-stamp bad" data-testid="stamp">LOSING MONEY · savings get 0%</span> : <span className="coin-legend"><i aria-hidden />1 coin = 0.01 NEAR (money)</span>}
                <span className="dots">{Array.from({ length: GOAL_SALES }, (_, i) => <i key={i} className={i < sales.fixedN ? 'on' : ''} />)}</span>
              </div>
            </>
          ) : (<>
            <div className="coin-legend solo"><i aria-hidden />1 coin = 0.01 NEAR (money) · <b>gold</b> = simulated · <b className="realc">green</b> = {api.mode === 'mock' ? 'mock API' : 'real testnet'}</div>
            <div className="lvl-stats l2">
              {run.phase === 'done' || prog.l2done ? <span className="g-stamp good" data-testid="goal2">★ Supplier paid on Sepolia{api.mode === 'mock' ? ' (mock)' : ''}</span> : <span className="g-stamp">Goal: 1 real order</span>}
              <span className="sim-note">customers on the island are simulated</span>
            </div>
          </>)}
        </section>

        <section className="status">
          <ModePills sim />
          <button type="button" className="icon-btn" onClick={() => { setIntro(level === 2 ? INTRO2 : INTRO1); setIntroI(0); }} aria-label="How does this work?" title="How does this work?" data-testid="help">?</button>
          <button type="button" className="icon-btn" onClick={() => { const m = !muted; setMuted(m); world?.setMuted(m); }} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} title="Sound">{muted ? '🔇' : '🔊'}</button>
          <button type="button" className="ledger-btn" onClick={() => setLedgerOpen(o => !o)} aria-expanded={ledgerOpen} data-testid="ledger-button">Ledger{ledgerCount ? <b>{ledgerCount}</b> : null}</button>
        </section>

        {panelOpen && (
          <section className={`run-panel g-card ${run.payoutId ? 'has-payout' : ''}`} data-testid="run-panel" aria-live="polite">
            <header><b>{kindWord === 'MOCK' ? 'Mock run' : 'Real run'} · NEAR testnet → Sepolia</b>{run.t0 > 0 && <span className="secs">{secs(run.t0, run.at.done)}s</span>}</header>
            <p className="run-caption" data-testid="run-caption">{runCaption}</p>
            <ol className="steps">
              <li className={run.account ? 'done' : run.phase === 'session' ? 'on' : ''}><i /><div><b>Free test account (sponsored)</b><small>{run.account ? <>{run.account} · no wallet</> : `creating… ${secs(run.at.session)}s`}</small></div></li>
              <li className={run.at.order ? 'done' : run.phase === 'publish' ? 'on' : ''}><i /><div><b>Stand put on NEAR testnet</b><small>{run.machineId ? <>{run.machineId}{run.reused ? ' · already on chain' : ''} </> : 'waiting'}{run.phase === 'publish' && ` · sending ${secs(run.at.publish)}s`}</small><Tx tx={run.publishTx} label="NEAR tx" /></div></li>
              <li className={run.orderTx ? 'done' : run.phase === 'order' ? 'on' : ''}><i /><div><b>Test customer pays {near(run.total ?? 100000000000000000000000n)} NEAR</b><small>{run.orderTx ? `${run.customer ?? 'seeded customer'} · ${near(run.vault ?? 0n)} → savings · ${near(run.fee ?? 0n)} → Portal${run.orderFee !== undefined ? ` · +${near(run.orderFee)} storage fee` : ''}` : run.phase === 'order' ? `paying on NEAR testnet… ${secs(run.at.order)}s` : 'waiting'}</small><Tx tx={run.orderTx} label="NEAR tx" /></div></li>
            </ol>
            {run.payoutId && <PortalCard payoutId={run.payoutId} />}
            {run.phase === 'unknown' && <p className="warn" role="alert">The order was sent, but its outcome could not be read. Check the explorer before trying again. <Tx tx={run.orderTx} label="NEAR tx" /></p>}
            {run.phase === 'error' && <p className="warn" role="alert" data-testid="run-error">Did not go through: {run.error}</p>}
            {run.phase === 'done' && <p className="win-line" data-testid="win2">★ Your supplier got paid on Ethereum{api.mode === 'mock' ? ' (mock data)' : ''}. Your stand now runs on its own: <b>open it as an app</b> and anyone can buy from it.</p>}
            {run.machineId && (run.at.order || run.phase === 'done') && (
              <div className="row-btns">
                <button type="button" className={`btn ${next?.dom === 'open-app' ? 'pulse-target' : ''}`} onClick={() => navigate(`/m/${run.machineId}`)} data-testid="open-app" title="Your stand as a standalone payment page anyone can use">Open as app ↗</button>
                {!running && <button type="button" className="btn ghost" onClick={() => { setRun({ phase: 'idle', t0: 0, at: {} }); world?.setSimCustomers(true); }}>Close</button>}
              </div>
            )}
          </section>
        )}

        <section className="g-dock">
          <div className="parts" role="toolbar" aria-label="Parts">
            {DOCK.map(p => {
              const on = p.lvl <= level;
              const grab = p.id === 'split' && level === 1 && !fixed;
              return (
                <button key={p.id} type="button" className={`part ${p.cls} ${on ? 'on' : ''} ${grab ? 'grab' : ''} ${grab && armed ? 'armed' : ''}`} data-testid={`dock-${p.id}`}
                  onPointerDown={grab ? onPartDown : undefined} onPointerMove={grab ? onPartMove : undefined} onPointerUp={grab ? onPartUp : undefined}
                  onClick={() => onPartClick(p)} aria-pressed={grab ? armed : undefined} aria-label={`${p.label}${on ? '' : ` (locked until Level ${p.lvl})`}${grab ? ': drag onto the glowing slot, or press to pick it up' : ''}`}>
                  <span aria-hidden /><label>{p.label}</label>{p.lvl > level && <em className="lock" aria-hidden>🔒 Level {p.lvl}</em>}
                </button>
              );
            })}
          </div>
          <button type="button" className={`run ${level === 2 ? 'ready' : 'locked'}`} onClick={runForReal} disabled={running} aria-disabled={level !== 2} data-testid="run-real">
            <span className="run-main">{running ? (api.mode === 'mock' ? 'Running (mock API)…' : 'Running on testnet…') : run.phase === 'done' ? 'Run another real order' : 'Run it for real'}</span>
            <span className="run-sub">{level !== 2 ? '🔒 unlocks in Level 2' : api.mode === 'mock' ? 'MOCK API · no chain · ~30 s' : 'real NEAR testnet + Ethereum Sepolia · ~1 min'}</span>
          </button>
        </section>

        {win1 && (
          <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="win1-title">
            <div className="modal g-card" data-testid="win1">
              <div className="big-star" aria-hidden>★</div>
              <h2 id="win1-title">Goal met: the stand keeps 70%</h2>
              <p>Now 7 of every 10 coins go to <b>your savings</b> and 3 still pay your supplier. {GOAL_SALES} simulated customers in a row, routed by the same engine the real contract runs.</p>
              <p className="next">Level 2: <b>pay your supplier on Ethereum</b>, for real, on testnet.</p>
              <div className="row-btns"><button type="button" className="btn" autoFocus onClick={() => goLevel(2)} data-testid="go-level2">Play Level 2 →</button><button type="button" className="btn ghost" onClick={() => setWin1(false)}>Keep watching</button></div>
            </div>
          </div>
        )}
        {next && !next.inline && <div ref={hintRef} className={`next-hint ${next.dom ? 'dom' : 'world'} ${running ? 'during-run' : ''}`} data-testid="next-hint" aria-live="polite"><div className="nh-bubble">{next.text}</div><div className="nh-arrow" aria-hidden>▼</div></div>}
        {tip && <div className="g-tip" role="status" data-testid="tip" style={{ left: tip.x, top: tip.y }}><div>{tip.text}</div></div>}
        {intro && (
          <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" data-testid="intro">
            <div className="intro-card g-card">
              <div className="intro-step">{introI + 1} / {intro.length}</div>
              <h2 id="intro-title">{intro[introI].title}</h2>
              <p>{intro[introI].body}</p>
              <div className="row-btns">
                <button type="button" className="btn" autoFocus data-testid="intro-next" onClick={() => (introI + 1 < intro.length ? setIntroI(introI + 1) : endIntro())}>{introI + 1 < intro.length ? 'Next' : intro === INTRO1 ? 'Let’s fix it' : 'Got it'}</button>
                {introI + 1 < intro.length && <button type="button" className="btn ghost" data-testid="intro-skip" onClick={endIntro}>Skip</button>}
              </div>
            </div>
          </div>
        )}
        <LedgerPanel open={ledgerOpen} onClose={() => setLedgerOpen(false)} />
        {toast && <div className={`g-toast show ${toast.tone ?? ''}`} role="status" data-testid="toast">{toast.text}</div>}
      </div>

      {drag && <div className={`drag-ghost ${drag.over ? 'over' : ''}`} style={{ left: drag.x, top: drag.y }} aria-hidden><span /></div>}
    </div>
  );
}
