// Machine model helpers for the UI. The machine object is exactly engine/MACHINE_FORMAT.md;
// positions are UI-only and never published.
import type { MachineDoc, OrderResult } from '../api/types';
import { getLimits } from './limits';
import { near, eth, pct, shortAddr } from './units';

export type PartType = 'CoinSlot' | 'Splitter' | 'Vault' | 'Gate' | 'Worker' | 'Payout' | 'Portal';
export type Condition = { type: 'MinAmount'; amount: string } | { type: 'NeedsApproval'; worker: string };
export type Part =
  | { type: 'CoinSlot'; price: string; output: string }
  | { type: 'Splitter'; outputs: { bps: number; target: string }[] }
  | { type: 'Vault'; name: string }
  | { type: 'Gate'; condition: Condition; pass: string; fail: string }
  | { type: 'Worker'; gates: string[] }
  | { type: 'Payout'; account: string }
  | { type: 'Portal'; chain: 'sepolia'; wei: string };
export type Machine = { portal_cap_wei: string; nodes: Record<string, Part> };
export type Pos = { x: number; y: number };
export type Positions = Record<string, Pos>;

export const PART_TYPES: PartType[] = ['CoinSlot', 'Splitter', 'Vault', 'Gate', 'Worker', 'Payout', 'Portal'];
export const PART_LABEL: Record<PartType, string> = {
  CoinSlot: 'Coin Slot', Splitter: 'Splitter', Vault: 'Vault', Gate: 'Gate', Worker: 'Worker', Payout: 'Payout', Portal: 'Portal',
};
export const PART_BLURB: Record<PartType, string> = {
  CoinSlot: 'takes the money.', Splitter: 'some here, some there.', Vault: 'keeps a reserve.',
  Gate: 'only if the rule holds.', Worker: 'holds one key. does one job.', Payout: 'pays a name.', Portal: 'pays on another chain.',
};
/** Parts that have an input and an output, so they can be dropped onto an existing pipe. */
export const INSERTABLE: PartType[] = ['Splitter', 'Gate'];
export const RECEIVES_MONEY = (t: PartType) => t !== 'CoinSlot' && t !== 'Worker';

export const ONE_NEAR = '1000000000000000000000000';
/** Template price: small, so a sponsored session (about 1 testnet NEAR) lasts several orders. */
export const TEMPLATE_PRICE = '100000000000000000000000'; // 0.1 NEAR
export const DEMO_WEI = '1000000000000000'; // 0.001 Sepolia ETH
export function templateWei(): string {
  const l = getLimits();
  if (!import.meta.env.VITE_CONTRACT_ID || !l) return DEMO_WEI;
  // Vending sends the smallest template share (7%) to its Portal.
  const affordable = BigInt(TEMPLATE_PRICE) * 7n / 100n / BigInt(l.rate);
  return [BigInt(DEMO_WEI), affordable, BigInt(l.maxWeiPerPayout ?? DEMO_WEI)].reduce((a,b) => a < b ? a : b).toString();
}
export const PREVIEW_RECIPIENT = '0x0000000000000000000000000000000000000000';

export type OutPort = { port: string; target: string; label?: string };
export function outPorts(p: Part): OutPort[] {
  switch (p.type) {
    case 'CoinSlot': return [{ port: 'out', target: p.output }];
    case 'Splitter': return p.outputs.map((o, i) => ({ port: `o${i}`, target: o.target, label: pct(o.bps) }));
    case 'Gate': return [{ port: 'pass', target: p.pass, label: p.condition.type === 'NeedsApproval' ? 'approved' : 'pass' }, { port: 'fail', target: p.fail, label: p.condition.type === 'NeedsApproval' ? 'refused' : 'fail' }];
    default: return [];
  }
}

