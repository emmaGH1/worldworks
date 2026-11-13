// GAME-3 puzzle jobs: definitions, the tree build model, compile-to-engine-machine, the rule checkers and stars.
// Pure logic (no DOM, no Three.js) so it runs in node tests with the same wasm engine the contract uses.
// Requirements are goals and limits, never the answer: the player derives the shares and the structure.
import type { MachineDoc, OrderResult } from '../../api/types.js';
import type { Machine, Part } from '../../lib/machine.js';

export type PersonId = 'ada' | 'bola' | 'chi' | 'dayo' | 'customer' | 'you' | 'f1' | 'f2';
export interface Person { id: PersonId; name: string; role: string; skin: string; shirt: string; hair: string; account?: string; evm?: string }

/** Fixed implicit demo recipients on NEAR testnet. Chi's Ethereum wallet is a real Sepolia address the team controls (demo). */
export const CHI_EVM = '0xE53AA3F186Dd3f580D2b6259bCa8aA86B10Eaeb2';
export const PEOPLE: Record<PersonId, Person> = {
  ada: { id: 'ada', name: 'Ada', role: 'baker, owns the shop', skin: '#8d5a3b', shirt: '#ff6f91', hair: '#2a1a12', account: '65c8bc5009157ffaa72a5160b0d56f4864c19e2214cc07f42c8f4205cfc7a4be' },
  bola: { id: 'bola', name: 'Bola', role: 'helper', skin: '#c98f68', shirt: '#4fb3ff', hair: '#1d1410', account: 'c7aaf34cd0000ea3928cada72e5c0da7f137dd6253570653f679181d547f0c4b' },
  chi: { id: 'chi', name: 'Chi', role: 'helper, moved abroad', skin: '#a8724f', shirt: '#ffb020', hair: '#3a2416', account: 'e60155237987e0d17f00d19940bc0af331bc2014a4f49c2a6081194cf5b7fc24', evm: CHI_EVM },
  dayo: { id: 'dayo', name: 'Dayo', role: 'delivery rider', skin: '#6e4630', shirt: '#2ec4b6', hair: '#140d09', account: '9de1cf2e633861aee8633e3801f32e6d0f663960fd4fe55d96aad246945698c2' },
  customer: { id: 'customer', name: 'Customer', role: 'buys bread', skin: '#f2c7a5', shirt: '#a78bfa', hair: '#5a3a22' },
  you: { id: 'you', name: 'You', role: 'shop owner', skin: '#d9a27a', shirt: '#ffd23f', hair: '#3a2416' },
  f1: { id: 'f1', name: 'Friend 1', role: 'friend', skin: '#b67c55', shirt: '#7bd389', hair: '#20140c' },
  f2: { id: 'f2', name: 'Friend 2', role: 'friend', skin: '#e0b48e', shirt: '#ff8a74', hair: '#6b3f22' },
};

export type PartKind = 'Splitter' | 'Payout' | 'Portal' | 'Vault' | 'Gate' | 'Worker';
export const PART_INFO: Record<PartKind, { name: string; does: string }> = {
  Splitter: { name: 'Splitter', does: 'splits money into shares' },
  Payout: { name: 'Payout', does: 'pays one person on NEAR' },
  Portal: { name: 'Portal', does: 'pays on Ethereum' },
  Vault: { name: 'Vault', does: 'keeps money locked' },
  Gate: { name: 'Gate', does: 'holds money until the Key' },
  Worker: { name: 'Key', does: 'who may open the Gate' },
};

export const PRICE = '100000000000000000000000'; // 0.10 NEAR per sale
export const PORTAL_WEI = '500000000000000';     // 0.0005 Sepolia ETH: default Portal payout
export const PORTAL_OPTIONS = ['500000000000000', '1000000000000000']; // 0.0005 / 0.001 ETH
export const DEFAULT_RATE = '1000000';           // contract min fee: yocto per wei (live get_limits value at GAME-3 time)
export const SHARE_STEP = 5;                      // Splitter dials click in 5% steps (a game rule, not an engine rule)
export const MAX_DEPTH = 2;                       // root (0) + two more levels
const NODE_PARTS: PartKind[] = ['Splitter', 'Gate', 'Payout', 'Portal', 'Vault'];
const LEAF_PARTS: PartKind[] = ['Payout', 'Portal', 'Vault'];

// ---------------------------------------------------------------- build model (a tree of sockets)
// Socket ids are paths: 'r' is the spot after the Coin Slot; a Splitter at P has children P.0, P.1(, P.2);
// a Gate at P has P.p (delivered), P.f (time up) and the Key hook P.k.
export type SocketRole = 'node' | 'key';
export interface Socket { id: string; depth: number; parent: string | null; port: string; role: SocketRole; accepts: PartKind[]; hint: string }
export interface Placed { uid: string; kind: PartKind; shares?: number[]; person?: PersonId; wei?: string }
export type Build = Record<string, Placed | null>;
export interface TrayItem { uid: string; kind: PartKind }

