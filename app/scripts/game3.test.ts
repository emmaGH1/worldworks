// GAME-3 rule checkers: every job has a correct build that passes and at least two wrong builds that fail
// with a one-line plain reason. Runs the real wasm engine the contract uses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initSync, validate, preview_order } from '../src/engine/pkg/worldworks_engine_wasm.js';
import { JOBS, activeSockets, compile, runTest, todo, jobMachineId, shopPeople, subtree, initialState, type Build, type Placed, type PersonId } from '../src/game/jobs/jobs.js';
import type { MachineDoc, OrderResult } from '../src/api/types.js';
initSync({ module: readFileSync(new URL('../src/engine/pkg/worldworks_engine_wasm_bg.wasm', import.meta.url)) });
const price = (m: any) => (Object.values(m.nodes) as any[]).find(p => p.type === 'CoinSlot').price;
const engine = {
  validate(doc: MachineDoc) { const r = JSON.parse(validate(JSON.stringify(doc.machine))); return r.ok ? { ok: true as const } : { ok: false as const, errors: r.errors.map((e: unknown) => JSON.stringify(e)) }; },
  preview(doc: MachineDoc, recipient?: string): OrderResult {
    const r = JSON.parse(preview_order(JSON.stringify(doc.machine), price(doc.machine), recipient));
    if (r.ok === false) throw Error(JSON.stringify(r.errors));
    return { tx: { hash: 'preview', explorerUrl: '' }, orderId: 'preview', pending: r.pending, trace: r.trace, effects: r.effects.map((e: any) => e.Payout ? { kind: 'payout', ...e.Payout } : e.VaultCredit ? { kind: 'vault', ...e.VaultCredit } : { kind: 'external', payoutId: 'preview', ...e.ExternalPayout }) };
  },
};
const [j1, j2, j3, j4, shop] = JOBS;
let u = 0;
const S = (...shares: number[]): Placed => ({ uid: `s${u++}`, kind: 'Splitter', shares });
const Pay = (person: PersonId): Placed => ({ uid: `p${u++}`, kind: 'Payout', person });
const Portal = (wei = '500000000000000'): Placed => ({ uid: `o${u++}`, kind: 'Portal', wei });
const Vault = (): Placed => ({ uid: `v${u++}`, kind: 'Vault' });
const Gate = (): Placed => ({ uid: `g${u++}`, kind: 'Gate' });
const Key = (person: PersonId): Placed => ({ uid: `k${u++}`, kind: 'Worker', person });
const y = (n: string) => BigInt(Math.round(Number(n) * 1e5)) * 10n ** 19n;

// ---------------------------------------------------------------- job 1
const j1one: Build = { r: S(60, 20, 20), 'r.0': Pay('ada'), 'r.1': Pay('bola'), 'r.2': Pay('chi') };
const j1chain: Build = { r: S(60, 40), 'r.0': Pay('ada'), 'r.1': S(50, 50), 'r.1.0': Pay('bola'), 'r.1.1': Pay('chi') };
test('job 1: Ada keeps 3× each helper — one 3-way Splitter is ★★★, a chain is ★★', () => {
  const a = runTest(j1, j1one, engine);
  assert.equal(a.ok, true, a.why); assert.equal(a.sales.length, 3); assert.equal(a.score?.stars, 3);
  assert.equal(a.totals?.near.ada, y('0.06'));
  const b = runTest(j1, j1chain, engine);
  assert.equal(b.ok, true, b.why); assert.equal(b.score?.stars, 2); assert.match(b.score!.note, /can be done with 4/);
});
test('job 1: wrong builds fail with a one-line reason', () => {
  assert.equal(runTest(j1, { ...j1one, r: S(50, 20, 30) }, engine).why, 'Ada got 0.05, needs 3× Bola’s 0.02 = 0.06.');
  assert.equal(runTest(j1, { ...j1one, r: S(50, 25, 25) }, engine).why, 'Ada got 0.05, needs 3× Bola’s 0.025 = 0.075.');
  const v = runTest(j1, { r: S(45, 15, 40), 'r.0': Pay('ada'), 'r.1': Pay('bola'), 'r.2': Vault() }, engine);
  assert.equal(v.ok, false); assert.equal(v.why, 'Chi got nothing.');
  const vault = runTest(j1, { r: S(60, 40), 'r.0': S(50, 50), 'r.0.0': Pay('ada'), 'r.0.1': Vault(), 'r.1': S(50, 50), 'r.1.0': Pay('bola'), 'r.1.1': Pay('chi') }, engine);
  assert.equal(vault.ok, false); assert.equal(vault.why, 'Ada got 0.03, needs 3× Bola’s 0.02 = 0.06.');
  assert.equal(runTest(j1, { ...j1one, 'r.1': Pay('ada') }, engine).why, 'Bola got nothing.');
  assert.equal(runTest(j1, { ...j1one, r: S(60, 20, 15) }, engine).why, 'A Splitter\'s belts add up to 95%. They must add up to 100%.');
});
test('job 1: a Vault keeping coins fails "every coin is paid out"', () => {
  // 3:1:1 holds but 25% sits in a Vault
  const r = runTest(j1, { r: S(75, 25), 'r.0': S(80, 20), 'r.0.0': Pay('ada'), 'r.0.1': Pay('bola'), 'r.1': S(80, 20), 'r.1.0': Vault(), 'r.1.1': Pay('chi') }, engine);
  assert.equal(r.ok, false);
  assert.match(r.why, /Ada got 0.06|A Vault kept/);
});

