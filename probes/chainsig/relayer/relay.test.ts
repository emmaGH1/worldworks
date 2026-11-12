import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recoverTransactionAddress, parseTransaction } from 'viem';
import { assemble } from './relay.js';
const record = JSON.parse(readFileSync(new URL('../evidence/run-3-1.json',import.meta.url),'utf8'));
const original = record.payout;
test('live signature recovers contract-derived address and fixes transaction fields', async () => {
 const raw = assemble(original);
 assert.equal(await recoverTransactionAddress({serializedTransaction:raw}),record.derived_address);
 const parsed = parseTransaction(raw);
 assert.equal(parsed.chainId,11155111);
 assert.equal(parsed.nonce,2);
 assert.equal(parsed.value,1n);
 assert.equal(parsed.to?.toLowerCase(),original.recipient.toLowerCase());
 assert.equal(parsed.gas,21000n);
 assert.ok(!parsed.data || parsed.data === '0x');
});
for(const [field,value] of Object.entries({recipient:'0x1111111111111111111111111111111111111111',wei:'2',nonce:42,chain_id:1,max_fee_per_gas:'1',gas_limit:22000})) {
 test(`relayer rejects altered ${field}`,()=>assert.throws(()=>assemble({...original,[field]:value})));
}
test('relayer rejects unsigned payout',()=>assert.throws(()=>assemble({...original,status:'pending',signature_json:null})));
