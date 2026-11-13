// GAME-2 puzzle jobs: definitions, the build model, compile-to-engine-machine and the requirement checks.
// Pure logic (no DOM, no Three.js) so it runs in node tests with the same wasm engine the contract uses.
import type { MachineDoc, OrderResult } from '../../api/types.js';
import type { Machine, Part } from '../../lib/machine.js';

export type PersonId = 'ada' | 'bola' | 'chi' | 'dayo' | 'customer';
export interface Person { id: PersonId; name: string; role: string; skin: string; shirt: string; hair: string; account?: string; evm?: string }

/** Fixed implicit demo recipients on NEAR testnet. Chi's Ethereum wallet is a real Sepolia address the team controls (demo). */
export const CHI_EVM = '0xE53AA3F186Dd3f580D2b6259bCa8aA86B10Eaeb2';
export const PEOPLE: Record<PersonId, Person> = {
  ada: { id: 'ada', name: 'Ada', role: 'baker, owns the shop', skin: '#8d5a3b', shirt: '#ff6f91', hair: '#2a1a12', account: '65c8bc5009157ffaa72a5160b0d56f4864c19e2214cc07f42c8f4205cfc7a4be' },
  bola: { id: 'bola', name: 'Bola', role: 'helper', skin: '#c98f68', shirt: '#4fb3ff', hair: '#1d1410', account: 'c7aaf34cd0000ea3928cada72e5c0da7f137dd6253570653f679181d547f0c4b' },
  chi: { id: 'chi', name: 'Chi', role: 'helper', skin: '#a8724f', shirt: '#ffb020', hair: '#3a2416', account: 'e60155237987e0d17f00d19940bc0af331bc2014a4f49c2a6081194cf5b7fc24', evm: CHI_EVM },
  dayo: { id: 'dayo', name: 'Dayo', role: 'delivery rider', skin: '#6e4630', shirt: '#2ec4b6', hair: '#140d09', account: '9de1cf2e633861aee8633e3801f32e6d0f663960fd4fe55d96aad246945698c2' },
  customer: { id: 'customer', name: 'Customer', role: 'buys bread', skin: '#f2c7a5', shirt: '#a78bfa', hair: '#5a3a22' },
};

export type PartKind = 'Splitter' | 'Payout' | 'Portal' | 'Vault' | 'Gate' | 'Worker';
export const PART_INFO: Record<PartKind, { name: string; does: string }> = {
  Splitter: { name: 'Splitter', does: 'splits money into shares' },
  Payout: { name: 'Payout', does: 'pays one person on NEAR' },
  Portal: { name: 'Portal', does: 'pays on Ethereum' },
  Vault: { name: 'Vault', does: 'keeps money locked' },
  Gate: { name: 'Gate', does: 'holds money until approved' },
  Worker: { name: 'Key', does: 'who may open the Gate' },
};

export type SocketRole = 'hub' | 'mid' | 'end' | 'key';
export interface Socket { id: string; role: SocketRole; lane: number; accepts: PartKind[]; hint: string }
export interface Placed { uid: string; kind: PartKind; shares?: number[]; person?: PersonId }
export type Build = Record<string, Placed | null>;
export interface TrayItem { uid: string; kind: PartKind }

export type Check =
  | { kind: 'share'; person: PersonId; pct: number }
  | { kind: 'eth'; person: PersonId }
  | { kind: 'afterDelivery'; person: PersonId; pct: number }
  | { kind: 'keyHolder'; person: PersonId };
export interface Requirement { id: string; text: string; check: Check }

export interface Job {
  n: 1 | 2 | 3;
  slug: string;
  client: PersonId;
  title: string;
  shop: string;
  quote: string;
  lesson: string;
  people: PersonId[];          // shown at lane ends / as choices
  lanes: number;               // splitter outputs
  sockets: Socket[];
  tray: PartKind[];            // initial tray (includes exactly one distractor)
  prefill?: Build;             // already-built parts (job 2 starts from job 1's solved shop)
  requirements: Requirement[];
  explain?: string;            // one plain line about the new idea
}