export interface Totals {
  price: bigint;
  near: Partial<Record<PersonId, bigint>>;    // everything a person got in a delivered sale (incl. after the Gate opened)
  before: Partial<Record<PersonId, bigint>>;  // what they got at the moment of payment
  wei: Partial<Record<PersonId, bigint>>;
  vault: bigint; lost: bigint;
  portalFee: bigint; portalWei: bigint; minFee: bigint; rate: bigint; portals: number;
  gated: boolean; keyHolder?: PersonId;
  undelivered?: { near: Partial<Record<PersonId, bigint>>; vault: bigint };  // the sale whose bread never arrives
  parts: number;
  friends: PersonId[];
}
export interface CheckOut { ok: boolean; amount: string; why: string }
export interface Requirement { id: string; pill: string; text: string; who?: PersonId[]; check: (t: Totals) => CheckOut }
export interface Score { stars: 1 | 2 | 3; note: string }

export interface Job {
  n: 1 | 2 | 3 | 4 | 5;
  slug: string;
  client: PersonId;
  title: string;
  shop: string;
  quote: string;
  lesson: string;
  people: PersonId[];          // shown in the world; who a Payout may pay
  payTo?: PersonId[];          // Payout chooser (default: people)
  keyPeople?: PersonId[];
  tray: PartKind[];            // the parts budget
  best: number;                // fewest parts of the best solution (★★★)
  requirements: Requirement[];
  explain?: string;
  abroad?: PersonId;           // lives on the Ethereum island; the Portal pays them
  score: (t: Totals) => Score;
}

// ---------------------------------------------------------------- money formatting
/** 0.0375-style NEAR, up to 5 decimals, no trailing zeros. */
export function fmtN(y: bigint): string {
  const neg = y < 0n; const v = neg ? -y : y;
  const whole = v / 10n ** 24n; let frac = ((v % 10n ** 24n) / 10n ** 19n).toString().padStart(5, '0').replace(/0+$/, '');
  if (!frac && whole === 0n && v > 0n) frac = '00001';
  return `${neg ? '-' : ''}${whole}${frac ? '.' + frac : ''}`;
}
export function fmtE(w: bigint): string {
  const whole = w / 10n ** 18n; const frac = ((w % 10n ** 18n) / 10n ** 12n).toString().padStart(6, '0').replace(/0+$/, '');
  return `${whole}${frac ? '.' + frac : ''}`;
}
const g = (r: Partial<Record<PersonId, bigint>>, p: PersonId) => r[p] ?? 0n;
const plus = (y: bigint) => (y > 0n ? `+${fmtN(y)}` : 'nothing');
const byParts = (t: Totals, best: number): Score =>
  t.parts <= best ? { stars: 3, note: `${t.parts} parts: the best possible.` }
  : t.parts === best + 1 ? { stars: 2, note: `${t.parts} parts. It can be done with ${best}.` }
  : { stars: 1, note: `${t.parts} parts. It can be done with ${best}.` };
const allPaid = (who: string): Requirement => ({
  id: 'all', pill: 'All paid out', text: 'Every coin is paid out',
  check: t => t.vault > 0n ? { ok: false, amount: `Vault ${fmtN(t.vault)}`, why: `A Vault kept ${fmtN(t.vault)}. ${who} wants every coin paid out.` }
    : t.lost > 0n ? { ok: false, amount: `lost ${fmtN(t.lost)}`, why: `${fmtN(t.lost)} went nowhere.` }
    : { ok: true, amount: '0 kept', why: '' },
});