export function setTarget(m: Machine, id: string, port: string, target: string): Machine {
  const p = m.nodes[id];
  if (!p) return m;
  let np: Part = p;
  if (p.type === 'CoinSlot' && port === 'out') np = { ...p, output: target };
  else if (p.type === 'Splitter' && port.startsWith('o')) {
    const i = Number(port.slice(1));
    np = { ...p, outputs: p.outputs.map((o, j) => (j === i ? { ...o, target } : o)) };
  } else if (p.type === 'Gate' && (port === 'pass' || port === 'fail')) np = { ...p, [port]: target } as Part;
  return withCap({ ...m, nodes: { ...m.nodes, [id]: np } });
}

export function nextId(m: Machine, type: PartType): string {
  const base: Record<PartType, string> = { CoinSlot: 'slot', Splitter: 'split', Vault: 'vault', Gate: 'gate', Worker: 'inspector', Payout: 'payout', Portal: 'portal' };
  const b = base[type];
  if (!m.nodes[b]) return b;
  for (let i = 2; ; i++) if (!m.nodes[`${b}${i}`]) return `${b}${i}`;
}

export function uniqueVaultName(m: Machine, want = 'reserve'): string {
  const names = new Set(Object.values(m.nodes).flatMap(p => (p.type === 'Vault' ? [p.name] : [])));
  if (!names.has(want)) return want;
  for (let i = 2; ; i++) if (!names.has(`${want} ${i}`)) return `${want} ${i}`;
}

export function defaultPart(m: Machine, type: PartType, session?: string): Part {
  switch (type) {
    case 'CoinSlot': return { type, price: TEMPLATE_PRICE, output: '' };
    case 'Splitter': return { type, outputs: [{ bps: 5000, target: '' }, { bps: 5000, target: '' }] };
    case 'Vault': return { type, name: uniqueVaultName(m) };
    case 'Gate': return { type, condition: { type: 'MinAmount', amount: '0' }, pass: '', fail: '' };
    case 'Worker': return { type, gates: [] };
    case 'Payout': return { type, account: session || 'you.testnet' };
    case 'Portal': return { type, chain: 'sepolia', wei: templateWei() };
  }
}

/** Remove a part and every reference to it. */
export function removeNode(m: Machine, id: string): Machine {
  const nodes: Record<string, Part> = {};
  for (const [k, p] of Object.entries(m.nodes)) {
    if (k === id) continue;
    let np = p;
    if (p.type === 'CoinSlot' && p.output === id) np = { ...p, output: '' };
    if (p.type === 'Splitter') np = { ...p, outputs: p.outputs.map(o => (o.target === id ? { ...o, target: '' } : o)) };
    if (p.type === 'Gate') {
      np = { ...p, pass: p.pass === id ? '' : p.pass, fail: p.fail === id ? '' : p.fail };
      if (p.condition.type === 'NeedsApproval' && p.condition.worker === id) np = { ...(np as typeof p), condition: { type: 'MinAmount', amount: '0' } };
    }
    if (p.type === 'Worker') np = { ...p, gates: p.gates.filter(g => g !== id) };
    nodes[k] = np;
  }
  return withCap({ ...m, nodes });
}

/** Bind a Worker to a Gate (the Gate now needs that Worker's approval). Keeps Worker scopes exact. */
export function bindWorker(m: Machine, worker: string, gate: string): Machine {
  const g = m.nodes[gate];
  if (!g || g.type !== 'Gate' || m.nodes[worker]?.type !== 'Worker') return m;
  const nodes: Record<string, Part> = { ...m.nodes, [gate]: { ...g, condition: { type: 'NeedsApproval', worker } } };
  for (const [k, p] of Object.entries(nodes)) {
    if (p.type !== 'Worker') continue;
    const gates = p.gates.filter(x => x !== gate);
    if (k === worker) gates.push(gate);
    nodes[k] = { ...p, gates };
  }
  return withCap({ ...m, nodes });
}

