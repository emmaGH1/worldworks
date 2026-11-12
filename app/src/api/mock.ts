// MOCK implementation of WorldworksApi. NOTHING HERE TOUCHES A CHAIN.
// Hashes, accounts and addresses below are fabricated for UI development and are shown in the UI
// with a "MOCK DATA" badge and without explorer links. Timings imitate measured testnet behaviour:
// NEAR tx ~1.5 s, Chain Signatures signature ~14.5 s, Sepolia confirmation ~12 s.
// validate/preview are real: they run the same Rust engine compiled to wasm.
import { validate as wasmValidate, preview_order as wasmPreview } from '../engine/pkg/worldworks_engine_wasm.js';
import type { MachineDoc, OrderResult, PayoutView, Session, TxRef, WorldworksApi } from './types';
import { lemonadeFixed, templates, simulateRelease, type Machine, type Part } from '../lib/machine';
import type { Limits } from '../lib/limits';

const NEAR_TX_MS = 1500;
const SIGNATURE_MS = 14500;
const SEPOLIA_MS = 12000;
const MOCK_PORTAL = '0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7'; // the real deployed treasury address (public); mock never moves its funds
const MOCK_CUSTOMER = 'seeded-customer.testnet';
const MOCK_CUSTOMER_EVM = '0x5eeD00000000000000000000000000000000c0DE';
// Plausible contract limits (G4b sizes the order fee at ~2x the measured worst-case order footprint).
const MOCK_LIMITS: Limits = {
  orderFee: '50000000000000000000000',        // 0.05 NEAR per order, retained by the contract for storage
  publishDeposit: '100000000000000000000000', // 0.1 NEAR attached to publish for machine storage
  rate: '1000000',                            // min Portal fee: 1e6 yocto per wei (0.001 NEAR per 0.001 ETH)
  epochBudgetWei: '10000000000000000',        // 0.01 Sepolia ETH per epoch
  epochRemainingWei: '10000000000000000',
};
const SPONSORED = '1000000000000000000000000'; // 1 NEAR: ~5 orders of a 0.1 NEAR machine + one publish

type Stored = {
  account?: string;
  balance?: string;
  budgetSpent?: string;
  budgetEpoch?: number;
  machines: Record<string, { doc: MachineDoc; owner: string; vaults: Record<string, string> }>;
  held: Record<string, { machineId: string; gate: string; amount: string; payer: string; recipient?: string }>;
  payouts: Record<string, { view: PayoutView; createdAt: number; relayedAt?: number }>;
  nonce: number;
};

const KEY = 'ww-mock-v2';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const rand = (alphabet: string, n: number) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
const nearTx = (): TxRef => { const hash = rand(B58, 44); return { hash, explorerUrl: `https://testnet.nearblocks.io/txns/${hash}` }; };
const evmTx = (): TxRef => { const hash = '0x' + rand('0123456789abcdef', 64); return { hash, explorerUrl: `https://sepolia.etherscan.io/tx/${hash}` }; };

function load(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch { /* storage unavailable: start fresh */ }
  return { machines: {}, held: {}, payouts: {}, nonce: 0 };
}
let db = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } }

function seed() {
  if (!db.machines.lemonade) db.machines.lemonade = { doc: { machine: lemonadeFixed(), workers: {} }, owner: 'worldworks-demo.testnet', vaults: {} };
  const vending = templates('worldworks-demo.testnet').find(t => t.id === 'vending')!;
  if (!db.machines['cross-chain-vending']) db.machines['cross-chain-vending'] = { doc: { machine: vending.machine, workers: {} }, owner: 'worldworks-demo.testnet', vaults: {} };
}
seed();

type RawEffect = { VaultCredit?: { name: string; amount: string }; Payout?: { account: string; amount: string }; ExternalPayout?: { recipient: string; wei: string; fee: string } };

function runEngine(doc: MachineDoc, recipient?: string): { ok: true; pending: boolean; effects: RawEffect[]; trace: string[] } | { ok: false; errors: unknown[] } {
  const m = doc.machine as Machine;
  const slot = Object.values(m.nodes ?? {}).find(p => p.type === 'CoinSlot') as Extract<Part, { type: 'CoinSlot' }> | undefined;
  if (!slot) return { ok: false, errors: [{ CoinSlotCount: 0 }] };
  const out = JSON.parse(wasmPreview(JSON.stringify(m), slot.price, recipient ?? null));
  if (out.ok === false) return out;
  return { ok: true, pending: !!out.pending, effects: out.effects ?? [], trace: out.trace ?? [] };
}

