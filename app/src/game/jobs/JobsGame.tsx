// GAME-2: puzzle jobs. JOB card → BUILD (sockets + tray) → TEST (3 simulated customers, wasm engine) → SHIP (real NEAR testnet).
// One thing moves at a time; every screen has exactly one highlighted next action (class "is-next").
// Simulated = labeled "Test · simulated" and never in the ledger. Real = TESTNET with explorer links, receipts only from API results.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { api } from '../../api';
import type { OrderResult, TxRef } from '../../api/types';
import { addRow, ensureSession, getState, finishOrder, pendingOrder, submitOrder, trackPayout, updateRow, retryRelay, useApp } from '../../lib/store';
import { loadLimits } from '../../lib/limits';
import { linkProps } from '../../lib/router';
import { eth, near } from '../../lib/units';
import { Tx, PortalCard, ModePills, LedgerPanel } from '../hud';
import {
  JOBS, PEOPLE, PART_INFO, PRICE, PORTAL_WEI, CHI_EVM, activeSockets, compile, defaultPlaced, initialState, jobByN, jobMachineId, runTest, todo,
  type Build, type Job, type PartKind, type PersonId, type Placed, type TestResult, type TrayItem, type SaleSim, type Received,
} from './jobs';
import { createJobScene, type JobScene, type LaneDest, type SalePlan, type CoinKind } from './scene';
import '../game.css';
import './jobs.css';
import { Face } from './Face';
import { checkPortalGas } from './portalPreflight';

// ------------------------------------------------------------------ persistence (keyed by mode + contract)
const contractId = () => (api.mode === 'mock' ? 'mock-contract.testnet' : (import.meta.env?.VITE_CONTRACT_ID as string | undefined) ?? 'ww-portal-261112.testnet');
const scope = () => `${api.mode}:${contractId()}`;
type Shipped = { machineId: string; orderTx?: TxRef; payoutId?: string; ethConfirmed?: boolean };
type Progress = { intro: boolean; at: number; solved: Record<number, boolean>; shipped: Record<number, Shipped> };
type RunPhase = 'session' | 'publish' | 'order' | 'approve' | 'paying' | 'portal' | 'done' | 'error' | 'unknown';
type Run = {
  job: number; phase: RunPhase; machineId?: string; publishTx?: TxRef; orderId?: string; orderTx?: TxRef; customer?: string;
  effects?: OrderResult['effects']; pending?: boolean; approveTx?: TxRef; payoutId?: string; payoutRow?: string; error?: string; started: number; build?: Build;
};
const PKEY = () => `ww-jobs-${scope()}`;
const RKEY = () => `ww-jobs-run-${scope()}`;
function loadProgress(): Progress {
  const p: Progress = { intro: false, at: 1, solved: {}, shipped: {} };
  try { Object.assign(p, JSON.parse(localStorage.getItem(PKEY()) ?? '{}')); } catch { /* storage off */ }
  const q = Number(new URLSearchParams(location.search).get('job'));
  if (q >= 1 && q <= 3) p.at = q;
  return p;
}
const saveProgress = (p: Progress) => { try { localStorage.setItem(PKEY(), JSON.stringify(p)); } catch { /* storage off */ } };
function loadRun(): Run | null { try { return JSON.parse(localStorage.getItem(RKEY()) ?? 'null'); } catch { return null; } }
const saveRun = (r: Run | null) => { try { if (r) localStorage.setItem(RKEY(), JSON.stringify(r)); else localStorage.removeItem(RKEY()); } catch { /* storage off */ } };
const unlocked = (p: Progress, n: number) => n === 1 || !!p.solved[n - 1];

// ------------------------------------------------------------------ small pieces
const PART_ICON: Record<PartKind, string> = { Splitter: '◔', Payout: '✉', Portal: '◎', Vault: '▣', Gate: '⊓', Worker: '⚿' };
function PartChip({ kind, small }: { kind: PartKind; small?: boolean }) {
  return <span className={`j-part k-${kind} ${small ? 'small' : ''}`}><b>{PART_ICON[kind]}</b><span><em>{PART_INFO[kind].name}</em>{!small && <small>{PART_INFO[kind].does}</small>}</span></span>;
}
const nearShort = (y: bigint) => near(y, 2);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const coinsFor = (y: bigint) => (y > 0n ? Math.max(1, Math.round(Number(y / 10n ** 21n) / 10)) : 0);

function describePlaced(p: Placed | null, job: Job): string {
  if (!p) return '';
  if (p.kind === 'Splitter') return p.shares!.map(s => `${s}%`).join(' · ');
  if (p.kind === 'Payout') return p.person ? `pays ${PEOPLE[p.person].name}` : 'pays… who?';
  if (p.kind === 'Worker') return p.person ? `${PEOPLE[p.person].name} holds it` : 'who holds it?';
  if (p.kind === 'Portal') return job.people.includes('chi') ? 'pays Chi on Ethereum' : 'pays on Ethereum';
  if (p.kind === 'Vault') return 'keeps the money';
  if (p.kind === 'Gate') return 'waits for the Key';
  return '';
}

/** Which socket to point at after a failed test. */
function fixTarget(job: Job, build: Build, r: TestResult): string {
  if (/Shares add|more than 0/.test(r.why)) return 'hub';
  const sockets = activeSockets(job, build);
  const vault = sockets.find(s => build[s.id]?.kind === 'Vault'); if (vault) return vault.id;
  if (/Key|confirm/.test(r.why)) return 'key1';
  if (/before the delivery/.test(r.why)) return 'mid1';
  if (/Ethereum|ETH/.test(r.why)) { const s = sockets.find(x => build[x.id]?.kind === 'Payout' && build[x.id]?.person === 'chi') ?? sockets.find(x => build[x.id]?.kind === 'Portal'); if (s) return s.id; }
  const seen = new Set<string>();
  for (const s of sockets) { const p = build[s.id]; if (p?.kind === 'Payout' && p.person) { if (seen.has(p.person)) return s.id; seen.add(p.person); } }
  if (/nothing/.test(r.why)) { const s = sockets.find(x => build[x.id]?.kind === 'Portal'); if (s) return s.id; }
  return 'hub';
}