export function setGateCondition(m: Machine, gate: string, c: Condition): Machine {
  const g = m.nodes[gate];
  if (!g || g.type !== 'Gate') return m;
  if (c.type === 'NeedsApproval') return bindWorker(m, c.worker, gate);
  const nodes: Record<string, Part> = { ...m.nodes, [gate]: { ...g, condition: c } };
  for (const [k, p] of Object.entries(nodes)) if (p.type === 'Worker' && p.gates.includes(gate)) nodes[k] = { ...p, gates: p.gates.filter(x => x !== gate) };
  return withCap({ ...m, nodes });
}

export function updatePart(m: Machine, id: string, p: Part): Machine {
  return withCap({ ...m, nodes: { ...m.nodes, [id]: p } });
}

// ---------- graph analysis ----------
export function source(m: Machine): string | undefined {
  return Object.keys(m.nodes).find(k => m.nodes[k].type === 'CoinSlot');
}
export function price(m: Machine): string {
  const s = source(m);
  const p = s ? m.nodes[s] : undefined;
  return p && p.type === 'CoinSlot' ? p.price : '0';
}
export const hasPortal = (m: Machine) => Object.values(m.nodes).some(p => p.type === 'Portal');

/** Source-to-node path counts (both Gate ports and every Splitter port count), mirroring the engine's conservative cap. */
export function pathCounts(m: Machine): Record<string, number> | null {
  const indeg: Record<string, number> = {};
  for (const k of Object.keys(m.nodes)) indeg[k] = 0;
  for (const p of Object.values(m.nodes)) for (const o of outPorts(p)) if (o.target && m.nodes[o.target]) indeg[o.target]++;
  const q = Object.keys(indeg).filter(k => indeg[k] === 0);
  const counts: Record<string, number> = {};
  const s = source(m);
  for (const k of Object.keys(m.nodes)) counts[k] = k === s ? 1 : 0;
  let seen = 0;
  while (q.length) {
    const k = q.shift()!;
    seen++;
    for (const o of outPorts(m.nodes[k])) {
      if (!o.target || !m.nodes[o.target]) continue;
      counts[o.target] += counts[k];
      if (--indeg[o.target] === 0) q.push(o.target);
    }
  }
  return seen === Object.keys(m.nodes).length ? counts : null;
}

/** portal_cap_wei is derived: the smallest cap the engine accepts for this wiring. */
export function withCap(m: Machine): Machine {
  const counts = pathCounts(m);
  let cap = 0n;
  for (const [k, p] of Object.entries(m.nodes)) {
    if (p.type !== 'Portal') continue;
    cap += BigInt(p.wei) * BigInt(Math.max(1, counts?.[k] ?? 1));
  }
  return { ...m, portal_cap_wei: cap.toString() };
}

export function toDoc(m: Machine, workers: Record<string, string>): MachineDoc {
  const w: Record<string, string> = {};
  for (const [k, p] of Object.entries(m.nodes)) if (p.type === 'Worker') w[k] = workers[k] || '';
  return { machine: m, workers: w };
}

// ---------- display ----------
export function title(m: Machine, id: string, session?: string): string {
  const p = m.nodes[id];
  if (!p) return id;
  if (p.type === 'Vault') return `${p.name} vault`;
  if (p.type === 'Worker') return id;
  if (p.type === 'Payout') return p.account === '$payer' ? 'Refund' : 'Payout';
  const same = Object.keys(m.nodes).filter(k => m.nodes[k].type === p.type);
  return same.length > 1 ? `${PART_LABEL[p.type]} ${same.indexOf(id) + 1}` : PART_LABEL[p.type];
}

export function who(account: string, session?: string): string {
  if (account === '$payer') return 'the buyer';
  if (session && account === session) return 'you';
  return shortAddr(account);
}