// ---------------------------------------------------------------- the jobs
const P = BigInt(PRICE);
export const JOBS: Job[] = [
  {
    n: 1, slug: 'bake3', client: 'ada', title: "Ada's bakery", shop: "Ada's Bakery", lesson: 'Splitter + Payout',
    quote: 'I pay my two helpers by hand every evening. I keep three times what each helper gets, and my helpers get the same. Make the shop do it.',
    people: ['ada', 'bola', 'chi'], tray: ['Splitter', 'Splitter', 'Payout', 'Payout', 'Payout', 'Payout', 'Vault'], best: 4,
    explain: 'A Splitter can have 2 or 3 belts. Its dials click in 5% steps.',
    requirements: [
      { id: 'ada', pill: 'Ada = 3× a helper', text: 'Ada keeps 3× what each helper gets', who: ['ada', 'bola', 'chi'], check: t => {
        const a = g(t.near, 'ada'), b = g(t.near, 'bola'), c = g(t.near, 'chi');
        if (a === 0n) return { ok: false, amount: 'nothing', why: 'Ada got nothing.' };
        if (b === 0n) return { ok: false, amount: plus(a), why: 'Bola got nothing.' };
        if (a !== 3n * b) return { ok: false, amount: plus(a), why: `Ada got ${fmtN(a)}, needs 3× Bola’s ${fmtN(b)} = ${fmtN(3n * b)}.` };
        if (a !== 3n * c) return { ok: false, amount: plus(a), why: c === 0n ? 'Chi got nothing.' : `Ada got ${fmtN(a)}, needs 3× Chi’s ${fmtN(c)} = ${fmtN(3n * c)}.` };
        return { ok: true, amount: plus(a), why: '' };
      } },
      { id: 'same', pill: 'Bola = Chi', text: 'Bola and Chi get the same', who: ['bola', 'chi'], check: t => {
        const b = g(t.near, 'bola'), c = g(t.near, 'chi');
        return b === c && b > 0n ? { ok: true, amount: `${plus(b)} each`, why: '' } : { ok: false, amount: `${fmtN(b)} / ${fmtN(c)}`, why: b === 0n && c === 0n ? 'The helpers got nothing.' : `Bola got ${fmtN(b)} but Chi got ${fmtN(c)}. Helpers get the same.` };
      } },
      allPaid('Ada'),
    ],
    score: t => byParts(t, 4),
  },
  {
    n: 2, slug: 'half3', client: 'ada', title: 'Ada steps back', shop: "Ada's Bakery", lesson: 'Splitter → Splitter',
    quote: 'I work less now, so I take half of every sale. Of the rest, Bola gets three times what Chi gets: she bakes the most.',
    people: ['ada', 'bola', 'chi'], tray: ['Splitter', 'Splitter', 'Payout', 'Payout', 'Payout', 'Payout', 'Vault'], best: 5,
    explain: 'Dials click in 5% steps. A Splitter can feed another Splitter.',
    requirements: [
      { id: 'half', pill: 'Ada = half', text: 'Ada gets half', who: ['ada'], check: t => {
        const a = g(t.near, 'ada');
        return 2n * a === t.price ? { ok: true, amount: plus(a), why: '' } : { ok: false, amount: plus(a), why: a === 0n ? 'Ada got nothing. She needs half: 0.05.' : `Ada got ${fmtN(a)}, needs half: ${fmtN(t.price / 2n)}.` };
      } },
      { id: 'bola', pill: 'Bola = 3× Chi', text: 'Bola gets 3× what Chi gets', who: ['bola', 'chi'], check: t => {
        const b = g(t.near, 'bola'), c = g(t.near, 'chi');
        if (c === 0n) return { ok: false, amount: plus(b), why: 'Chi got nothing.' };
        return b === 3n * c ? { ok: true, amount: plus(b), why: '' } : { ok: false, amount: plus(b), why: `Bola got ${fmtN(b)}, needs 3× Chi’s ${fmtN(c)} = ${fmtN(3n * c)}.` };
      } },
      allPaid('Ada'),
    ],
    score: t => byParts(t, 5),
  },
  {
    n: 3, slug: 'abroad3', client: 'chi', title: 'Chi moved abroad', shop: "Ada's Bakery", lesson: 'Portal (Ethereum)',
    quote: 'I live abroad now and only use Ethereum. Send me at least 0.0005 ETH for every loaf. Bola keeps her 20%. Ada gets everything else.',
    people: ['ada', 'bola', 'chi'], tray: ['Splitter', 'Splitter', 'Payout', 'Payout', 'Payout', 'Portal', 'Vault'], best: 6, abroad: 'chi',
    explain: 'The Portal makes NEAR sign an Ethereum payment itself (Chain Signatures). The contract charges 1 NEAR per 1 ETH it sends. Anything above that is kept as extra fee.',
    requirements: [
      { id: 'eth', pill: 'Chi ≥ 0.0005 ETH', text: 'Chi gets at least 0.0005 ETH on Ethereum', who: ['chi'], check: t => {
        const n = g(t.near, 'chi'), w = g(t.wei, 'chi');
        if (n > 0n) return { ok: false, amount: `${plus(n)} NEAR`, why: `Chi got ${fmtN(n)} NEAR, but Chi only uses Ethereum now.` };
        if (!t.portals) return { ok: false, amount: 'nothing', why: 'Chi got nothing on Ethereum.' };
        if (t.portalFee < t.minFee) return { ok: false, amount: 'refused', why: `The Portal needs ${fmtN(t.minFee)} NEAR to send ${fmtE(t.portalWei)} ETH but gets ${fmtN(t.portalFee)}. The contract would refuse it.` };
        if (w < 500000000000000n) return { ok: false, amount: `${fmtE(w)} ETH`, why: `Chi got ${fmtE(w)} ETH, needs at least 0.0005.` };
        return { ok: true, amount: `+${fmtE(w)} ETH`, why: '' };
      } },
      { id: 'bola', pill: 'Bola = 20%', text: 'Bola keeps her 20%', who: ['bola'], check: t => {
        const b = g(t.near, 'bola');
        return 5n * b === t.price ? { ok: true, amount: plus(b), why: '' } : { ok: false, amount: plus(b), why: b === 0n ? 'Bola got nothing. She keeps 20%: 0.02.' : `Bola got ${fmtN(b)}, needs 20%: ${fmtN(t.price / 5n)}.` };
      } },
      { id: 'rest', pill: 'Ada gets the rest', text: 'Ada gets everything else', who: ['ada'], check: t => {
        const a = g(t.near, 'ada');
        if (t.vault > 0n) return { ok: false, amount: plus(a), why: `A Vault kept ${fmtN(t.vault)}. Ada should get it.` };
        if (a === 0n) return { ok: false, amount: 'nothing', why: 'Ada got nothing.' };
        const others = (Object.entries(t.near) as [PersonId, bigint][]).filter(([p]) => p !== 'ada' && p !== 'bola' && p !== 'chi').reduce((s, [, v]) => s + v, 0n);
        if (others > 0n || t.lost > 0n) return { ok: false, amount: plus(a), why: `${fmtN(others + t.lost)} went to someone else.` };
        return { ok: true, amount: plus(a), why: '' };
      } },
    ],
    score: t => {
      const extra = t.portalFee - t.minFee;
      if (extra <= 0n) return { stars: 3, note: 'Zero waste: the Portal gets exactly its fee.' };
      return { stars: extra <= 10n ** 21n ? 2 : 1, note: `The Portal keeps ${fmtN(extra)} NEAR more than its fee. Ada could have it.` };
    },
  },
  {
    n: 4, slug: 'rider3', client: 'dayo', title: 'Dayo delivers', shop: "Ada's Bakery", lesson: 'Gate + Key',
    quote: 'I deliver the bread. Pay my 20% only after the customer has it. If the bread never arrives, the customer gets that money back. Ada gets the other 80%.',
    people: ['ada', 'dayo'], payTo: ['ada', 'dayo', 'customer'], keyPeople: ['customer', 'dayo', 'ada'],
    tray: ['Splitter', 'Gate', 'Worker', 'Payout', 'Payout', 'Payout', 'Vault'], best: 6,
    explain: 'A Gate holds money until its Key holder confirms. It has two exits: delivered, and time up.',
    requirements: [
      { id: 'ada', pill: 'Ada = 80%', text: 'Ada gets 80%', who: ['ada'], check: t => {
        const a = g(t.near, 'ada');
        return 5n * a === 4n * t.price ? { ok: true, amount: plus(a), why: '' } : { ok: false, amount: plus(a), why: a === 0n ? 'Ada got nothing. She needs 80%: 0.08.' : `Ada got ${fmtN(a)}, needs 80%: ${fmtN((t.price * 4n) / 5n)}.` };
      } },
      { id: 'after', pill: 'Dayo after delivery', text: 'Dayo gets 20%, only after delivery', who: ['dayo'], check: t => {
        const before = g(t.before, 'dayo'), all = g(t.near, 'dayo'), lost = t.undelivered ? g(t.undelivered.near, 'dayo') : before;
        if (before > 0n) return { ok: false, amount: `${plus(before)} early`, why: 'Dayo was paid before the bread arrived.' };
        if (all === 0n) return { ok: false, amount: 'nothing', why: 'Dayo got nothing, even after delivery.' };
        if (lost > 0n) return { ok: false, amount: plus(all), why: 'Dayo got paid for bread that never arrived.' };
        return 5n * all === t.price ? { ok: true, amount: `${plus(all)} after`, why: '' } : { ok: false, amount: plus(all), why: `Dayo got ${fmtN(all)}, needs 20%: ${fmtN(t.price / 5n)}.` };
      } },
      { id: 'refund', pill: 'No bread → refund', text: 'No delivery → the customer gets Dayo’s share back', who: ['customer'], check: t => {
        if (!t.undelivered) return { ok: false, amount: 'no refund', why: 'Nothing waits for the delivery, so nothing can go back to the customer.' };
        const r = g(t.undelivered.near, 'customer');
        if (r * 5n >= t.price) return { ok: true, amount: `${plus(r)} back`, why: '' };
        if (t.undelivered.vault > 0n) return { ok: false, amount: 'kept', why: `The bread never arrived and the customer got nothing back: a Vault kept ${fmtN(t.undelivered.vault)}.` };
        return { ok: false, amount: 'nothing back', why: 'The bread never arrived, but the customer got nothing back.' };
      } },
      { id: 'key', pill: 'Customer has the Key', text: 'The customer confirms delivery', who: ['customer'], check: t => {
        const h = t.keyHolder;
        if (h === 'customer') return { ok: true, amount: 'Customer', why: '' };
        return { ok: false, amount: h ? PEOPLE[h].name : 'no Key', why: !h ? 'Nobody holds the Key, so the Gate never opens.' : h === 'dayo' ? 'The rider can’t confirm their own delivery. Give the Key to the customer.' : `${PEOPLE[h].name} wasn’t there. The customer must confirm.` };
      } },
    ],
    score: t => g(t.before, 'ada') * 5n === t.price * 4n ? { stars: 3, note: 'Ada is paid at once; only Dayo’s share waits.' } : { stars: 2, note: 'Ada waited for the delivery too. Can she be paid at once?' },
  },
  {
    n: 5, slug: 'shop', client: 'you', title: 'Your shop', shop: 'Your shop', lesson: 'your own stake',
    quote: 'Your own shop. Every sale really pays you on NEAR testnet. Add up to two friends.',
    people: ['you'], tray: ['Splitter', 'Splitter', 'Payout', 'Payout', 'Payout', 'Payout', 'Portal'], best: 1,
    requirements: [
      { id: 'you', pill: 'You get paid', text: 'You get paid', who: ['you'], check: t => {
        const y = g(t.near, 'you');
        return y > 0n ? { ok: true, amount: plus(y), why: '' } : { ok: false, amount: 'nothing', why: 'You got nothing. Put a Payout for You in the machine.' };
      } },
      { id: 'friends', pill: 'Friends get paid', text: 'Every friend gets something', who: ['f1', 'f2'], check: t => {
        for (const f of t.friends) {
          if (g(t.near, f) === 0n && g(t.wei, f) === 0n) return { ok: false, amount: 'missing', why: `${PEOPLE[f].name} got nothing.` };
        }
        if (t.portals && t.portalFee < t.minFee) return { ok: false, amount: 'refused', why: `The Portal needs ${fmtN(t.minFee)} NEAR to send ${fmtE(t.portalWei)} ETH but gets ${fmtN(t.portalFee)}.` };
        return { ok: true, amount: t.friends.length ? 'all' : 'none added', why: '' };
      } },
      allPaid('You'),
    ],
    score: () => ({ stars: 3, note: 'Your shop works.' }),
  },
];
export const jobByN = (n: number) => JOBS.find(j => j.n === n) ?? JOBS[0];

