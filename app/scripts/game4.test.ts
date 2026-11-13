import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveApi } from '../src/api/live.js';

test('expiry uses finalized chain height, boundary is inclusive, resolved orders never qualify; refusal sends no transaction', async () => {
  const prior = globalThis.fetch;
  let height = '99', pending = true;
  const calls: string[] = [];
  globalThis.fetch = async (_url, init) => {
    const req = JSON.parse(String(init?.body)); calls.push(req.method);
    if (req.method === 'query') {
      assert.equal(req.params.finality, 'final');
      assert.equal(req.params.method_name, 'get_order');
      return Response.json({result:{result:[...Buffer.from(JSON.stringify({pending,expires_at:'100'}))]}});
    }
    assert.equal(req.method, 'block'); assert.equal(req.params.finality, 'final');
    return Response.json({result:{header:{height}}});
  };
  try {
    const storage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
    const api = new LiveApi(storage);
    assert.equal((await api.expiry('rider-test','order-test')).eligible, false);
    await assert.rejects(api.expire('rider-test','order-test'), /not pending or has not expired/);
    height = '100'; assert.equal((await api.expiry('rider-test','order-test')).eligible, true);
    pending = false; assert.equal((await api.expiry('rider-test','order-test')).eligible, false);
    assert(calls.every(m => m === 'query' || m === 'block'));
  } finally { globalThis.fetch = prior; }
});