// ---------------------------------------------------------------- job 2
const j2best: Build = { r: S(50, 50), 'r.0': Pay('ada'), 'r.1': S(75, 25), 'r.1.0': Pay('bola'), 'r.1.1': Pay('chi') };
test('job 2: half to Ada, then Bola 3× Chi needs a chain (5 parts ★★★; 6 parts ★★)', () => {
  const a = runTest(j2, j2best, engine);
  assert.equal(a.ok, true, a.why); assert.equal(a.score?.stars, 3);
  assert.equal(a.totals?.near.bola, y('0.0375')); assert.equal(a.totals?.near.chi, y('0.0125'));
  const b = runTest(j2, { r: S(50, 25, 25), 'r.0': Pay('ada'), 'r.1': Pay('bola'), 'r.2': S(50, 50), 'r.2.0': Pay('bola'), 'r.2.1': Pay('chi') }, engine);
  assert.equal(b.ok, true, b.why); assert.equal(b.score?.stars, 2);
});
test('job 2: one Splitter cannot do it; wrong builds explain why', () => {
  assert.equal(runTest(j2, { r: S(50, 35, 15), 'r.0': Pay('ada'), 'r.1': Pay('bola'), 'r.2': Pay('chi') }, engine).why, 'Bola got 0.035, needs 3× Chi’s 0.015 = 0.045.');
  assert.equal(runTest(j2, { r: S(50, 40, 10), 'r.0': Pay('ada'), 'r.1': Pay('bola'), 'r.2': Pay('chi') }, engine).why, 'Bola got 0.04, needs 3× Chi’s 0.01 = 0.03.');
  assert.equal(runTest(j2, { ...j2best, r: S(60, 40) }, engine).why, 'Ada got 0.06, needs half: 0.05.');
  assert.match(runTest(j2, { ...j2best, 'r.1.1': Vault() }, engine).why, /Chi got nothing/);
});

