import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, applyNodeChanges, useReactFlow,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, type IsValidConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { api } from '../api';
import type { OrderResult } from '../api/types';
import { machineHash } from '../engine/index';
import {
  INSERTABLE, PART_LABEL, PART_TYPES, PREVIEW_RECIPIENT, RECEIVES_MONEY, bindWorker, defaultPart, edgeId, friendlyErrors, hasPortal,
  keptInVaults, nextId, outPorts, price, removeNode, setTarget, simulate, simulateRelease, source, templates, title, toDoc,
  uniqueVaultName, withCap, templateWei, type Machine, type PartType, type Positions, type TemplateId,
} from '../lib/machine';
import { addRow, ensureSession, getState, setState, trackPayout, updateRow, useApp } from '../lib/store';
import { play, glint } from '../lib/flow';
import { sfx } from '../lib/sound';
import { linkProps, navigate } from '../lib/router';
import { eth, near, pct } from '../lib/units';
import { loadLimits, minPortalFee, useLimits } from '../lib/limits';
import { Ctx, type WorkshopCtx } from '../components/workshopCtx';
import { PartNode } from '../components/PartNode';
import { PipeEdge, type PipeEdgeType } from '../components/PipeEdge';
import { CustomerArt, PartArt } from '../components/PartArt';
import { LedgerDrawer, LedgerPeek } from '../components/Ledger';
import { PortalSteps } from '../components/PortalSteps';
import { Logo, MockBadge, TxLink } from '../components/bits';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const parseErr = (s: string): string | Record<string, string | number> => {
  try { return JSON.parse(s); } catch { /* not JSON */ }
  const m = /^(\w+)\s*[:(]\s*"?([^")]*)"?\)?$/.exec(s.trim());
  return m ? { [m[1]]: m[2] } : s;
};

type CustomerPhase = 'away' | 'walking' | 'waiting' | 'paying' | 'happy' | 'leaving';
type CustomerState = { phase: CustomerPhase; bubble: string; sub: string };
type Held = { machineId: string; orderId: string; gate: string; worker: string; amount: bigint; machine: Machine };

function useNarrow() {
  const q = '(max-width: 760px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setNarrow(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return narrow;
}

// ---------------- customer (a scripted, seeded customer; never called AI) ----------------
const CustomerCtx = { current: { phase: 'away', bubble: '', sub: '' } as CustomerState, subs: new Set<() => void>() };
function setCustomer(c: Partial<CustomerState>) { CustomerCtx.current = { ...CustomerCtx.current, ...c }; CustomerCtx.subs.forEach(f => f()); }
function useCustomer() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(x => x + 1); CustomerCtx.subs.add(f); return () => { CustomerCtx.subs.delete(f); }; }, []);
  return CustomerCtx.current;
}

function CustomerNode(_: NodeProps) {
  const c = useCustomer();
  return (
    <div className={`customer phase-${c.phase}`} data-testid="customer" data-phase={c.phase}>
      {c.bubble && c.phase !== 'away' && (
        <div className="bubble">{c.bubble}<small>{c.sub}</small></div>
      )}
      <div className="walker"><div className="bob"><CustomerArt mood={c.phase === 'happy' || c.phase === 'leaving' ? 'happy' : 'idle'} /></div></div>
      {c.phase === 'paying' && <div className="toss" aria-hidden><span /></div>}
    </div>
  );
}

const nodeTypes = { part: PartNode, customer: CustomerNode };
const edgeTypes = { pipe: PipeEdge };

// ---------------- the page ----------------
export function Workshop() {
  return <ReactFlowProvider><WorkshopInner /></ReactFlowProvider>;
}

