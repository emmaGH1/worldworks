import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recoverTransactionAddress, parseTransaction } from 'viem';
import { assemble, broadcast } from '../api/portal.js';
const record = JSON.parse(readFileSync(new URL('./portal-signature-fixture.json',import.meta.url),'utf8'));
const original = record.payout;
test('live signature recovers contract-derived address and fixes transaction fields', async () => {
 const raw = assemble(original);
 assert.equal(await recoverTransactionAddress({serializedTransaction:raw}),record.derived_address);
 const parsed = parseTransaction(raw);
 assert.equal(parsed.chainId,11155111);
 assert.equal(parsed.nonce,0);
 assert.equal(parsed.value,1000000000000000n);
 assert.equal(parsed.to?.toLowerCase(),original.recipient.toLowerCase());
 assert.equal(parsed.gas,21000n);
 assert.ok(!parsed.data || parsed.data === '0x');
});
for(const [field,value] of Object.entries({recipient:'0x1111111111111111111111111111111111111111',wei:'2',nonce:42,chain_id:1,max_fee_per_gas:'1',gas_limit:22000})) {
 test(`relayer rejects altered ${field}`,()=>assert.throws(()=>assemble({...original,[field]:value})));
}
test('relayer rejects unsigned payout',()=>assert.throws(()=>assemble({...original,status:'pending',signature_json:null})));

test('broadcast returns deterministic hash and known-transaction rebroadcast is idempotent', async () => {
 const raw = assemble(original);
 const calls: string[] = [];
 const rpc = {getChainId:async()=>11155111,sendRawTransaction:async()=>{calls.push('send');return '0x01' as const;},getTransaction:async()=>({})};
 const first = await broadcast(raw,rpc);
 const again = await broadcast(raw,{...rpc,sendRawTransaction:async()=>{throw Error('already known');}});
 assert.deepEqual(first,again);
 assert.equal(calls.length,1);
});
test('unaccepted broadcast preserves RPC failure', async () => {
 const raw = assemble(original);
 const rpc = {getChainId:async()=>11155111,sendRawTransaction:async()=>{throw Error('insufficient funds');},getTransaction:async()=>{throw Error('not found');}};
 await assert.rejects(broadcast(raw,rpc),/insufficient funds/);
});
test('wrong RPC chain cannot broadcast', async () => {
 let sent = false;
 const rpc = {getChainId:async()=>1,sendRawTransaction:async()=>{sent=true; return '0x01' as const;},getTransaction:async()=>({})};
 await assert.rejects(broadcast(assemble(original),rpc),/Sepolia only/);
 assert.equal(sent,false);
});