function mapEffects(raw: RawEffect[], payer: string, mkPayout: (r: string, wei: string, fee: string) => string): OrderResult['effects'] {
  return raw.map(e => {
    if (e.VaultCredit) return { kind: 'vault' as const, name: e.VaultCredit.name, amount: e.VaultCredit.amount };
    if (e.Payout) return { kind: 'payout' as const, account: e.Payout.account === 'buyer.testnet' ? payer : e.Payout.account, amount: e.Payout.amount };
    const x = e.ExternalPayout!;
    return { kind: 'external' as const, payoutId: mkPayout(x.recipient, x.wei, x.fee), recipient: x.recipient, wei: x.wei, fee: x.fee };
  });
}

function heldGate(m: Machine, trace: string[]): string | undefined {
  const gates = Object.entries(m.nodes).filter(([, p]) => p.type === 'Gate' && p.condition.type === 'NeedsApproval').map(([k]) => k);
  return gates.find(g => trace.some(t => t.includes(g))) ?? gates[0];
}

async function placeOrder(machineId: string, payer: string, recipient?: string, fromSession = false): Promise<OrderResult> {
  await sleep(NEAR_TX_MS);
  const rec = db.machines[machineId];
  if (!rec) throw new Error(`No machine called “${machineId}”.`);
  const res = runEngine(rec.doc, recipient);
  if (!res.ok) throw new Error('The engine rejected this order: ' + JSON.stringify(res.errors));
  // the same admission rules the contract applies before routing anything (mock epoch: 10 minutes)
  const epoch = Math.floor(Date.now() / 600000);
  if (db.budgetEpoch !== epoch) { db.budgetEpoch = epoch; db.budgetSpent = '0'; }
  for (const e of res.effects) {
    if (!e.ExternalPayout) continue;
    const min = BigInt(e.ExternalPayout.wei) * BigInt(MOCK_LIMITS.rate);
    if (BigInt(e.ExternalPayout.fee) < min) throw new Error('Portal fee is below the minimum for this payout.');
    const spent = BigInt(db.budgetSpent ?? '0') + BigInt(e.ExternalPayout.wei);
    if (spent > BigInt(MOCK_LIMITS.epochBudgetWei)) throw new Error('The Portal budget for this epoch is used up. Try again later.');
  }
  for (const e of res.effects) if (e.ExternalPayout) db.budgetSpent = (BigInt(db.budgetSpent ?? '0') + BigInt(e.ExternalPayout.wei)).toString();
  if (fromSession) {
    const m0 = rec.doc.machine as Machine;
    const slot0 = Object.values(m0.nodes).find(p => p.type === 'CoinSlot') as Extract<Part, { type: 'CoinSlot' }>;
    const cost = BigInt(slot0.price) + BigInt(MOCK_LIMITS.orderFee);
    const bal = BigInt(db.balance ?? SPONSORED);
    if (bal < cost) throw new Error('Not enough testnet NEAR left in this session for price + storage fee.');
    db.balance = (bal - cost).toString();
  }
  const tx = nearTx();
  const orderId = `o-${Date.now().toString(36)}-${rand('abcdefghjkmnpqrstuvwxyz23456789', 4)}`;
  const effects = mapEffects(res.effects, payer, (r, wei, fee) => {
    const payoutId = String(db.nonce++);
    db.payouts[payoutId] = { createdAt: Date.now(), view: { payoutId, status: 'awaiting_signature', recipient: r, wei, portalAddress: MOCK_PORTAL, nonce: Number(payoutId), nearTx: tx } };
    void fee;
    return payoutId;
  });
  for (const e of effects) if (e.kind === 'vault') rec.vaults[e.name] = (BigInt(rec.vaults[e.name] ?? '0') + BigInt(e.amount)).toString();
  if (res.pending) {
    const m = rec.doc.machine as Machine;
    const credited = effects.reduce((a, e) => a + (e.kind === 'external' ? BigInt(e.fee) : BigInt(e.amount)), 0n);
    const slot = Object.values(m.nodes).find(p => p.type === 'CoinSlot') as Extract<Part, { type: 'CoinSlot' }>;
    db.held[`${machineId}/${orderId}`] = { machineId, gate: heldGate(m, res.trace) ?? '', amount: (BigInt(slot.price) - credited).toString(), payer, recipient };
  }
  save();
  return { tx, orderId, pending: res.pending, effects, trace: res.trace };
}

function payoutNow(id: string): PayoutView {
  const p = db.payouts[id];
  if (!p) throw new Error(`Unknown payout ${id}`);
  const now = Date.now();
  let status = p.view.status;
  if (status === 'awaiting_signature' && now - p.createdAt >= SIGNATURE_MS) status = 'signed';
  if (p.relayedAt) status = now - p.relayedAt >= SEPOLIA_MS ? 'confirmed' : 'broadcast';
  p.view = { ...p.view, status };
  return { ...p.view };
}