// ---------------------------------------------------------------- job 3
const ctx3 = { rate: '1000000' };
const j3best: Build = { r: S(75, 20, 5), 'r.0': Pay('ada'), 'r.1': Pay('bola'), 'r.2': S(90, 10), 'r.2.0': Pay('ada'), 'r.2.1': Portal() };
test('job 3: exact Portal fee is ★★★, a 5% Portal share passes with waste ★', () => {
  const a = runTest(j3, j3best, engine, ctx3);
  assert.equal(a.ok, true, a.why); assert.equal(a.score?.stars, 3);
  assert.equal(a.totals?.portalFee, y('0.0005')); assert.equal(a.totals?.wei.chi, 500000000000000n);
  assert.deepEqual(a.rows.map(r => r.amount), ['+0.0005 ETH', '+0.02', '+0.0795']);
  const b = runTest(j3, { r: S(75, 20, 5), 'r.0': Pay('ada'), 'r.1': Pay('bola'), 'r.2': Portal() }, engine, ctx3);
  assert.equal(b.ok, true, b.why); assert.equal(b.score?.stars, 1); assert.match(b.score!.note, /keeps 0.0045 NEAR more/);
  const c = compile(j3, j3best);
  assert.equal(c.recipient, '0xE53AA3F186Dd3f580D2b6259bCa8aA86B10Eaeb2'); assert.equal((c.doc.machine as any).portal_cap_wei, '500000000000000');
});
test('job 3: wrong builds — Chi on NEAR, Portal underfunded, Bola wrong', () => {
  assert.equal(runTest(j3, { r: S(60, 20, 20), 'r.0': Pay('ada'), 'r.1': Pay('bola'), 'r.2': Pay('chi') }, engine, ctx3).why, 'Chi got 0.02 NEAR, but Chi only uses Ethereum now.');
  assert.equal(runTest(j3, { ...j3best, 'r.2': S(95, 5) }, engine, ctx3).why, 'The Portal needs 0.0005 NEAR to send 0.0005 ETH but gets 0.00025. The contract would refuse it.');
  assert.equal(runTest(j3, { ...j3best, 'r.2.1': Portal('1000000000000000') }, engine, ctx3).why, 'The Portal needs 0.001 NEAR to send 0.001 ETH but gets 0.0005. The contract would refuse it.');
  assert.equal(runTest(j3, { ...j3best, r: S(70, 25, 5) }, engine, ctx3).why, 'Bola got 0.025, needs 20%: 0.02.');
  assert.equal(runTest(j3, { ...j3best, 'r.2.0': Vault() }, engine, ctx3).why, 'A Vault kept 0.0045. Ada should get it.');
});

// ---------------------------------------------------------------- job 4
const j4best: Build = { r: S(80, 20), 'r.0': Pay('ada'), 'r.1': Gate(), 'r.1.p': Pay('dayo'), 'r.1.f': Pay('customer'), 'r.1.k': Key('customer') };
test('job 4: Gate on Dayo’s share is ★★★; Gate on the whole sale is ★★', () => {
  assert.deepEqual(activeSockets(j4, j4best).map(s => s.id), ['r', 'r.0', 'r.1', 'r.1.p', 'r.1.f', 'r.1.k']);
  const a = runTest(j4, j4best, engine);
  assert.equal(a.ok, true, a.why); assert.equal(a.score?.stars, 3);
  assert.equal(a.sales[0].held, y('0.02')); assert.equal(a.sales[2].delivered, false);
  assert.equal(a.totals?.undelivered?.near.customer, y('0.02'));
  const whole = runTest(j4, { r: Gate(), 'r.k': Key('customer'), 'r.p': S(80, 20), 'r.p.0': Pay('ada'), 'r.p.1': Pay('dayo'), 'r.f': Pay('customer') }, engine);
  assert.equal(whole.ok, true, whole.why); assert.equal(whole.score?.stars, 2);
  assert.deepEqual(compile(j4, j4best, { holder: 'me.testnet' }).doc.workers, { checker: 'me.testnet' });
});
test('job 4: wrong builds — paid early, refund trapped in a Vault, rider holds the Key, refund to Dayo', () => {
  assert.equal(runTest(j4, { r: S(80, 20), 'r.0': Pay('ada'), 'r.1': Pay('dayo') }, engine).why, 'Dayo was paid before the bread arrived.');
  assert.equal(runTest(j4, { ...j4best, 'r.1.f': Vault() }, engine).why, 'The bread never arrived and the customer got nothing back: a Vault kept 0.02.');
  assert.equal(runTest(j4, { ...j4best, 'r.1.k': Key('dayo') }, engine).why, 'The rider can’t confirm their own delivery. Give the Key to the customer.');
  assert.equal(runTest(j4, { ...j4best, 'r.1.f': Pay('dayo') }, engine).why, 'Dayo got paid for bread that never arrived.');
  assert.deepEqual(todo(j4, { ...j4best, 'r.1.k': null }), [{ socket: 'r.1.k', what: 'empty' }]);
});