// ---------------------------------------------------------------- sockets
export function activeSockets(_job: Job, build: Build): Socket[] {
  const out: Socket[] = [];
  const visit = (id: string, depth: number, parent: string | null, port: string) => {
    const hint = port === 'p' ? 'delivered' : port === 'f' ? 'time up' : depth === 0 ? 'start here' : 'empty';
    out.push({ id, depth, parent, port, role: 'node', accepts: depth < MAX_DEPTH ? NODE_PARTS : LEAF_PARTS, hint });
    const p = build[id];
    if (p?.kind === 'Splitter') p.shares!.forEach((_, i) => visit(`${id}.${i}`, depth + 1, id, String(i)));
    if (p?.kind === 'Gate') {
      visit(`${id}.p`, depth + 1, id, 'p'); visit(`${id}.f`, depth + 1, id, 'f');
      out.push({ id: `${id}.k`, depth: depth + 1, parent: id, port: 'k', role: 'key', accepts: ['Worker'], hint: 'Key' });
    }
  };
  visit('r', 0, null, '');
  return out;
}
export const maxBelts = (socketId: string) => (socketId === 'r' ? 3 : 2);
/** All placed parts at or below a socket (what goes back to the tray when it is removed). */
export function subtree(build: Build, id: string): string[] {
  return Object.keys(build).filter(k => build[k] && (k === id || k.startsWith(id + '.')));
}
export function initialState(job: Job): { build: Build; tray: TrayItem[] } {
  return { build: { r: null }, tray: job.tray.map((kind, i) => ({ uid: `t${job.n}-${i}-${kind}`, kind })) };
}
export function defaultPlaced(_job: Job, kind: PartKind, uid: string): Placed {
  if (kind === 'Splitter') return { uid, kind, shares: [50, 50] };
  if (kind === 'Portal') return { uid, kind, wei: PORTAL_WEI };
  return { uid, kind };
}
/** What still needs doing before Test, in order. Empty = ready to test. */
export function todo(job: Job, build: Build): { socket: string; what: 'empty' | 'person' }[] {
  const out: { socket: string; what: 'empty' | 'person' }[] = [];
  for (const s of activeSockets(job, build)) {
    const p = build[s.id];
    if (!p) { out.push({ socket: s.id, what: 'empty' }); continue; }
    if ((p.kind === 'Payout' || p.kind === 'Worker') && !p.person) out.push({ socket: s.id, what: 'person' });
  }
  return out;
}
export function partsUsed(job: Job, build: Build): number { return activeSockets(job, build).filter(s => build[s.id]).length; }