function WorkshopInner() {
  const session = useApp(s => s.session);
  const sessionError = useApp(s => s.sessionError);
  const goals = useApp(s => s.goals);
  const payouts = useApp(s => s.payouts);
  const soundOn = useApp(s => s.sound);
  const narrow = useNarrow();
  const rf = useReactFlow();

  const [tplId, setTplId] = useState<TemplateId>('lemonade');
  const tpl = useMemo(() => templates(session?.accountId).find(t => t.id === tplId)!, [tplId, session?.accountId]);
  const [machine, setMachineRaw] = useState<Machine>(() => templates().find(t => t.id === 'lemonade')!.machine);
  const [workers, setWorkers] = useState<Record<string, string>>({});
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [dragging, setDragging] = useState<PartType | null>(null);
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'bad' | 'info' } | null>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [activePayout, setActivePayout] = useState<string | null>(null);
  const [sales, setSales] = useState<{ count: number; kept: bigint }>({ count: 0, kept: 0n });
  const [chainVaults, setChainVaults] = useState<{ id: string; vaults: Record<string, string> } | null>(null);
  const [unclaimed, setUnclaimed] = useState('0');
  useEffect(() => { if (session) void api.getUnclaimed?.().then(setUnclaimed).catch(() => {}); }, [session]);
  const [publishedIds] = useState(() => new Set<string>());
  const spawn = useRef<Positions>({});
  const wrapper = useRef<HTMLDivElement>(null);

  const { limits } = useLimits();
  useEffect(() => { void ensureSession().then(() => loadLimits()); }, []);
  useEffect(() => {
    if (api.mode !== 'live' || !limits) return;
    setMachineRaw(m => withCap({...m, nodes: Object.fromEntries(Object.entries(m.nodes).map(([k,p]) => [k, p.type === 'Portal' ? {...p, wei: templateWei()} : p]))}));
  }, [limits]);

  // load a template (also the first load)
  const loadTemplate = useCallback((id: TemplateId) => {
    const t = templates(getState().session?.accountId).find(x => x.id === id)!;
    setTplId(id);
    setMachineRaw(t.machine);
    setWorkers(t.workers(getState().session?.accountId ?? ''));
    spawn.current = { ...t.positions };
    setRfNodes(buildNodes(t.machine, [], t.positions));
    setHeld(null); setSales({ count: 0, kept: 0n }); setChainVaults(null); setActivePayout(null);
    setCustomer({ phase: 'away', bubble: '', sub: '' });
    setTimeout(() => rf.fitView({ ...fitOpts(narrow), nodes: Object.keys(t.machine.nodes).map(id => ({ id })) }), 80);
  }, [rf, narrow]);
  useEffect(() => { loadTemplate('lemonade'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // once the session arrives, bind template Workers/Payouts that default to "you"
  useEffect(() => {
    if (!session) return;
    setWorkers(w => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v || session.accountId])));
    setMachineRaw(m => {
      let changed = false;
      const nodes = { ...m.nodes };
      for (const [k, p] of Object.entries(nodes)) if (p.type === 'Payout' && p.account === 'you.testnet') { nodes[k] = { ...p, account: session.accountId }; changed = true; }
      return changed ? { ...m, nodes } : m;
    });
  }, [session]);

  const setMachine = useCallback((m: Machine) => setMachineRaw(withCap(m)), []);

  // keep React Flow nodes in sync with the machine (positions and measurements preserved)
  useEffect(() => { setRfNodes(prev => buildNodes(machine, prev, spawn.current)); }, [machine]);
  const partCount = Object.keys(machine.nodes).length;
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) { firstFit.current = false; return; }
    const t = setTimeout(() => rf.fitView({ ...fitOpts(narrow), nodes: Object.keys(machine.nodes).map(id => ({ id })), duration: 450 }), 120);
    return () => clearTimeout(t);
  }, [partCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- validation + preview through the wasm engine ----------
  const doc = useMemo(() => toDoc(machine, workers), [machine, workers]);
  const check = useMemo(() => {
    const v = api.validate(doc);
    const issues = v.ok ? [] : friendlyErrors(machine, v.errors.map(parseErr));
    for (const [k, p] of Object.entries(machine.nodes)) if (p.type === 'Worker' && !workers[k]) issues.push({ node: k, text: `${k} needs a NEAR account to approve with.` });
    // contract admission rules the local engine does not know about
    const portals = Object.keys(machine.nodes).filter(k => machine.nodes[k].type === 'Portal');
    if (portals.length > 1) issues.push({ node: portals[1], text: 'One Portal per machine for now. Remove the extra one.' });
    for (const [id, p] of Object.entries(machine.nodes)) {
      if (new TextEncoder().encode(id).length > 32) issues.push({node:id,text:'Part id must be at most 32 bytes.'});
      if (p.type === 'Portal' && (BigInt(p.wei) <= 0n || limits?.maxWeiPerPayout && BigInt(p.wei) > BigInt(limits.maxWeiPerPayout))) issues.push({node:id,text:'Portal amount must be positive and within the contract payout cap.'});
    }
    let preview: OrderResult | null = null;
    if (!issues.length) {
      try { preview = api.preview(doc, hasPortal(machine) ? PREVIEW_RECIPIENT : undefined); } catch { preview = null; }
    }
    for (const e of preview?.effects ?? []) {
      if (e.kind !== 'external') continue;
      const min = minPortalFee(e.wei, limits);
      if (min !== null && BigInt(e.fee) < min) {
        issues.push({ node: portals[0], text: `The Portal gets ${near(e.fee)} NEAR per sale but needs at least ${near(min)} NEAR to pay ${eth(e.wei)} ETH. Send it a bigger share.` });
        preview = null;
      }
    }
    return { ok: issues.length === 0, issues, preview };
  }, [doc, machine, workers, limits]);
  const issuesByNode = useMemo(() => {
    const r: Record<string, string[]> = {};
    for (const i of check.issues) if (i.node) (r[i.node] ??= []).push(i.text);
    return r;
  }, [check.issues]);

  const total = BigInt(price(machine) || '0');
  const keptPreview = keptInVaults(check.preview);
  const keptShare = total > 0n ? Number((keptPreview * 10000n) / total) / 10000 : 0;
  const ownerPaid = check.preview?.effects.some(e => e.kind === 'payout' && e.account !== '$payer') ?? false;
  const losing = check.ok && !check.preview?.pending && keptPreview === 0n && !ownerPaid;

  // goal 1 on paper as soon as the preview keeps something
  useEffect(() => {
    if (keptPreview > 0n && getState().goals.stopLosing === 'todo') setState(s => ({ goals: { ...s.goals, stopLosing: 'preview' } }));
  }, [keptPreview]);

  // ---------- edges derived from the machine ----------
  const edges: PipeEdgeType[] = useMemo(() => {
    const out: PipeEdgeType[] = [];
    for (const [id, p] of Object.entries(machine.nodes)) {
      for (const o of outPorts(p)) {
        if (!o.target || !machine.nodes[o.target]) continue;
        const eid = edgeId(id, o.port);
        out.push({
          id: eid, source: id, sourceHandle: o.port, target: o.target, targetHandle: 'in', type: 'pipe', selected: selectedEdge === eid,
          data: { kind: 'money', label: p.type === 'Splitter' || p.type === 'Gate' ? o.label : undefined, insertable: true, toPortal: machine.nodes[o.target].type === 'Portal' },
          zIndex: 0,
        });
      }
      if (p.type === 'Worker') for (const g of p.gates) if (machine.nodes[g]) out.push({ id: `k|${id}|${g}`, source: id, sourceHandle: 'key', target: g, targetHandle: 'perm', type: 'pipe', data: { kind: 'key' }, selectable: false });
    }
    return out;
  }, [machine, selectedEdge]);

  const hintEdge = tplId === 'lemonade' && goals.stopLosing === 'todo' && machine.nodes.slot?.type === 'CoinSlot' && machine.nodes.slot.output === 'portal' ? edgeId('slot', 'out') : null;
  const [highlightEdges, setHighlight] = useState<Set<string>>(new Set());

  // ---------- editing actions ----------
  const posOf = (id: string) => rfNodes.find(n => n.id === id)?.position ?? spawn.current[id] ?? { x: 0, y: 0 };

  const insertOnPipe = useCallback((eid: string, type: PartType) => {
    const [, src, port] = eid.split('|');
    const srcPart = machine.nodes[src];
    const target = srcPart ? outPorts(srcPart).find(p => p.port === port)?.target : undefined;
    if (!target || !INSERTABLE.includes(type)) return;
    const id = nextId(machine, type);
    const a = posOf(src), b = posOf(target);
    const at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let m: Machine = { ...machine, nodes: { ...machine.nodes } };
    if (type === 'Splitter') {
      const vaultId = nextId(m, 'Vault');
      m.nodes[vaultId] = { type: 'Vault', name: uniqueVaultName(m) };
      m.nodes[id] = { type: 'Splitter', outputs: [{ bps: 3000, target }, { bps: 7000, target: vaultId }] };
      spawn.current[vaultId] = { x: at.x + 190, y: at.y + 190 };
    } else {
      m.nodes[id] = { type: 'Gate', condition: { type: 'MinAmount', amount: '0' }, pass: target, fail: target };
    }
    spawn.current[id] = at;
    m = setTarget(m, src, port, id);
    setMachine(m);
    sfx.snap();
    setToast({ text: type === 'Splitter' ? 'Splitter in. It now keeps 70% in a reserve Vault.' : 'Gate in. Click it to set its rule.', tone: 'ok' });
  }, [machine, rfNodes, setMachine]); // eslint-disable-line react-hooks/exhaustive-deps

  const connectSocket = (key: string, type: PartType, at: { x: number; y: number }) => {
    const [src, port] = key.split('|');
    const id = nextId(machine, type);
    let m: Machine = { ...machine, nodes: { ...machine.nodes, [id]: defaultPart(machine, type, session?.accountId) } };
    m = setTarget(m, src, port, id);
    spawn.current[id] = at;
    setMachine(m);
    sfx.snap();
  };

  const placeFree = (type: PartType, at: { x: number; y: number }) => {
    const id = nextId(machine, type);
    spawn.current[id] = at;
    setMachine({ ...machine, nodes: { ...machine.nodes, [id]: defaultPart(machine, type, session?.accountId) } });
    if (type === 'Worker' && session) setWorkers(w => ({ ...w, [id]: session.accountId }));
    sfx.snap();
  };

  const removePart = useCallback((id: string) => {
    setMachine(removeNode(machine, id));
    setWorkers(w => { const n = { ...w }; delete n[id]; return n; });
  }, [machine, setMachine]);

  const addWorkerFor = useCallback((gate: string) => {
    const id = nextId(machine, 'Worker');
    const g = posOf(gate);
    spawn.current[id] = { x: g.x, y: g.y - 260 };
    let m: Machine = { ...machine, nodes: { ...machine.nodes, [id]: { type: 'Worker', gates: [] } } };
    m = bindWorker(m, id, gate);
    setMachine(m);
    if (session) setWorkers(w => ({ ...w, [id]: session.accountId }));
  }, [machine, session, setMachine]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = useCallback((id: string | null) => setRfNodes(nds => nds.map(n => ({ ...n, selected: n.id === id }))), []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const removes = changes.filter(c => c.type === 'remove').map(c => (c as { id: string }).id).filter(id => id !== 'customer');
    if (removes.length) { let m = machine; for (const id of removes) m = removeNode(m, id); setMachine(m); }
    setRfNodes(nds => applyNodeChanges(changes.filter(c => c.type !== 'remove'), nds));
  }, [machine, setMachine]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) {
      if (c.type === 'select') setSelectedEdge(c.selected ? c.id : null);
      if (c.type === 'remove' && c.id.startsWith('e|')) {
        const [, src, port] = c.id.split('|');
        setMachine(setTarget(machine, src, port, ''));
        setSelectedEdge(null);
      }
    }
  }, [machine, setMachine]);

  const isValidConnection: IsValidConnection = useCallback((c: Connection | Edge) => {
    if (!c.source || !c.target || c.source === c.target) return false;
    const t = machine.nodes[c.target];
    if (!t) return false;
    if (c.sourceHandle === 'key') return t.type === 'Gate' && c.targetHandle === 'perm';
    return c.targetHandle === 'in' && RECEIVES_MONEY(t.type);
  }, [machine]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    if (c.sourceHandle === 'key') setMachine(bindWorker(machine, c.source, c.target));
    else if (c.sourceHandle) setMachine(setTarget(machine, c.source, c.sourceHandle, c.target));
    sfx.snap();
  }, [machine, setMachine]);

  // ---------- drag from the palette ----------
  const targetAt = (x: number, y: number): string | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const h = el as HTMLElement;
      if (h.dataset?.socket) return `socket:${h.dataset.socket}`;
      const pipe = h.getAttribute?.('data-pipe');
      if (pipe) return `pipe:${pipe}`;
    }
    return null;
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!dragging && !e.dataTransfer.types.includes('application/ww-part')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    let t = targetAt(e.clientX, e.clientY);
    const type = dragging;
    if (t?.startsWith('pipe:') && type && !INSERTABLE.includes(type)) t = null;
    if (t?.startsWith('socket:') && type && !RECEIVES_MONEY(type)) t = null;
    if (t !== hoverTarget) setHoverTarget(t);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = (e.dataTransfer.getData('application/ww-part') || dragging) as PartType | null;
    setDragging(null); setHoverTarget(null);
    if (!type || !PART_TYPES.includes(type)) return;
    const t = targetAt(e.clientX, e.clientY);
    const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const pos = { x: at.x - 56, y: at.y - 56 };
    if (t?.startsWith('pipe:') && INSERTABLE.includes(type)) return insertOnPipe(t.slice(5), type);
    if (t?.startsWith('socket:') && RECEIVES_MONEY(type)) return connectSocket(t.slice(7), type, pos);
    placeFree(type, pos);
  };

  // ---------- publishing ----------
  const machineIdFor = async (m: Machine): Promise<string> => {
    const h = await machineHash(m);
    const hash = typeof h === 'string' ? h : Math.abs([...JSON.stringify(m)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(16);
    const acct = (getState().session?.accountId ?? 'guest').split('.')[0].replace(/[^a-z0-9]/g, '').slice(-12);
    return `${tplId}-${hash.replace(/^0x/, '').slice(0, 8)}-${acct}`;
  };

  const ensurePublished = async (): Promise<string> => {
    const s = await ensureSession();
    if (!s) throw new Error(getState().sessionError ?? 'No testnet account yet.');
    const snapshot = doc;
    const id = await machineIdFor(snapshot.machine as Machine);
    if (publishedIds.has(id)) return id;
    const existing = await api.getMachine(id);
    if (existing) { if (existing.owner !== s.accountId) throw Error('Machine id belongs to another owner.'); publishedIds.add(id); return id; }
    const deposit = limits?.publishDeposit;
    const row = addRow({ kind: 'publish', title: `Published “${tpl.name}”`, detail: [`machine id ${id}`, deposit ? `storage deposit ${near(deposit)} NEAR from your sponsored session; unused deposit refunded` : 'with a storage deposit'], amount: deposit ? near(deposit) : undefined, status: 'pending', statusText: 'sending' });
    try {
      const tx = await api.publish(id, snapshot);
      updateRow(row, { status: 'confirmed', statusText: 'confirmed', tx });
      publishedIds.add(id);
      return id;
    } catch (e) {
      updateRow(row, { status: 'failed', statusText: 'failed' });
      throw e;
    }
  };

  const withdraw = async (name?: string) => {
    if (busy) return;
    setBusy('Withdrawing on NEAR testnet…');
    try {
      const tx = name && chainVaults ? await api.withdrawVault!(chainVaults.id, name, chainVaults.vaults[name]) : await api.withdrawUnclaimed!();
      addRow({kind:'withdraw',title:name ? `Withdrew ${name} vault` : 'Withdrew unclaimed NEAR',status:'confirmed',tx});
      if (chainVaults) await refreshVaults(chainVaults.id);
      setUnclaimed(await api.getUnclaimed!());
    } catch(e) { setToast({text:(e as Error).message,tone:'bad'}); }
    setBusy(null);
  };

  const refreshVaults = async (id: string) => {
    try { const r = await api.getMachine(id); if (r) setChainVaults({ id, vaults: r.vaults }); } catch { /* keep last */ }
  };

  // ---------- serve a customer ----------
  const serve = async () => {
    if (!check.ok || busy) return;
    const snapshot = machine;
    const start = source(snapshot)!;
    setBusy('Publishing your machine to testnet…');
    setHeld(null);
    let id: string;
    try { id = await ensurePublished(); } catch (e) { setBusy(null); sfx.error(); setToast({ text: `Could not publish: ${(e as Error).message}`, tone: 'bad' }); return; }
    setBusy('A seeded customer is on the way…');
    setCustomer({ phase: 'walking', bubble: tplId === 'lemonade' ? 'One lemonade, please.' : 'One, please.', sub: 'seeded customer' });
    const orderP = api.customerOrder(id);
    await sleep(1300);
    setCustomer({ phase: 'waiting', sub: 'seeded customer · paying on testnet…' });
    let r: Awaited<ReturnType<typeof api.customerOrder>>;
    try { r = await orderP; } catch (e) {
      setBusy(null); sfx.error();
      setCustomer({ phase: 'leaving', bubble: 'Hm, that did not go through.', sub: (e as Error).message.slice(0, 80) });
      setToast({ text: `Order failed: ${(e as Error).message}`, tone: 'bad' });
      setTimeout(() => setCustomer({ phase: 'away' }), 2200);
      return;
    }
    const detail = r.effects.map(e => e.kind === 'vault' ? `${near(e.amount)} → ${e.name} vault` : e.kind === 'payout' ? `${near(e.amount)} → ${e.account}` : `${near(e.fee)} Portal fee → ${eth(e.wei)} ETH on Sepolia`);
    if (r.pending) detail.push('held at a Gate, waiting for approval');
    const fee = limits ? BigInt(limits.orderFee) : null;
    addRow({ kind: 'order', title: 'Seeded customer bought one', detail: [`from ${r.customer}`, ...detail, ...(fee !== null ? [`+ ${near(fee)} storage fee, kept by the contract`] : [])], amount: near(fee !== null ? total + fee : total), status: 'confirmed', statusText: 'confirmed', tx: r.tx });
    setCustomer({ phase: 'paying', sub: 'seeded customer · paid' });
    setBusy('Coins are moving…');
    sfx.tock('CoinSlot');
    await sleep(450);
    const sim = simulate(snapshot, start, total);
    setHighlight(new Set(sim.steps.map(s => s.edge)));
    const dur = play(sim, start, {
      partType: n => snapshot.nodes[n]?.type,
      isPortal: n => snapshot.nodes[n]?.type === 'Portal',
      onArrive: n => sfx.tock(snapshot.nodes[n]?.type ?? ''),
      onSink: n => { const t = snapshot.nodes[n]?.type; if (t === 'Payout') sfx.kaching(); if (t === 'Portal') sfx.whoosh(); },
    });
    await sleep(dur + 300);
    setHighlight(new Set());
    const kept = keptInVaults(r);
    setSales(s => ({ count: s.count + 1, kept: s.kept + kept }));
    void refreshVaults(id);
    if (kept > 0n) {
      setState(s => ({ goals: { stopLosing: 'done', payEthereum: s.goals.payEthereum === 'locked' ? 'todo' : s.goals.payEthereum }, keptNote: `${near(kept)} NEAR kept on sale #${sales.count + 1}` }));
    }
    for (const e of r.effects) {
      if (e.kind !== 'external') continue;
      const row = addRow({ kind: 'payout', title: 'Portal → Sepolia', detail: [`to ${e.recipient.slice(0, 8)}…${e.recipient.slice(-4)} (seeded customer's demo address)`], amount: eth(e.wei), unit: 'ETH', status: 'pending', statusText: 'signing on NEAR', tx: r.tx, payoutId: e.payoutId });
      setActivePayout(e.payoutId);
      if (getState().goals.stopLosing === 'done') setState(s => ({ goals: { ...s.goals, payEthereum: s.goals.payEthereum === 'done' ? 'done' : 'running' } }));
      trackPayout(e.payoutId, row, v => {
        if (v.status === 'confirmed') {
          sfx.chime();
          if (getState().goals.stopLosing === 'done') setState(s => ({ goals: { ...s.goals, payEthereum: 'done' } }));
        }
      });
    }
    if (r.pending) {
      const gate = sim.held[0];
      const g = gate ? snapshot.nodes[gate.gate] : undefined;
      if (gate && g?.type === 'Gate' && g.condition.type === 'NeedsApproval') setHeld({ machineId: id, orderId: r.orderId, gate: gate.gate, worker: g.condition.worker, amount: gate.amount, machine: snapshot });
    }
    setCustomer({ phase: 'happy', bubble: r.pending ? 'I will wait for the inspector.' : 'Thanks!', sub: 'seeded customer' });
    setBusy(null);
    setTimeout(() => setCustomer({ phase: 'leaving' }), 1600);
    setTimeout(() => setCustomer({ phase: 'away', bubble: '' }), 2600);
  };

  const approveHeld = async () => {
    if (!held || busy) return;
    setBusy(`Approving as ${held.worker}…`);
    const row = addRow({ kind: 'approve', title: `${held.worker} approved`, detail: [`order ${held.orderId}`, `as ${workers[held.worker] ?? 'worker'}`], status: 'pending', statusText: 'sending' });
    try {
      const { tx, effects } = await api.approve(held.machineId, held.orderId);
      updateRow(row, { status: 'confirmed', statusText: 'confirmed', tx });
      for (const e of effects) {
        if (e.kind !== 'external') continue;
        const prow = addRow({ kind: 'payout', title: 'Portal → Sepolia', detail: [`to ${e.recipient.slice(0, 8)}…${e.recipient.slice(-4)}`], amount: eth(e.wei), unit: 'ETH', status: 'pending', statusText: 'signing on NEAR', tx, payoutId: e.payoutId });
        setActivePayout(e.payoutId);
        trackPayout(e.payoutId, prow);
      }
      glint(held.worker);
      const sim = simulateRelease(held.machine, held.gate, held.amount);
      setHighlight(new Set(sim.steps.map(s => s.edge)));
      const dur = play(sim, held.gate, { partType: n => held.machine.nodes[n]?.type, isPortal: n => held.machine.nodes[n]?.type === 'Portal', onSink: n => { if (held.machine.nodes[n]?.type === 'Payout') sfx.kaching(); } });
      await sleep(dur + 300);
      setHighlight(new Set());
      void refreshVaults(held.machineId);
      setHeld(null);
    } catch (e) {
      updateRow(row, { status: 'failed', statusText: 'failed' });
      setToast({ text: `Approval failed: ${(e as Error).message}`, tone: 'bad' });
    }
    setBusy(null);
  };

  const openAsApp = async () => {
    if (!check.ok) { setToast({ text: 'Fix the machine first: ' + (check.issues[0]?.text ?? ''), tone: 'bad' }); return; }
    setBusy('Publishing your machine to testnet…');
    try { const id = await ensurePublished(); setBusy(null); navigate(`/m/${id}`); }
    catch (e) { setBusy(null); setToast({ text: `Could not publish: ${(e as Error).message}`, tone: 'bad' }); }
  };
  const publishOnly = async () => {
    if (!check.ok) { setToast({ text: 'Fix the machine first: ' + (check.issues[0]?.text ?? ''), tone: 'bad' }); return; }
    setBusy('Publishing your machine to testnet…');
    try { const id = await ensurePublished(); setToast({ text: `Published as ${id}.`, tone: 'ok' }); }
    catch (e) { setToast({ text: `Could not publish: ${(e as Error).message}`, tone: 'bad' }); }
    setBusy(null);
  };

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4200); return () => clearTimeout(t); }, [toast]);

  // vault fill (visual): on-chain balance if we have it, else what this session kept
  const vaultFill = useMemo(() => {
    const r: Record<string, number> = {};
    for (const [id, p] of Object.entries(machine.nodes)) {
      if (p.type !== 'Vault') continue;
      const onChain = chainVaults ? BigInt(chainVaults.vaults[p.name] ?? '0') : 0n;
      const v = onChain > 0n ? onChain : sales.kept;
      r[id] = total > 0n ? Math.min(1, Number((v * 1000n) / (total * 3n)) / 1000) : 0;
    }
    return r;
  }, [machine, chainVaults, sales.kept, total]);

  const portalBusy = !!activePayout && !!payouts[activePayout] && !['confirmed', 'signature_failed'].includes(payouts[activePayout].status);

  const ctx: WorkshopCtx = {
    machine, session: session?.accountId, workers, issues: issuesByNode, readOnly: narrow, dragging, hoverTarget, hintEdge, highlightEdges,
    vaultFill, portalBusy, setMachine, setWorker: (n, a) => setWorkers(w => ({ ...w, [n]: a })), removePart, insertOnPipe, addWorkerFor, select,
  };

  const reserveOnChain = chainVaults ? Object.values(chainVaults.vaults).reduce((a, v) => a + BigInt(v), 0n) : null;
  const unattachedIssues = check.issues.filter(i => !i.node || !machine.nodes[i.node]);

  // ---------- headline ----------
  let h1: React.ReactNode, sub: React.ReactNode;
  if (!check.ok) { h1 = <>Something is <span className="coral">not connected.</span></>; sub = check.issues[0]?.text; }
  else if (tplId === 'lemonade' && losing) { h1 = <>Your machine is <span className="coral squiggle">losing money.</span></>; sub = <>Every coin goes straight out. <b>Nothing refills the reserve.</b></>; }
  else if (tplId === 'lemonade') { h1 = <>Now it keeps <span className="green">{pct(Math.round(keptShare * 10000))}</span> of every sale.</>; sub = sales.count ? <>Real orders, real reserve. <b>Open it as an app</b> next.</> : <>Fixed on paper. <b>Serve a customer</b> to prove it.</>; }
  else { h1 = tpl.name; sub = tpl.tagline; }

  const stamp = !check.ok ? { t: 'JAMMED', c: 'coral' } : losing ? { t: 'BROKE', c: 'coral' } : held ? { t: 'WAITING', c: 'amber' } : { t: 'RUNNING', c: 'green' };
  const previewLine = check.preview ? previewWords(check.preview, total, machine) : null;

  return (
    <Ctx.Provider value={ctx}>
      <div className={`workshop ${narrow ? 'narrow' : ''} ${dragging ? 'is-dragging' : ''}`}>
        <header className="topbar">
          <a {...linkProps('/')} className="home"><Logo /></a>
          <div className="mname-wrap">
            <button type="button" className="mname" onClick={() => setMenuOpen(o => !o)} aria-expanded={menuOpen} data-testid="templates-button">
              {tpl.name} <em>· yours</em> <span className="caret">▾</span>
            </button>
            {menuOpen && (
              <div className="menu card" role="menu">
                <h6>Templates</h6>
                {templates(session?.accountId).map(t => (
                  <button key={t.id} type="button" role="menuitem" className={t.id === tplId ? 'on' : ''} onClick={() => { setMenuOpen(false); loadTemplate(t.id); }}>
                    <b>{t.name}{t.id === 'lemonade' ? ' (broken start)' : ''}</b><small>{t.tagline}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={`stamp ${stamp.c}`} data-testid="stamp">{stamp.t}</div>
          <div className="sp" />
          <MockBadge compact />
          {!narrow && <div className="pill"><i />testnet money</div>}
          {!narrow && <a className="pill link" {...linkProps('/verify')}>what's real?</a>}
          <button type="button" className={`round ${soundOn ? 'on' : ''}`} aria-label={soundOn ? 'Sound on' : 'Sound off'} title={soundOn ? 'Sound on' : 'Sound off (default)'} onClick={() => setState(s => ({ sound: !s.sound }))}>
            {soundOn ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M17 9l5 6M22 9l-5 6" /></svg>}
          </button>
          {!narrow && <button type="button" className="ghost-btn" onClick={() => setLedgerOpen(true)} data-testid="ledger-button">Ledger</button>}
          {!narrow && <button type="button" className="ghost-btn" onClick={publishOnly} disabled={!!busy}>Publish</button>}
          <button type="button" className="open-app" onClick={openAsApp} disabled={!!busy} data-testid="open-app">Open as app <span><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 2h6v6M10 2 3 9" /></svg></span></button>
        </header>

        {narrow && (
          <div className="narrow-note card">
            <b>Best on a bigger screen.</b> Building needs room. You can still serve a customer and watch the machine run.
          </div>
        )}

        <div className="stage">
          {!narrow && (
            <aside className="palette card" aria-label="Parts">
              <h5>Parts</h5>
              {PART_TYPES.map(t => (
                <div
                  key={t}
                  className={`chip ${t === 'Splitter' && hintEdge ? 'try' : ''}`}
                  draggable
                  data-testid={`palette-${t}`}
                  onDragStart={e => { e.dataTransfer.setData('application/ww-part', t); e.dataTransfer.effectAllowed = 'copy'; setDragging(t); select(null); }}
                  onDragEnd={() => { setDragging(null); setHoverTarget(null); }}
                  onDoubleClick={() => { const c = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }); placeFree(t, { x: c.x - 56, y: c.y + 120 }); }}
                  title={`${PART_LABEL[t]}: drag onto the board${INSERTABLE.includes(t) ? ' or onto a pipe' : ''}`}
                >
                  <PartArt type={t} size={46} />
                  <b>{PART_LABEL[t]}</b>
                </div>
              ))}
            </aside>
          )}

          <div className="canvas" ref={wrapper} onDragOver={onDragOver} onDrop={onDrop} onDragLeave={e => { if (e.currentTarget === e.target) setHoverTarget(null); }}>
            <ReactFlow
              nodes={rfNodes}
              edges={edges as Edge[]}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={isValidConnection}
              onPaneClick={() => { select(null); setSelectedEdge(null); setMenuOpen(false); }}
              fitView
              fitViewOptions={fitOpts(narrow)}
              minZoom={0.35}
              maxZoom={1.6}
              nodesDraggable={!narrow}
              nodesConnectable={!narrow}
              elementsSelectable={!narrow}
              panOnDrag={!narrow}
              zoomOnScroll={!narrow}
              zoomOnPinch
              deleteKeyCode={['Backspace', 'Delete']}
              proOptions={{ hideAttribution: true }}
              snapToGrid
              snapGrid={[8, 8]}
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={2.2} color="var(--color-grid)" />
            </ReactFlow>
            {hintEdge && !dragging && !narrow && <HintArrow edge={hintEdge} />}
          </div>

          <div className="headline">
            <h1>{h1}</h1>
            <p>{sub}</p>
            {unattachedIssues.length > 0 && <ul className="issues">{unattachedIssues.map(i => <li key={i.text}>{i.text}</li>)}</ul>}
          </div>


          {(tplId === 'lemonade' || Object.values(machine.nodes).some(p => p.type === 'Vault')) && <div className="reserve card" data-testid="reserve">
            <div className="ring">
              <svg viewBox="0 0 78 78" width="78" height="78"><circle cx="39" cy="39" r="32" fill="none" stroke="var(--color-line)" strokeWidth="9" />
                <circle cx="39" cy="39" r="32" fill="none" stroke={keptShare > 0 ? 'var(--color-confirmed)' : 'var(--color-failed)'} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${Math.max(0.1, keptShare * 201)} 201`} transform="rotate(-90 39 39)" style={{ transition: 'stroke-dasharray 400ms' }} /></svg>
              <div><span>{Math.round(keptShare * 100)}%</span><small>kept</small></div>
            </div>
            <div>
              <h6>Reserve</h6>
              {api.mode === 'live' && chainVaults && Object.entries(chainVaults.vaults).filter(([,v]) => BigInt(v) > 0n).map(([name]) => <button key={name} className="mini" disabled={!!busy} onClick={() => withdraw(name)} data-testid="withdraw-vault">Withdraw {name}</button>)}
              {BigInt(unclaimed) > 0n && <button className="mini" disabled={!!busy} onClick={() => withdraw()} data-testid="withdraw-unclaimed">Withdraw {near(unclaimed)} unclaimed NEAR</button>}
              {keptShare > 0 ? <div className="ok-line">keeps {near(keptPreview)} NEAR per sale</div> : <div className="bad-line"><i>!</i>{Object.values(machine.nodes).some(p => p.type === 'Vault') ? 'nothing reaches a Vault' : 'empty · nothing refills it'}</div>}
              <div className="stats">sales <b data-testid="sales-count">{sales.count}</b> · kept <b data-testid="kept-total">{near(sales.kept)}</b> NEAR</div>
              {reserveOnChain !== null && <div className="stats">{api.mode === 'mock' ? 'mock vault total' : 'vault on chain'} <b data-testid="vault-on-chain">{near(reserveOnChain)}</b> NEAR</div>}
            </div>
          </div>}

          <div className="dock">
            {held ? (
              <div className="held card" data-testid="held">
                <PartArt type="Worker" size={44} s={{ mood: 'surprised' }} />
                <div><b>{near(held.amount)} NEAR is waiting at {title(held.machine, held.gate)}.</b><small>{held.worker} is bound to your account, so you can approve it.</small></div>
                <button type="button" className="primary" onClick={approveHeld} disabled={!!busy} data-testid="approve">Approve as {held.worker}</button>
              </div>
            ) : null}
            <button type="button" className="serve" onClick={serve} disabled={!check.ok || !!busy || !session || !limits} data-testid="serve">
              <CustomerArt size={34} />
              <span><b>{busy ?? 'Serve a customer'}</b><small>{!session ? (sessionError ? `Account problem: ${sessionError}` : 'creating your testnet account…') : !check.ok ? 'fix the machine first' : `seeded customer pays ${near(total)} NEAR${limits ? ` + ${near(limits.orderFee)} storage fee` : ''} · testnet`}</small></span>
            </button>
            {previewLine && !busy && <div className="preview-line" data-testid="preview-line"><em>preview</em>{previewLine}</div>}
          </div>

          <div className="side">
          {!narrow && <Goals tplId={tplId} hasPortal={hasPortal(machine)} compact={!!activePayout} />}
          {activePayout && (
            <div className="portal-card card" data-testid="portal-card">
              <header><PartArt type="Portal" size={36} s={{ spinning: portalBusy, mood: portalBusy ? 'surprised' : 'happy' }} /><div><b>Paying a customer on Ethereum</b><small>NEAR Chain Signatures → Sepolia{api.mode === 'mock' ? ' · simulated by the mock API' : ''}</small></div>
                {!portalBusy && <button type="button" className="x" aria-label="Close" onClick={() => setActivePayout(null)}>×</button>}</header>
              <PortalSteps payoutId={activePayout} compact />
            </div>
          )}
          {!narrow && !activePayout && <LedgerPeek onOpen={() => setLedgerOpen(true)} />}
          </div>
        </div>

        {toast && <div className={`toast ${toast.tone}`} role="status">{toast.text}</div>}
        <LedgerDrawer open={ledgerOpen} onClose={() => setLedgerOpen(false)} />
        {session && !narrow && <div className="whoami">you are <b>{session.accountId}</b>{session.isNew ? ' · new testnet account, no wallet needed' : ''}</div>}
      </div>
    </Ctx.Provider>
  );
}

function fitOpts(narrow: boolean) {
  return narrow
    ? { padding: { top: '250px', bottom: '230px', left: '70px', right: '40px' } as const, maxZoom: 0.9 }
    : { padding: { top: '200px', bottom: '150px', left: '330px', right: '400px' } as const, maxZoom: 1.05 };
}

function buildNodes(m: Machine, prev: Node[], spawn: Positions): Node[] {
  const byId = new Map(prev.map(n => [n.id, n]));
  const out: Node[] = Object.keys(m.nodes).map(id => {
    const old = byId.get(id);
    const partType = m.nodes[id].type;
    if (old && (old.data as { partType: string }).partType === partType) return old;
    return { id, type: 'part', position: spawn[id] ?? old?.position ?? { x: 0, y: 0 }, data: { partType }, className: old ? '' : 'spawn', zIndex: 2 };
  });
  const s = source(m);
  const slotPos = s ? (byId.get(s)?.position ?? spawn[s]) : undefined;
  if (slotPos) {
    const oldC = byId.get('customer');
    out.push({ ...(oldC ?? {}), id: 'customer', type: 'customer', position: { x: slotPos.x - 200, y: slotPos.y - 30 }, data: {}, draggable: false, selectable: false, connectable: false, deletable: false, focusable: false, zIndex: 3 });
  }
  return out;
}

function previewWords(p: OrderResult, total: bigint, m: Machine): string {
  if (p.pending) return `${near(total)} NEAR in → held at a Gate until a Worker approves`;
  const parts = p.effects.map(e => e.kind === 'vault' ? `${near(e.amount)} kept` : e.kind === 'payout' ? `${near(e.amount)} to ${e.account === '$payer' ? 'buyer' : 'payout'}` : `${near(e.fee)} Portal fee → ${eth(e.wei)} ETH on Sepolia`);
  void m;
  return `next sale: ${near(total)} NEAR in → ${parts.join(' · ')}`;
}

function Goals({ tplId, hasPortal, compact }: { tplId: TemplateId; hasPortal: boolean; compact?: boolean }) {
  const g = useApp(s => s.goals);
  const note = useApp(s => s.keptNote);
  const g1 = g.stopLosing;
  const g2 = g.payEthereum;
  return (
    <div className={`goals card ${compact ? 'compact' : ''}`} data-testid="goals">
      <h5>Goals</h5>
      <div className={`goal ${g1}`} data-testid="goal-1" data-state={g1}>
        <span className="tick">{g1 === 'done' ? '✓' : '1'}</span>
        <div>
          <b>Make the machine stop losing money</b>
          <small>{g1 === 'done' ? note : g1 === 'preview' ? 'Fixed on paper. Serve a customer to make it real.' : tplId === 'lemonade' ? 'Drag a Splitter onto the pipe between the Coin Slot and the Portal.' : 'Load the Lemonade Machine from the menu to start.'}</small>
        </div>
      </div>
      <div className={`goal ${g2}`} data-testid="goal-2" data-state={g2}>
        <span className="tick">{g2 === 'done' ? '✓' : g2 === 'locked' ? '🔒' : '2'}</span>
        <div>
          <b>Pay a customer on Ethereum</b>
          <small>{g2 === 'locked' ? 'Unlocks after goal 1.' : g2 === 'done' ? 'Confirmed on Sepolia. Built in a game, paid on another chain.' : g2 === 'running' ? 'The Portal is paying on Sepolia right now…' : hasPortal ? 'Serve a customer: the Portal pays them in Sepolia ETH through NEAR Chain Signatures.' : 'Add a Portal to the machine first.'}</small>
        </div>
      </div>
      {g1 === 'done' && g2 === 'done' && !compact && <div className="goal free"><span className="tick">∞</span><div><b>Free play</b><small>Try the templates, or open your machine as an app.</small></div></div>}
    </div>
  );
}

/** Hand-drawn arrow pointing at the socket on the broken pipe (rendered in screen space). */
function HintArrow({ edge }: { edge: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = document.querySelector(`[data-testid="socket-${edge}"]`) as HTMLElement | null;
      const host = document.querySelector('.canvas') as HTMLElement | null;
      if (el && host) {
        const a = el.getBoundingClientRect(), b = host.getBoundingClientRect();
        const p = { x: a.left + a.width / 2 - b.left, y: a.top - b.top };
        setPos(old => (old && Math.abs(old.x - p.x) < 0.5 && Math.abs(old.y - p.y) < 0.5 ? old : p));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [edge]);
  if (!pos) return null;
  return (
    <div className="hint-arrow" style={{ left: pos.x, top: pos.y }} aria-hidden>
      <div className="hint-text">drop a Splitter here<small>to keep some for a reserve</small></div>
      <svg width="60" height="64" viewBox="0 0 60 64"><path d="M12 4 C 2 24 14 44 40 54" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" /><path d="M29 56 L41 55 L37 44" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
}

export { TxLink };
