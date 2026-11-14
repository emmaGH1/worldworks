// GAME-3: real puzzles. JOB chip → BUILD a tree of parts (chained Splitters, Gate exits, a Portal anywhere) →
// TEST (3 simulated customers through the wasm engine; each requirement pill ticks as its coins land) → SHIP (real NEAR testnet).
// One thing moves at a time; every screen has exactly one highlighted next action (class "is-next").
// Simulated = labeled "Test · simulated" and never in the ledger. Real = TESTNET with explorer links, receipts only from API results.
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPE } from 'react';
import { api } from '../../api';
import type { OrderResult, TxRef } from '../../api/types';
import { approvalIntent, submitApproval, finishApproval } from '../../lib/approvals';
import { recordNearEffects, nearTransferText, addRow, ensureSession, getState, finishOrder, pendingOrder, submitOrder, trackPayout, updateRow, retryRelay, useApp } from '../../lib/store';
import { loadLimits, useLimits } from '../../lib/limits';
import { linkProps } from '../../lib/router';
import { eth, isEvmAddress, near, shortAddr } from '../../lib/units';
import { Tx, PortalCard, LedgerPanel, useTick } from '../hud';
import {
  JOBS, PEOPLE, PART_INFO, PRICE, PORTAL_OPTIONS, DEFAULT_RATE, SHARE_STEP, activeSockets, compile, defaultPlaced, initialState, jobByN, jobMachineId,
  runTest, todo, subtree, maxBelts, sinkFlows, ownerOf, fmtN, fmtE, partsUsed,
  type Build, type Ctx, type Job, type PartKind, type PersonId, type Placed, type TestResult, type TrayItem, type SinkFlow,
} from './jobs';
import { createJobScene, type JobScene, type LaneDest, type Flow, type CoinKind } from './scene';
import '../game.css';
import './jobs.css';
import { Face } from './Face';
import { Spotlight } from './Spotlight';
import { sound } from './sound';
import { useDismiss, OverlayClose } from './useDismiss';
import { FACTORY_ENABLED } from './factory';
import { simClock } from './simClock';
import { partReason, personReason, requirementReason } from './reasoning';
import { ReasonTooltip } from './ReasonTooltip';
import { FactoryView } from './FactoryView';
import { checkPortalGas } from './portalPreflight';

// ------------------------------------------------------------------ persistence (keyed by mode + contract)
const contractId = () => (api.mode === 'mock' ? 'mock-contract.testnet' : (import.meta.env?.VITE_CONTRACT_ID as string | undefined) ?? 'ww-portal-261112.testnet');
const scope = () => `${api.mode}:${contractId()}`;
type Shipped = { machineId: string; orderTx?: TxRef; payoutId?: string; ethConfirmed?: boolean; link?: string };
type Friends = { f1: string; f2: string; done: boolean; names?: Partial<Record<'f1' | 'f2', string>> };
type Progress = { factoryHistory?: Record<number, Shipped[]>; intro: boolean; at: number; solved: Record<number, number>; shipped: Record<number, Shipped>; seen: Record<number, boolean>; builds: Record<number, Build>; friends: Friends };
type RunPhase = 'session' | 'publish' | 'order' | 'approve' | 'paying' | 'portal' | 'done' | 'error' | 'unknown';
type Run = {
  job: number; phase: RunPhase; machineId?: string; publishTx?: TxRef; orderId?: string; orderTx?: TxRef; customer?: string; recipient?: string;
  effects?: OrderResult['effects']; pending?: boolean; approveTx?: TxRef; payoutId?: string; payoutRow?: string; error?: string; started: number; build?: Build;
  backgrounded?: boolean; resolution?: 'pending' | 'approved' | 'expired'; gateIntent?: 'approve' | 'expire';
  ctx?: Ctx; balanceBefore?: string; balanceAfter?: string; account?: string; orderEffects?: number;
};
const PKEY = () => `ww-jobs3-${scope()}`;
const RKEY = () => `ww-jobs3-run-${scope()}`;
function loadProgress(): Progress {
  const p: Progress = { intro: false, at: 1, solved: {}, shipped: {}, seen: {}, builds: {}, friends: { f1: '', f2: '', done: false } };
  try { Object.assign(p, JSON.parse(localStorage.getItem(PKEY()) ?? '{}')); } catch { /* storage off */ }
  const q = Number(new URLSearchParams(location.search).get('job'));
  if (q >= 1 && q <= 5) p.at = q;
  return p;
}
const saveProgress = (p: Progress) => { try { localStorage.setItem(PKEY(), JSON.stringify(p)); } catch { /* storage off */ } };
/** Storage can throw (blocked site data, some private windows); never let that crash the game. */
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
function loadRun(): Run | null { try { return JSON.parse(localStorage.getItem(RKEY()) ?? 'null'); } catch { return null; } }
const saveRun = (r: Run | null) => { try { if (r) localStorage.setItem(RKEY(), JSON.stringify(r)); else localStorage.removeItem(RKEY()); } catch { /* storage off */ } };
const unlocked = (p: Progress, n: number) => n === 1 || (n === 5 ? !!p.solved[1] : !!p.solved[n - 1]);
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const NEAR_ACCOUNT = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const friendKind = (s: string): 'near' | 'evm' | 'bad' | 'none' => { const v = s.trim(); return !v ? 'none' : isEvmAddress(v) ? 'evm' : NEAR_ACCOUNT.test(v) ? 'near' : 'bad'; };

function recordRunEffects(r: Run) {
  if (!r.orderId || !r.effects) return;
  recordNearEffects({orderId:r.orderId, tx:r.orderTx ?? {hash:'',explorerUrl:''}, pending:!!r.pending, effects:r.effects, trace:[]});
  if (r.orderEffects !== undefined) for (const row of getState().ledger) {
    const i = Number(row.detail?.find(d => d.startsWith('effect '))?.slice(7));
    if (row.orderId === r.orderId && Number.isFinite(i) && i >= r.orderEffects) updateRow(row.id,{tx:r.approveTx});
  }
}

