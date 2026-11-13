import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initSync, validate, preview_order } from '../src/engine/pkg/worldworks_engine_wasm.js';
import { JOBS, initialState, compile, runTest, todo, activeSockets, jobMachineId, shopPeople, type Build } from '../src/game/jobs/jobs.js';
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
const [j1, j2, j3] = JOBS;
const solved1: Build = { hub: { uid: 'a', kind: 'Splitter', shares: [60, 20, 20] }, end0: { uid: 'b', kind: 'Payout', person: 'ada' }, end1: { uid: 'c', kind: 'Payout', person: 'bola' }, end2: { uid: 'd', kind: 'Payout', person: 'chi' } };

test('job 1: correct build passes with three customers', () => {
  const r = runTest(j1, solved1, engine);
  assert.equal(r.ok, true, r.why); assert.equal(r.sales.length, 3);
  assert.deepEqual(r.rows.map(x => x.amount), ['+0.06 NEAR', '+0.02 NEAR', '+0.02 NEAR']);
});
test('job 1: default even split fails with a one-line reason', () => {
  const b = { ...solved1, hub: { uid: 'a', kind: 'Splitter' as const, shares: [40, 30, 30] } };
  const r = runTest(j1, b, engine);
  assert.equal(r.ok, false); assert.equal(r.why, 'Ada got 40%, needs 60%.');
});
test('job 1: shares not adding to 100 and a Vault distractor', () => {
  assert.equal(runTest(j1, { ...solved1, hub: { uid: 'a', kind: 'Splitter', shares: [60, 20, 10] } }, engine).why, 'Shares add up to 90%. They must add up to 100%.');
  const r = runTest(j1, { ...solved1, end2: { uid: 'v', kind: 'Vault' } }, engine);
  assert.equal(r.ok, false); assert.match(r.why, /^Chi got nothing/); assert.match(r.why, /Vault kept 20%/);
  const t = runTest(j1, { ...solved1, end1: { uid: 'x', kind: 'Payout', person: 'ada' } }, engine);
  assert.equal(t.why, 'Ada got 80%, needs 60%.');
});
test('job 1: todo lists empty sockets and missing people', () => {
  const { build } = initialState(j1);
  assert.equal(todo(j1, build).length, 4);
  assert.deepEqual(todo(j1, { ...solved1, end0: { uid: 'b', kind: 'Payout' } }), [{ socket: 'end0', what: 'person' }]);
});
test('job 2: prefilled Payout to Chi fails, Portal passes', () => {
  const { build } = initialState(j2);
  const r = runTest(j2, build, engine);
  assert.equal(r.ok, false); assert.equal(r.why, 'Chi got NEAR, but Chi only uses Ethereum now.');
  const ok = runTest(j2, { ...build, end2: { uid: 'p', kind: 'Portal' } }, engine);
  assert.equal(ok.ok, true, ok.why); assert.equal(ok.rows[2].amount, '+0.0001 ETH');
  const c = compile(j2, { ...build, end2: { uid: 'p', kind: 'Portal' } });
  assert.equal((c.doc.machine as any).portal_cap_wei, '100000000000000');
});
test('job 3: Gate + Key held by the customer passes; rider key and direct payout fail', () => {
  const { build } = initialState(j3);
  assert.deepEqual(activeSockets(j3, build).map(s => s.id), ['hub', 'end0', 'mid1', 'end1']);
  const good: Build = { ...build, mid1: { uid: 'g', kind: 'Gate' }, key1: { uid: 'k', kind: 'Worker', person: 'customer' }, end1: { uid: 'p', kind: 'Payout', person: 'dayo' } };
  assert.deepEqual(activeSockets(j3, good).map(s => s.id), ['hub', 'end0', 'mid1', 'key1', 'end1']);
  const r = runTest(j3, good, engine);
  assert.equal(r.ok, true, r.why);
  assert.equal(r.sales[0].held, 20000000000000000000000n);
  assert.equal(r.sales[0].released.dayo?.near, 20000000000000000000000n);
  assert.equal(r.sales[2].delivered, false); assert.equal(r.sales[2].released.refund, 20000000000000000000000n);
  assert.equal(runTest(j3, { ...good, key1: { uid: 'k', kind: 'Worker', person: 'dayo' } }, engine).why, 'The rider can’t confirm their own delivery. Give the Key to the customer.');
  const direct = runTest(j3, { ...build, mid1: { uid: 'p', kind: 'Payout', person: 'dayo' } }, engine);
  assert.equal(direct.why, 'Dayo was paid before the delivery.');
  assert.deepEqual(compile(j3, good, 'me.testnet').doc.workers, { checker: 'me.testnet' });
});
test('machine ids are contract-valid and shop people read back from the machine', () => {
  const c = compile(j1, solved1);
  const id = jobMachineId(j1, c.doc, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
  assert.match(id, /^[a-z0-9_-]{1,32}$/);
  assert.deepEqual(shopPeople(c.doc.machine as any).map(p => [p.person.id, p.pct, p.how]), [['ada', 60, 'near'], ['bola', 20, 'near'], ['chi', 20, 'near']]);
});


test('live Portal preflight blocks gas-incompatible recipients and fails closed on an unreadable estimate', async () => {
  const { checkPortalGas } = await import('../src/game/jobs/portalPreflight.js');
  const reply = (body: object, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;
  await checkPortalGas('0x1', '0x2', '100000000000000', reply({ result: '0x5208' }));
  await assert.rejects(checkPortalGas('0x1', '0x2', '100000000000000', reply({ result: '0x31f38' })), /needs more gas.*No sale was sent/);
  await assert.rejects(checkPortalGas('0x1', '0x2', '100000000000000', reply({ error: 'offline' }, 502)), /Cannot check/);
});