/** Where the money of one sale ends up, socket by socket, with the engine's integer split (remainder to belt 0). */
export interface SinkFlow { path: string[]; amount: bigint; kind: PartKind; person?: PersonId; gate?: string; port?: 'p' | 'f' }
export function sinkFlows(build: Build, price = BigInt(PRICE)): SinkFlow[] {
  const out: SinkFlow[] = [];
  const walk = (id: string, amt: bigint, path: string[], gate?: string, port?: 'p' | 'f') => {
    const p = build[id]; if (!p) return; const np = [...path, id];
    if (p.kind === 'Splitter') {
      const sh = p.shares ?? []; const parts = sh.map(s => (amt / 10000n) * BigInt(s * 100) + ((amt % 10000n) * BigInt(s * 100)) / 10000n);
      parts[0] += amt - parts.reduce((a, b) => a + b, 0n);
      sh.forEach((_, i) => walk(`${id}.${i}`, parts[i], np, gate, port));
    } else if (p.kind === 'Gate') { walk(`${id}.p`, amt, np, id, 'p'); walk(`${id}.f`, amt, np, id, 'f'); }
    else if (p.kind !== 'Worker') out.push({ path: np, amount: amt, kind: p.kind, person: p.person, gate, port });
  };
  walk('r', price, []);
  return out;
}