export const PRICE = '100000000000000000000000'; // 0.10 NEAR per sale
export const PORTAL_WEI = '100000000000000';     // 0.0001 Sepolia ETH per Portal payout
const END: PartKind[] = ['Payout', 'Portal', 'Vault'];

export const JOBS: Job[] = [
  {
    n: 1, slug: 'bakery', client: 'ada', title: "Ada's bakery", shop: "Ada's Bakery",
    quote: 'I pay my two helpers by hand every evening. Make my shop pay everyone automatically.',
    lesson: 'Splitter + Payout',
    people: ['ada', 'bola', 'chi'], lanes: 3,
    sockets: [
      { id: 'hub', role: 'hub', lane: -1, accepts: ['Splitter'], hint: 'splits the money' },
      { id: 'end0', role: 'end', lane: 0, accepts: END, hint: 'pays someone' },
      { id: 'end1', role: 'end', lane: 1, accepts: END, hint: 'pays someone' },
      { id: 'end2', role: 'end', lane: 2, accepts: END, hint: 'pays someone' },
    ],
    tray: ['Splitter', 'Payout', 'Payout', 'Payout', 'Vault'],
    requirements: [
      { id: 'ada', text: 'Ada gets 60%', check: { kind: 'share', person: 'ada', pct: 60 } },
      { id: 'bola', text: 'Bola gets 20%', check: { kind: 'share', person: 'bola', pct: 20 } },
      { id: 'chi', text: 'Chi gets 20%', check: { kind: 'share', person: 'chi', pct: 20 } },
    ],
  },
  {
    n: 2, slug: 'abroad', client: 'chi', title: 'Chi moved abroad', shop: "Ada's Bakery",
    quote: 'I moved abroad and only use Ethereum now. Can my 20% reach me there?',
    lesson: 'Portal',
    people: ['ada', 'bola', 'chi'], lanes: 3,
    sockets: [
      { id: 'hub', role: 'hub', lane: -1, accepts: ['Splitter'], hint: 'splits the money' },
      { id: 'end0', role: 'end', lane: 0, accepts: END, hint: 'pays someone' },
      { id: 'end1', role: 'end', lane: 1, accepts: END, hint: 'pays someone' },
      { id: 'end2', role: 'end', lane: 2, accepts: END, hint: 'pays someone' },
    ],
    tray: ['Portal', 'Vault'],
    prefill: {
      hub: { uid: 'p-split', kind: 'Splitter', shares: [60, 20, 20] },
      end0: { uid: 'p-ada', kind: 'Payout', person: 'ada' },
      end1: { uid: 'p-bola', kind: 'Payout', person: 'bola' },
      end2: { uid: 'p-chi', kind: 'Payout', person: 'chi' },
    },
    requirements: [
      { id: 'ada', text: 'Ada gets 60%', check: { kind: 'share', person: 'ada', pct: 60 } },
      { id: 'bola', text: 'Bola gets 20%', check: { kind: 'share', person: 'bola', pct: 20 } },
      { id: 'chi', text: 'Chi is paid on Ethereum', check: { kind: 'eth', person: 'chi' } },
    ],
    explain: 'NEAR signs an Ethereum payment itself (Chain Signatures). No bridge, no Ethereum wallet for Ada.',
  },
  {
    n: 3, slug: 'delivery', client: 'dayo', title: 'Dayo delivers', shop: "Ada's Bakery",
    quote: 'I deliver the bread. Pay me when the customer has it, not before.',
    lesson: 'Gate + Key',
    people: ['ada', 'dayo'], lanes: 2,
    sockets: [
      { id: 'hub', role: 'hub', lane: -1, accepts: ['Splitter'], hint: 'splits the money' },
      { id: 'end0', role: 'end', lane: 0, accepts: END, hint: 'pays someone' },
      { id: 'mid1', role: 'mid', lane: 1, accepts: ['Gate', 'Payout', 'Vault', 'Portal'], hint: 'money passes here' },
      { id: 'key1', role: 'key', lane: 1, accepts: ['Worker'], hint: 'who opens the Gate' },
      { id: 'end1', role: 'end', lane: 1, accepts: END, hint: 'pays someone' },
    ],
    tray: ['Gate', 'Worker', 'Payout', 'Vault'],
    prefill: {
      hub: { uid: 'p-split', kind: 'Splitter', shares: [80, 20] },
      end0: { uid: 'p-ada', kind: 'Payout', person: 'ada' },
    },
    requirements: [
      { id: 'ada', text: 'Ada gets 80%', check: { kind: 'share', person: 'ada', pct: 80 } },
      { id: 'dayo', text: 'Dayo gets 20% after delivery', check: { kind: 'afterDelivery', person: 'dayo', pct: 20 } },
      { id: 'key', text: 'The customer confirms delivery', check: { kind: 'keyHolder', person: 'customer' } },
    ],
    explain: 'A Gate holds Dayo’s share. Only the Key holder can release it. If nobody confirms in time, it goes back to the customer.',
  },
];