function destOf(job: Job, build: Build, lane: number): LaneDest {
  const mid = build[`mid${lane}`];
  if (mid?.kind === 'Gate') return { type: 'gate' };
  const p = mid ?? build[`end${lane}`];
  if (!p) return { type: 'nobody' };
  if (p.kind === 'Payout') return p.person ? { type: 'person', person: p.person } : { type: 'nobody' };
  if (p.kind === 'Portal') return { type: 'portal' };
  if (p.kind === 'Vault') return { type: 'vault' };
  return { type: 'nobody' };
}
function passDest(build: Build, lane: number): LaneDest {
  const p = build[`end${lane}`];
  if (p?.kind === 'Payout' && p.person) return { type: 'person', person: p.person };
  if (p?.kind === 'Portal') return { type: 'portal' };
  if (p?.kind === 'Vault') return { type: 'vault' };
  return { type: 'nobody' };
}
function laneAmounts(job: Job, build: Build): bigint[] {
  const sh = build.hub?.shares ?? [];
  return Array.from({ length: job.lanes }, (_, i) => (BigInt(PRICE) * BigInt(sh[i] ?? 0)) / 100n);
}
function salePlan(job: Job, build: Build, kind: CoinKind): SalePlan {
  const amts = laneAmounts(job, build);
  return { kind, lanes: amts.map((a, i) => { const d = destOf(job, build, i); return { coins: coinsFor(a), dest: d, label: d.type === 'person' ? `+${nearShort(a)}` : d.type === 'gate' ? 'waiting for delivery' : undefined }; }) };
}