// ---------------------------------------------------------------- compile
export interface Ctx { holder?: string; accounts?: Partial<Record<PersonId, string>>; evm?: Partial<Record<PersonId, string>>; rate?: string; friends?: PersonId[] }
export interface Compiled { doc: MachineDoc; roleHolder?: PersonId; error?: string; recipient?: string; portalPerson?: PersonId }
export const WORKER_ROLE = 'checker';
export const nodeId = (socket: string) => 'n_' + socket.replace(/\./g, '_');
const EMPTY: MachineDoc = { machine: { portal_cap_wei: '0', nodes: {} }, workers: {} };

export function accountOf(p: PersonId, ctx: Ctx = {}): string | undefined {
  if (p === 'customer') return '$payer';
  return ctx.accounts?.[p] ?? PEOPLE[p].account ?? (p === 'you' ? 'you.testnet' : undefined);
}
export function evmOf(p: PersonId, ctx: Ctx = {}): string | undefined { return ctx.evm?.[p] ?? PEOPLE[p].evm; }
/** Who the Portal pays in this job: the person abroad, or the first friend with an Ethereum address. */
export function portalPerson(job: Job, ctx: Ctx = {}): PersonId | undefined {
  if (job.abroad) return job.abroad;
  return (ctx.friends ?? []).find(f => !!ctx.evm?.[f]);
}

/** Turn the socket tree into an engine machine (engine/MACHINE_FORMAT.md). */
export function compile(job: Job, build: Build, ctx: Ctx = {}): Compiled {
  const nodes: Record<string, Part> = {};
  const gates: string[] = []; let holder: PersonId | undefined; let wei = 0n; let error = ''; let vaults = 0;
  const emit = (id: string): void => {
    const p = build[id]; const nid = nodeId(id);
    if (!p) { error ||= 'Fill every glowing spot first.'; return; }
    if (p.kind === 'Splitter') {
      const sh = p.shares ?? []; const tot = sh.reduce((a, b) => a + b, 0);
      if (sh.some(x => x <= 0)) error ||= 'Every belt needs more than 0%.';
      if (tot !== 100) error ||= `A Splitter's belts add up to ${tot}%. They must add up to 100%.`;
      nodes[nid] = { type: 'Splitter', outputs: sh.map((s, i) => ({ bps: s * 100, target: nodeId(`${id}.${i}`) })) };
      sh.forEach((_, i) => emit(`${id}.${i}`));
    } else if (p.kind === 'Gate') {
      nodes[nid] = { type: 'Gate', condition: { type: 'NeedsApproval', worker: WORKER_ROLE }, pass: nodeId(`${id}.p`), fail: nodeId(`${id}.f`) };
      gates.push(nid); holder = build[`${id}.k`]?.person;
      emit(`${id}.p`); emit(`${id}.f`);
    } else if (p.kind === 'Payout') {
      const person = p.person; if (!person) { error ||= 'Choose who each Payout pays.'; return; }
      const acct = accountOf(person, ctx);
      if (!acct) { error ||= `${PEOPLE[person].name} has no NEAR account. Use the Portal for them.`; return; }
      nodes[nid] = { type: 'Payout', account: acct };
    } else if (p.kind === 'Portal') {
      const w = p.wei ?? PORTAL_WEI; wei += BigInt(w);
      nodes[nid] = { type: 'Portal', chain: 'sepolia', wei: w };
    } else if (p.kind === 'Vault') {
      nodes[nid] = { type: 'Vault', name: `jar ${++vaults}` };
    } else error ||= 'A Key goes on the Key hook next to a Gate.';
  };
  emit('r');
  if (error) return { doc: EMPTY, error };
  const doc: MachineDoc = { machine: { portal_cap_wei: wei.toString(), nodes: { slot: { type: 'CoinSlot', price: PRICE, output: nodeId('r') }, ...nodes } } as Machine, workers: {} };
  if (gates.length) { (doc.machine as Machine).nodes[WORKER_ROLE] = { type: 'Worker', gates }; doc.workers[WORKER_ROLE] = ctx.holder ?? 'you.testnet'; }
  const pp = portalPerson(job, ctx);
  return { doc, roleHolder: holder, recipient: wei > 0n && pp ? evmOf(pp, ctx) : undefined, portalPerson: wei > 0n ? pp : undefined };
}