export const jobByN = (n: number) => JOBS.find(j => j.n === n) ?? JOBS[0];

// ---------------------------------------------------------------- build state
let uidSeq = 0;
export function initialState(job: Job): { build: Build; tray: TrayItem[] } {
  const build: Build = {};
  for (const s of job.sockets) build[s.id] = job.prefill?.[s.id] ? { ...job.prefill[s.id]!, shares: job.prefill[s.id]!.shares?.slice() } : null;
  return { build, tray: job.tray.map(kind => ({ uid: `t${++uidSeq}-${kind}`, kind })) };
}

export function defaultPlaced(job: Job, kind: PartKind, uid: string): Placed {
  if (kind === 'Splitter') {
    return { uid, kind, shares: job.lanes === 3 ? [40, 30, 30] : job.lanes === 2 ? [50, 50] : [25, 25, 25, 25] };
  }
  return { uid, kind };
}

/** Sockets that exist in the current build (the key and the end after a Gate only matter when a Gate is in place). */
export function activeSockets(job: Job, build: Build): Socket[] {
  return job.sockets.filter(s => {
    if (s.role === 'key') return build[`mid${s.lane}`]?.kind === 'Gate';
    if (s.role === 'end' && job.sockets.some(m => m.role === 'mid' && m.lane === s.lane)) {
      const mid = build[`mid${s.lane}`];
      return !mid || mid.kind === 'Gate';
    }
    return true;
  });
}

/** What still needs doing before Test, in order. Empty = ready to test. */
export function todo(job: Job, build: Build): { socket: string; what: string }[] {
  const out: { socket: string; what: string }[] = [];
  for (const s of activeSockets(job, build)) {
    const p = build[s.id];
    if (!p) { out.push({ socket: s.id, what: 'empty' }); continue; }
    if ((p.kind === 'Payout' || p.kind === 'Worker') && !p.person) out.push({ socket: s.id, what: 'person' });
  }
  return out;
}

// ---------------------------------------------------------------- compile
export interface Compiled { doc: MachineDoc; roleHolder?: PersonId; error?: string }
export const WORKER_ROLE = 'checker';