/** One short rule chip per part, like Stripe's "$10 Charge" labels. */
export function ruleChip(m: Machine, id: string, session?: string): string {
  const p = m.nodes[id];
  if (!p) return '';
  switch (p.type) {
    case 'CoinSlot': return `${near(p.price)} NEAR / buy`;
    case 'Splitter': {
      const parts = p.outputs.map(o => `${pct(o.bps)} → ${o.target ? shortName(m, o.target) : '?'}`);
      return parts.join(' · ');
    }
    case 'Vault': return 'keeps a reserve';
    case 'Gate': return p.condition.type === 'MinAmount'
      ? (p.condition.amount === '0' ? 'always passes' : `at least ${near(p.condition.amount)} NEAR`)
      : `needs ${p.condition.worker}`;
    case 'Worker': return p.gates.length ? `can: approve` : 'no gate yet';
    case 'Payout': return p.account === '$payer' ? 'back to the buyer' : `to ${who(p.account, session)}`;
    case 'Portal': return `→ Sepolia · ${eth(p.wei)} ETH`;
  }
}

function shortName(m: Machine, id: string): string {
  const p = m.nodes[id];
  if (!p) return '?';
  if (p.type === 'Vault') return p.name;
  if (p.type === 'Payout') return p.account === '$payer' ? 'buyer' : 'payout';
  return PART_LABEL[p.type];
}

// ---------- friendly validation ----------
type RawError = string | Record<string, string | number>;
export type Friendly = { node?: string; text: string };
export function friendlyErrors(m: Machine, errors: RawError[]): Friendly[] {
  const out: Friendly[] = [];
  const name = (id: string) => (m.nodes[id] ? title(m, id) : 'a part');
  for (const e of errors) {
    if (typeof e === 'string') {
      out.push({ text: e === 'TooManyNodes' ? 'That is a lot of parts. A machine holds up to 32.' : e === 'TooManyFlows' ? 'Too many ways for a coin to travel. Simplify a branch or two.' : 'Something in this machine is not quite right.' });
      continue;
    }
    const [k, v] = Object.entries(e)[0] ?? ['', ''];
    const id = String(v);
    const map: Record<string, Friendly> = {
      ZeroPrice: { node: id, text: 'The Coin Slot needs a price above zero.' },
      IdenticalApprovalTargets: { node: id, text: `${name(id)} needs two different exits: one if approved, one if refused.` },
      InvalidAccount: { node: id, text: `${name(id)}: that does not look like a NEAR account (like alice.testnet).` },
      InvalidVaultName: { node: id, text: 'Give the Vault a name (up to 32 characters).' },
      Cycle: { node: id, text: `Money would go round in a loop at ${name(id)}. Pipes must flow one way.` },
      CoinSlotCount: { text: Number(v) === 0 ? 'Every machine needs one Coin Slot to take the money.' : 'Only one Coin Slot per machine. Remove the extra one.' },
      UnconnectedOutput: { node: id, text: `${name(id)} has a pipe going nowhere. Connect it to a part.` },
      UnreachableNode: { node: id, text: `No money can reach ${name(id)} yet. Pipe something into it.` },
      InvalidSplitter: { node: id, text: `${name(id)}: the shares must add up to 100%, each above 0.` },
      PortalAboveCap: { node: m.nodes[id] ? id : undefined, text: 'The Portal would pay more than this machine allows per order.' },
      MissingWorker: { node: id, text: `${name(id)} waits for a Worker who is not on the board.` },
      MissingNode: { text: 'A pipe points at a part that is gone.' },
      InvalidWorkerScope: { node: id, text: `${name(id)}: its Worker must hold the key to it.` },
      InvalidFlowTarget: { node: id, text: `Money cannot flow into ${name(id)}.` },
      UnsupportedChain: { node: id, text: 'Portals only go to Sepolia for now.' },
    };
    out.push(map[k] ?? { text: 'Some settings are not valid. Check the numbers.' });
  }
  // de-duplicate
  return out.filter((f, i) => out.findIndex(g => g.text === f.text) === i);
}

// ---------- flow simulation (UI animation only; numbers shown come from the API) ----------
export type FlowStep = { edge: string; from: string; to: string; amount: bigint };
export type FlowSim = { steps: FlowStep[]; sinks: { node: string; amount: bigint }[]; held: { gate: string; amount: bigint }[] };
export const edgeId = (src: string, port: string) => `e|${src}|${port}`;