// ---------------------------------------------------------------- test (simulated)
export type Received = Partial<Record<PersonId, { near: bigint; wei: bigint }>> & { vault?: bigint };
export interface SaleSim { n: number; delivered: boolean; held: bigint; effects: OrderResult['effects']; paidEffects: OrderResult['effects'] }
export interface RowResult { id: string; ok: boolean; text: string; amount: string }
export interface TestResult { ok: boolean; why: string; rows: RowResult[]; sales: SaleSim[]; totals?: Totals; score?: Score; engineError?: string }
export type Engine = { validate(doc: MachineDoc): { ok: true } | { ok: false; errors: string[] }; preview(doc: MachineDoc, recipient?: string): OrderResult };

export function ownerOf(acct: string, ctx: Ctx = {}): PersonId | null {
  if (acct === '$payer' || acct === 'buyer.testnet') return 'customer';
  for (const [p, a] of Object.entries(ctx.accounts ?? {})) if (a === acct) return p as PersonId;
  for (const p of Object.values(PEOPLE)) if (p.account === acct) return p.id;
  if (acct === 'you.testnet') return 'you';
  return null;
}
function tally(effects: OrderResult['effects'], ctx: Ctx, evmPerson: PersonId | undefined) {
  const near: Partial<Record<PersonId, bigint>> = {}, wei: Partial<Record<PersonId, bigint>> = {};
  let vault = 0n, fee = 0n, w = 0n, lost = 0n;
  for (const e of effects) {
    if (e.kind === 'payout') { const who = ownerOf(e.account, ctx); if (who) near[who] = (near[who] ?? 0n) + BigInt(e.amount); else lost += BigInt(e.amount); }
    else if (e.kind === 'vault') vault += BigInt(e.amount);
    else { fee += BigInt(e.fee); w += BigInt(e.wei); if (evmPerson) wei[evmPerson] = (wei[evmPerson] ?? 0n) + BigInt(e.wei); }
  }
  return { near, wei, vault, fee, w, lost };
}
/** Variant of the machine where every approval Gate resolves one way (simulates the Key or the time-out). */
export function resolveGates(doc: MachineDoc, pass: boolean): MachineDoc {
  const m = structuredClone(doc.machine) as Machine;
  for (const [id, p] of Object.entries(m.nodes)) {
    if (p.type === 'Gate' && p.condition.type === 'NeedsApproval') {
      m.nodes[id] = { ...p, condition: { type: 'MinAmount', amount: pass ? '0' : PRICE + '0' } };
      delete m.nodes[p.condition.worker];
    }
  }
  return { machine: m, workers: {} };
}