/** Turn the socket build into an engine machine (engine/MACHINE_FORMAT.md). `holderAccount` binds the Key role. */
export function compile(job: Job, build: Build, holderAccount = 'you.testnet'): Compiled {
  const nodes: Record<string, Part> = {};
  const hub = build.hub;
  const shares = hub?.shares ?? [];
  const total = shares.reduce((a, b) => a + b, 0);
  if (!hub || hub.kind !== 'Splitter') return { doc: { machine: { portal_cap_wei: '0', nodes: {} }, workers: {} }, error: 'missing splitter' };
  if (shares.some(x => x <= 0)) return { doc: { machine: { portal_cap_wei: '0', nodes: {} }, workers: {} }, error: 'Every share must be more than 0%.' };
  if (total !== 100) return { doc: { machine: { portal_cap_wei: '0', nodes: {} }, workers: {} }, error: `Shares add up to ${total}%. They must add up to 100%.` };
  nodes.slot = { type: 'CoinSlot', price: PRICE, output: 'split' };
  const outputs: { bps: number; target: string }[] = [];
  let wei = 0n, holder: PersonId | undefined;
  const workers: Record<string, string> = {};
  const endNode = (p: Placed, id: string): Part | null => {
    if (p.kind === 'Payout') return { type: 'Payout', account: PEOPLE[p.person ?? 'ada'].account ?? '$payer' };
    if (p.kind === 'Portal') { wei += BigInt(PORTAL_WEI); return { type: 'Portal', chain: 'sepolia', wei: PORTAL_WEI }; }
    if (p.kind === 'Vault') return { type: 'Vault', name: `jar ${id.slice(-1)}` };
    return null;
  };
  for (let lane = 0; lane < job.lanes; lane++) {
    const mid = build[`mid${lane}`];
    const end = build[`end${lane}`];
    const endId = `pay${lane}`;
    let target = endId;
    if (mid && mid.kind === 'Gate') {
      const gid = `gate${lane}`;
      const key = build[`key${lane}`];
      holder = key?.person;
      nodes[gid] = { type: 'Gate', condition: { type: 'NeedsApproval', worker: WORKER_ROLE }, pass: endId, fail: 'refund' };
      nodes[WORKER_ROLE] = { type: 'Worker', gates: [gid] };
      nodes.refund = { type: 'Payout', account: '$payer' };
      workers[WORKER_ROLE] = holderAccount;
      target = gid;
      if (end) { const n = endNode(end, endId); if (n) nodes[endId] = n; }
    } else if (mid) {
      const n = endNode(mid, `mid${lane}`); if (n) nodes[endId] = n;
    } else if (end) {
      const n = endNode(end, endId); if (n) nodes[endId] = n;
    }
    outputs.push({ bps: (shares[lane] ?? 0) * 100, target });
  }
  nodes.split = { type: 'Splitter', outputs };
  const machine: Machine = { portal_cap_wei: wei.toString(), nodes };
  return { doc: { machine, workers }, roleHolder: holder };
}

// ---------------------------------------------------------------- test (simulated)
export type Received = Partial<Record<PersonId, { near: bigint; wei: bigint }>> & { vault?: bigint; refund?: bigint };
export interface SaleSim {
  n: number;
  delivered: boolean;               // job 3: customer 3 never confirms
  paid: Received;                   // routed at the moment of payment
  held: bigint;                     // waiting at the Gate
  released: Received;               // after approval (or after time-out: refund)
  effects: OrderResult['effects'];
}
export interface RowResult { id: string; ok: boolean; text: string; amount: string }
export interface TestResult { ok: boolean; why: string; rows: RowResult[]; sales: SaleSim[]; engineError?: string }

type Engine = { validate(doc: MachineDoc): { ok: true } | { ok: false; errors: string[] }; preview(doc: MachineDoc, recipient?: string): OrderResult };

const accountOwner = (acct: string): PersonId | 'refund' | null => {
  if (acct === '$payer' || acct === 'buyer.testnet') return 'refund';
  for (const p of Object.values(PEOPLE)) if (p.account === acct) return p.id;
  return null;
};
function tally(effects: OrderResult['effects'], into: Received) {
  for (const e of effects) {
    if (e.kind === 'payout') {
      const who = accountOwner(e.account);
      if (who === 'refund') into.refund = (into.refund ?? 0n) + BigInt(e.amount);
      else if (who) { const r = (into[who] ??= { near: 0n, wei: 0n }); r.near += BigInt(e.amount); }
    } else if (e.kind === 'vault') into.vault = (into.vault ?? 0n) + BigInt(e.amount);
    else { const r = (into.chi ??= { near: 0n, wei: 0n }); r.wei += BigInt(e.wei); }
  }
}
const pctOf = (y: bigint) => Number((y * 10000n) / BigInt(PRICE)) / 100;
const nearStr = (y: bigint) => { const s = (Number(y / 10n ** 18n) / 1e6).toFixed(3).replace(/0$/, ''); return s; };