export function simulate(m: Machine, startNode: string, amount: bigint): FlowSim {
  const sim: FlowSim = { steps: [], sinks: [], held: [] };
  const visit = (id: string, amt: bigint, depth: number) => {
    const p = m.nodes[id];
    if (!p || depth > 40) return;
    const go = (port: string, target: string, a: bigint) => {
      if (!target) return;
      sim.steps.push({ edge: edgeId(id, port), from: id, to: target, amount: a });
      visit(target, a, depth + 1);
    };
    switch (p.type) {
      case 'CoinSlot': go('out', p.output, amt); break;
      case 'Splitter': {
        const shares = p.outputs.map(o => (amt * BigInt(o.bps)) / 10000n);
        const rest = amt - shares.reduce((a, b) => a + b, 0n);
        shares[0] += rest;
        p.outputs.forEach((o, i) => go(`o${i}`, o.target, shares[i]));
        break;
      }
      case 'Gate':
        if (p.condition.type === 'NeedsApproval') sim.held.push({ gate: id, amount: amt });
        else if (amt >= BigInt(p.condition.amount)) go('pass', p.pass, amt);
        else go('fail', p.fail, amt);
        break;
      default: sim.sinks.push({ node: id, amount: amt });
    }
  };
  visit(startNode, amount, 0);
  return sim;
}

export function simulateRelease(m: Machine, gate: string, amount: bigint): FlowSim {
  const g = m.nodes[gate];
  const sim: FlowSim = { steps: [], sinks: [], held: [] };
  if (!g || g.type !== 'Gate' || !g.pass) return sim;
  const rest = simulate(m, g.pass, amount);
  sim.steps.push({ edge: edgeId(gate, 'pass'), from: gate, to: g.pass, amount }, ...rest.steps);
  sim.sinks = rest.sinks; sim.held = rest.held;
  return sim;
}

export function keptInVaults(r: Pick<OrderResult, 'effects'> | null | undefined): bigint {
  if (!r) return 0n;
  return r.effects.reduce((a, e) => (e.kind === 'vault' ? a + BigInt(e.amount) : a), 0n);
}

// ---------- plain words (for the standalone app page) ----------
export function describe(m: Machine, session?: string): string[] {
  const s = source(m);
  if (!s) return ['This machine has no Coin Slot.'];
  const total = BigInt(price(m));
  const lines: string[] = [`You pay ${near(total)} NEAR (testnet money).`];
  const amt = (a: bigint) => `${near(a)} NEAR`;
  const walk = (id: string, a: bigint, subject: string, depth: number) => {
    const p = m.nodes[id];
    if (!p || depth > 12) return;
    switch (p.type) {
      case 'Splitter': {
        const shares = p.outputs.map(o => (a * BigInt(o.bps)) / 10000n);
        shares[0] += a - shares.reduce((x, y) => x + y, 0n);
        p.outputs.forEach((o, i) => walk(o.target, shares[i], `${pct(o.bps)}${depth ? ' of that' : ''} (${amt(shares[i])})`, depth + 1));
        break;
      }
      case 'Vault': lines.push(`${subject} is kept in the “${p.name}” vault.`); break;
      case 'Payout': lines.push(p.account === '$payer' ? `${subject} goes back to you.` : `${subject} is paid to ${session && p.account === session ? 'the owner' : p.account}.`); break;
      case 'Portal': lines.push(`${subject} pays the Portal fee. The contract then asks NEAR Chain Signatures to sign a payment of ${eth(p.wei)} Sepolia ETH to your Ethereum address.`); break;
      case 'Gate':
        if (p.condition.type === 'NeedsApproval') {
          lines.push(`${subject} waits for “${p.condition.worker}” to approve.`);
          walk(p.pass, a, 'If approved, it', depth + 1);
          walk(p.fail, a, 'If not approved before it expires, it', depth + 1);
        } else if (a >= BigInt(p.condition.amount)) walk(p.pass, a, subject, depth + 1);
        else walk(p.fail, a, subject, depth + 1);
        break;
      default: break;
    }
  };
  const first = m.nodes[s];
  if (first.type === 'CoinSlot') walk(first.output, total, 'All of it', 0);
  return lines;
}