// ------------------------------------------------------------------ the game
export function JobsGame() {
  const [prog, setProg] = useState<Progress>(loadProgress);
  const job = jobByN(prog.at);
  const activeJobRef = useRef(job); activeJobRef.current = job;
  const [st, setSt] = useState(() => initialState(job));
  const build = st.build, tray = st.tray;
  const [selected, setSelected] = useState<string | null>(null); // tray uid
  const [editing, setEditing] = useState<string | null>(null);  // socket id
  const [briefOpen, setBriefOpen] = useState(true);
  const [help, setHelp] = useState(false);
  const [levels, setLevels] = useState(false);
  const [ledger, setLedger] = useState(false);
  const [test, setTest] = useState<{ running: boolean; sale: number; result: TestResult | null; caption: string; shown: number; waitTap?: 'approve' | null; fix?: string | null; dirty: boolean }>({ running: false, sale: 0, result: null, caption: '', shown: 0, dirty: true });
  const [run, setRunState] = useState<Run | null>(() => { const r = loadRun(); return r && r.job === prog.at ? r : r; });
  const [drag, setDrag] = useState<{ uid: string; kind: PartKind; x: number; y: number; moved: boolean } | null>(null);
  const [runClosed, setRunClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shake, setShake] = useState<string | null>(null);
  const session = useApp(s => s.session);
  const sessionError = useApp(s => s.sessionError);
  const payout = useApp(s => (run?.payoutId ? s.payouts[run.payoutId] : undefined));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JobScene | null>(null);
  const tapResolve = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const [is2d, setIs2d] = useState(false);

  const setRun = useCallback((r: Run | null | ((x: Run | null) => Run | null)) => {
    const n = typeof r === 'function' ? r(runRef.current) : r;
    runRef.current = n; saveRun(n); setRunState(n);
  }, []);
  const update = (p: Partial<Progress>) => setProg(o => { const n = { ...o, ...p }; saveProgress(n); return n; });

  // ---------- scene lifecycle ----------
  useEffect(() => {
    mounted.current = true;
    const s = createJobScene(canvasRef.current!, overlayRef.current!, {
      margins: (w, h, portrait) => (portrait ? { t: Math.min(250, h * 0.3), b: 210, l: 8, r: 8 } : { t: 76, b: 150, l: Math.min(380, w * 0.3), r: 24 }),
    });
    sceneRef.current = s; setIs2d(s.is2d);
    return () => { mounted.current = false; s.dispose(); sceneRef.current = null; };
  }, []);
  useEffect(() => { sceneRef.current?.setJob(job); sceneRef.current?.setBuild(st.build); }, [job]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sceneRef.current?.setBuild(build); }, [build]);
  useEffect(() => { const t = setTimeout(() => sceneRef.current?.relayout(), 50); return () => clearTimeout(t); }, [briefOpen]);

  // ---------- switching jobs ----------
  const testEpoch = useRef(0);
  const openJob = (n: number) => {
    testEpoch.current++; tapResolve.current?.(); setRunClosed(false);
    if (test.running) return;
    const j = jobByN(n);
    setSt(initialState(j)); setSelected(null); setEditing(null); setBriefOpen(true); setLevels(false);
    setTest({ running: false, sale: 0, result: null, caption: '', shown: 0, dirty: true });
    tapResolve.current = null;
    sceneRef.current?.setPortal('idle', 'sim');
    update({ at: n });
  };

  // ---------- build editing ----------
  const todos = todo(job, build);
  const active = activeSockets(job, build);
  const mutate = (b: Build, t: TrayItem[] = tray) => { setSt({ build: b, tray: t }); setTest(x => ({ ...x, dirty: true, result: x.running ? x.result : null, fix: null })); };
  const place = (socketId: string, uid: string) => {
    const item = tray.find(t => t.uid === uid); if (!item) return false;
    const sock = job.sockets.find(s => s.id === socketId);
    if (!sock || !sock.accepts.includes(item.kind)) { setShake(socketId); setTimeout(() => setShake(null), 500); return false; }
    const b = { ...build }; let t = tray.filter(x => x.uid !== uid);
    const old = b[socketId]; if (old) t = [...t, { uid: old.uid, kind: old.kind }];
    b[socketId] = defaultPlaced(job, item.kind, uid);
    // a Gate leaving the lane takes its Key with it
    if (sock.role === 'mid' && item.kind !== 'Gate') { const k = b[`key${sock.lane}`]; if (k) { t = [...t, { uid: k.uid, kind: k.kind }]; b[`key${sock.lane}`] = null; } }
    mutate(b, t); setSelected(null);
    const placed = b[socketId]!;
    if (placed.kind === 'Payout' || placed.kind === 'Worker' || placed.kind === 'Splitter') setEditing(socketId);
    return true;
  };
  const removeAt = (socketId: string) => {
    const p = build[socketId]; if (!p) return;
    const b = { ...build, [socketId]: null }; let t = [...tray, { uid: p.uid, kind: p.kind }];
    if (socketId.startsWith('mid')) { const k = b[`key${socketId.slice(-1)}`]; if (k) { t = [...t, { uid: k.uid, kind: k.kind }]; b[`key${socketId.slice(-1)}`] = null; } }
    mutate(b, t); setEditing(null);
  };
  const setPlaced = (socketId: string, patch: Partial<Placed>) => mutate({ ...build, [socketId]: { ...build[socketId]!, ...patch } });

  // ---------- drag & tap ----------
  const socketAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) { const s = (el as HTMLElement).closest?.('[data-socket]') as HTMLElement | null; if (s) return s.dataset.socket!; }
    let best: string | null = null, bd = 70;
    overlayRef.current?.querySelectorAll<HTMLElement>('[data-socket]').forEach(el => { const r = el.getBoundingClientRect(); const d = Math.hypot(r.x + r.width / 2 - x, r.y + r.height / 2 - y); if (d < bd) { bd = d; best = el.dataset.socket!; } });
    return best;
  };
  const onChipDown = (e: RPE, item: TrayItem) => {
    if (busy) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ uid: item.uid, kind: item.kind, x: e.clientX, y: e.clientY, moved: false });
  };
  const onChipMove = (e: RPE) => { if (drag) setDrag(d => d && { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 }); };
  const onChipUp = (e: RPE) => {
    if (!drag) return;
    const d = drag; setDrag(null);
    if (!d.moved) { setSelected(s => (s === d.uid ? null : d.uid)); setEditing(null); return; }
    const sock = socketAt(e.clientX, e.clientY);
    if (sock && active.some(s => s.id === sock)) place(sock, d.uid);
  };
  const onSocket = (id: string) => {
    if (busy) return;
    if (selected) { place(id, selected); return; }
    if (build[id]) setEditing(e => (e === id ? null : id));
    else { setShake(id); setTimeout(() => setShake(null), 500); }
  };

  // ---------- TEST (simulated) ----------
  const busy = test.running || (!!run && run.job === job.n && !['done', 'error'].includes(run.phase));
  const playOne = async (s: SaleSim, r: TestResult, i: number, onlyOne: boolean) => {
    const sc = sceneRef.current; if (!sc || !mounted.current) return;
    setTest(x => ({ ...x, sale: i + 1, caption: `Customer ${i + 1} of ${onlyOne ? 1 : 3} pays 0.10 NEAR` }));
    const plan = salePlan(job, build, 'sim');
    await sc.playSale(plan);
    const gateLane = plan.lanes.findIndex(l => l.dest.type === 'gate');
    const portalLane = plan.lanes.findIndex(l => l.dest.type === 'portal');
    if (portalLane >= 0) {
      setTest(x => ({ ...x, caption: 'Portal: NEAR signs an Ethereum payment… (simulated)' }));
      sc.setPortal('swirl', 'sim'); await sleep(i === 0 ? 1100 : 600);
      sc.setPortal('beam', 'sim'); await sleep(i === 0 ? 1300 : 800);
      sc.setPortal('pop', 'sim'); await sleep(1200);
      sc.floater('person:chi', '+0.0001 ETH', 'good eth');
      sc.setPortal('idle', 'sim');
    }
    if (gateLane >= 0) {
      const holder = build.key1?.person;
      if (s.delivered && holder) {
        setTest(x => ({ ...x, caption: `Dayo’s share waits at the Gate. Did the bread arrive?`, waitTap: 'approve' }));
        await new Promise<void>(res => { tapResolve.current = res; });
        if (!mounted.current) return;
        setTest(x => ({ ...x, waitTap: null, caption: `${PEOPLE[holder].name} used the Key. The Gate opens.` }));
        await sc.release('pass', passDest(build, gateLane));
      } else {
        setTest(x => ({ ...x, caption: holder ? 'This bread never arrived. Nobody confirms…' : 'Nobody holds the Key. Nobody can confirm…' }));
        await sleep(1600);
        setTest(x => ({ ...x, caption: 'Time is up: the money goes back to the customer.' }));
        await sc.release('refund', { type: 'nobody' });
        sc.floater('person:customer', 'refund', 'good');
      }
    }
    sc.customerLeave();
    setTest(x => ({ ...x, shown: i + 1 }));
    await sleep(350);
    void r;
  };
  const startTest = async () => {
    if (busy || todos.length) return;
    setEditing(null); setSelected(null); setBriefOpen(true);
    const r = runTest(job, build, api);
    setTest({ running: true, sale: 0, result: r, caption: '', shown: 0, dirty: false });
    if (r.sales.length === 0) { setTest(x => ({ ...x, running: false, shown: 1, caption: '', fix: fixTarget(job, build, r) })); return; }
    const epoch = ++testEpoch.current;
    const count = 3;
    for (let i = 0; i < count; i++) { await playOne(r.sales[i], r, i, false); if (!mounted.current || epoch !== testEpoch.current) return; }
    setTest(x => ({ ...x, running: false, caption: '', fix: r.ok ? null : fixTarget(job, build, r) }));
    if (r.ok) update({ solved: { ...prog.solved, [job.n]: true } });
  };
  const tap = () => { tapResolve.current?.(); tapResolve.current = null; };

  // ---------- SHIP (real) ----------
  const runRef = useRef(run); runRef.current = run;
  const step = (patch: Partial<Run>) => setRun(r => (r ? { ...r, ...patch } : r));
  const playReal = async (effects: OrderResult['effects'], pending: boolean, saleJob: Job = job, saleBuild: Build = build) => {
    const sc = sceneRef.current; if (!sc) return;
    const kind: CoinKind = api.mode === 'mock' ? 'mock' : 'real';
    const plan = salePlan(saleJob, saleBuild, kind);
    // real amounts: only what the API reported
    const got: Received = {};
    for (const e of effects) if (e.kind === 'payout') { const who = Object.values(PEOPLE).find(p => p.account === e.account)?.id; if (who) (got[who] ??= { near: 0n, wei: 0n }).near += BigInt(e.amount); }
    plan.lanes = plan.lanes.map(l => (l.dest.type === 'person' ? { ...l, label: `+${nearShort(got[l.dest.person]?.near ?? 0n)}` } : l));
    void pending;
    await sc.playSale(plan);
  };
  const ship = async () => {
    if (busy || !prog.solved[job.n]) return;
    if (run && !['done', 'error'].includes(run.phase)) { setLevels(true); return; }
    const pend = pendingOrder();
    if (pend && !pend.machineId.startsWith(job.slug.slice(0, 8))) { setRun({ job: job.n, phase: 'error', error: 'An earlier order is still being checked. Open that job first.', started: Date.now() }); return; }
    const c0 = compile(job, build);
    setRunClosed(false);
    setRun({ job: job.n, phase: 'session', started: Date.now(), build: structuredClone(build) });
    try {
      const s = await ensureSession();
      if (!s) throw Error(getState().sessionError || 'Could not create your free test account.');
      if (job.n === 2) {
        if (api.mode === 'live') await checkPortalGas((await api.contractInfo()).portalAddress, CHI_EVM, PORTAL_WEI);
        const l = await loadLimits(true);
        const need = BigInt(PORTAL_WEI) + 21000n * 100_000_000_000n;
        if (!l) throw Error('Cannot read the Portal limits. Try again before shipping.');
        if (BigInt(PORTAL_WEI) > BigInt(l.maxWeiPerPayout ?? '0') || laneAmounts(job, build)[2] < BigInt(l.rate) * BigInt(PORTAL_WEI)) throw Error('This Portal share does not meet the contract limits.');
        if (BigInt(l.epochRemainingWei) < need) throw Error('Ethereum payouts are busy right now (shared hourly budget used up). Try again in about 15 minutes.');
      }
      const c = compile(job, build, s.accountId);
      void c0;
      const id = jobMachineId(job, c.doc, s.accountId);
      step({ phase: 'publish', machineId: id });
      const existing = await api.getMachine(id);
      if (existing && existing.owner !== s.accountId) throw Error('This shop belongs to another account.');
      if (!existing) {
        const row = addRow({ kind: 'publish', title: `Put “${job.title}” on NEAR testnet`, status: 'pending', statusText: 'sending…', detail: [`machine ${id}`] });
        const tx = await api.publish(id, c.doc);
        updateRow(row, { status: 'confirmed', statusText: 'confirmed', tx });
        step({ publishTx: tx });
      }
      step({ phase: 'order' });
      await order(id);
    } catch (e) {
      if (mounted.current) step({ phase: 'error', error: (e as Error).message });
    }
  };
  const order = async (id: string, orderJob: Job = job, orderBuild: Build = build) => {
    const recipient = orderJob.n === 2 ? CHI_EVM : undefined;
    const r = await submitOrder(id, true, recipient, () => step({ phase: 'unknown' }));
    const row = addRow({ kind: 'order', orderId: r.orderId, title: `A seeded customer bought from ${orderJob.shop}`, amount: near(PRICE), status: 'confirmed', statusText: r.pending ? 'paid · Dayo’s share waits at the Gate' : 'paid', tx: r.tx, detail: [`machine ${id}`, `order ${r.orderId}`, '1.32 NEAR deposit kept by the contract for storage'] });
    const ext = r.effects.find(e => e.kind === 'external');
    let payoutRow: string | undefined;
    if (ext && ext.kind === 'external') payoutRow = addRow({ kind: 'payout', payoutId: ext.payoutId, title: 'Portal: 0.0001 ETH to Chi’s wallet (demo)', amount: eth(ext.wei), unit: 'ETH', status: 'pending', statusText: 'signing on NEAR', tx: r.tx });
    // persist before acknowledging the order intent
    setRun(x => x && { ...x, orderId: r.orderId, orderTx: r.tx, customer: (r as { customer?: string }).customer, effects: r.effects, pending: r.pending, payoutId: ext && ext.kind === 'external' ? ext.payoutId : undefined, payoutRow, phase: 'paying' });
    finishOrder(r.orderId);
    void row;
    if (ext && ext.kind === 'external' && payoutRow) trackPayout(ext.payoutId, payoutRow);
    if (!r.effects.length) { step({ phase: 'unknown', error: 'Order observed on NEAR. Payment receipts are unavailable; check the transaction. No new sale will be sent.' }); return; }
    if (activeJobRef.current.n === orderJob.n) await playReal(r.effects, r.pending, orderJob, orderBuild);
    if (r.pending) { step({ phase: 'approve' }); return; }
    afterPaid(id, r.effects, ext && ext.kind === 'external' ? ext.payoutId : undefined, payoutRow);
  };
  const afterPaid = (id: string, effects: OrderResult['effects'], payoutId?: string, payoutRow?: string) => {
    if (activeJobRef.current.n === runRef.current?.job) sceneRef.current?.customerLeave();
    if (payoutId && payoutRow) {
      step({ phase: 'portal' });
      trackPayout(payoutId, payoutRow);
      return;
    }
    step({ phase: 'done' });
    update({ shipped: { ...loadProgress().shipped, [runRef.current?.job ?? job.n]: { machineId: id, orderTx: runRef.current?.orderTx } } });
    void effects;
  };
  const approve = async () => {
    const r = runRef.current; if (!r?.machineId || !r.orderId) return;
    try {
      step({ phase: 'paying' });
      const a = await api.approve(r.machineId, r.orderId);
      addRow({ kind: 'approve', title: 'Delivery confirmed: Dayo’s share released', status: a.observation === 'unknown' ? 'unknown' : 'confirmed', statusText: a.observation === 'unknown' ? 'submitted — result not confirmed yet' : 'confirmed', tx: a.tx });
      step({ approveTx: a.tx, effects: [...(r.effects ?? []), ...a.effects], pending: a.pending });
      if (a.observation === 'unknown') { step({ phase: 'unknown', error: 'The approval was sent, but its result could not be read yet. Check the receipt link.' }); return; }
      await sceneRef.current?.release('pass', passDest(build, 1));
      afterPaid(r.machineId, a.effects);
    } catch (e) { step({ phase: 'approve', error: (e as Error).message }); }
  };
  useEffect(() => {
    if (run?.phase !== 'unknown' || !run.approveTx || !run.machineId || !run.orderId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const found = await api.getOrder(run.machineId!, run.orderId!);
        if (!cancelled && found && !found.pending && found.observation !== 'unknown' && found.effects.some(e => e.kind === 'payout' && e.account === PEOPLE.dayo.account)) {
          step({ effects: found.effects.length ? found.effects : run.effects, pending: false, phase: 'done', error: undefined });
          update({ shipped: { ...loadProgress().shipped, [run.job]: { machineId: run.machineId!, orderTx: run.orderTx } } });
        }
      } catch { /* read only: missing observation never authorizes another approval */ }
    };
    void check(); const timer = setInterval(check, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [run?.phase, run?.approveTx]);
  // Portal confirmation → star (only on API confirmed)
  useEffect(() => {
    const sc = sceneRef.current;
    if (!run || !run.payoutId || !['portal', 'done'].includes(run.phase)) return;
    const s = payout?.status;
    if (s === 'broadcast' && run.job === job.n) sc?.setPortal('beam', api.mode === 'mock' ? 'mock' : 'real');
    else if (s === 'confirmed') {
      if (run.job === job.n) sc?.setPortal('pop', api.mode === 'mock' ? 'mock' : 'real');
      if (run.phase !== 'done') {
        step({ phase: 'done' });
        update({ shipped: { ...loadProgress().shipped, [run.job]: { machineId: run.machineId!, orderTx: run.orderTx, payoutId: run.payoutId, ethConfirmed: true } } });
      }
    } else if (s === 'signature_failed' && run.job === job.n) sc?.setPortal('failed', 'real');
    else if (s && run.job === job.n) sc?.setPortal('swirl', api.mode === 'mock' ? 'mock' : 'real');
  }, [payout?.status, run?.payoutId, run?.phase, job.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // resume after reload: an order in flight is resumed (never re-spent); payouts restart via restoreLedger
  useEffect(() => {
    const r = loadRun(); if (!r) return;

    if (r.phase === 'session' || r.phase === 'publish') step({ phase: 'error', error: 'The page reloaded before the sale. Test this job and ship again; any existing shop will be reused.' });
    if (r.phase === 'paying' && r.orderId && !r.payoutId) {
      if (r.pending) step({ phase: 'approve' });
      else if (r.effects?.length) { step({ phase: 'done' }); update({ shipped: { ...loadProgress().shipped, [r.job]: { machineId: r.machineId!, orderTx: r.orderTx } } }); }
    }
    if (r.phase === 'order' || r.phase === 'unknown' || (r.phase === 'paying' && !r.orderId)) {
      const pend = pendingOrder();
      if (pend && r.machineId && pend.machineId === r.machineId) { setRun({ ...r, phase: 'order' }); void order(r.machineId, jobByN(r.job), r.build ?? initialState(jobByN(r.job)).build).catch(e => step({ phase: 'error', error: (e as Error).message })); }
      else if (!r.orderId) setRun({ ...r, phase: 'error', error: 'The page reloaded before the order was sent. Nothing was spent on it. You can ship again.' });
    }
    if (['portal', 'paying'].includes(r.phase) && r.payoutId && r.payoutRow) { step({ phase: 'portal' }); trackPayout(r.payoutId, r.payoutRow); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // restore the solved build when coming back to a shipped/running job
  useEffect(() => {
    if (run && run.job === job.n && run.phase !== 'error' && test.dirty && !test.result && prog.solved[job.n]) {
      const solved = run.build ? { build: run.build, tray: [] } : solvedBuild(job); if (solved) { setSt(s => ({ ...s, build: solved.build, tray: solved.tray })); setTest(x => ({ ...x, dirty: false, result: runTest(job, solved.build, api), shown: 3 })); }
    }
  }, [job.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- derived UI state ----------
  const result = test.result;
  const passed = !!result?.ok && !test.dirty && !test.running;
  const failed = !!result && !result.ok && !test.dirty && !test.running;
  const runHere = run && run.job === job.n ? run : null;
  const shipping = !!runHere && !['done', 'error'].includes(runHere.phase);
  const shipped = runHere?.phase === 'done';
  const next: string = (() => {
    if (!prog.intro || help) return 'intro';
    if (test.waitTap) return 'tap';
    if (runHere && runClosed && !shipped) return 'reopen';
    if (runHere?.phase === 'approve') return 'approve';
    if (shipped) return 'nextjob';
    if (shipping || test.running) return 'none';
    if (passed) return 'ship';
    if (editing) return build[editing]?.kind === 'Payout' || build[editing]?.kind === 'Worker' ? 'sheet' : 'done-edit';
    if (failed && test.fix) return `socket:${test.fix}`;
    if (editing && build[editing] && ((build[editing]!.kind === 'Payout' || build[editing]!.kind === 'Worker') && !build[editing]!.person)) return 'sheet';
    if (todos.length) {
      const t = todos[0];
      if (t.what === 'person') return `socket:${t.socket}`;
      if (selected) return `socket:${t.socket}`;
      const sock = job.sockets.find(s => s.id === t.socket)!;
      const item = tray.find(x => sock.accepts.includes(x.kind) && !(sock.role === 'end' && x.kind === 'Vault'));
      return item ? `tray:${item.uid}` : `socket:${t.socket}`;
    }
    if (editing) return 'done-edit';
    return 'test';
  })();
  const isNext = (k: string) => (next === k ? ' is-next' : '');
  useEffect(() => { sceneRef.current?.setGlow(selected ? active.filter(s => s.accepts.includes(tray.find(t => t.uid === selected)?.kind as PartKind) && !build[s.id]).map(s => s.id) : [], next.startsWith('socket:') ? next.slice(7) : null); }, [selected, next, build]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedKind = tray.find(t => t.uid === selected)?.kind;
  const bannerText = (() => {
    if (test.running) return test.caption;
    if (runHere) return shipCaption(runHere, job, payout?.status, payout?.waitingPayoutId, payout?.relayError);
    if (failed) return '';
    if (passed) return 'It works! Now put it on NEAR for real.';
    if (selectedKind) return `Now tap a glowing spot for the ${PART_INFO[selectedKind].name}.`;
    if (todos.length) {
      const t = todos[0];
      if (t.what === 'person') return build[t.socket]?.kind === 'Worker' ? 'Who holds the Key? Tap it and choose.' : 'Who does this Payout pay? Tap it and choose.';
      return next.startsWith('tray:') ? 'Drag a part onto a glowing spot (or tap the part, then the spot).' : 'Fill the glowing spot.';
    }
    return 'Everything is placed. Press Test to try it with 3 customers.';
  })();

  // ---------- render ----------
  const reqRows = job.requirements.map(r => {
    const row = result?.rows.find(x => x.id === r.id);
    const show = !!row && !test.dirty && test.shown > 0;
    return { ...r, ok: show ? row!.ok : null, amount: show ? row!.amount : '' };
  });
  const shopUrl = runHere?.machineId ? `${location.origin}/m/${runHere.machineId}` : '';
  const editingP = editing ? build[editing] : null;

  return (
    <div className={`ww-game jobs-game ${is2d ? 'is-2d' : ''}`} data-testid="jobs-game" data-job={job.n} data-next={next}>
      <canvas ref={canvasRef} className="j-canvas" aria-hidden />
      <div ref={overlayRef} className="j-overlay">
        {/* sockets */}
        {active.map(s => {
          const p = build[s.id];
          const fits = !!selectedKind && s.accepts.includes(selectedKind);
          return (
            <div key={s.id} className="j-anchor" data-anchor={`socket:${s.id}`}>
              <button type="button" data-socket={s.id} data-testid={`socket-${s.id}`} disabled={busy}
                className={`j-sock r-${s.role} ${p ? 'filled' : 'empty'} ${fits ? 'fits' : ''} ${shake === s.id ? 'shake' : ''} ${editing === s.id ? 'editing' : ''}${isNext(`socket:${s.id}`)}`}
                onClick={() => onSocket(s.id)} aria-label={p ? `${PART_INFO[p.kind].name}: ${describePlaced(p, job)}` : `Empty spot: ${s.hint}`}>
                {p ? <><PartChip kind={p.kind} small /><small>{describePlaced(p, job)}</small></> : <><b>+</b><small>{s.hint}</small></>}
              </button>
            </div>
          );
        })}
        {/* people */}
        {job.people.map(id => (
          <div key={id} className="j-anchor" data-anchor={`person:${id}`}>
            <div className={`j-person ${id === job.client ? 'client' : ''}`} data-testid={`person-${id}`}>
              <Face id={id} size={30} /><b>{PEOPLE[id].name}</b>
              {id === 'chi' && job.n === 2 && <small>Ethereum wallet (demo)</small>}
            </div>
          </div>
        ))}
        {(test.running || runHere) && <div className="j-anchor" data-anchor="person:customer"><div className="j-person cust"><b>{runHere ? (api.mode === 'mock' ? 'Customer (mock)' : 'Real customer') : `Customer ${test.sale || 1}`}</b></div></div>}
        <div className="j-anchor" data-anchor="stand"><div className="j-stand"><b>{job.shop}</b><small>Coin Slot · 0.10 NEAR a loaf</small></div></div>
        {job.n === 2 && <div className="j-anchor" data-anchor="home"><div className="j-sign">Chi moved abroad</div></div>}
        {job.n === 2 && <div className="j-anchor" data-anchor="isle"><div className="j-isle">Ethereum<small>another blockchain</small></div></div>}
      </div>

      {/* top bar */}
      <header className="j-top">
        <span className="j-logo">WORLDWORKS</span>
        <button type="button" className="j-levels-btn" disabled={test.running} onClick={() => setLevels(v => !v)} data-testid="levels">Job {job.n} of 3 ▾</button>
        <span className="j-pills"><ModePills sim={test.running} /></span>
        <button type="button" className="j-icon" onClick={() => setLedger(v => !v)} aria-label="Ledger" title="Real transactions">≡</button>
        <button type="button" className="j-icon" onClick={() => setHelp(true)} aria-label="Help" data-testid="help">?</button>
      </header>

      {levels && (
        <div className="j-levels g-card" data-testid="level-list">
          {JOBS.map(j => {
            const sh = prog.shipped[j.n];
            return (
              <div key={j.n} className="j-level-row"><button type="button" disabled={!unlocked(prog, j.n)} className={j.n === job.n ? 'on' : ''} onClick={() => openJob(j.n)} data-testid={`level-${j.n}`}>
                <Face id={j.client} size={28} />
                <span><b>{j.n}. {j.title}</b><small>{j.lesson}{!unlocked(prog, j.n) ? ' · locked' : ''}</small></span>
                {prog.solved[j.n] && <em className="star" title="Solved">★</em>}
              </button>{sh && <a {...linkProps(`/m/${sh.machineId}`)} className="live-link">live ↗</a>}</div>
            );
          })}
          <p className="j-note">You can switch jobs any time. Anything running keeps going in the background.</p>
        </div>
      )}

      {/* job card */}
      <section className={`j-brief g-card ${briefOpen ? 'open' : 'closed'}`} data-testid="job-card">
        <div className="j-brief-head" onClick={() => setBriefOpen(o => !o)}>
          <Face id={job.client} size={48} />
          <div>
            <small>JOB {job.n} · {PEOPLE[job.client].name}, {PEOPLE[job.client].role}</small>
            <q>{job.quote}</q>
          </div>
        </div>
        <ul className="j-reqs" data-testid="requirements">
          {reqRows.map(r => (
            <li key={r.id} className={r.ok === null ? '' : r.ok ? 'ok' : 'bad'} data-testid={`req-${r.id}`} data-ok={r.ok === null ? '' : String(r.ok)}>
              <i>{r.ok === null ? '○' : r.ok ? '✓' : '✗'}</i><span>{r.text}</span>{r.amount && <em>{r.amount}</em>}
            </li>
          ))}
        </ul>
        {job.explain && <p className="j-explain">{job.explain}</p>}
        {test.result && !test.dirty && <p className="j-simlabel">Test · simulated in your browser by the same engine the contract runs. Not on any chain.</p>}
      </section>

      {/* banner: one line of what is happening / what to do */}
      {(bannerText || failed) && (!runHere || runClosed) && (
        <div className={`j-banner ${failed ? 'bad' : passed ? 'good' : ''}`} data-testid="banner" aria-live="polite">
          {failed ? <><b>✗</b> <span data-testid="fail-why">{result!.why}</span></> : bannerText}
        </div>
      )}

      {/* Gate tap during test */}
      {test.waitTap && (
        <div className="j-tapcard g-card">
          <p>Customer {test.sale}: the bread arrived.</p>
          <button type="button" className={`j-btn${isNext('tap')}`} onClick={tap} data-testid="tap-approve">
            ✓ Delivered <small>{build.key1?.person ? `${PEOPLE[build.key1.person].name} uses the Key` : ''}</small>
          </button>
        </div>
      )}

      {/* settings sheet for a placed part */}
      {editingP && !busy && (
        <div className="j-sheet g-card" data-testid="sheet">
          <header><PartChip kind={editingP.kind} small /><button type="button" className="g-x" onClick={() => setEditing(null)} aria-label="Close">×</button></header>
          {editingP.kind === 'Splitter' && (
            <div className="j-shares">
              <p>How much goes down each belt?</p>
              {editingP.shares!.map((v, i) => {
                const d = destOf(job, build, i);
                const pass = d.type === 'gate' ? passDest(build, i) : d;
                const to = pass.type === 'person' ? PEOPLE[pass.person].name : pass.type === 'portal' ? 'Portal' : pass.type === 'vault' ? 'Vault' : `belt ${i + 1}`;
                return (
                  <div key={i} className="j-share" data-testid={`share-${i}`}>
                    <i className={`lane l${i}`} /><span>{to}{d.type === 'gate' ? ' (via Gate)' : ''}</span>
                    <button type="button" aria-label={`less to ${to}`} onClick={() => setPlaced(editing!, { shares: editingP.shares!.map((x, j) => (j === i ? Math.max(5, x - 5) : x)) })} data-testid={`share-${i}-minus`}>−</button>
                    <b>{v}%</b>
                    <button type="button" aria-label={`more to ${to}`} onClick={() => setPlaced(editing!, { shares: editingP.shares!.map((x, j) => (j === i ? Math.min(95, x + 5) : x)) })} data-testid={`share-${i}-plus`}>+</button>
                  </div>
                );
              })}
              {(() => { const t = editingP.shares!.reduce((a, b) => a + b, 0); return <p className={`j-total ${t === 100 ? 'ok' : 'bad'}`}>Total {t}%{t === 100 ? ' ✓' : ' (must be 100%)'}</p>; })()}
            </div>
          )}
          {(editingP.kind === 'Payout' || editingP.kind === 'Worker') && (
            <div className="j-who">
              <p>{editingP.kind === 'Payout' ? 'Who gets paid?' : 'Who holds the Key? (they confirm the delivery)'}</p>
              <div className={`j-chips${isNext('sheet')}`}>
                {(editingP.kind === 'Payout' ? job.people : (['customer', 'dayo', 'ada'] as PersonId[])).map(id => (
                  <button key={id} type="button" className={editingP.person === id ? 'on' : ''} onClick={() => { setPlaced(editing!, { person: id }); setEditing(null); }} data-testid={`who-${id}`}>
                    <Face id={id} size={34} /><span>{PEOPLE[id].name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {(editingP.kind === 'Portal' || editingP.kind === 'Vault' || editingP.kind === 'Gate') && <p className="j-what">{editingP.kind === 'Portal' ? 'Sends 0.0001 test ETH to Chi’s Ethereum wallet. Its share (in NEAR) pays the Portal.' : editingP.kind === 'Vault' ? 'Keeps money locked in the shop. Nobody gets it.' : 'Holds the money until the Key holder approves. If nobody does in time, it goes back to the customer.'}</p>}
          <footer>
            <button type="button" className="j-mini" onClick={() => removeAt(editing!)} data-testid="remove-part">Back to tray</button>
            <button type="button" className={`j-mini primary${isNext('done-edit')}`} onClick={() => setEditing(null)} data-testid="sheet-done">Done</button>
          </footer>
        </div>
      )}

      {/* ship panel */}
      {runHere && !runClosed && (
        <section className="j-ship g-card" data-testid="ship-panel" data-phase={runHere.phase}>
          <header><b>{api.mode === 'mock' ? 'MOCK run' : 'Real run · NEAR testnet'}</b><button type="button" className="g-x" onClick={() => setRunClosed(true)} aria-label="Close" data-testid="ship-close">×</button></header>
          <p className="j-run-caption" aria-live="polite" data-testid="ship-caption">{shipCaption(runHere, job, payout?.status, payout?.waitingPayoutId, payout?.relayError)}</p>
          {runHere.phase === 'error' && <p className="j-err" data-testid="ship-error">{runHere.error}</p>}
          {runHere.error && runHere.phase === 'approve' && <p className="j-err">{runHere.error}</p>}
          {runHere.phase === 'unknown' && <p className="j-warn">{runHere.error ?? 'Submitted — result not confirmed yet. Checking the chain… (nothing will be paid twice)'}</p>}
          <Receipts run={runHere} job={job} />
          {runHere.phase === 'approve' && (
            <button type="button" className={`j-btn${isNext('approve')}`} onClick={approve} data-testid="approve-real">✓ Delivered <small>You confirm for the customer (you hold the Key)</small></button>
          )}
          {runHere.payoutId && <><PortalCard payoutId={runHere.payoutId} />
          {payout?.relayError && <p role="alert">{payout.relayError}</p>}
          {(payout?.relayError || payout?.status === 'signature_failed') && <button type="button" className="j-mini" onClick={() => retryRelay(runHere.payoutId!)}>Retry payout status</button>}</>}
          {runHere.phase === 'done' && (
            <div className="j-live" data-testid="live-link">
              <p>Your shop is live. Anyone can pay at:</p>
              <code>{shopUrl.replace(/^https?:\/\//, '')}</code>
              <div>
                <button type="button" className="j-mini" onClick={() => { void navigator.clipboard?.writeText(shopUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); }}>{copied ? 'Copied ✓' : 'Copy link'}</button>
                <a className="j-mini" {...linkProps(`/m/${runHere.machineId}`)} data-testid="open-shop">Open it</a>
              </div>
            </div>
          )}
        </section>
      )}

      {runHere && runClosed && <button type="button" className={`j-reopen j-mini${isNext('reopen')}`} onClick={() => setRunClosed(false)}>View running shop</button>}
      {/* bottom: tray + one main button */}
      <footer className="j-bottom">
        <div className="j-tray" data-testid="tray" aria-label="Parts">
          {tray.length === 0 && <span className="j-tray-empty">All parts placed</span>}
          {tray.map(t => (
            <button key={t.uid} type="button" className={`j-trayitem ${selected === t.uid ? 'sel' : ''}${isNext(`tray:${t.uid}`)}`} data-testid={`tray-${t.kind}`} disabled={busy}
              onPointerDown={e => onChipDown(e, t)} onPointerMove={onChipMove} onPointerUp={onChipUp} onPointerCancel={() => setDrag(null)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(t.uid); setEditing(null); } }}>
              <PartChip kind={t.kind} />
            </button>
          ))}
        </div>
        <div className="j-actions">
          {!shipped && !passed && (
            <button type="button" className={`j-btn test${isNext('test')}`} disabled={busy || todos.length > 0} onClick={startTest} data-testid="test">
              Test <small>3 customers · simulated</small>
            </button>
          )}
          {passed && !shipped && (
            <button type="button" className={`j-btn ship${isNext('ship')}`} disabled={busy} onClick={ship} data-testid="ship">
              Ship it for real <small>{api.mode === 'mock' ? 'MOCK: no chain, fake hashes' : 'Puts this machine on NEAR testnet and runs 1 real sale. ~1 min. No wallet.'}</small>
            </button>
          )}
          {shipped && (
            job.n < 3
              ? <button type="button" className={`j-btn next${isNext('nextjob')}`} onClick={() => openJob(job.n + 1)} data-testid="next-job">Next job → <small>{JOBS[job.n].title}</small></button>
              : <button type="button" className={`j-btn next${isNext('nextjob')}`} onClick={() => setLevels(true)} data-testid="next-job">All jobs done ★ <small>see your live shops</small></button>
          )}
          {passed && !shipped && job.n < 3 && !shipping && <button type="button" className="j-link" onClick={() => openJob(job.n + 1)} data-testid="skip-ship">Skip to the next job</button>}
        </div>
      </footer>

      {drag?.moved && <div className="j-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}><PartChip kind={drag.kind} small /></div>}

      {(!prog.intro || help) && (
        <div className="j-intro" role="dialog" aria-modal data-testid="intro">
          <div className="g-card">
            <h1>WORLDWORKS</h1>
            <p className="point" data-testid="point">Money that runs itself: solve a real person’s money problem with parts, then ship it as a real payment app on NEAR.</p>
            {help && <ol className="how"><li><b>Read the job.</b> A person needs money to move a certain way.</li><li><b>Build.</b> Put parts on the glowing spots.</li><li><b>Test.</b> 3 pretend customers buy. Each rule gets ✓ or ✗.</li><li><b>Ship.</b> One real sale on NEAR testnet. You get a link anyone can pay.</li></ol>}
            <button type="button" className="j-btn is-next" data-testid="start" onClick={() => { update({ intro: true }); setHelp(false); }}>{help ? 'Got it' : 'Start job 1'}</button>
          </div>
        </div>
      )}
      <LedgerPanel open={ledger} onClose={() => setLedger(false)} />
      {sessionError && runHere?.phase === 'error' && <span className="sr-only">{sessionError}</span>}
    </div>
  );
}

function solvedBuild(job: Job): { build: Build; tray: TrayItem[] } | null {
  const s = initialState(job);
  const b: Build = { ...s.build };
  if (job.n === 1) Object.assign(b, { hub: { uid: 's', kind: 'Splitter', shares: [60, 20, 20] }, end0: { uid: 'a', kind: 'Payout', person: 'ada' }, end1: { uid: 'b', kind: 'Payout', person: 'bola' }, end2: { uid: 'c', kind: 'Payout', person: 'chi' } });
  else if (job.n === 2) b.end2 = { uid: 'p', kind: 'Portal' };
  else Object.assign(b, { mid1: { uid: 'g', kind: 'Gate' }, key1: { uid: 'k', kind: 'Worker', person: 'customer' }, end1: { uid: 'd', kind: 'Payout', person: 'dayo' } });
  const tray: TrayItem[] = [...(job.n === 2 ? [{ uid: 'chi-payout', kind: 'Payout' as PartKind }] : []), ...s.tray.filter(t => t.kind === 'Vault')];
  return { build: b, tray };
}

function shipCaption(r: Run, job: Job, status?: string, waiting?: string, relayError?: string): string {
  const mock = api.mode === 'mock' ? ' (mock)' : '';
  switch (r.phase) {
    case 'session': return `Creating your free test account…${mock}`;
    case 'publish': return `Putting ${job.shop} on NEAR testnet…${mock}`;
    case 'order': return `A seeded customer is paying 0.10 NEAR…${mock}`;
    case 'unknown': return 'Payment sent. Checking the result…';
    case 'paying': return 'Paying everyone…';
    case 'approve': return 'Dayo’s share waits at the Gate. Tap Delivered when the bread arrives.';
    case 'portal':
      if (relayError) return 'Chi’s payout could not be verified. Check the receipt before retrying.';
      if (status === 'waiting_for_earlier_nonce') return `Chi’s payment is waiting for an earlier payout #${waiting ?? '?'}.`;
      if (status === 'broadcast') return 'Sent to Ethereum. Waiting for blocks…';
      if (status === 'signature_failed') return 'NEAR could not sign Chi’s payment. No ETH was sent.';
      return 'NEAR is signing Chi’s Ethereum payment…';
    case 'done': return job.n === 2 ? `Chi got paid on Ethereum${mock}. Every receipt is below.` : `Everyone got paid${mock}. Every receipt is below.`;
    case 'error': return 'The real run stopped.';
  }
}

function Receipts({ run, job }: { run: Run; job: Job }) {
  const payouts = useApp(s => (run.payoutId ? s.payouts[run.payoutId] : undefined));
  if (!run.effects) return null;
  const rows: { id: PersonId | 'refund'; text: string; tx?: TxRef; evm?: TxRef; note?: string }[] = [];
  for (const e of run.effects) {
    if (e.kind === 'payout') {
      const who = Object.values(PEOPLE).find(p => p.account === e.account);
      rows.push({ id: who?.id ?? 'refund', text: `${who?.name ?? 'Customer refund'} +${near(e.amount, 2)} NEAR`, tx: who?.id === 'dayo' && run.approveTx ? run.approveTx : run.orderTx });
    } else if (e.kind === 'vault') rows.push({ id: 'refund', text: `Vault kept ${near(e.amount, 2)} NEAR`, tx: run.orderTx });
    else {
      const confirmed = payouts?.status === 'confirmed';
      rows.push({ id: 'chi', text: confirmed ? `Chi +${eth(e.wei)} ETH on Sepolia` : `Chi: ${eth(e.wei)} ETH on the way`, tx: run.orderTx, evm: confirmed ? payouts?.evmTx : undefined, note: `Chi’s ${near(e.fee, 2)} NEAR share paid the Portal` });
    }
  }
  if (run.pending && !run.approveTx) rows.push({ id: 'dayo', text: 'Dayo: 0.02 NEAR waiting at the Gate', tx: run.orderTx });
  return (
    <ul className="j-receipts" data-testid="receipts">
      {rows.map((r, i) => (
        <li key={i} data-testid={`receipt-${r.id}`}>
          {r.id !== 'refund' ? <Face id={r.id} size={26} /> : <i className="j-dot" />}
          <span>{r.text}{r.note && <small>{r.note}</small>}</span>
          <Tx tx={r.tx} label="NEAR" />{r.evm && <Tx tx={r.evm} label="Sepolia" />}
        </li>
      ))}
      <li className="j-fine"><details><summary>Details</summary>
        <p>Machine <code>{run.machineId}</code>. The customer paid 0.10 NEAR plus a 1.32 NEAR deposit kept by the contract for storage.{run.customer ? ` Customer account: ${run.customer} (seeded demo customer).` : ''}</p>
        <Tx tx={run.publishTx} label="publish" />
      </details></li>
    </ul>
  );
}
