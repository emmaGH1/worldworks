import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CONTRACT,rpc,view} from '../api/_near.js';
import {derive} from '../api/_portal.js';
const before=JSON.parse(readFileSync('/opt/ww-target/g4b-before-state.json','utf8'));
const after=await rpc('query',{request_type:'view_state',finality:'final',account_id:CONTRACT,prefix_base64:''});
// Existing stored records are immutable during this verification; run before new orders.
for(const v of before.values) assert.deepEqual(after.values.find((a:any)=>a.key===v.key),v);
assert.equal(after.values.length,before.values.length+1);
const address=await derive();assert.equal(address,'0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7');
assert.equal((await view('get_portal_address',{})).toLowerCase(),address.toLowerCase());
const wasm=readFileSync('/opt/ww-target/near/worldworks_contract.wasm');
const code=await rpc('query',{request_type:'view_code',finality:'final',account_id:CONTRACT});
assert.equal(createHash('sha256').update(Buffer.from(code.code_base64,'base64')).digest('hex'),createHash('sha256').update(wasm).digest('hex'));
console.log(JSON.stringify({address,wasmBytes:wasm.length,sha256:createHash('sha256').update(wasm).digest('hex'),preservedRecords:before.values.length,limits:await view('get_limits',{}),liabilities:await view('get_liabilities',{})},null,2));