// ---------------------------------------------------------------- your shop
test('your shop: you + a NEAR friend + an Ethereum friend', () => {
  const ctx = { accounts: { you: 'ww-abc123.testnet', f1: 'friend.testnet' }, evm: { f2: '0x1111111111111111111111111111111111111111' }, friends: ['f1', 'f2'] as PersonId[], rate: '1000000' };
  const good: Build = { r: S(70, 25, 5), 'r.0': Pay('you'), 'r.1': Pay('f1'), 'r.2': Portal() };
  const a = runTest(shop, good, engine, ctx);
  assert.equal(a.ok, true, a.why); assert.equal(a.totals?.near.you, y('0.07'));
  assert.equal(compile(shop, good, ctx).recipient, '0x1111111111111111111111111111111111111111');
  assert.equal(runTest(shop, { r: S(70, 30), 'r.0': Pay('you'), 'r.1': Pay('f1') }, engine, ctx).why, 'Friend 2 got nothing.');
  assert.equal(runTest(shop, { r: S(70, 25, 5), 'r.0': Pay('f1'), 'r.1': Pay('f1'), 'r.2': Portal() }, engine, ctx).why, 'You got nothing. Put a Payout for You in the machine.');
  assert.equal(compile(shop, { r: Pay('f2') }, ctx).error, 'Friend 2 has no NEAR account. Use the Portal for them.');
});

// ---------------------------------------------------------------- tree helpers, ids, standalone shop
test('sockets: chained Splitter adds child sockets; removing returns the subtree; depth is bounded', () => {
  const { build } = initialState(j2);
  assert.deepEqual(activeSockets(j2, build).map(s => s.id), ['r']);
  assert.deepEqual(activeSockets(j2, j2best).map(s => s.id), ['r', 'r.0', 'r.1', 'r.1.0', 'r.1.1']);
  assert.deepEqual(subtree(j2best, 'r.1').sort(), ['r.1', 'r.1.0', 'r.1.1']);
  assert.equal(activeSockets(j2, j2best).find(s => s.id === 'r.1.0')!.accepts.includes('Splitter'), false);
});
test('machine ids are contract-valid and the shop reads chained shares back from the machine', () => {
  const c = compile(j2, j2best);
  const id = jobMachineId(j2, c.doc, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
  assert.match(id, /^[a-z0-9_-]{1,32}$/);
  assert.deepEqual(shopPeople(c.doc.machine as any).map(p => [p.name, p.pct, p.how]), [['Ada', 50, 'near'], ['Bola', 37.5, 'near'], ['Chi', 12.5, 'near']]);
  assert.deepEqual(shopPeople(compile(j4, j4best).doc.machine as any).map(p => [p.name, p.pct, p.how]), [['Ada', 80, 'near'], ['Dayo', 20, 'after']]);
  assert.deepEqual(shopPeople(compile(j3, j3best).doc.machine as any).map(p => [p.name, p.pct, p.how]), [['Ada', 79.5, 'near'], ['Bola', 20, 'near'], ['Ethereum wallet', 0.5, 'eth']]);
});
test('contract effect bounds hold for every best build (≤4 NEAR transfers, ≤1 Portal on any path)', () => {
  const bounds = (m: any, id: string): [number, number] => {
    const p = m.nodes[id];
    if (p.type === 'Payout') return [1, 0]; if (p.type === 'Portal') return [0, 1];
    if (p.type === 'CoinSlot') return bounds(m, p.output);
    if (p.type === 'Splitter') return p.outputs.map((o: any) => bounds(m, o.target)).reduce((a: number[], b: number[]) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
    if (p.type === 'Gate') { const a = bounds(m, p.pass), b = bounds(m, p.fail); return [Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
    return [0, 0];
  };
  for (const [job, b] of [[j1, j1one], [j1, j1chain], [j2, j2best], [j3, j3best], [j4, j4best]] as const) {
    const m = compile(job, b).doc.machine as any; const [t, p] = bounds(m, 'slot');
    assert.ok(t <= 4 && p <= 1, `${job.slug}: ${t} transfers, ${p} portals`);
    assert.ok(Object.keys(m.nodes).every(k => /^[a-z0-9_-]{1,32}$/.test(k)));
  }
});
test('live Portal preflight blocks gas-incompatible recipients and fails closed on an unreadable estimate', async () => {
  const { checkPortalGas } = await import('../src/game/jobs/portalPreflight.js');
  const reply = (body: object, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  await checkPortalGas('0x1', '0x2', '500000000000000', reply({ result: '0x5208' }));
  await assert.rejects(checkPortalGas('0x1', '0x2', '500000000000000', reply({ result: '0x31f38' })), /needs more gas.*No sale was sent/);
  await assert.rejects(checkPortalGas('0x1', '0x2', '500000000000000', reply({ error: 'offline' }, 502)), /Cannot check/);
});
