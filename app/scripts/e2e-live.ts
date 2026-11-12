import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { initSync } from '../src/engine/pkg/worldworks_engine_wasm.js';
import { LiveApi } from '../src/api/live.js';
import { account, send, view } from '../api/near.js';
import { client, relay } from '../api/portal.js';
initSync({module:readFileSync(new URL('../src/engine/pkg/worldworks_engine_wasm_bg.wasm',import.meta.url))});
const file=process.env.E2E_STORAGE_FILE ?? `/opt/ww-secrets/e2e-browser-${Date.now()}.json`;
if(!file.startsWith('/opt/ww-secrets/')) throw Error('Acceptance keys must stay in /opt/ww-secrets/');
const saved:Record<string,string>=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
const storage={getItem:(k:string)=>saved[k]??null,setItem:(k:string,v:string)=>{saved[k]=v;writeFileSync(file,JSON.stringify(saved),{mode:0o600});},removeItem:(k:string)=>{delete saved[k];}};
const api=new LiveApi(storage,process.env.API_URL??'http://127.0.0.1:3001');
const log=(label:string,data:unknown)=>console.log(label,JSON.stringify(data,null,2));
const session=await api.session(); log('session',session); assert.equal(session.network,'testnet');
const stamp=Date.now().toString(36);
const vendingId=`g4-vending-${stamp}`,escrowId=`g4-escrow-${stamp}`;
const load=(name:string)=>JSON.parse(readFileSync(new URL(`../../engine/examples/${name}.json`,import.meta.url),'utf8'));
const vending={machine:load('vending'),workers:{}};
const escrow={machine:load('escrow'),workers:{inspector:session.accountId}};
assert.deepEqual(api.validate(vending),{ok:true}); log('wasm preview',api.preview(vending));
log('publish vending',await api.publish(vendingId,vending));
log('publish escrow (installs approve-only key)',await api.publish(escrowId,escrow));
if(api.workerKeyTx) log('add scoped key',api.workerKeyTx);
const worker=await api.workerPermission(); log('scoped permission from RPC',worker);
assert.deepEqual((worker.permission as any).FunctionCall.method_names,['approve']);
const order=await api.order(vendingId); log('vending order',order); assert.equal(order.pending,false);
const held=await api.order(escrowId); log('escrow order',held); assert.equal(held.pending,true);
log('approve using scoped key',await api.approve(escrowId,held.orderId));
assert.equal((await view('get_order',{machine_id:escrowId,order_id:held.orderId})).pending,false);
let denied=false;
try { await send(account(session.accountId,saved['worldworks.testnet.worker.key']),'publish_machine',{machine_id:'forbidden',machine_json:JSON.stringify(vending.machine),workers:{},expiry_blocks:'100'}); }
catch(error) { const message=String(error); assert.match(message,/MethodNameMismatch|method.*not.*allowed|not.*permission/i); denied=true; log('scoped key CANNOT publish (expected rejection)',message); }
assert(denied,'Scoped key unexpectedly published');
const seeded=await api.customerOrder(vendingId); log('seeded customer order',seeded); assert.equal(seeded.customer,'ww-customer-g4-261112.testnet');
const external=order.effects.find(e=>e.kind==='external'); assert(external?.kind==='external');
const deadline=Date.now()+180000;
let payout=await api.getPayout(external.payoutId);
while(payout.status==='awaiting_signature' && Date.now()<deadline) {await new Promise(r=>setTimeout(r,3000));payout=await api.getPayout(external.payoutId);}
log('payout',payout); assert(['signed','broadcast','confirmed'].includes(payout.status));
const balance=await client.getBalance({address:payout.portalAddress as `0x${string}`}); log('Sepolia treasury wei',balance.toString());
if(balance===0n) console.log('NEEDS USER: fund Sepolia treasury '+payout.portalAddress+'; relay/confirmed acceptance not performed.');
else {
 // Shared treasury has historical nonces; relay each preceding signed payout first.
 for(let nonce=0;nonce<=payout.nonce;nonce++) { const p=await api.getPayout(String(nonce)); if(p.status==='signed') log('relay nonce '+nonce,await relay(String(nonce))); }
 payout=await api.getPayout(payout.payoutId);
 const until=Date.now()+180000;
 while(payout.status!=='confirmed' && Date.now()<until) {await new Promise(r=>setTimeout(r,3000)); payout=await api.getPayout(payout.payoutId);}
 log('confirmed Sepolia payout',payout); assert.equal(payout.status,'confirmed');
}
console.log('PASS: session, WASM validate/preview, publishes, orders, scoped approval/rejection, seeded customer, signed payout.');