export const mockApi: WorldworksApi & { limits(): Promise<Limits> } = {
  mode: 'mock',

  async session(): Promise<Session> {
    await sleep(600);
    const isNew = !db.account;
    if (!db.account) { db.account = `ww-${rand('abcdefghijkmnpqrstuvwxyz23456789', 6)}.testnet`; save(); }
    db.balance ??= SPONSORED; save();
    return { accountId: db.account, balance: db.balance, isNew, network: 'testnet' };
  },

  validate(doc) {
    const out = JSON.parse(wasmValidate(JSON.stringify(doc.machine)));
    return out.ok ? { ok: true } : { ok: false, errors: (out.errors ?? []).map((e: unknown) => (typeof e === 'string' ? e : JSON.stringify(e))) };
  },

  preview(doc, recipient) {
    const res = runEngine(doc, recipient);
    if (!res.ok) return { tx: { hash: 'preview', explorerUrl: '' }, orderId: 'preview', pending: false, effects: [], trace: ['error: ' + JSON.stringify(res.errors)] };
    let n = 0;
    return { tx: { hash: 'preview', explorerUrl: '' }, orderId: 'preview', pending: res.pending, effects: mapEffects(res.effects, '$payer', () => `preview-${n++}`), trace: res.trace };
  },

  async publish(machineId, doc) {
    await sleep(NEAR_TX_MS);
    if (db.machines[machineId]) throw new Error('machine already published');
    if (!/^[a-z0-9_-]{1,32}$/.test(machineId)) throw new Error('Machine ids are 1–32 characters.');
    const v = mockApi.validate(doc);
    if (!v.ok) throw new Error('The engine rejected this machine.');
    const portals = Object.values((doc.machine as Machine).nodes).filter(p => p.type === 'Portal');
    if (portals.length > 1) throw new Error('The contract accepts one Portal per machine.');
    const bal = BigInt(db.balance ?? SPONSORED);
    if (bal < BigInt(MOCK_LIMITS.publishDeposit)) throw new Error('Not enough testnet NEAR for the storage deposit.');
    db.balance = (bal - BigInt(MOCK_LIMITS.publishDeposit)).toString();
    db.machines[machineId] = { doc: JSON.parse(JSON.stringify(doc)), owner: db.account ?? 'unknown.testnet', vaults: {} };
    save();
    return nearTx();
  },

  async getMachine(machineId) {
    await sleep(350);
    const rec = db.machines[machineId];
    return rec ? JSON.parse(JSON.stringify(rec)) : null;
  },

  order(machineId, recipient) {
    return placeOrder(machineId, db.account ?? 'unknown.testnet', recipient, true);
  },

  async customerOrder(machineId) {
    const r = await placeOrder(machineId, MOCK_CUSTOMER, MOCK_CUSTOMER_EVM);
    return { ...r, customer: MOCK_CUSTOMER };
  },

  async approve(machineId, orderId) {
    await sleep(NEAR_TX_MS);
    const key = `${machineId}/${orderId}`;
    const h = db.held[key];
    if (!h) throw new Error('Nothing is waiting for approval on that order.');
    const rec = db.machines[machineId];
    const m = rec.doc.machine as Machine;
    const sim = simulateRelease(m, h.gate, BigInt(h.amount));
    const tx = nearTx();
    for (const s of sim.sinks) {
      const p = m.nodes[s.node];
      if (p?.type === 'Vault') rec.vaults[p.name] = (BigInt(rec.vaults[p.name] ?? '0') + s.amount).toString();
      if (p?.type === 'Portal' && h.recipient) {
        const payoutId = String(db.nonce++);
        db.payouts[payoutId] = { createdAt: Date.now(), view: { payoutId, status: 'awaiting_signature', recipient: h.recipient, wei: p.wei, portalAddress: MOCK_PORTAL, nonce: Number(payoutId), nearTx: tx } };
      }
    }
    delete db.held[key];
    save();
    return tx;
  },

  async getPayout(payoutId) {
    await sleep(250);
    const v = payoutNow(payoutId);
    save();
    return v;
  },

  async relay(payoutId) {
    await sleep(900);
    const v = payoutNow(payoutId);
    if (v.status !== 'signed') throw new Error(`Payout ${payoutId} is ${v.status}, not signed yet.`);
    const p = db.payouts[payoutId];
    p.relayedAt = Date.now();
    p.view = { ...p.view, status: 'broadcast', evmTx: evmTx() };
    save();
    return { ...p.view };
  },

  async limits(): Promise<Limits> {
    await sleep(200);
    return { ...MOCK_LIMITS, epochRemainingWei: (BigInt(MOCK_LIMITS.epochBudgetWei) - BigInt(db.budgetSpent ?? '0')).toString() };
  },

  async contractInfo() {
    await sleep(200);
    return { contractId: 'mock-contract.testnet', portalAddress: MOCK_PORTAL, explorer: 'https://testnet.nearblocks.io' };
  },
};