/** Variant of the machine where every approval Gate resolves one way (simulates Approve or time-out). */
function resolveGates(doc: MachineDoc, pass: boolean): MachineDoc {
  const m = structuredClone(doc.machine) as Machine;
  for (const [id, p] of Object.entries(m.nodes)) {
    if (p.type === 'Gate' && p.condition.type === 'NeedsApproval') {
      m.nodes[id] = { ...p, condition: { type: 'MinAmount', amount: pass ? '0' : PRICE + '0' } };
      delete m.nodes[p.condition.worker];
    }
  }
  return { machine: m, workers: {} };
}

/** Three simulated customers through the wasm engine, then each requirement checked. */
export function runTest(job: Job, build: Build, engine: Engine): TestResult {
  const c = compile(job, build);
  const fail = (why: string, engineError?: string): TestResult => ({ ok: false, why, rows: job.requirements.map(r => ({ id: r.id, ok: false, text: r.text, amount: '' })), sales: [], engineError });
  if (c.error) return fail(c.error);
  const v = engine.validate(c.doc);
  if (!v.ok) return fail('The engine rejected this machine. Check every socket.', v.errors.join('; '));
  const sales: SaleSim[] = [];
  const gated = job.sockets.some(s => s.role === 'mid') && build.mid1?.kind === 'Gate';
  for (let n = 1; n <= 3; n++) {
    const delivered = !(gated && n === 3);
    let r: OrderResult;
    try { r = engine.preview(c.doc, CHI_EVM); } catch (e) { return fail('The engine rejected this machine. Check every socket.', String(e)); }
    if (r.trace.some(t => t.startsWith('error'))) return fail('The engine rejected this machine. Check every socket.', r.trace.join(' '));
    const paid: Received = {}; tally(r.effects, paid);
    let held = 0n; const released: Received = {}; let effects = r.effects;
    if (r.pending) {
      const routed = r.effects.reduce((a, e) => a + (e.kind === 'external' ? BigInt(e.fee) : BigInt(e.amount)), 0n);
      held = BigInt(PRICE) - routed;
      const after = engine.preview(resolveGates(c.doc, delivered), CHI_EVM);
      const all: Received = {}; tally(after.effects, all);
      // released = all - paid
      for (const k of Object.keys(all) as (keyof Received)[]) {
        if (k === 'vault' || k === 'refund') { const d = ((all[k] as bigint) ?? 0n) - ((paid[k] as bigint | undefined) ?? 0n); if (d > 0n) released[k] = d; continue; }
        const a = all[k]!, b = paid[k] ?? { near: 0n, wei: 0n };
        if (a.near - b.near > 0n || a.wei - b.wei > 0n) released[k] = { near: a.near - b.near, wei: a.wei - b.wei };
      }
      effects = after.effects;
    }
    sales.push({ n, delivered, paid, held, released, effects });
  }
  const s1 = sales[0];
  const total = (who: PersonId, s: SaleSim) => (s.paid[who]?.near ?? 0n) + (s.released[who]?.near ?? 0n);
  const rows: RowResult[] = [];
  let why = '';
  const vaulted = s1.paid.vault ?? 0n;
  for (const r of job.requirements) {
    const ck = r.check;
    let ok = false, amount = '', reason = '';
    const name = PEOPLE[ck.person].name;
    if (ck.kind === 'share') {
      const got = total(ck.person, s1);
      const p = pctOf(got);
      amount = got > 0n ? `+${nearStr(got)} NEAR` : (s1.paid[ck.person]?.wei ? 'got ETH' : 'nothing');
      ok = p === ck.pct && !(s1.paid[ck.person]?.wei);
      if (!ok) reason = s1.paid[ck.person]?.wei ? `${name} got ETH, but wants NEAR here.` : got === 0n ? `${name} got nothing. ${name} needs ${ck.pct}%.` : `${name} got ${p}%, needs ${ck.pct}%.`;
    } else if (ck.kind === 'eth') {
      const w = s1.paid[ck.person]?.wei ?? 0n;
      const n = total(ck.person, s1);
      ok = w > 0n && n === 0n;
      amount = w > 0n ? '+0.0001 ETH' : n > 0n ? `+${nearStr(n)} NEAR` : 'nothing';
      if (!ok) reason = n > 0n ? `${name} got NEAR, but ${name} only uses Ethereum now.` : `${name} got nothing on Ethereum.`;
    } else if (ck.kind === 'afterDelivery') {
      const before = s1.paid[ck.person]?.near ?? 0n;
      const after = s1.released[ck.person]?.near ?? 0n;
      const s3 = sales[2];
      ok = before === 0n && pctOf(after) === ck.pct && (s3.released[ck.person]?.near ?? 0n) === 0n;
      amount = before > 0n ? `+${nearStr(before)} NEAR before delivery` : after > 0n ? `+${nearStr(after)} NEAR after delivery` : 'nothing';
      if (!ok) reason = before > 0n ? `${name} was paid before the delivery.` : after === 0n ? `${name} got nothing, even after delivery.` : `${name} got ${pctOf(after)}%, needs ${ck.pct}%.`;
    } else {
      const holder = c.roleHolder;
      ok = holder === ck.person;
      amount = holder ? `${PEOPLE[holder].name} holds the Key` : 'no Key';
      if (!ok) reason = !holder ? 'Nobody holds the Key, so the Gate never opens.' : holder === 'dayo' ? 'The rider can’t confirm their own delivery. Give the Key to the customer.' : `${PEOPLE[holder].name} wasn’t there. The customer must confirm.`;
    }
    rows.push({ id: r.id, ok, text: r.text, amount });
    if (!ok && !why) why = reason;
  }
  if (!why && vaulted > 0n) why = `A Vault kept ${pctOf(vaulted)}%. Nobody gets that money.`;
  if (vaulted > 0n && why && !why.includes('Vault')) why = `${why} (A Vault kept ${pctOf(vaulted)}%.)`;
  const ok = rows.every(r => r.ok) && vaulted === 0n;
  return { ok, why: ok ? '' : why, rows, sales };
}