/** Three simulated customers through the wasm engine, then each requirement checked. Customer 3's bread never arrives when a Gate waits. */
export function runTest(job: Job, build: Build, engine: Engine, ctx: Ctx = {}): TestResult {
  const c = compile(job, build, ctx);
  const fail = (why: string, engineError?: string): TestResult => ({ ok: false, why, rows: job.requirements.map(r => ({ id: r.id, ok: false, text: r.text, amount: '' })), sales: [], engineError });
  if (c.error) return fail(c.error);
  const v = engine.validate(c.doc);
  if (!v.ok) return fail('The engine rejected this machine. Check every spot.', v.errors.join('; '));
  const rec = c.recipient ?? CHI_EVM;
  const evmP = c.portalPerson;
  const sales: SaleSim[] = [];
  const gated = Object.values((c.doc.machine as Machine).nodes).some(p => p.type === 'Gate');
  let first: ReturnType<typeof tally> | null = null, all: ReturnType<typeof tally> | null = null, undelivered: ReturnType<typeof tally> | null = null;
  for (let n = 1; n <= 3; n++) {
    const delivered = !(gated && n === 3);
    let r: OrderResult;
    try { r = engine.preview(c.doc, rec); } catch (e) { return fail('The engine rejected this machine. Check every spot.', String(e)); }
    if (r.trace.some(t => t.startsWith('error'))) return fail('The engine rejected this machine. Check every spot.', r.trace.join(' '));
    let effects = r.effects, held = 0n;
    if (r.pending) {
      held = BigInt(PRICE) - r.effects.reduce((a, e) => a + BigInt(e.kind === 'external' ? e.fee : e.amount), 0n);
      effects = engine.preview(resolveGates(c.doc, delivered), rec).effects;
    }
    if (n === 1) { first = tally(r.effects, ctx, evmP); all = tally(effects, ctx, evmP); }
    if (!delivered) undelivered = tally(effects, ctx, evmP);
    sales.push({ n, delivered, held, effects, paidEffects: r.effects });
  }
  const rate = BigInt(ctx.rate ?? DEFAULT_RATE);
  const portalNodes = Object.values((c.doc.machine as Machine).nodes).filter((p): p is Extract<Part, { type: 'Portal' }> => p.type === 'Portal');
  const portals = portalNodes.length;
  const t: Totals = {
    price: BigInt(PRICE), near: all!.near, before: first!.near, wei: all!.wei, vault: all!.vault, lost: all!.lost,
    portalFee: all!.fee, portalWei: all!.w || BigInt(portalNodes[0]?.wei ?? '0'),
    minFee: 0n, rate, portals, gated, keyHolder: c.roleHolder,
    undelivered: undelivered ? { near: undelivered.near, vault: undelivered.vault } : undefined,
    parts: partsUsed(job, build), friends: ctx.friends ?? [],
  };
  t.minFee = t.portalWei * rate;
  const rows: RowResult[] = []; let why = '';
  for (const r of job.requirements) {
    if (r.id === 'friends' && !t.friends.length && !t.portals) continue;
    const o = r.check(t);
    rows.push({ id: r.id, ok: o.ok, text: r.text, amount: o.amount });
    if (!o.ok && !why) why = o.why;
  }
  const ok = rows.every(r => r.ok);
  return { ok, why: ok ? '' : why, rows, sales, totals: t, score: ok ? job.score(t) : undefined };
}

// ---------------------------------------------------------------- ids and the standalone shop
/** Ids accepted by the contract: [a-z0-9_-], ≤32. Unique per session account and per machine content. */
export function jobMachineId(job: Job, doc: MachineDoc, account: string): string {
  let h = 0x811c9dc5; const s = JSON.stringify(doc);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  const acct = account.split('.')[0].replace(/[^a-z0-9]/g, '').slice(-10) || 'guest';
  return `${job.slug.slice(0, 8)}-${(h >>> 0).toString(16).padStart(8, '0')}-${acct}`;
}
export interface ShopEntry { key: string; name: string; face: PersonId; pct: number; how: 'near' | 'eth' | 'after' | 'refund'; account?: string }
/** Who a published machine pays and what share of each sale, walking chained Splitters and Gates. */
export function shopPeople(machine: Machine, owner?: string): ShopEntry[] {
  const out = new Map<string, ShopEntry>();
  const src = Object.values(machine.nodes).find(p => p.type === 'CoinSlot');
  const walk = (id: string, frac: number, after: boolean) => {
    const node = machine.nodes[id]; if (!node) return;
    if (node.type === 'Splitter') { for (const o of node.outputs) walk(o.target, (frac * o.bps) / 10000, after); return; }
    if (node.type === 'Gate') { walk(node.pass, frac, true); return; }
    let e: ShopEntry | null = null;
    if (node.type === 'Payout') {
      if (node.account === '$payer') return;
      const who = ownerOf(node.account);
      const name = who && who !== 'you' ? PEOPLE[who].name : node.account === owner ? 'Shop owner' : shortAcct(node.account);
      e = { key: node.account, name, face: who && who !== 'you' ? who : node.account === owner ? 'you' : 'f1', pct: 0, how: after ? 'after' : 'near', account: node.account };
    } else if (node.type === 'Portal') e = { key: 'portal', name: 'Ethereum wallet', face: 'chi', pct: 0, how: 'eth' };
    if (!e) return;
    const prev = out.get(e.key); if (prev) prev.pct += frac * 100; else out.set(e.key, { ...e, pct: frac * 100 });
  };
  if (src && src.type === 'CoinSlot') walk(src.output, 1, false);
  return [...out.values()].map(e => ({ ...e, pct: Math.round(e.pct * 100) / 100 }));
}
const shortAcct = (a: string) => (a.length > 22 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
export const isJobMachine = (id: string) => /^(bakery|abroad|delivery|bake3|half3|abroad3|rider3|shop)-/.test(id);
export const jobForMachineId = (id: string) => JOBS.find(j => id.startsWith(j.slug.slice(0, 8) + '-'));