// ------------------------------------------------------------------ small pieces
const PART_ICON: Record<PartKind, string> = { Splitter: '◔', Payout: '✉', Portal: '◎', Vault: '▣', Gate: '⊓', Worker: '⚿' };
function PartChip({ kind, small }: { kind: PartKind; small?: boolean }) {
  return <span className={`j-part k-${kind} ${small ? 'small' : ''}`}><b>{PART_ICON[kind]}</b>{!small && <span><em>{PART_INFO[kind].name}</em><small>{PART_INFO[kind].does}</small></span>}</span>;
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const coinsFor = (y: bigint) => (y > 0n ? Math.max(1, Math.round(Number(y / 10n ** 21n) / 10)) : 0);
const pname = (p: PersonId) => PEOPLE[p].name;

function shortLabel(p: Placed | null, job: Job, who: (p: PersonId) => string): string {
  if (!p) return '';
  if (p.kind === 'Splitter') return p.shares!.join('·');
  if (p.kind === 'Payout') return p.person ? (p.person === 'customer' ? 'Refund' : who(p.person)) : 'who?';
  if (p.kind === 'Worker') return p.person ? who(p.person) : 'who?';
  if (p.kind === 'Portal') return `${fmtE(BigInt(p.wei ?? '0'))} ETH`;
  if (p.kind === 'Vault') return 'Vault';
  if (p.kind === 'Gate') return 'Gate';
  void job; return '';
}
function destOf(p: Placed | null): LaneDest {
  if (!p) return { type: 'nobody' };
  if (p.kind === 'Payout') return p.person ? { type: 'person', person: p.person } : { type: 'nobody' };
  if (p.kind === 'Portal') return { type: 'portal' };
  if (p.kind === 'Vault') return { type: 'vault' };
  return { type: 'nobody' };
}
/** Coin flows for one sale: direct sinks, plus one held flow per Gate. */
function salePlan(build: Build, sinks: SinkFlow[], label: (f: SinkFlow) => string | undefined) {
  const direct: Flow[] = []; const gates = new Map<string, { path: string[]; amount: bigint }>();
  for (const f of sinks) {
    if (f.gate) { if (!gates.has(f.gate)) gates.set(f.gate, { path: f.path.slice(0, f.path.indexOf(f.gate) + 1), amount: 0n }); if (f.port === 'p') gates.get(f.gate)!.amount += f.amount; continue; }
    const p = build[f.path[f.path.length - 1]];
    direct.push({ path: f.path, coins: coinsFor(f.amount), dest: destOf(p), label: label(f), tag: p?.person });
  }
  const held: Flow[] = [...gates.values()].map(g => ({ path: g.path, coins: coinsFor(g.amount), dest: { type: 'gate' }, label: 'waiting for the Key' }));
  return { flows: [...direct, ...held], gates: [...gates.keys()] };
}
function releaseFlows(build: Build, sinks: SinkFlow[], gate: string, pass: boolean, label: (f: SinkFlow) => string | undefined): Flow[] {
  return sinks.filter(f => f.gate === gate && f.port === (pass ? 'p' : 'f')).map(f => {
    const p = build[f.path[f.path.length - 1]];
    return { path: f.path.slice(f.path.indexOf(gate)), coins: coinsFor(f.amount), dest: destOf(p), label: label(f), tag: p?.person };
  });
}
/** Which socket to point at after a failed test. */
function fixTarget(job: Job, build: Build, r: TestResult): string {
  const socks = activeSockets(job, build);
  const bad = r.rows.find(x => !x.ok)?.id;
  const find = (pred: (p: Placed) => boolean) => socks.find(s => build[s.id] && pred(build[s.id]!))?.id;
  if (/Splitter's belts|more than 0/.test(r.why)) return find(p => p.kind === 'Splitter' && (p.shares ?? []).reduce((a, b) => a + b, 0) !== 100) ?? 'r';
  if (/Vault/.test(r.why)) return find(p => p.kind === 'Vault') ?? 'r';
  if (bad === 'key') return find(p => p.kind === 'Worker') ?? find(p => p.kind === 'Gate') ?? 'r';
  if (/only uses Ethereum/.test(r.why)) return find(p => p.kind === 'Payout' && p.person === 'chi') ?? 'r';
  if (/Portal needs/.test(r.why)) { const s = socks.find(x => build[x.id]?.kind === 'Portal'); return s?.parent ?? s?.id ?? 'r'; }
  if (/before the bread|never arrived|nothing back|Nothing waits/.test(r.why)) return find(p => p.kind === 'Gate') ?? find(p => p.kind === 'Payout' && p.person === 'dayo') ?? 'r';
  if (/Fill every|Choose who/.test(r.why)) return todo(job, build)[0]?.socket ?? 'r';
  return 'r';
}

// ------------------------------------------------------------------ the game
export function JobsGame() {
  const [prog, setProg] = useState<Progress>(loadProgress);
  const [fast,setFast] = useState(false);
  const [overview, setOverview] = useState(()=>FACTORY_ENABLED && !!loadProgress().solved[1] && !new URLSearchParams(location.search).has('job'));
  const [factoryCaption,setFactoryCaption] = useState('');
  const job = jobByN(prog.at);
  const activeJobRef = useRef(job); activeJobRef.current = job;
  const [st, setSt] = useState(() => initialState(job));
  const build = st.build, tray = st.tray;
  const [selected, setSelected] = useState<string | null>(null); // tray uid
  const [target, setTarget] = useState<string | null>(null);     // empty socket tapped first
  const [editing, setEditing] = useState<string | null>(null);  // socket id
  const [cardOpen, setCardOpen] = useState(() => !loadProgress().seen[loadProgress().at]);
  const [restarting,setRestarting] = useState(false);
  const [help, setHelp] = useState(false);
  const [tipClose,setTipClose]=useState<(()=>void)|null>(null);
  const reportTip=useCallback((close:(()=>void)|null)=>setTipClose(()=>close),[]);
  const [guide, setGuide] = useState(() => !loadProgress().intro && lsGet(`ww-guide4-${scope()}`) !== 'done');
  const [tutorialReplay, setTutorialReplay] = useState(false);
  const [reviewedFail, setReviewedFail] = useState(false);
  const [hint, setHint] = useState(0);
  const dismissGuide = () => { setGuide(false); setTutorialReplay(false); try { localStorage.setItem(`ww-guide4-${scope()}`, 'done'); } catch { /* storage off */ } };
  useEffect(() => { if (job.n > 1 && !lsGet(`ww-hint4-${scope()}-${job.n}`)) setHint(job.n); }, [job.n]);

  const [audio, setAudio] = useState(sound.settings);
  const [soundOpen, setSoundOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [title, setTitle] = useState(false);
  const configureAudio = (patch: Partial<typeof audio>) => { sound.configure(patch); setAudio(sound.settings); };
  // Touch pointerdown is not a user activation on mobile browsers; pointerup/touchend/click are.
  useEffect(() => { const unlock = () => sound.unlock(); const evs = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const; evs.forEach(e => window.addEventListener(e, unlock)); return () => { evs.forEach(e => window.removeEventListener(e, unlock)); sound.stop(); }; }, []);
  const [levels, setLevels] = useState(false);
  const [ledger, setLedger] = useState(false);
  const [test, setTest] = useState<{ running: boolean; sale: number; result: TestResult | null; caption: string; shown: number; revealed: string[]; waitTap?: 'approve' | null; fix?: string | null; dirty: boolean }>({ running: false, sale: 0, result: null, caption: '', shown: 0, revealed: [], dirty: true });
  const [run, setRunState] = useState<Run | null>(() => loadRun());
  const [drag, setDrag] = useState<{ uid: string; kind: PartKind; x: number; y: number; moved: boolean } | null>(null);
  const [runClosed, setRunClosed] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [momentClosed, setMomentClosed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shake, setShake] = useState<string | null>(null);
  const [shopEdit, setShopEdit] = useState(false);
  const [friendDraft, setFriendDraft] = useState<Friends>(() => loadProgress().friends);
  const session = useApp(s => s.session);
  const sessionError = useApp(s => s.sessionError);
  const payout = useApp(s => (run?.payoutId ? s.payouts[run.payoutId] : undefined));
  const { limits } = useLimits();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JobScene | null>(null);
  const tapResolve = useRef<(() => void) | null>(null);
  const mounted = useRef(true);
  const [is2d, setIs2d] = useState(false);
  const runRef = useRef(run); runRef.current = run;

  const setRun = useCallback((r: Run | null | ((x: Run | null) => Run | null)) => {
    const n = typeof r === 'function' ? r(runRef.current) : r;
    runRef.current = n; saveRun(n); setRunState(n);
  }, []);
  const update = (p: Partial<Progress> | ((o: Progress) => Partial<Progress>)) => setProg(o => { const n = { ...o, ...(typeof p === 'function' ? p(o) : p) }; saveProgress(n); return n; });

  // ---------- who is in this job (Your shop: you + up to two friends) ----------
  const friends = prog.friends;
  const friendIds = (['f1', 'f2'] as const).filter(f => friendKind(friends[f]) === 'near' || friendKind(friends[f]) === 'evm');
  const evmFriend = friendIds.find(f => friendKind(friends[f]) === 'evm');
  const people: PersonId[] = job.n === 5 ? ['you', ...friendIds] : job.people;
  const abroad: PersonId | undefined = job.abroad ?? (job.n === 5 ? evmFriend : undefined);
  const who = useCallback((p: PersonId) => (p === 'f1' || p === 'f2') ? friends.names?.[p]?.trim() || pname(p) : pname(p), [friends.names]);
  const ctx: Ctx = useMemo(() => {
    const c: Ctx = { rate: limits?.rate ?? DEFAULT_RATE, holder: session?.accountId };
    if (job.n === 5) {
      c.accounts = { you: session?.accountId ?? 'you.testnet' }; c.evm = {}; c.friends = friendIds;
      for (const f of friendIds) { if (friendKind(friends[f]) === 'near') c.accounts[f] = friends[f].trim(); else c.evm[f] = friends[f].trim(); }
    }
    return c;
  }, [job.n, limits?.rate, session?.accountId, friends.f1, friends.f2]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember the player's own account so the You house's Real total survives a reload (it is only a lookup key; Real still needs confirmed receipts).
  useEffect(() => { if (session?.accountId) lsSet(`ww-you-account-${scope()}`, session.accountId); }, [session?.accountId]);
  const factoryCtx = useMemo<Ctx>(()=>({...ctx,accounts:{...ctx.accounts,you:session?.accountId??lsGet(`ww-you-account-${scope()}`)??'you.testnet',...Object.fromEntries(friendIds.filter(f=>friendKind(friends[f])==='near').map(f=>[f,friends[f].trim()]))},evm:Object.fromEntries(friendIds.filter(f=>friendKind(friends[f])==='evm').map(f=>[f,friends[f].trim()])),friends:friendIds}),[ctx,session?.accountId,friends]);
  // ---------- scene lifecycle ----------
  useEffect(() => {
    mounted.current = true;
    const s = createJobScene(canvasRef.current!, overlayRef.current!, {
      margins: (w, h, portrait, mode) => {
        if(mode==='portal') {
          const top=document.querySelector('.j-moment-top')?.getBoundingClientRect().height ?? (portrait?225:170);
          const bottom=document.querySelector('.j-moment-bottom')?.getBoundingClientRect().height ?? (portrait?300:240);
          return {t:top+12,b:bottom+12,l:portrait?10:60,r:portrait?10:60};
        }
        return portrait ? {t:112,b:172,l:6,r:6} : {t:104,b:138,l:Math.min(40,w*.03),r:24};
      },
    });
    sceneRef.current = s; setIs2d(s.is2d);
    void loadLimits();
    return () => { mounted.current = false; s.dispose(); sceneRef.current = null; };
  }, []);
  const worldKey = `${job.n}|${people.join(',')}|${abroad ?? ''}`;
  useEffect(() => { sceneRef.current?.setJob(job, { people, abroad }); sceneRef.current?.setBuild(st.build); }, [worldKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sceneRef.current?.setBuild(build); }, [build]);

  // ---------- switching jobs ----------
  const testEpoch = useRef(0);
  const freshTest = { running: false, sale: 0, result: null, caption: '', shown: 0, revealed: [], dirty: true };
  const openJob = (n: number) => {
    testEpoch.current++; tapResolve.current?.(); setReceiptsOpen(false); setRunClosed(false); setMomentClosed(false);
    if (test.running) return;
    setOverview(false); setRestarting(false);
    const j = jobByN(n);
    setSt(initialState(j)); setSelected(null); setTarget(null); setEditing(null); setLevels(false);
    setCardOpen(!prog.seen[n] && lsGet('ww-skip-intros')!=='1');
    setTest(freshTest);
    tapResolve.current = null;
    sceneRef.current?.setPortal('idle', 'sim'); sceneRef.current?.focus('all');
    update({ at: n });
    if (n === 5 && !prog.friends.done) { setFriendDraft(prog.friends); setShopEdit(true); }
  };
  useEffect(() => { if (job.n === 5 && !prog.friends.done && prog.intro) setShopEdit(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- build editing ----------
  const todos = todo(job, build);
  const active = activeSockets(job, build);
  const mutate = (b: Build, t: TrayItem[] = tray) => { setSt({ build: b, tray: t }); setTest(x => ({ ...x, dirty: true, result: x.running ? x.result : null, fix: null, revealed: [] })); };
  const takeOut = (b: Build, t: TrayItem[], id: string) => { for (const k of subtree(b, id)) { const p = b[k]!; t.push({ uid: p.uid, kind: p.kind }); delete b[k]; } if (id === 'r') b.r = null; return t; };
  const place = (socketId: string, uid: string) => {
    const item = tray.find(t => t.uid === uid); if (!item) return false;
    const sock = active.find(s => s.id === socketId);
    if (!sock || !sock.accepts.includes(item.kind)) { setShake(socketId); setTimeout(() => setShake(null), 500); return false; }
    const b = { ...build }; let t = tray.filter(x => x.uid !== uid);
    if (b[socketId]) t = takeOut(b, t, socketId);
    b[socketId] = defaultPlaced(job, item.kind, uid);
    setHint(0); mutate(b, t); sound.play('place'); setSelected(null); setTarget(null);
    const placed = b[socketId]!;
    if (placed.kind === 'Payout' || placed.kind === 'Worker' || placed.kind === 'Splitter' || placed.kind === 'Portal') setEditing(socketId);
    return true;
  };
  const removeAt = (socketId: string) => {
    if (!build[socketId]) return;
    const b = { ...build }; const t = takeOut(b, [...tray], socketId);
    mutate(b, t); setEditing(null);
  };
  const setPlaced = (socketId: string, patch: Partial<Placed>) => { sound.play('dial'); mutate({ ...build, [socketId]: { ...build[socketId]!, ...patch } }); };
  const setBelts = (socketId: string, n: number) => {
    const p = build[socketId]!; const old = p.shares!;
    const b = { ...build }; let t = [...tray];
    if (n < old.length) for (let i = n; i < old.length; i++) t = takeOut(b, t, `${socketId}.${i}`);
    const even = n === 3 ? [40, 30, 30] : [50, 50];
    b[socketId] = { ...p, shares: even };
    mutate(b, t);
  };

  // ---------- drag & tap ----------
  const socketAt = (x: number, y: number) => {
    for (const el of document.elementsFromPoint(x, y)) { const s = (el as HTMLElement).closest?.('[data-socket]') as HTMLElement | null; if (s) return s.dataset.socket!; }
    let best: string | null = null, bd = 60;
    overlayRef.current?.querySelectorAll<HTMLElement>('[data-socket]').forEach(el => { const r = el.getBoundingClientRect(); const d = Math.hypot(r.x + r.width / 2 - x, r.y + r.height / 2 - y); if (d < bd) { bd = d; best = el.dataset.socket!; } });
    return best;
  };
  const liveClock = !!run && !['done','error'].includes(run.phase);
  useTick(liveClock,1000);
  simClock.fast=fast; simClock.live=liveClock; simClock.testing=test.running && !liveClock;
  const busy = test.running || (!!run && run.job === job.n && !['done', 'error'].includes(run.phase));
  const onChipDown = (e: RPE, item: TrayItem) => {
    if (busy) return;
    sound.play('pickup');
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ uid: item.uid, kind: item.kind, x: e.clientX, y: e.clientY, moved: false });
  };
  const onChipMove = (e: RPE) => { if (drag) setDrag(d => d && { ...d, x: e.clientX, y: e.clientY, moved: d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 }); };
  const onChipUp = (e: RPE) => {
    if (!drag) return;
    const d = drag; setDrag(null);
    if (!d.moved) {
      if (target) { place(target, d.uid); return; }
      setSelected(s => (s === d.uid ? null : d.uid)); setEditing(null); return;
    }
    const sock = socketAt(e.clientX, e.clientY);
    if (sock && active.some(s => s.id === sock)) place(sock, d.uid);
  };
  const onSocket = (id: string) => {
    if (busy) return;
    if (selected) { place(id, selected); return; }
    if (build[id]) { setTarget(null); setEditing(e => (e === id ? null : id)); }
    else { setEditing(null); setTarget(t => (t === id ? null : id)); }
  };

  // ---------- TEST (simulated) ----------
  const reasoningPreview=useMemo(()=>runTest(job,build,api,ctx),[job,build,ctx]);
  const sinks = useMemo(() => sinkFlows(build), [build]);
  const simLabel = (f: SinkFlow) => (f.kind === 'Payout' && f.person ? `+${fmtN(f.amount)}` : f.kind === 'Vault' ? `kept ${fmtN(f.amount)}` : undefined);
  const reveal = (ids: string[]) => {sound.play(ids.some(id=>test.result?.rows.find(r=>r.id===id)?.ok===false)?'fail':'tick');setTest(x => ({ ...x, revealed: [...new Set([...x.revealed, ...ids])] }));};
  const revealFor = (tag?: PersonId, dest?: LaneDest) => {
    const ids = job.requirements.filter(r => (tag && r.who?.includes(tag)) || (dest?.type === 'vault' && (r.id === 'all' || r.id === 'rest')) || (dest?.type === 'portal' && r.who?.includes(abroad ?? 'chi'))).map(r => r.id);
    if (ids.length) reveal(ids);
  };
  const playOne = async (i: number, r: TestResult) => {
    const sc = sceneRef.current; if (!sc || !mounted.current) return;
    const s = r.sales[i];
    const epoch=testEpoch.current;const cancelled=()=>epoch!==testEpoch.current||!mounted.current;
    setTest(x => ({ ...x, sale: i + 1, caption: `Customer ${i + 1} of 3 pays 0.10 NEAR` }));
    sound.play('belt');
    const plan = salePlan(build, sinks, simLabel);
    const land = (f: Flow) => { sound.play('coin',f.coins); sound.play('tick'); if (i === 0 || (!s.delivered && f.tag === 'customer')) revealFor(f.tag as PersonId | undefined, f.dest); };
    await sc.playSale({ kind: 'sim', flows: plan.flows,cancelled }, land);
    if(cancelled())return;
    if (plan.flows.some(f => f.dest.type === 'portal')) {
      const pf = sinks.find(f => f.kind === 'Portal'); const w = BigInt(build[pf!.path[pf!.path.length - 1]]?.wei ?? '0');
      setTest(x => ({ ...x, caption: 'Portal: NEAR signs an Ethereum payment… (simulated)' }));
      sc.setPortal('swirl', 'sim'); await simClock.wait(i === 0 ? 1000 : 500);if(cancelled())return;
      sound.play('beam');sc.setPortal('beam', 'sim'); await simClock.wait(i === 0 ? 1200 : 700);if(cancelled())return;
      sc.setPortal('pop', 'sim'); await simClock.wait(1100);if(cancelled())return;
      if (abroad) sc.floater(`person:${abroad}`, `+${fmtE(w)} ETH`, 'good eth');
      sc.setPortal('idle', 'sim');
      if (i === 0) revealFor(abroad);
    }
    for (const g of plan.gates) {
      const holder = build[`${g}.k`]?.person;
      if (s.delivered && holder) {
        setTest(x => ({ ...x, caption: 'The money waits at the Gate. Did the bread arrive?', waitTap: 'approve' }));
        await new Promise<void>(res => { tapResolve.current = res; });
        if (cancelled()) return;
        setTest(x => ({ ...x, waitTap: null, caption: `${who(holder)} used the Key. The Gate opens.` }));
        await sc.release(g, releaseFlows(build, sinks, g, true, simLabel), 'sim', land);
      } else {
        setTest(x => ({ ...x, caption: holder ? 'This bread never arrived. Nobody confirms…' : 'Nobody holds the Key. Nobody can confirm…' }));
        await simClock.wait(1300);if(cancelled())return;
        setTest(x => ({ ...x, caption: 'Time is up: the Gate sends the money down its “time up” exit.' }));
        await sc.release(g, releaseFlows(build, sinks, g, false, simLabel), 'sim', land);
      }
    }
    if(cancelled())return;
    sc.customerLeave();
    if (i === 0) reveal(job.requirements.filter(q => q.id !== 'refund').map(q => q.id));
    setTest(x => ({ ...x, shown: i + 1 }));
    await simClock.wait(300);
  };
  const startTest = async () => {
    if (busy || todos.length) return;
    setEditing(null); setSelected(null); setTarget(null); setCardOpen(false);
    const l = limits ?? await loadLimits();
    const r = runTest(job, build, api, { ...ctx, rate: l?.rate ?? DEFAULT_RATE });
    setReviewedFail(false); setTest({ running: true, sale: 0, result: r, caption: '', shown: 0, revealed: [], dirty: false });
    if (r.sales.length === 0) { setTest(x => ({ ...x, running: false, shown: 3, revealed: job.requirements.map(q => q.id), caption: '', fix: fixTarget(job, build, r) })); return; }
    const epoch = ++testEpoch.current;
    for (let i = 0; i < 3; i++) { await playOne(i, r); if (!mounted.current || epoch !== testEpoch.current) return; }
    setTest(x => ({ ...x, running: false, caption: '', revealed: job.requirements.map(q => q.id), fix: r.ok ? null : fixTarget(job, build, r) }));
    sound.play(r.ok ? 'pass' : 'fail');
    if(r.ok) { for(let i=0;i<(r.score?.stars??1);i++) setTimeout(()=>sound.play('star'),i*230); if(!prog.solved[job.n]) sound.play('unlock'); }
    if (!r.ok) { setShake(fixTarget(job, build, r)); setTimeout(() => setShake(null), 600); }
    if (r.ok && job.n===1 && !prog.solved[1] && FACTORY_ENABLED) { dismissGuide(); setFactoryCaption("Your machine now runs in your factory. Next: Bola’s plot."); setOverview(true); }
    if (r.ok) update(o => ({ solved: { ...o.solved, [job.n]: Math.max(o.solved[job.n] ?? 0, r.score?.stars ?? 1) }, builds: { ...o.builds, [job.n]: structuredClone(build) } }));
  };
  const tap = () => { tapResolve.current?.(); tapResolve.current = null; };

  // ---------- SHIP (real) ----------
  const step = (patch: Partial<Run>) => setRun(r => (r ? { ...r, ...patch } : r));
  const realLabel = (effects: OrderResult['effects'], c: Ctx) => {
    const got: Partial<Record<PersonId, bigint>> = {};
    for (const e of effects) if (e.kind === 'payout' && e.settled === true) { const w = ownerOf(e.account, c); if (w) got[w] = (got[w] ?? 0n) + BigInt(e.amount); }
    return (f: SinkFlow) => (f.kind === 'Payout' && f.person && got[f.person] ? `+${fmtN(got[f.person]!)}` : f.kind === 'Payout' ? 'transfer requested' : undefined);
  };
  const playReal = async (effects: OrderResult['effects'], c: Ctx, saleBuild: Build) => {
    const sc = sceneRef.current; if (!sc) return;
    const kind: CoinKind = api.mode === 'mock' ? 'mock' : 'real';
    const plan = salePlan(saleBuild, sinkFlows(saleBuild), realLabel(effects, c));
    await sc.playSale({ kind, flows: plan.flows });
  };
  const ship = async () => {
    if (busy || !prog.solved[job.n]) return;
    if (run && !['done', 'error'].includes(run.phase)) { setLevels(true); return; }
    const pend = pendingOrder();
    if (pend && !pend.machineId.startsWith(job.slug.slice(0, 8))) { setRun({ job: job.n, phase: 'error', error: 'An earlier order is still being checked. Open that job first.', started: Date.now() }); return; }
    setRestarting(false); sound.play('ship'); dismissGuide(); setRunClosed(false); setMomentClosed(false); setCardOpen(false); setReceiptsOpen(false);
    setRun({ job: job.n, phase: 'session', started: Date.now(), build: structuredClone(build) });
    try {
      const s = await ensureSession();
      if (!s) throw Error(getState().sessionError || 'Could not create your free test account.');
      const l = await loadLimits(true);
      if (!l) throw Error('Cannot read the contract limits. Try again before shipping.');
      const c: Ctx = { ...ctx, rate: l.rate, holder: s.accountId, ...(job.n === 5 ? { accounts: { ...ctx.accounts, you: s.accountId } } : {}) };
      const comp = compile(job, build, c);
      if (comp.error) throw Error(comp.error);
      if (comp.recipient) {
        const portalNode = Object.values((comp.doc.machine as { nodes: Record<string, { type: string; wei?: string }> }).nodes).find(p => p.type === 'Portal')!;
        const wei = BigInt(portalNode.wei!);
        const fee = sinkFlows(build).filter(f => f.kind === 'Portal').reduce((a, f) => a + f.amount, 0n);
        if (wei > BigInt(l.maxWeiPerPayout ?? '0') || fee < BigInt(l.rate) * wei) throw Error('This Portal does not meet the contract limits.');
        if (BigInt(l.epochRemainingWei) < wei + 21000n * 100_000_000_000n) throw Error('Ethereum payouts are busy right now (shared hourly budget used up). Try again in about 15 minutes.');
        if (api.mode === 'live') await checkPortalGas((await api.contractInfo()).portalAddress, comp.recipient, wei.toString(), fetch, job.n === 5 ? 'Your friend’s' : 'Chi’s');
      }
      if (api.mode === 'live' && job.n === 5) for (const f of friendIds) {
        const a = c.accounts?.[f]; if (!a || /^[0-9a-f]{64}$/.test(a)) continue;
        const res = await fetch('https://rpc.testnet.fastnear.com', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: a } }) }).then(r => r.json()).catch(() => null);
        if (!res || res.error) throw Error(`${a} is not an account on NEAR testnet. No sale was sent.`);
      }
      const id = jobMachineId(job, comp.doc, s.accountId);
      step({ phase: 'publish', machineId: id, ctx: c, recipient: comp.recipient, account: s.accountId });
      const existing = await api.getMachine(id);
      if (existing && existing.owner !== s.accountId) throw Error('This shop belongs to another account.');
      if (!existing) {
        const row = addRow({ kind: 'publish', title: `Put “${job.title}” on NEAR testnet`, status: 'pending', statusText: 'sending…', detail: [`machine ${id}`] });
        const tx = await api.publish(id, comp.doc);
        updateRow(row, { status: 'confirmed', statusText: 'confirmed', tx });
        step({ publishTx: tx });
      }
      if (job.n === 5) step({ balanceBefore: await api.balance() });
      step({ phase: 'order' });
      await order(id);
    } catch (e) {
      if (mounted.current) step({ phase: pendingOrder() ? 'unknown' : 'error', error: (e as Error).message });
    }
  };
  const order = async (id: string, resend = false) => {
    const r0 = runRef.current!; const orderJob = jobByN(r0.job); const orderBuild = r0.build ?? build; const c = r0.ctx ?? ctx;
    const r = await submitOrder(id, true, r0.recipient, () => step({ phase: 'unknown' }), { resend });
    addRow({ kind: 'order', orderId: r.orderId, title: `A seeded customer bought from ${orderJob.shop}`, amount: near(PRICE), status: 'confirmed', statusText: r.pending ? 'order accepted · a share waits at the Gate' : 'order accepted', tx: r.tx, detail: [`machine ${id}`, `order ${r.orderId}`, '1.32 NEAR deposit kept by the contract for storage'] });
    const ext = r.effects.find(e => e.kind === 'external');
    let payoutRow: string | undefined;
    if (ext && ext.kind === 'external') payoutRow = addRow({ kind: 'payout', payoutId: ext.payoutId, title: `Portal: ${eth(ext.wei)} ETH to ${shortAddr(ext.recipient)}`, amount: eth(ext.wei), unit: 'ETH', status: 'pending', statusText: 'signing on NEAR', tx: r.tx });
    setRun(x => x && { ...x, orderId: r.orderId, orderTx: r.tx, customer: (r as { customer?: string }).customer, effects: r.effects, pending: r.pending, payoutId: ext && ext.kind === 'external' ? ext.payoutId : undefined, payoutRow, phase: 'paying' });
    recordRunEffects(runRef.current!);
    finishOrder(r.orderId);
    if (ext && ext.kind === 'external' && payoutRow) trackPayout(ext.payoutId, payoutRow);
    if (!r.effects.length && !r.pending && !r.recovered) { step({ phase: 'unknown', error: 'Order observed on NEAR. Payment receipts are unavailable; check the transaction. No new sale will be sent.' }); return; }
    if (activeJobRef.current.n === orderJob.n) await playReal(r.effects, c, orderBuild);
    if (r.pending) { step({ phase: 'approve' }); return; }
    afterPaid(id, ext && ext.kind === 'external' ? ext.payoutId : undefined, payoutRow);
  };
  const afterPaid = (id: string, payoutId?: string, payoutRow?: string) => {
    if (activeJobRef.current.n === runRef.current?.job) sceneRef.current?.customerLeave();
    if (runRef.current?.job === 5) void watchBalance();
    if (payoutId && payoutRow) { step({ phase: 'portal' }); trackPayout(payoutId, payoutRow); return; }
    finish(id);
  };
  const finish = (id: string, extra: Partial<Shipped> = {}) => {
    const r = runRef.current; if (!r) return;
    step({ phase: 'done' });
    const link = `/m/${id}${r.recipient && r.job === 5 ? `?to=${r.recipient}` : ''}`;
    update(o => ({ factoryHistory:{...o.factoryHistory,[r.job]:[...(o.factoryHistory?.[r.job]??[]).filter(s=>s.machineId!==id||s.payoutId!==extra.payoutId),{machineId:id,orderTx:r.orderTx,link,...extra}]}, shipped: { ...o.shipped, [r.job]: { machineId: id, orderTx: r.orderTx, link, ...extra } } }));
  };
  const watchBalance = async () => {
    const before = runRef.current?.balanceBefore; if (!before) return;
    for (let i = 0; i < 15 && mounted.current; i++) {
      try { const b = await api.balance(); if (b !== before) { step({ balanceAfter: b }); return; } } catch { /* read only */ }
      await sleep(2000);
    }
  };
  const [canExpire, setCanExpire] = useState(false);
  useEffect(() => {
    setCanExpire(false);
    if (run?.phase !== 'approve' || !run.machineId || !run.orderId) return;
    let stopped = false;
    const check = async () => { try { const e = await api.expiry?.(run.machineId!, run.orderId!); if (!stopped) setCanExpire(!!e?.eligible); } catch { if (!stopped) setCanExpire(false); } };
    void check(); const timer = setInterval(check, 3000);
    return () => { stopped = true; clearInterval(timer); };
  }, [run?.phase, run?.machineId, run?.orderId]);
  const approve = async (refund = false) => {
    const r = runRef.current; if (!r?.machineId || !r.orderId) return;
    try {
      step({ phase: 'paying', gateIntent: refund ? 'expire' : 'approve', orderEffects: r.effects?.length ?? 0, error: undefined });
      const a = await submitApproval(r.machineId, r.orderId, refund ? 'expire' : 'approve');
      addRow({ kind: 'approve', title: refund ? 'Order expired: the refund exit opened' : 'Delivery confirmed: the Gate opened', status: a.observation === 'unknown' ? 'unknown' : 'confirmed', statusText: a.observation === 'unknown' ? 'submitted — result not confirmed yet' : 'confirmed', tx: a.tx });
      step({ resolution: a.observation === 'unknown' ? undefined : refund ? 'expired' : 'approved', approveTx: a.tx, orderEffects: (r.effects ?? []).length, effects: [...(r.effects ?? []), ...a.effects], pending: a.pending });
      if (a.observation === 'unknown') { step({ phase: 'unknown', error: 'The Gate action was sent, but its result could not be read yet. Check the receipt link.' }); return; }
      recordRunEffects(runRef.current!); finishApproval(r.machineId, r.orderId);
      const b = r.build ?? build; const s = sinkFlows(b);
      const g = Object.keys(b).find(k => b[k]?.kind === 'Gate');
      if (g && activeJobRef.current.n === r.job) await sceneRef.current?.release(g, releaseFlows(b, s, g, !refund, realLabel(a.effects, r.ctx ?? ctx)), api.mode === 'mock' ? 'mock' : 'real');
      const ext = a.effects.find(e => e.kind === 'external');
      afterPaid(r.machineId, ext && ext.kind === 'external' ? ext.payoutId : undefined);
    } catch (e) { step({ phase: 'unknown', error: `The Gate action could not be confirmed. Checking the order before offering another action. ${(e as Error).message}` }); }
  };
  useEffect(() => {
    if (!['unknown', 'paying'].includes(run?.phase ?? '') || !run?.gateIntent || !run.machineId || !run.orderId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const found = await api.getOrder(run.machineId!, run.orderId!);
        if (!cancelled && found && !found.pending && found.observation !== 'unknown' && ['approved', 'expired'].includes(found.resolution ?? '')) {
          step({ effects: found.effects, pending: false, resolution: found.resolution === 'expired' ? 'expired' : 'approved', error: undefined });
          recordRunEffects(runRef.current!); finishApproval(run.machineId!,run.orderId!);
          finish(run.machineId!);
        }
      } catch { /* read only: missing observation never authorizes another approval */ }
    };
    void check(); const timer = setInterval(check, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [run?.phase, run?.approveTx, run?.gateIntent]); // eslint-disable-line react-hooks/exhaustive-deps
  // Portal status → scene (only on API status; the star waits for confirmed)
  useEffect(() => {
    const sc = sceneRef.current;
    if (!run || !run.payoutId || !['portal', 'done'].includes(run.phase)) return;
    const s = payout?.status; const kind: CoinKind = api.mode === 'mock' ? 'mock' : 'real';
    if (s === 'broadcast' && run.job === job.n) sc?.setPortal('beam', kind);
    else if (s === 'confirmed') {
      if (run.job === job.n) sc?.setPortal('pop', kind);
      if (run.phase !== 'done') finish(run.machineId!, { payoutId: run.payoutId, ethConfirmed: true });
    } else if (s === 'signature_failed' && run.job === job.n) sc?.setPortal('failed', 'real');
    else if (s && run.job === job.n) sc?.setPortal('swirl', kind);
  }, [payout?.status, run?.payoutId, run?.phase, job.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // resume after reload: an order in flight is resumed (never re-spent); payouts restart via restoreLedger
  useEffect(() => {
    const r = loadRun(); if (!r) return;
    const intent = r.machineId && r.orderId ? approvalIntent(r.machineId,r.orderId) : null;
    if (intent) { step({phase:'unknown', gateIntent:intent.action, approveTx:intent.tx ?? r.approveTx}); return; }
    if(r.approveTx && !r.resolution && ['unknown','paying'].includes(r.phase)) { step({phase:'unknown',gateIntent:'approve'}); return; }
    if (r.phase === 'session' || r.phase === 'publish') step({ phase: 'error', error: 'The page reloaded before the sale. Test this job and ship again; any existing shop will be reused.' });
    if (r.phase === 'paying' && r.orderId && !r.payoutId && !r.gateIntent) {
      if (r.pending) step({ phase: 'approve' });
      else if (r.effects?.length) finish(r.machineId!);
    }
    if (r.phase === 'order' || r.phase === 'unknown' || (r.phase === 'paying' && !r.orderId)) {
      const pend = pendingOrder();
      if (pend && r.machineId && pend.machineId === r.machineId) { setRun({ ...r, phase: 'order' }); void order(r.machineId).catch(e => step({ phase: 'error', error: (e as Error).message })); }
      else if (!r.orderId) setRun({ ...r, phase: 'error', error: 'The page reloaded before the order was sent. Nothing was spent on it. You can ship again.' });
    }
    if (r.job === 5 && r.balanceBefore && ['done','portal','paying'].includes(r.phase)) void watchBalance();
    if (['portal', 'paying'].includes(r.phase) && r.payoutId && r.payoutRow) { step({ phase: 'portal' }); trackPayout(r.payoutId, r.payoutRow); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // restore the solved build when coming back to a solved/shipped job
  useEffect(() => {
    if(guide && tutorialReplay && job.n===1) return;
    const saved = (run && run.job === job.n && run.phase !== 'error' && run.build) || prog.builds[job.n];
    if (saved && prog.solved[job.n] && test.dirty && !test.result) {
      const used = new Set(Object.values(saved).filter(Boolean).map(p => p!.uid));
      const base = initialState(job);
      const left: TrayItem[] = []; const pool = [...base.tray];
      for (const p of Object.values(saved)) if (p) { const i = pool.findIndex(t => t.kind === p.kind); if (i >= 0) pool.splice(i, 1); }
      left.push(...pool.filter(t => !used.has(t.uid)));
      setSt({ build: saved, tray: left });
      setTest(x => ({ ...x, dirty: false, result: runTest(job, saved, api, ctx), shown: 3, revealed: job.requirements.map(q => q.id) }));
    }
  }, [job.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- derived UI state ----------
  const result = test.result;
  const passed = !!result?.ok && !test.dirty && !test.running;
  const failed = !!result && !result.ok && !test.dirty && !test.running;
  const runHere = !restarting && !(guide && tutorialReplay && job.n===1) && run && run.job === job.n ? run : null;
  const shipping = !!runHere && !['done', 'error'].includes(runHere.phase);
  const shipped = runHere?.phase === 'done';
  const momentOn = lsGet('ww-skip-portal')!=='1' && !!runHere?.payoutId && !momentClosed && !runClosed && (runHere.phase === 'portal' || (runHere.phase === 'done' && !!payout));
  useEffect(() => { sceneRef.current?.focus(momentOn ? 'portal' : (!prog.intro || title) ? 'title' : test.running ? 'test' : 'all'); }, [momentOn, prog.intro, title, test.running]);
  useEffect(() => { sound.portal(momentOn && !!payout && !payout.stalled && !payout.readFailed && !['confirmed', 'signature_failed'].includes(payout.status)); if (momentOn && payout?.status === 'confirmed') sound.play('gem'); }, [momentOn, payout?.status, payout?.stalled, payout?.readFailed]);
  useEffect(() => {
    if(!momentOn) return;
    const observer=new ResizeObserver(()=>sceneRef.current?.relayout());
    document.querySelectorAll('.j-moment-top,.j-moment-bottom').forEach(el=>observer.observe(el));
    return ()=>observer.disconnect();
  },[momentOn]);
  const [factory, setFactory] = useState<{customers:number; totals:Partial<Record<PersonId,bigint>>;ethTotals:Partial<Record<PersonId,bigint>>}>({customers:0,totals:{},ethTotals:{}});
  const factoryOn = !overview && (passed || (shipped && !test.dirty)) && !help && prog.intro && !shipping && !momentOn && !editing && !selected && !target && !cardOpen && !receiptsOpen && !levels;
  useEffect(() => {
    setFactory({customers:0,totals:{},ethTotals:{}});
    if (!factoryOn) return;
    let cancelled = false;
    const sc = sceneRef.current, b = structuredClone(build), fs = sinkFlows(b);
    const loop = async () => {
      await sleep(1800);
      while (!cancelled && sc) {
        const plan = salePlan(b, fs, () => 'SIMULATED');
        await sc.playSale({kind:'sim',flows:plan.flows,cancelled:()=>cancelled});
        if (cancelled) return;
        for (const g of plan.gates) { await sc.release(g,releaseFlows(b,fs,g,true,()=> 'SIMULATED'),'sim'); if (cancelled) return; }
        setFactory(v => { const totals={...v.totals},ethTotals={...v.ethTotals}; for(const f of fs) if(f.person && f.kind==='Payout' && f.port!=='f') totals[f.person]=(totals[f.person]??0n)+f.amount; for(const f of fs) if(f.kind==='Portal' && f.port!=='f' && abroad) ethTotals[abroad]=(ethTotals[abroad]??0n)+BigInt(b[f.path.at(-1)!]?.wei??'0'); return {customers:v.customers+1,totals,ethTotals}; });
        sc.customerLeave(); await sleep(2500);
      }
    };
    void loop(); return () => { cancelled=true; sc?.stopSim(); };
  }, [factoryOn, job.n, build]); // illustrative flow only, never an API order
  const continueBuilding = () => { if (job.n < 5) { step({backgrounded:true}); setMomentClosed(true); setRunClosed(true); openJob(job.n+1); } };
  const guideStep = (() => {
    if (overview || !guide || job.n!==1 || !prog.intro || title || shipping || runHere || test.running || levels) return null;
    if (cardOpen) return {target:'job-card',text:'Ada keeps three times each helper’s share.'};
    if (failed && !reviewedFail) return {target:'fail-why',text:'This goal failed. Tap the reason to inspect.'};
    if (editing) {
      const p=build[editing];
      if(p?.kind==='Splitter') return p.shares!.length===2 ? {target:'belt-add',text:'Add a belt for each helper.'} : {target:'sheet',text:'Turn the dials. Then tap Done.'};
      if(p?.kind==='Payout') return {target:`who-${['ada','bola','chi'][Number(editing.split('.')[1]??0)]??'ada'}`,text:'Choose who this Payout pays.'};
      return {target:'sheet',text:'Inspect the part. Tap Done to continue.'};
    }
    if (passed) return {target:'ship',text:'It works! Ship one real testnet sale.'};
    if (failed && test.fix) return {target:`socket-${test.fix}`,text:'Open this part and fix the failed goal.'};
    const t=todos[0];
    if(t) {
      if(selected) return {target:`socket-${t.socket}`,text:'Drop the part on this glowing spot.'};
      if(t.what==='person') return {target:`socket-${t.socket}`,text:'Choose who this part pays.'};
      return {target:`tray-${t.socket==='r'?'Splitter':'Payout'}`,text:t.socket==='r'?'Pick a Splitter to divide each sale.':'Pick a Payout for this belt.'};
    }
    return {target:'test',text:'Test three pretend customers. See what happens.'};
  })();
  const replayHint = () => { setHelp(false); if(job.n===1) { setTutorialReplay(true); setSt(initialState(job));setTest(freshTest);setGuide(true);setCardOpen(true);setRunClosed(true);setReviewedFail(false); } else setHint(job.n); };
  useEffect(()=>sound.test(test.running),[test.running]);
  const shopSetup = job.n === 5 && shopEdit;
  const next: string = (() => {
    if (!prog.intro || title) return 'intro';
    if (shopSetup) return 'shop-done';
    if (cardOpen && (!runHere || runClosed) && !test.running) return 'card';
    if (test.waitTap) return 'tap';
    if (momentOn) return payout?.status === 'confirmed' ? 'moment' : 'none';
    if (runHere && runClosed && !shipped) return 'reopen';
    if (runHere?.phase === 'approve') return 'approve';
    if (shipped) return runClosed ? 'reopen' : 'nextjob';
    if (shipping || test.running) return 'none';
    if (passed) return 'ship';
    if (editing) return (build[editing]?.kind === 'Payout' || build[editing]?.kind === 'Worker') && !build[editing]?.person ? 'sheet' : 'done-edit';
    if (failed && test.fix) return `socket:${test.fix}`;
    if (target) return 'tray';
    if (todos.length) {
      const t = todos[0];
      if (t.what === 'person' || selected) return `socket:${t.socket}`;
      if (job.n === 1 && t.socket === 'r') { const sp = tray.find(x => x.kind === 'Splitter'); if (sp) return `tray:${sp.uid}`; }
      return `socket:${t.socket}`;
    }
    return 'test';
  })();
  const isNext = (k: string) => (!guideStep && next === k ? ' is-next' : '');
  useEffect(() => {
    const kind = tray.find(t => t.uid === selected)?.kind;
    if(guideStep) { const socket=guideStep.target.startsWith('socket-')?guideStep.target.slice(7):null; sceneRef.current?.setGlow(socket?[socket]:[],socket); return; }
    sceneRef.current?.setGlow(kind ? active.filter(s => s.accepts.includes(kind) && !build[s.id]).map(s => s.id) : target ? [target] : [], next.startsWith('socket:') ? next.slice(7) : null);
  }, [selected, target, next, build, guideStep?.target]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedKind = tray.find(t => t.uid === selected)?.kind;
  const bannerText = (() => {
    if (test.running) return test.caption;
    if (runHere) return shipCaption(runHere, job, who, payout?.status, payout?.waitingPayoutId, payout?.relayError);
    if (failed || passed) return '';
    if (selectedKind) return `Now tap a glowing spot for the ${PART_INFO[selectedKind].name}.`;
    if (target) return 'Now tap a part in the tray to put it there.';
    if (todos.length) {
      const t = todos[0];
      if (t.what === 'person') return build[t.socket]?.kind === 'Worker' ? 'Who holds the Key? Tap it and choose.' : 'Who does this Payout pay? Tap it and choose.';
      return 'Drag a part onto a glowing spot (or tap the spot, then a part).';
    }
    return 'Everything is placed. Press Test to try it with 3 customers.';
  })();

  const closeCard = () => {setCardOpen(false);update(o=>({seen:{...o.seen,[job.n]:true}}));};
  const activeOverlay = tipClose?{id:'tooltip',selector:'.j-reason-tooltip',close:tipClose}
    :help?{id:'help',selector:'.j-help',close:()=>setHelp(false)}
    :(!prog.intro||title)?null
    :soundOpen?{id:'sound',selector:'[data-testid="sound-popover"]',close:()=>setSoundOpen(false)}
    :menu?{id:'menu',selector:'[data-testid="menu-sheet"]',close:()=>setMenu(false)}
    :ledger?{id:'ledger',selector:'.ledger',close:()=>setLedger(false)}
    :levels?{id:'levels',selector:'.j-levels',close:()=>setLevels(false)}
    :shopSetup?{id:'shop',selector:'[data-testid="shop-setup"]',close:()=>setShopEdit(false)}
    :test.waitTap?{id:'test-wait',selector:'.j-tapcard,[data-testid="skip-test"]',close:()=>skipTest()}
    :test.running?{id:'test-animation',selector:'.jobs-game',close:()=>skipTest()}
    :editing?{id:'part',selector:'.j-sheet',close:()=>setEditing(null)}
    :guideStep?{id:'guide',selector:'.j-guide-bubble,[data-testid="tutorial-skip"],[data-testid="'+guideStep.target+'"]',close:dismissGuide}
    :momentOn?{id:'portal',selector:'.j-moment-top,.j-moment-bottom',close:()=>{setMomentClosed(true);setRunClosed(true);}}
    :!overview&&cardOpen&&(!runHere||runClosed)&&!test.running?{id:'card',selector:'.j-card',close:closeCard}
    :!overview&&runHere&&!runClosed?{id:'run',selector:'.j-ship,.j-inside',close:()=>setRunClosed(true)}
    :hint===job.n&&!overview&&!cardOpen&&!shipping?{id:'hint',selector:'.j-new-hint',close:()=>{setHint(0);lsSet(`ww-hint4-${scope()}-${job.n}`,'done');}}
    :!overview?{id:'editor',selector:'.jobs-game',close:()=>{dismissGuide();setOverview(true);setCardOpen(false);setRunClosed(true);setMomentClosed(true);}}
    :null;
  useDismiss(activeOverlay);
  useEffect(()=>{sound.portal(shipping||momentOn);},[shipping,momentOn]);
  useEffect(()=>{if(run?.phase)sound.play(run.phase==='done'?'gem':run.phase==='error'?'fail':'ship');},[run?.phase]);
  const skipTest = () => {
    const r=test.result;if(!r)return;
    testEpoch.current++;tapResolve.current?.();tapResolve.current=null;sceneRef.current?.stopSim();sceneRef.current?.setPortal('idle','sim');
    setTest(x=>({...x,running:false,waitTap:null,caption:'',shown:3,revealed:job.requirements.map(q=>q.id),fix:r.ok?null:fixTarget(job,build,r)}));
    sound.play(r.ok?'pass':'fail');
    if(r.ok)for(let i=0;i<(r.score?.stars??1);i++)setTimeout(()=>sound.play('star'),i*230);
    if(r.ok){update(o=>({solved:{...o.solved,[job.n]:Math.max(o.solved[job.n]??0,r.score?.stars??1)},builds:{...o.builds,[job.n]:structuredClone(build)}}));if(job.n===1){dismissGuide();setOverview(true);}}
  };
  useEffect(()=>{const show=(e:KeyboardEvent)=>{if(e.key==='?'&&!(e.target instanceof Element&&e.target.closest('input,textarea'))){e.preventDefault();setHelp(true);}};addEventListener('keydown',show);return()=>removeEventListener('keydown',show);},[]);
  // ---------- render ----------
  const reqRows = job.requirements.filter(r => r.id !== 'friends' || friendIds.length || (result?.rows.some(x => x.id === 'friends'))).map(r => {
    const row = result?.rows.find(x => x.id === r.id);
    const show = !!row && !test.dirty && test.revealed.includes(r.id);
    return { ...r, ok: show ? row!.ok : null, amount: show ? row!.amount : '' };
  });
  const shopLink = runHere?.machineId ? `/m/${runHere.machineId}${runHere.recipient && runHere.job === 5 ? `?to=${runHere.recipient}` : ''}` : '';
  const shopUrl = shopLink ? `${location.origin}${shopLink}` : '';
  const editingP = editing ? build[editing] : null;
  const editingSock = editing ? active.find(s => s.id === editing) : undefined;
  const parts = partsUsed(job, build);
  const rateText = `${Number(BigInt(limits?.rate ?? DEFAULT_RATE)) / 1e6} NEAR per 1 ETH`;
  const portalInflow = editing ? sinks.filter(f => f.path[f.path.length - 1] === editing).reduce((a, f) => a + f.amount, 0n) : 0n;
  const childName = (sid: string) => {
    const p = build[sid];
    if (!p) return 'empty belt';
    if (p.kind === 'Payout') return p.person ? (p.person === 'customer' ? 'Refund' : who(p.person)) : 'Payout';
    if (p.kind === 'Portal') return abroad ? `Portal → ${who(abroad)}` : 'Portal';
    return PART_INFO[p.kind].name;
  };
  const shareText = job.n === 5 ? 'I built a money machine in WORLDWORKS. Buy a loaf for 0.10 test NEAR and it pays me (and my friends) automatically on NEAR testnet:' : `I solved “${job.title}” in WORLDWORKS. This shop splits every sale on NEAR testnet by itself:`;
  useEffect(() => {
    if ((prog.intro && !title) || help) return;
    const startOnEnter = (e: KeyboardEvent) => {
      if (!['Tab','Shift','Control','Alt','Meta'].includes(e.key) && !e.repeat && !(e.target instanceof Element && e.target.closest('input,textarea,select'))) {
        e.preventDefault(); update({intro:true}); setTitle(false);
      }
    };
    window.addEventListener('keydown', startOnEnter);
    return () => window.removeEventListener('keydown', startOnEnter);
  }, [prog.intro, title, help]);
  const share = async () => { try { if (navigator.share) { await navigator.share({ title: 'WORLDWORKS shop', text: shareText, url: shopUrl }); return; } } catch { /* cancelled */ } void navigator.clipboard?.writeText(`${shareText} ${shopUrl}`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); };

  return (
    <div className={`ww-game jobs-game ${new URLSearchParams(location.search).get('lowfx') === '1' ? 'lowfx' : ''} ${is2d ? 'is-2d' : ''} ${test.running || shipping ? 'is-running' : ''} ${momentOn ? 'is-moment' : ''} ${!prog.intro || title ? 'is-title' : ''} ${overview && prog.intro && !title ? 'is-factory' : ''}`} onClickCapture={e => { if ((e.target as HTMLElement).closest('button')) sound.play('tap'); if ((e.target as HTMLElement).closest('[data-testid="fail-why"]')) setReviewedFail(true); }} data-testid="jobs-game" data-job={job.n} data-next={next}>
      <ReasonTooltip onDismissChange={reportTip} />
      <canvas ref={canvasRef} className="j-canvas" aria-hidden />
      <div ref={overlayRef} className="j-overlay">
        {active.filter(s=>s.parent && s.role==='node').map(s=><div key={`belt:${s.id}`} className="j-anchor" data-anchor={`belt:${s.id}`}><button className="j-belt-hit" aria-label={`Inspect belt ${s.id}`} data-reason={`Belt to ${s.id}: ${partReason(build,s.id,ctx)}`} /></div>)}
        {active.map(s => {
          const p = build[s.id];
          const fits = !!selectedKind && s.accepts.includes(selectedKind);
          return (
            <div key={s.id} className="j-anchor" data-anchor={`socket:${s.id}`}>
              <button data-reason={p ? partReason(build,s.id,ctx) : undefined} type="button" data-socket={s.id} data-testid={`socket-${s.id}`} disabled={busy}
                className={`j-sock r-${s.role} d-${s.depth} ${p ? `filled k-${p.kind}` : 'empty'} ${s.port === 'p' ? 'port-p' : s.port === 'f' ? 'port-f' : ''} ${fits ? 'fits' : ''} ${target === s.id ? 'targeted' : ''} ${shake === s.id ? 'shake' : ''} ${editing === s.id ? 'editing' : ''}${isNext(`socket:${s.id}`)}`}
                onClick={() => onSocket(s.id)} aria-label={p ? `${PART_INFO[p.kind].name}: ${shortLabel(p, job, who)}` : `Empty spot: ${s.hint}`}>
                {p ? <><PartChip kind={p.kind} small /><span className="lbl">{shortLabel(p, job, who)}</span></> : <><b>+</b>{s.hint !== 'empty' && <span className="lbl">{s.hint}</span>}</>}
              </button>
            </div>
          );
        })}
        {people.map(id => (
          <div key={id} className="j-anchor" data-anchor={`person:${id}`}>
            <div data-reason={personReason(id,result??reasoningPreview)} className={`j-person ${id === job.client ? 'client' : ''}`} data-testid={`person-${id}`}>
              <Face id={id} size={26} /><b>{who(id)}</b>
              {id === abroad && <small>on Ethereum</small>}
              {(id === 'f1' || id === 'f2') && id !== abroad && <small>{shortAddr(friends[id].trim())}</small>}
            </div>
          </div>
        ))}
        {(test.running || runHere) && <div className="j-anchor" data-anchor="person:customer"><div data-reason="Customer: pays 0.10 NEAR per sale. Test customers and their money are simulated; real orders run at network speed." className="j-person cust"><b>{runHere ? (api.mode === 'mock' ? 'Customer (mock)' : 'Real customer') : `Customer ${test.sale || 1}`}</b></div></div>}
        <div className="j-anchor" data-anchor="stand"><div data-reason="Coin Slot: each simulated customer pays 0.10 NEAR. Order storage fees are separate from the money routed through the machine." className="j-stand"><b>{job.n === 5 ? 'Your shop' : job.shop}</b><small>0.10 NEAR a loaf</small></div></div>
        {job.abroad && <div className="j-anchor" data-anchor="home"><div className="j-sign">{pname(job.abroad)} moved abroad</div></div>}
        {abroad && <div className="j-anchor" data-anchor="isle"><div className="j-isle">Ethereum<small>another blockchain</small></div></div>}
      </div>

      {FACTORY_ENABLED && overview && prog.intro && !title && <FactoryView progress={prog} ctx={factoryCtx} onOpen={openJob} caption={factoryCaption} fast={fast} setFast={setFast} live={liveClock} storageKey={`ww-factory6-${scope()}`} balance={run?.job===5?run.balanceAfter:undefined} />}
      {/* top bar: job chip + requirement pills */}
      <header className="j-top">
        <button type="button" className="j-home j-mini" aria-label="Factory" data-testid="factory-home" disabled={test.running} onClick={() => { if(FACTORY_ENABLED) {dismissGuide();setOverview(true);setHelp(false);setMenu(false);setEditing(null);setCardOpen(false);setRunClosed(true);setMomentClosed(true);} else setLevels(true); }}><img className="j-brand-mark" src="/brand/mark-64.png" alt="" width="28" height="28" /><span className="j-home-brand"><img src="/brand/wordmark.webp" alt="WORLDWORKS" width="100" height="20" /><span>{overview?'Factory':'← Back to factory'}</span></span></button>
        <button type="button" className={`j-chip${cardOpen ? '' : isNext('card')}`} onClick={() => { setRunClosed(true); setCardOpen(o => !o); }} data-testid="job-chip" aria-expanded={cardOpen}>
          <Face id={job.client} size={24} /><span><b>{job.n < 5 ? `${job.n}. ` : ''}{job.title}</b>{prog.solved[job.n] ? <em className="j-stars">{stars(prog.solved[job.n])}</em> : null}</span>
        </button>
        <span className="j-network">{api.mode === 'mock' ? 'MOCK' : 'TESTNET'}</span>
        <button type="button" className="j-icon" onClick={() => {setSoundOpen(v=>!v);setMenu(false);}} aria-label={`Sound settings: ${audio.music?'music on':'music off'}, ${audio.effects?'effects on':'effects off'}`} aria-expanded={soundOpen} data-testid="sound"><HudIcon kind={audio.music || audio.effects ? 'sound' : 'muted'} /></button>
        <button type="button" className="j-icon" onClick={() => {setMenu(v=>!v);setSoundOpen(false);}} aria-label="Menu" aria-expanded={menu} data-testid="menu"><HudIcon kind="menu" /></button>
      </header>
      {!cardOpen && (
        <ul className="j-reqpills" data-testid="requirements" onClick={() => setCardOpen(true)}>
          {reqRows.map(r => (
            <li key={r.id} className={r.ok === null ? '' : r.ok ? 'ok' : 'bad'} data-testid={`req-${r.id}`} data-ok={r.ok === null ? '' : String(r.ok)} data-reason={requirementReason(job,r.id,result,result?fixTarget(job,build,result):'r')} title={r.text}>
              <i>{r.ok === null ? '○' : r.ok ? '✓' : '✗'}</i>{r.pill}{r.amount && <em>{r.amount}</em>}
            </li>
          ))}
        </ul>
      )}

      {levels && (
        <div className="j-levels g-card" data-testid="level-list"><OverlayClose onClose={()=>setLevels(false)} />
          {JOBS.map(j => {
            const sh = prog.shipped[j.n];
            return (
              <div key={j.n} className="j-level-row"><button type="button" disabled={!unlocked(prog, j.n)} className={j.n === job.n ? 'on' : ''} onClick={() => openJob(j.n)} data-testid={`level-${j.n}`}>
                <Face id={j.client} size={28} />
                <span><b>{j.n < 5 ? `${j.n}. ` : ''}{j.title}</b><small>{j.lesson}{!unlocked(prog, j.n) ? (j.n === 5 ? ' · unlocks after job 1' : ' · locked') : ''}</small></span>
                {prog.solved[j.n] ? <em className="star" title="Stars">{stars(prog.solved[j.n])}</em> : null}
              </button>{sh && <a {...linkProps(sh.link ?? `/m/${sh.machineId}`)} className="live-link">live ↗</a>}</div>
            );
          })}
          <p className="j-note">Switch jobs any time. Anything running keeps going in the background.</p>
        </div>
      )}

      {menu && <section className="j-hud-sheet g-card" data-testid="menu-sheet" aria-label="Game menu"><OverlayClose onClose={()=>setMenu(false)} />
        <button onClick={()=>{setLevels(true);setMenu(false);}} data-testid="levels">Jobs</button>
        <button onClick={()=>{setLedger(true);setMenu(false);}}>Real transactions</button>
        <button onClick={()=>{setHelp(true);setMenu(false);}} data-testid="help">? Help</button>
        <button onClick={()=>{replayHint();setMenu(false);}}>Replay tutorial</button>
        <button disabled={busy} onClick={()=>{setRestarting(true);setSt(initialState(job));setTest(freshTest);setCardOpen(true);setEditing(null);setMenu(false);setRunClosed(true);setMomentClosed(true);}}>Restart this job</button>
        <button onClick={()=>{setTitle(true);setMenu(false);}}>Title screen</button>
        <button onClick={()=>setMenu(false)}>Close</button>
      </section>}
      {soundOpen && <section className="j-hud-sheet j-sound-panel g-card" data-testid="sound-popover" aria-label="Sound settings">
        <header><h2>Sound</h2><button className="j-icon" aria-label="Close" onClick={()=>setSoundOpen(false)}>✕</button></header>
        {(['music','effects'] as const).map(channel=><div className="j-sound-channel" key={channel}>
          <button className="j-icon" aria-label={channel==='music'?'Music':'Effects'} aria-pressed={audio[channel]} onClick={()=>configureAudio({[channel]:!audio[channel]})}><HudIcon kind={audio[channel]?'sound':'muted'} /></button>
          <label htmlFor={`sound-${channel}`}>{channel==='music'?'Music':'Effects'}</label><output>{Math.round(audio[channel==='music'?'musicVolume':'effectsVolume']*100)}%</output>
          <input id={`sound-${channel}`} aria-label={channel==='music'?'Music volume':'Effects volume'} type="range" min="0" max="1" step="0.05" value={audio[channel==='music'?'musicVolume':'effectsVolume']} style={{'--level':`${audio[channel==='music'?'musicVolume':'effectsVolume']*100}%`} as React.CSSProperties} onChange={e=>configureAudio({[channel==='music'?'musicVolume':'effectsVolume']:Number(e.target.value),[channel]:true})} onPointerUp={()=>{if(channel==='effects')sound.play('tap');}} onKeyUp={()=>{if(channel==='effects')sound.play('tap');}} />
        </div>)}
        <div className="j-sound-master"><label htmlFor="sound-master">Master</label><output>{Math.round(audio.volume*100)}%</output><input id="sound-master" aria-label="Volume" type="range" min="0" max="1" step="0.05" value={audio.volume} style={{'--level':`${audio.volume*100}%`} as React.CSSProperties} onChange={e=>configureAudio({volume:Number(e.target.value)})} /></div>
      </section>}
      {help && <section className="j-hud-sheet j-help g-card" role="dialog" aria-label={`Help: ${job.title}`} data-testid="help-sheet"><OverlayClose onClose={()=>setHelp(false)} />
        <h2>{overview?'Your factory':`Job ${job.n}: ${job.title}`}</h2>{overview&&<p>Choose the yellow Next job button to keep building. Customers run an endless simulated preview, which you can pause. Gold Real totals need confirmed receipts.</p>}
        {job.requirements.map(r=><p key={r.id}>{r.text}</p>)}
        {[...new Set(job.tray)].map(k=><p key={k}><b>{PART_INFO[k].name}</b> — {PART_INFO[k].does}</p>)}
        <button onClick={replayHint}>Show me again</button><button onClick={()=>setHelp(false)}>Close</button>
      </section>}

      {/* job card (expanded on tap) */}
      {cardOpen && (!runHere || runClosed) && !test.running && (
        <section className="j-card g-card" data-testid="job-card"><OverlayClose onClose={closeCard} />
          <div className="j-card-head">
            <Face id={job.client} size={44} />
            <div><small>{job.n < 5 ? `JOB ${job.n} · ` : ''}{pname(job.client)}, {PEOPLE[job.client].role}</small><q>{job.quote}</q></div>
          </div>
          <ul className="j-reqs">
            {reqRows.map(r => <li key={r.id} className={r.ok === null ? '' : r.ok ? 'ok' : 'bad'}><i>{r.ok === null ? '○' : r.ok ? '✓' : '✗'}</i><span>{r.text}</span>{r.amount && <em>{r.amount}</em>}</li>)}
          </ul>
          {job.explain && <p className="j-explain">{job.explain}</p>}
          <p className="j-budget">Parts budget: {job.tray.length} in the tray{job.n < 5 ? ` · fewest parts earns ★★★` : ''}</p>
          {job.n === 5 && <button type="button" className="j-mini" onClick={() => { setFriendDraft(prog.friends); setShopEdit(true); setCardOpen(false); }} data-testid="edit-friends">Change who is in my shop</button>}
          {prog.seen[job.n] && <button className="j-mini" data-testid="skip-intro" onClick={()=>{lsSet('ww-skip-intros','1');closeCard();}}>Skip intro · remember</button>}
          <button type="button" className={`j-btn wide${isNext('card')}`} onClick={() => { setCardOpen(false); update(o => ({ seen: { ...o.seen, [job.n]: true } })); }} data-testid="card-go">{prog.seen[job.n] ? 'Back to the machine' : 'Start building'}</button>
        </section>
      )}

      {test.running && <button className="j-skip-animation j-btn" data-testid="skip-test" onClick={skipTest}>Skip animation · show test result</button>}
      {liveClock && runClosed && <button className="j-progress-chip" data-testid="run-progress" onClick={()=>{setRunClosed(false);setMomentClosed(false);}}> {api.mode==='mock'?'MOCK':'TESTNET'} · {payout?.status??run?.phase} · {Math.max(0,Math.floor((Date.now()-(run?.started??Date.now()))/1000))} s · usually ~60 s{Date.now()-(run?.started??Date.now())>90000?' · Taking longer than usual; keep playing':''} · View status</button>}
      {/* banner: one line of what is happening / what to do */}
      {(bannerText || failed || passed) && (!runHere || runClosed || !['done','error','unknown','approve'].includes(runHere.phase)) && !momentOn && !cardOpen && !shopSetup && (
        <div className={`j-banner ${failed ? 'bad' : passed ? 'good' : ''}`} data-testid="banner" aria-live="polite">
          {failed ? <><b>✗</b> <span data-testid="fail-why" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setReviewedFail(true);}}>{result!.why}</span></>
            : passed ? <span data-testid="pass-note"><b className="j-stars">{stars(result!.score?.stars ?? 1)}</b> It works! {result!.score?.note}</span>
            : bannerText}
        </div>
      )}

      {test.waitTap && (
        <div className="j-tapcard g-card"><OverlayClose onClose={()=>skipTest()} />
          <p>Customer {test.sale}: the bread arrived.</p>
          <button type="button" className={`j-btn${isNext('tap')}`} onClick={tap} data-testid="tap-approve">✓ Delivered <small>{(() => { const g = Object.keys(build).find(k => build[k]?.kind === 'Gate'); const h = g ? build[`${g}.k`]?.person : undefined; return h ? `${who(h)} uses the Key` : ''; })()}</small></button>
        </div>
      )}

      {/* settings sheet for a placed part */}
      {editingP && !busy && (
        <div className="j-sheet g-card" data-testid="sheet"><OverlayClose onClose={()=>setEditing(null)} />
          <header><PartChip kind={editingP.kind} /><button type="button" className="g-x" onClick={() => setEditing(null)} aria-label="Close">×</button></header>
          {editingP.kind === 'Splitter' && (
            <div className="j-shares">
              {editingP.shares!.map((v, i) => (
                <div key={i} className="j-share" data-testid={`share-${i}`}>
                  <i className={`lane l${i}`} /><span>{childName(`${editing}.${i}`)}</span>
                  <button type="button" aria-label={`less to belt ${i + 1}`} onClick={() => setPlaced(editing!, { shares: editingP.shares!.map((x, j) => (j === i ? Math.max(SHARE_STEP, x - SHARE_STEP) : x)) })} data-testid={`share-${i}-minus`}>−</button>
                  <b>{v}%</b>
                  <button type="button" aria-label={`more to belt ${i + 1}`} onClick={() => setPlaced(editing!, { shares: editingP.shares!.map((x, j) => (j === i ? Math.min(100 - SHARE_STEP, x + SHARE_STEP) : x)) })} data-testid={`share-${i}-plus`}>+</button>
                </div>
              ))}
              {(() => { const t = editingP.shares!.reduce((a, b) => a + b, 0); return <p className={`j-total ${t === 100 ? 'ok' : 'bad'}`}>Total {t}%{t === 100 ? ' ✓' : ' (must be 100%)'} · dials click in {SHARE_STEP}% steps</p>; })()}
              <div className="j-belts">
                {editingP.shares!.length < maxBelts(editing!) && <button type="button" className="j-mini" onClick={() => setBelts(editing!, editingP.shares!.length + 1)} data-testid="belt-add">+ belt</button>}
                {editingP.shares!.length > 2 && <button type="button" className="j-mini" onClick={() => setBelts(editing!, editingP.shares!.length - 1)} data-testid="belt-remove">− belt</button>}
              </div>
            </div>
          )}
          {(editingP.kind === 'Payout' || editingP.kind === 'Worker') && (
            <div className="j-who">
              <p>{editingP.kind === 'Payout' ? 'Who gets paid?' : 'Who holds the Key? (they confirm the delivery)'}</p>
              <div className={`j-chips${isNext('sheet')}`}>
                {(editingP.kind === 'Payout' ? (job.n === 5 ? people : job.payTo ?? job.people) : (job.keyPeople ?? ['customer'])).map(id => (
                  <button key={id} type="button" className={editingP.person === id ? 'on' : ''} onClick={() => { setPlaced(editing!, { person: id }); setEditing(null); }} data-testid={`who-${id}`}>
                    <Face id={id} size={32} /><span>{id === 'customer' && editingP.kind === 'Payout' ? 'Customer (refund)' : who(id)}</span>
                  </button>
                ))}
              </div>
              {job.n === 5 && editingP.kind === 'Payout' && evmFriend && <p className="j-what">{who(evmFriend)} uses Ethereum: pay them with the Portal.</p>}
            </div>
          )}
          {editingP.kind === 'Portal' && (
            <div className="j-portal-set">
              <p>Sends to {abroad ? who(abroad) : 'an Ethereum wallet'} on Ethereum:</p>
              <div className="j-chips">
                {PORTAL_OPTIONS.filter(w => !limits?.maxWeiPerPayout || BigInt(w) <= BigInt(limits.maxWeiPerPayout)).map(w => (
                  <button key={w} type="button" className={editingP.wei === w ? 'on' : ''} onClick={() => setPlaced(editing!, { wei: w })} data-testid={`wei-${w}`}><span>{fmtE(BigInt(w))} ETH</span></button>
                ))}
              </div>
              <p className="j-what">Fee: {rateText} (contract rule{limits ? ', read live' : ''}). This Portal needs at least <b>{fmtN(BigInt(editingP.wei ?? '0') * BigInt(limits?.rate ?? DEFAULT_RATE))} NEAR</b> flowing in. Now flowing in: <b data-testid="portal-inflow">{fmtN(portalInflow)} NEAR</b>. Extra is kept by the contract.</p>
            </div>
          )}
          {(editingP.kind === 'Vault' || editingP.kind === 'Gate') && <p className="j-what">{editingP.kind === 'Vault' ? 'Keeps money locked in the shop. Nobody gets it.' : 'Holds the money until the Key holder confirms. Two exits: “delivered” and “time up” (after about 100 NEAR blocks on the real contract).'}</p>}
          {editingSock && <p className="j-depth">{editingSock.depth < 2 ? 'Anything can go here, even another Splitter or a Gate.' : 'Last spot on this belt: Payout, Portal or Vault.'}</p>}
          <footer>
            <button type="button" className="j-mini" onClick={() => removeAt(editing!)} data-testid="remove-part">Back to tray</button>
            <button type="button" className={`j-mini primary${isNext('done-edit')}`} onClick={() => setEditing(null)} data-testid="sheet-done">Done</button>
          </footer>
        </div>
      )}

      {/* Your shop: who is in it */}
      {shopSetup && (
        <section className="j-card g-card" data-testid="shop-setup"><OverlayClose onClose={()=>setShopEdit(false)} />
          <div className="j-card-head"><Face id="you" size={44} /><div><small>YOUR SHOP</small><q>Every sale pays you for real on NEAR testnet. Add up to two friends.</q></div></div>
          <p className="j-what">You: {session ? <b className="mono">{shortAddr(session.accountId)}</b> : 'your free test account (made when you ship, no wallet)'}</p>
          {(['f1', 'f2'] as const).map(f => {
            const k = friendKind(friendDraft[f]);
            return (
              <label key={f} className="j-field">
                <span>{pname(f)} <small>(optional)</small></span>
                <input aria-label={`${pname(f)} name (owner only)`} maxLength={24} value={friendDraft.names?.[f] ?? ''} onChange={e => setFriendDraft(d => ({ ...d, names: { ...d.names, [f]: e.target.value } }))} placeholder="Friend’s name (owner only)" data-testid={`name-${f}`} />
                <input value={friendDraft[f]} onChange={e => setFriendDraft(d => ({ ...d, [f]: e.target.value }))} placeholder="name.testnet or 0x… (Sepolia)" spellCheck={false} autoCapitalize="off" data-testid={`friend-${f}`} className={k === 'bad' ? 'bad' : ''} />
                <small>{k === 'near' ? 'NEAR account: paid by a Payout' : k === 'evm' ? 'Ethereum address: paid by the Portal (it must have received Sepolia ETH before)' : k === 'bad' ? 'Not a NEAR account or a 0x address' : 'Leave empty for none'}</small>
              </label>
            );
          })}
          <p className="j-muted">Names stay in this browser for you only. Shared shops show addresses.</p>
          {friendKind(friendDraft.f1) === 'evm' && friendKind(friendDraft.f2) === 'evm' && <p className="j-err">Only one friend can be on Ethereum: each sale carries one Ethereum recipient.</p>}
          <button type="button" className={`j-btn wide${isNext('shop-done')}`} data-testid="shop-go"
            disabled={friendKind(friendDraft.f1) === 'bad' || friendKind(friendDraft.f2) === 'bad' || (friendKind(friendDraft.f1) === 'evm' && friendKind(friendDraft.f2) === 'evm')}
            onClick={() => { update({ friends: { ...friendDraft, done: true }, seen: { ...prog.seen, 5: true } }); setShopEdit(false); setCardOpen(false); setSt(initialState(job)); setTest(freshTest); }}>Build my shop</button>
        </section>
      )}

      {/* Portal moment: the world fills the screen while NEAR signs an Ethereum payment */}
      {momentOn && runHere && <PortalMoment run={runHere} job={job} who={who} abroad={abroad} next={isNext('moment')} onContinue={job.n<5?continueBuilding:undefined} onClose={() => { setMomentClosed(true); setReceiptsOpen(true); }} onSkip={()=>{lsSet('ww-skip-portal','1');setMomentClosed(true);setReceiptsOpen(true);}} />}

      {factoryOn && <div className="j-factory" data-testid="factory-counter"><b>SIMULATED factory</b> · {factory.customers} customers{Object.entries(factory.totals).map(([p,n])=><span key={p}>{who(p as PersonId)} {fmtN(n!)} NEAR</span>)}{Object.entries(factory.ethTotals).map(([p,n])=><span key={p}>{who(p as PersonId)} {fmtE(n!)} ETH</span>)}</div>}
      {hint===job.n && !cardOpen && !momentOn && !shipping && !shopEdit && <aside className="j-new-hint" data-testid="job-hint"><OverlayClose onClose={()=>{setHint(0);lsSet(`ww-hint4-${scope()}-${job.n}`,'done');}} />{job.n===2?'Chain Splitters: a belt can feed another Splitter.':job.n===3?'Portal: send from NEAR to someone on Ethereum.':job.n===4?'Gate: delivery opens one exit; expiry opens the refund.':'Your own shop pays you. Add friends before building.'}<button type="button" onClick={()=>{setHint(0);lsSet(`ww-hint4-${scope()}-${job.n}`,'done');}}>Got it</button></aside>}
      {run && run.job!==job.n && (run.phase!=='done' || run.backgrounded) && <button type="button" className={`j-background-run ${run.phase==='done'?'confirmed':''}`} data-testid="background-run" onClick={()=>{step({backgrounded:false});openJob(run.job);}}>Job {run.job} · {run.phase==='done'?(payout?.status==='confirmed'?'Ethereum confirmed — receipts':'Order complete — check receipts'):payout?.readFailed?'Status unavailable — check':payout?.status??run.phase}</button>}
      {shipping && !momentOn && !runClosed && runHere && !['approve','error','unknown'].includes(runHere.phase) && <section className="j-inside g-card" data-testid="inside-machine"><OverlayClose onClose={()=>setRunClosed(true)} /><h2>Inside the machine</h2><button className="j-mini" data-testid="skip-wait" onClick={()=>{setRunClosed(true);setMomentClosed(true);setOverview(true);}}>Keep playing · track in background</button><p>Usually ~60 s. Network delays can take longer. Close this view to keep playing; tracking continues.</p><InsideMachine run={runHere} />{job.n<5 && <button type="button" className="j-mini" data-testid="continue-building" onClick={continueBuilding}>Start the next job while this finishes</button>}</section>}
      {/* ship panel */}
      {runHere && !runClosed && !momentOn && ['done','error','unknown','approve'].includes(runHere.phase) && (
        <section className="j-ship g-card" data-testid="ship-panel" data-phase={runHere.phase}>
          <header><b>{api.mode === 'mock' ? 'MOCK run' : 'Real run · NEAR testnet'}</b><button type="button" className="g-x" onClick={() => setRunClosed(true)} aria-label="Close" data-testid="ship-close">×</button></header>
          <p className="j-run-caption" aria-live="polite" data-testid="ship-caption">{shipCaption(runHere, job, who, payout?.status, payout?.waitingPayoutId, payout?.relayError)}</p>
          {runHere.phase === 'error' && <p className="j-err" data-testid="ship-error">{runHere.error}</p>}
          {runHere.error && ['approve','done'].includes(runHere.phase) && <p className="j-err">{runHere.error}</p>}
          {runHere.phase === 'unknown' && <p className="j-warn">{runHere.error ?? 'Submitted — result not confirmed yet. Checking the chain… (nothing will be paid twice)'}</p>}
          {runHere.phase === 'unknown' && pendingOrder()?.stalled && runHere.machineId && <div><button type="button" className="j-mini" onClick={() => { void order(runHere.machineId!).catch(e => step({ phase:'unknown', error:e.message })); }}>Check again</button><button type="button" className="j-mini" onClick={() => { void order(runHere.machineId!, true).catch(e => step({ phase:'unknown', error:e.message })); }}>Send again with the same order id</button></div>}
          {runHere.job === 5 && runHere.balanceBefore && <YourBalance run={runHere} onRefresh={async () => { try { step({ balanceAfter: await api.balance(), error: undefined }); } catch { step({ error: 'Could not refresh your balance. Try again.' }); } }} />}
          {runHere.phase === 'done' && <><button type="button" className="j-mini" aria-expanded={receiptsOpen} onClick={() => setReceiptsOpen(v => !v)} data-testid="receipts-toggle">{receiptsOpen ? 'Hide receipts' : 'View receipts'}</button>{receiptsOpen && <Receipts run={runHere} who={who} />}</>}
          {runHere.phase === 'approve' && (
            <button type="button" className={`j-btn${isNext('approve')}`} onClick={() => approve()} data-testid="approve-real">✓ Delivered <small>You hold the Key for this demo; confirm for the customer</small></button>
          )}
          {runHere.phase === 'approve' && canExpire && <button type="button" className="j-mini" onClick={() => approve(true)} data-testid="expire-real">Bread never arrived — refund the customer</button>}
          {runHere.payoutId && <><PortalCard payoutId={runHere.payoutId} />
            {payout?.relayError && <p role="alert">{payout.relayError}</p>}
            {(payout?.relayError || payout?.status === 'signature_failed') && <button type="button" className="j-mini" onClick={() => retryRelay(runHere.payoutId!)}>Retry payout status</button>}</>}
          {runHere.phase === 'done' && (
            <div className="j-live" data-testid="live-link">
              <p>{runHere.job === 5 ? 'Your shop is live. Share it:' : 'This shop is live. Anyone can pay at:'}</p>
              <code>{shopUrl.replace(/^https?:\/\//, '')}</code>
              <div>
                <button type="button" className="j-mini primary" onClick={share} data-testid="share">{copied ? 'Copied ✓' : 'Share'}</button>
                <button type="button" className="j-mini" onClick={() => { void navigator.clipboard?.writeText(shopUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); }} data-testid="copy-link">Copy link</button>
                <a className="j-mini" href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shopUrl)}`} target="_blank" rel="noreferrer" data-testid="share-x">Post on X</a>
                <a className="j-mini" {...linkProps(shopLink)} data-testid="open-shop">Open it</a>
              </div>
            </div>
          )}
        </section>
      )}

      {runHere && runClosed && <button type="button" className={`j-reopen j-mini${isNext('reopen')}`} onClick={() => { setRunClosed(false); setMomentClosed(false); setCardOpen(false); }}>View the real run</button>}
      {/* bottom: tray + one main button */}
      <footer className="j-bottom">
        {!busy && !shipped && (
          <div className={`j-tray${isNext('tray')}`} data-testid="tray" aria-label="Parts">
            {tray.length === 0 && <span className="j-tray-empty">All parts placed</span>}
            {tray.map(t => {
              const fitsTarget = !!target && !!active.find(s => s.id === target)?.accepts.includes(t.kind);
              return (
                <button key={t.uid} type="button" className={`j-trayitem ${selected === t.uid ? 'sel' : ''} ${fitsTarget ? 'fits' : ''}${isNext(`tray:${t.uid}`)}`} data-testid={`tray-${t.kind}`} disabled={busy || (!!target && !fitsTarget)}
                  onPointerDown={e => onChipDown(e, t)} onPointerMove={onChipMove} onPointerUp={onChipUp} onPointerCancel={() => setDrag(null)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (target) place(target, t.uid); else { setSelected(t.uid); setEditing(null); } } }}>
                  <PartChip kind={t.kind} />
                </button>
              );
            })}
          </div>
        )}
        <div className="j-actions">
          <button className="j-mini j-fast" data-testid="fast-forward" aria-pressed={fast && !liveClock} disabled={liveClock} title={liveClock?"Real transactions run at network speed":"Speeds simulated time only"} onClick={()=>setFast(f=>!f)}>⏩ 4×{fast && !liveClock?" · SIMULATED":""}</button>
          {!shipped && !passed && (
            <button type="button" className={`j-btn test${isNext('test')}`} disabled={busy || todos.length > 0} title={busy?'A test or order is running':todos.length?'Place and configure all parts first':'Run a simulated test'} onClick={startTest} data-testid="test">
              Test <small>{test.running ? `customer ${test.sale} of 3 · simulated` : `3 customers · simulated · ${parts} part${parts === 1 ? '' : 's'}`}</small>
            </button>
          )}
          {passed && !shipped && (
            <button type="button" className={`j-btn ship${isNext('ship')}`} disabled={busy} title={busy?'A test or order is running':'Run one order'} onClick={ship} data-testid="ship">
              Ship it for real <small>{api.mode === 'mock' ? 'MOCK: no chain, fake hashes' : 'Puts it on NEAR testnet and runs 1 real sale. ~1 min. No wallet.'}</small>
            </button>
          )}
          {shipped && (
            job.n < 5
              ? <button type="button" className={`j-btn next${isNext('nextjob')}`} onClick={() => openJob(job.n + 1)} data-testid="next-job">Next → <small>{JOBS[job.n].title}</small></button>
              : <button type="button" className={`j-btn next${isNext('nextjob')}`} onClick={() => setLevels(true)} data-testid="next-job">All done ★ <small>see your live shops</small></button>
          )}
          {passed && !shipped && job.n < 5 && !shipping && <button type="button" className="j-link" onClick={() => openJob(job.n + 1)} data-testid="skip-ship">Skip to the next job</button>}
        </div>
      </footer>

      {drag?.moved && <div className="j-ghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px)` }}><PartChip kind={drag.kind} small /></div>}

      {(!prog.intro || title) && (
        <div className="j-intro" role="dialog" aria-modal aria-label="Welcome to WORLDWORKS" data-testid="intro" onClick={e=>{if(!(e.target as HTMLElement).closest('button,a,input')){update({intro:true});setTitle(false);}}}>
          <picture className="j-splash-art" aria-hidden="true">
            <source media="(max-width: 640px)" srcSet="/brand/keyart-mobile.webp" />
            <img src="/brand/keyart.webp" alt="" width="1920" height="1080" />
          </picture>
          <div className="j-portal-glow" aria-hidden="true" />
          <div className="j-splash-content">
            <h1><img className="j-splash-logo" src="/brand/logo.webp" alt="WORLDWORKS" width="900" height="182" /></h1>
            <p className="j-splash-tagline">Money that runs itself.</p>
            <p className="j-splash-description" data-testid="point">Solve real people's money problems with parts, then ship them as real payment apps on NEAR.</p>
            <nav className="j-splash-menu" aria-label="Title menu">
              <button type="button" className="j-splash-start" data-testid="start" autoFocus onClick={() => { update({ intro: true }); setTitle(false); setHelp(false); }}>{prog.intro ? `Continue: job ${job.n}` : 'Start job 1'}<span aria-hidden="true">→</span></button>
              {prog.intro && FACTORY_ENABLED && <button type="button" onClick={() => {setTitle(false);setOverview(true);setHelp(false);}}>Factory</button>}
              <button type="button" onClick={() => setHelp(true)}>How it works</button>
              {runHere && <button type="button" onClick={()=>{update({intro:true});setTitle(false);setRunClosed(false);}}>View a real run</button>}
              <button type="button" aria-pressed={audio.music || audio.effects} onClick={() => {const on=!(audio.music || audio.effects);configureAudio({music:on,effects:on});}}><HudIcon kind={audio.music || audio.effects ? 'sound' : 'muted'} />Sound {audio.music || audio.effects ? 'on' : 'off'}</button>
            </nav>
          </div>
          <footer className="j-splash-credits"><span>Built on NEAR · testnet</span><span>NEAR Hackathon 2026</span></footer>
        </div>
      )}
      {guideStep && <Spotlight target={guideStep.target} text={guideStep.text} onSkip={dismissGuide} />}
      <LedgerPanel open={ledger} onClose={() => setLedger(false)} />
      {sessionError && runHere?.phase === 'error' && <span className="sr-only">{sessionError}</span>}
    </div>
  );
}

function shipCaption(r: Run, job: Job, who: (p: PersonId) => string, status?: string, waiting?: string, relayError?: string): string {
  const mock = api.mode === 'mock' ? ' (mock)' : '';
  const ab = job.abroad ? who(job.abroad) : 'Your friend';
  switch (r.phase) {
    case 'session': return `Creating your free test account…${mock}`;
    case 'publish': return `Putting ${job.n === 5 ? 'your shop' : job.shop} on NEAR testnet…${mock}`;
    case 'order': return `A seeded customer is paying 0.10 NEAR…${mock}`;
    case 'unknown': return 'Outcome unknown. Checking the existing order…';
    case 'paying': return 'Reading the transfer receipts…';
    case 'approve': return 'A share waits at the Gate. Tap Delivered when the bread arrives.';
    case 'portal':
      if (relayError) return `${ab}’s payout could not be verified. Check the receipt before retrying.`;
      if (status === 'waiting_for_earlier_nonce') return `${ab}’s payment is waiting for an earlier payout #${waiting ?? '?'}.`;
      if (status === 'broadcast') return 'Sent to Ethereum. Waiting for blocks…';
      if (status === 'signature_failed') return `NEAR could not sign ${ab}’s payment. No ETH was sent.`;
      return 'NEAR is signing an Ethereum transaction…';
    case 'done': return r.resolution === 'expired' ? `Order expired — the refund exit ran${mock}. Check transfer receipts.` : r.payoutId ? `Ethereum confirmed${mock}. Check each NEAR transfer receipt.` : `Order complete${mock}. Check transfer receipts.`;
    case 'error': return 'The real run stopped.';
  }
}

function PortalMoment({ run, job, who, abroad, next, onClose, onContinue, onSkip }: { run: Run; job: Job; who: (p: PersonId) => string; abroad?: PersonId; next: string; onClose: () => void; onContinue?: () => void; onSkip:()=>void }) {
  const p = useApp(s => (run.payoutId ? s.payouts[run.payoutId] : undefined));
  const liveNow = !!p && p.status !== 'confirmed' && p.status !== 'signature_failed';
  useTick(liveNow, 500);
  const now = Date.now();
  const secs = (a?: number, b?: number) => (a ? Math.max(0, Math.round(((b ?? now) - a) / 1000)) : 0);
  const name = abroad ? who(abroad) : 'Chi';
  const owner = job.n === 5 ? 'You' : 'Ada';
  const s = p?.status ?? 'awaiting_signature';
  const signedAt = p?.stepAt.signed ?? p?.stepAt.broadcast;
  const head = p?.readFailed ? 'Cannot read the payout status' : p?.stalled ? 'The payout is taking longer than expected' : s === 'confirmed' ? `${name} got ${eth(p?.wei ?? '0')} ETH on Ethereum`
    : s === 'broadcast' ? 'Crossing the water: Ethereum is adding it to a block'
    : s === 'waiting_for_earlier_nonce' ? `Waiting for earlier payout #${p?.waitingPayoutId ?? 'unknown'}`
    : s === 'signed' ? 'Signed by NEAR. Sending it to Ethereum…'
    : s === 'signature_failed' ? 'NEAR could not sign. No ETH was sent.'
    : 'NEAR is signing an Ethereum transaction';
  const t = s === 'awaiting_signature' || s === 'waiting_for_signature' ? secs(p?.startedAt) : s === 'broadcast' ? secs(p?.stepAt.broadcast) : null;
  const rpcs = p?.confirmations?.length ?? 0;
  return (
    <div className={`j-moment st-${s}`} data-testid="portal-moment" data-status={s} onClick={e=>{if(!(e.target as HTMLElement).closest('button,a,details'))onSkip();}}>
      <div className="j-moment-top"><OverlayClose onClose={onClose} /><button className="j-mini" data-testid="skip-portal" onClick={onSkip}>Skip animation · keep tracking</button>
        <small>{api.mode === 'mock' ? 'MOCK · timings imitate testnet, nothing is on chain' : 'LIVE · NEAR testnet → Sepolia'}</small>
        {s === 'confirmed' && <strong className="j-confirmed">✓ Confirmed{api.mode === 'mock' ? ' · MOCK' : ''}</strong>}
        <h2 data-testid="moment-head">{head}{t !== null && <span className="secs"> · {t}s</span>}</h2>
        <p>Usually ~60 s; network delays can take longer. You can keep playing.</p><p>{owner} never touched Ethereum. {owner === 'You' ? 'Your' : 'Her'} NEAR machine {s === 'confirmed' ? 'paid' : s === 'signature_failed' ? 'could not pay' : 'will pay'} {name} there by itself.</p>
      </div>
      <div className="j-moment-bottom">
        {(p?.relayError || p?.stalled || p?.readFailed) && <div className="j-moment-error" role="status">{p?.relayError || 'Payout tracking is stalled. Confirmation is not known.'}<button type="button" className="j-mini" onClick={() => retryRelay(run.payoutId!)} data-testid="moment-retry">Retry payout status</button></div>}
        {s!=='confirmed' && <p className="j-live-stage" data-testid="live-stage">{s==='broadcast' ? p?.confirmationProgress?.length ? `Ethereum block depth ${Math.max(0,Math.min(3,...p.confirmationProgress.map(x=>Number(x.depth))))}/3. Both RPCs must agree before confirmation.` : 'Sent to Ethereum. Waiting for a mined block receipt.' : s==='waiting_for_earlier_nonce' ? `Payout #${p?.waitingPayoutId??'unknown'} must finish first: Ethereum nonces run in order.` : s==='signature_failed' ? 'The signer failed. Check status before retrying.' : 'No bridge. NEAR itself signs the Ethereum payment.'}</p>}
        <ol className="j-moment-steps">
          <li className={p?.stepAt.signed || ['signed', 'broadcast', 'confirmed'].includes(s) ? 'done' : 'on'}>NEAR signs{signedAt && p ? ` · ${secs(p.startedAt, signedAt)}s` : ''}</li>
          <li className={['broadcast', 'confirmed'].includes(s) ? (s === 'confirmed' ? 'done' : 'on') : ''}>Beam to Ethereum</li>
          <li className={s === 'confirmed' ? 'done' : ''}>{s === 'confirmed' ? (rpcs >= 2 ? `Confirmed · seen by ${rpcs} RPCs` : api.mode === 'mock' ? 'Confirmed (mock)' : 'Confirmed') : 'Lands in ' + name + '’s wallet'}</li>
        </ol>
        <details className="j-stage-details"><summary data-testid="wait-toggle">Inside the machine · observed stages</summary><InsideMachine run={run} /></details>
        {onContinue && s!=='confirmed' && <button type="button" className="j-wait-next" data-testid="continue-building" onClick={onContinue}>Start the next job while this finishes</button>}
        <div className="j-moment-links"><Tx tx={p?.nearTx ?? run.orderTx} label="NEAR" />{p?.evmTx && <Tx tx={p.evmTx} label="Sepolia" />}</div>
        <button type="button" className={`j-btn wide${next}`} onClick={onClose} data-testid="moment-close">{s === 'confirmed' ? 'See every receipt' : 'Watch from the receipts'}</button>
      </div>
    </div>
  );
}

function InsideMachine({run}: {run:Run}) {
  const p=useApp(s=>run.payoutId?s.payouts[run.payoutId]:undefined);
  useTick(!!p && p.status!=='confirmed',1000);
  return <ol className="j-stage-line" data-testid="observed-stages">
    {!run.orderTx && <li>Waiting for the NEAR order receipt. No result is known yet.</li>}
    {run.orderTx && <li>Order accepted on NEAR. <Tx tx={run.orderTx} label={`NEAR ${shortAddr(run.orderTx.hash)}`} /></li>}
    {!!run.effects?.length && <li>The contract ran your machine and returned these routes.</li>}
    {run.effects?.map((e,i)=><li key={i}>{e.kind==='payout'?`${shortAddr(e.account)} · ${fmtN(BigInt(e.amount))} NEAR · ${nearTransferText(e)}`:e.kind==='vault'?`${fmtN(BigInt(e.amount))} NEAR routed to a Vault`:`Portal fee ${fmtN(BigInt(e.fee))} NEAR · requested ${eth(e.wei)} ETH`}</li>)}
    {p && <li>{p.status==='waiting_for_earlier_nonce'?`Waiting for earlier payout #${p.waitingPayoutId??'unknown'}. Each Ethereum nonce goes in order.`:p.status==='confirmed'?'Both RPCs agree: the Ethereum receipt succeeded.':p.status==='broadcast'?'Sent to Ethereum. Waiting for its confirmed block receipt.':p.status==='signature_failed'?'The signer failed. No Ethereum confirmation is known.':`NEAR’s signer network is working · ${Math.max(0,Math.floor((Date.now()-p.startedAt)/1000))}s. No bridge: NEAR itself signs the Ethereum payment.`}{p.evmTx && <Tx tx={p.evmTx} label={`Ethereum ${shortAddr(p.evmTx.hash)}`} />}</li>}
    {p?.nearBlockHeight && <li>Observed NEAR block {p.nearBlockHeight}.</li>}
    {p && p.status==='broadcast' && <li>{p.confirmationProgress?.length ? `Ethereum depth ${Math.max(0,Math.min(3,...p.confirmationProgress.map(x=>Number(x.depth))))}/3 · ${p.confirmationProgress.length}/2 RPCs have a validated receipt. Waiting for both.` : api.mode==='mock' ? 'MOCK: no real block-depth data.' : 'No mined receipt observed yet. Waiting for block-depth reads.'}</li>}
    {api.mode==='mock' && <li>MOCK: these stages imitate testnet; no chain transaction.</li>}
  </ol>;
}

function YourBalance({ run, onRefresh }: { run: Run; onRefresh: () => void }) {
  const b0 = BigInt(run.balanceBefore!); const b1 = run.balanceAfter ? BigInt(run.balanceAfter) : null;
  const link = run.account ? (api.mode === 'mock' ? null : `https://testnet.nearblocks.io/address/${run.account}`) : null;
  return (
    <div className="j-balance" data-testid="your-balance">
      <Face id="you" size={32} />
      <span><b>Your account</b><small>{fmtN(b0)} → {b1 !== null ? <b data-testid="balance-after">{fmtN(b1)} NEAR</b> : 'checking…'}{b1 !== null && <em className="up" data-testid="balance-delta"> {b1 >= b0 ? '+' : '−'}{fmtN(b1 >= b0 ? b1 - b0 : b0 - b1)}</em>}{api.mode === 'mock' ? ' (mock)' : ''}</small></span>
      <button type="button" className="j-mini" onClick={onRefresh} data-testid="balance-refresh">Refresh</button>
      {link && <a className="txl" href={link} target="_blank" rel="noreferrer">account ↗</a>}
    </div>
  );
}

function Receipts({ run, who }: { run: Run; who: (p: PersonId) => string }) {
  const payouts = useApp(s => (run.payoutId ? s.payouts[run.payoutId] : undefined));
  if (!run.effects) return null;
  const c = run.ctx ?? {};
  const rows: { face: PersonId | null; key: string; name: string; amount: string; tx?: TxRef; evm?: TxRef; note?: string }[] = [];
  run.effects.forEach((e, i) => {
    const tx = run.orderEffects !== undefined && i >= run.orderEffects ? run.approveTx : run.orderTx;
    if (e.kind === 'payout') {
      const w = e.account === run.customer ? 'customer' : ownerOf(e.account, c);
      rows.push({ face: w, key: w ?? 'other', name: w === 'customer' ? 'Customer refund' : w ? who(w) : shortAddr(e.account), amount: `${e.settled === true ? '+' : ''}${fmtN(BigInt(e.amount))} NEAR`, note: nearTransferText(e), tx });
    } else if (e.kind === 'vault') rows.push({ face: null, key: 'vault', name: 'Vault', amount: `${fmtN(BigInt(e.amount))} NEAR kept`, tx });
    else {
      const confirmed = payouts?.status === 'confirmed';
      const w = (['f1', 'f2', 'chi'] as PersonId[]).find(p => p === 'chi' ? run.job !== 5 && e.recipient.toLowerCase() === (PEOPLE.chi.evm ?? '').toLowerCase() : c.evm?.[p]?.toLowerCase() === e.recipient.toLowerCase()) ?? null;
      rows.push({ face: w, key: w ?? 'eth', name: w ? who(w) : shortAddr(e.recipient), amount: confirmed ? `+${eth(e.wei)} ETH` : `${eth(e.wei)} ETH on the way`, tx, evm: confirmed ? payouts?.evmTx : undefined, note: `Portal fee ${fmtN(BigInt(e.fee))} NEAR` });
    }
  });
  if (run.pending && !run.approveTx) rows.push({ face: null, key: 'gate', name: 'Gate', amount: 'a share is waiting', tx: run.orderTx });
  return (
    <ul className="j-receipts" data-testid="receipts">
      {rows.map((r, i) => (
        <li key={i} data-testid={`receipt-${r.key}`}>
          {r.face ? <Face id={r.face} size={32} /> : <i className="j-dot" />}
          <span className="who"><b>{r.name}</b>{r.note && <small>{r.note}</small>}</span>
          <span className="amt">{r.amount}</span>
          <span className="links"><Tx tx={r.tx} label="NEAR" />{r.evm && <Tx tx={r.evm} label="Sepolia" />}</span>
        </li>
      ))}
      <li className="j-fine"><details><summary>Details</summary>
        <p>Machine <code>{run.machineId}</code>. The customer paid 0.10 NEAR plus a 1.32 NEAR deposit kept by the contract for storage.{run.customer ? ` Customer account: ${run.customer} (seeded demo customer).` : ''}</p>
        <Tx tx={run.publishTx} label="publish" />
      </details></li>
    </ul>
  );
}

function HudIcon({kind}:{kind:'home'|'sound'|'muted'|'menu'}) { return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{kind==='home'?<><path d="M3 11 12 3l9 8v10H3Z"/><path d="M9 21v-7h6v7"/></>:kind==='menu'?<><path d="M4 6h16M4 12h16M4 18h16"/></>:<><path d="M11 4 6 9H3v6h3l5 5Z"/>{kind==='sound'?<path d="M15 8q5 4 0 8m3-11q8 7 0 14"/>:<path d="m16 9 6 6m0-6-6 6"/>}</>}</svg>; }