/** Ids accepted by the contract: [a-z0-9_-], ≤32. Unique per session account and per machine content. */
export function jobMachineId(job: Job, doc: MachineDoc, account: string): string {
  let h = 0x811c9dc5; const s = JSON.stringify(doc);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  const acct = account.split('.')[0].replace(/[^a-z0-9]/g, '').slice(-10) || 'guest';
  return `${job.slug.slice(0, 8)}-${(h >>> 0).toString(16).padStart(8, '0')}-${acct}`;
}

/** Who a published machine pays, for the standalone shop (/m/:id). */
export function shopPeople(machine: Machine): { person: Person; pct: number; how: 'near' | 'eth' | 'after' }[] {
  const out: { person: Person; pct: number; how: 'near' | 'eth' | 'after' }[] = [];
  const split = Object.values(machine.nodes).find(p => p.type === 'Splitter');
  if (!split || split.type !== 'Splitter') return out;
  for (const o of split.outputs) {
    let node = machine.nodes[o.target]; let how: 'near' | 'eth' | 'after' = 'near';
    if (node?.type === 'Gate') { node = machine.nodes[node.pass]; how = 'after'; }
    if (node?.type === 'Payout') { const who = accountOwner(node.account); if (who && who !== 'refund') out.push({ person: PEOPLE[who], pct: o.bps / 100, how }); }
    if (node?.type === 'Portal') out.push({ person: PEOPLE.chi, pct: o.bps / 100, how: 'eth' });
  }
  return out;
}
export const isJobMachine = (id: string) => /^(bakery|abroad|delivery)-/.test(id);
export const jobForMachineId = (id: string) => JOBS.find(j => id.startsWith(j.slug.slice(0, 8) + '-'));