// ---------- templates ----------
export type TemplateId = 'lemonade' | 'escrow' | 'vending';
export type Template = { id: TemplateId; name: string; tagline: string; machine: Machine; positions: Positions; workers: (session: string) => Record<string, string> };

export function lemonadeBroken(): Machine {
  return withCap({ portal_cap_wei: '0', nodes: {
    slot: { type: 'CoinSlot', price: TEMPLATE_PRICE, output: 'portal' },
    portal: { type: 'Portal', chain: 'sepolia', wei: templateWei() },
  } });
}
export function lemonadeFixed(): Machine {
  return withCap({ portal_cap_wei: '0', nodes: {
    slot: { type: 'CoinSlot', price: TEMPLATE_PRICE, output: 'split' },
    split: { type: 'Splitter', outputs: [{ bps: 3000, target: 'portal' }, { bps: 7000, target: 'vault' }] },
    vault: { type: 'Vault', name: 'reserve' },
    portal: { type: 'Portal', chain: 'sepolia', wei: templateWei() },
  } });
}

export function templates(session?: string): Template[] {
  const you = session || 'you.testnet';
  return [
    {
      id: 'lemonade', name: 'Lemonade Machine', tagline: 'Sells lemonade, pays on Ethereum… and keeps nothing.',
      machine: lemonadeBroken(),
      positions: { slot: { x: 0, y: 0 }, portal: { x: 600, y: 0 } },
      workers: () => ({}),
    },
    {
      id: 'escrow', name: 'Escrow with an Inspector', tagline: 'Money waits until the inspector says yes.',
      machine: withCap({ portal_cap_wei: '0', nodes: {
        slot: { type: 'CoinSlot', price: TEMPLATE_PRICE, output: 'review' },
        review: { type: 'Gate', condition: { type: 'NeedsApproval', worker: 'inspector' }, pass: 'seller', fail: 'refund' },
        inspector: { type: 'Worker', gates: ['review'] },
        seller: { type: 'Payout', account: you },
        refund: { type: 'Payout', account: '$payer' },
      } }),
      positions: { slot: { x: 0, y: 40 }, review: { x: 300, y: 40 }, inspector: { x: 300, y: -230 }, seller: { x: 600, y: -100 }, refund: { x: 600, y: 190 } },
      workers: s => ({ inspector: s }),
    },
    {
      id: 'vending', name: 'Cross-chain Vending', tagline: 'Keeps a reserve, pays its maker, and delivers on Ethereum.',
      machine: withCap({ portal_cap_wei: '0', nodes: {
        slot: { type: 'CoinSlot', price: TEMPLATE_PRICE, output: 'fees' },
        fees: { type: 'Splitter', outputs: [{ bps: 7000, target: 'reserve_fee' }, { bps: 3000, target: 'creator' }] },
        reserve_fee: { type: 'Splitter', outputs: [{ bps: 9000, target: 'reserve' }, { bps: 1000, target: 'delivery' }] },
        reserve: { type: 'Vault', name: 'reserve' },
        creator: { type: 'Payout', account: you },
        portal: { type: 'Portal', chain: 'sepolia', wei: templateWei() },
        delivery: { type: 'Gate', condition: { type: 'MinAmount', amount: '0' }, pass: 'portal', fail: 'portal' },
      } }),
      positions: { slot: { x: 0, y: 60 }, fees: { x: 250, y: 60 }, reserve_fee: { x: 500, y: -110 }, creator: { x: 500, y: 250 }, reserve: { x: 760, y: -250 }, delivery: { x: 760, y: 20 }, portal: { x: 1010, y: 20 } },
      workers: () => ({}),
    },
  ];
}
