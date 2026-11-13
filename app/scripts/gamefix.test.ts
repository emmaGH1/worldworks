import {test} from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/api/index.js';
import { advancePayout, trackPayout, getState, addRow, retryRelay } from '../src/lib/store.js';
import { submitOrder, pendingOrder, finishOrder, canPay, GAS_MARGIN } from '../src/lib/orders.js';
import { FUNDING } from '../api/session.js';
import { Account, KeyPair, placeOrder } from '../api/_near.js';
import customer from '../api/customer.js';
import { LiveApi } from '../src/api/live.js';
const mem=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>mem.get(k)??null,setItem:(k:string,v:string)=>mem.set(k,v),removeItem:(k:string)=>mem.delete(k)},configurable:true});
const result={orderId:'id-one',tx:{hash:'hash',explorerUrl:'https://testnet.near.rocks/tx/hash'},pending:false,effects:[],trace:[]};
test('504 after customer acceptance resolves by orderId, with no second submission',async()=>{
 const old={customer:api.customerOrder,get:api.getOrder};let submits=0,reads=0,unknown=false,id='';
 api.customerOrder=async(_machine,orderId)=>{submits++;id=orderId!;throw Object.assign(Error('API 504'),{status:504});};
 api.getOrder=async(_machine,orderId)=>{reads++;assert.equal(orderId,id);assert(pendingOrder());return {...result,orderId};};
 try{const r=await submitOrder('lemon',true,undefined,()=>{unknown=true;});assert.equal(submits,1);assert.equal(reads,1);assert(unknown);assert.equal(r.orderId,id);assert.equal(pendingOrder()?.orderId,id);finishOrder(id);assert.equal(pendingOrder(),null);}
 finally{api.customerOrder=old.customer;api.getOrder=old.get;}
});
test('unknown receipt resolves and preserves the submitted transaction link',async()=>{
 const old={order:api.order,get:api.getOrder};let submitted=0;
 api.order=async()=>{submitted++;return {...result,observation:'unknown'};};
 api.getOrder=async()=>({...result,tx:{hash:'',explorerUrl:''},effects:[{kind:'external',payoutId:'3',recipient:'0x00',wei:'1',fee:'2'}]});
 try{const r=await submitOrder('lemon',false);assert.equal(r.observation,undefined);assert.equal(r.tx.hash,'hash');assert.equal(r.effects[0].kind,'external');assert.equal(submitted,1);finishOrder(r.orderId);}
 finally{api.order=old.order;api.getOrder=old.get;}
});
test('signature retries are gated and bounded to two per payout per page',async()=>{
 const old={get:api.getPayout,retry:api.retrySignature};const now=Date.now;let clock=1000,retries=0;
 Date.now=()=>clock;
 api.getPayout=async payoutId=>({payoutId,status:'signature_failed',recipient:'',wei:'0',portalAddress:'',nonce:0,retryEligible:true});
 api.retrySignature=async()=>{retries++;};
 try{await advancePayout('bounded-test');assert.equal(retries,0);clock+=15000;await advancePayout('bounded-test');await advancePayout('bounded-test');assert.equal(retries,1);clock+=15000;await advancePayout('bounded-test');clock+=15000;await advancePayout('bounded-test');assert.equal(retries,2);}
 finally{api.getPayout=old.get;api.retrySignature=old.retry;Date.now=now;}
});
test('queued payout advances predecessor; five read failures stop until manual Retry',async()=>{
 const old={get:api.getPayout,relay:api.relay};const timeout=globalThis.setTimeout;const queue:(()=>Promise<void>)[]=[];const seen:string[]=[];
 globalThis.setTimeout=((fn:any)=>{queue.push(fn);return 0;}) as any;
 const view=(id:string,status:any)=>({payoutId:id,status,recipient:'',wei:'0',portalAddress:'',nonce:0});
 api.getPayout=async id=>{seen.push(id);return view(id,'signed');};
 api.relay=async id=>id==='parent'?{...view(id,'waiting_for_earlier_nonce'),waitingPayoutId:'earlier'}:view(id,'confirmed');
 const row=addRow({kind:'payout',title:'parent',status:'pending',payoutId:'parent'});
 try{
  trackPayout('parent',row);await new Promise(r=>setImmediate(r));assert(seen.includes('earlier'));assert.match(getState().ledger.find(r=>r.id===row)!.statusText!,/#earlier/);
  api.getPayout=async()=>{throw Error('offline');};
  for(let n=0;n<5;n++) await queue.shift()!();
  assert.equal(queue.length,0);assert.equal(getState().ledger.find(r=>r.id===row)!.status,'unknown');assert.match(getState().payouts.parent.relayError!,/Can't read/);
  api.getPayout=async id=>view(id,'confirmed');retryRelay('parent');await new Promise(r=>setImmediate(r));assert.equal(getState().ledger.find(r=>r.id===row)!.status,'confirmed');
 }finally{api.getPayout=old.get;api.relay=old.relay;globalThis.setTimeout=timeout;}
});
test('balance check reserves price, order fee and gas; funding supports two standard purchases',()=>{
 const price=100000000000000000000000n,fee=1320000000000000000000000n;
 assert.equal(canPay((price+fee+GAS_MARGIN-1n).toString(),price,fee),false);
 assert.equal(canPay((price+fee+GAS_MARGIN).toString(),price,fee),true);
 assert(FUNDING>=400000000000000000000000n+2n*(price+fee)+GAS_MARGIN);
 assert.equal(FUNDING,4500000000000000000000000n);
});
test('customer repeat checks contract order before spend or quota and returns existing external receipt',async()=>{
 const oldFetch=fetch;const oldId=process.env.CUSTOMER_ACCOUNT_ID,oldKey=process.env.CUSTOMER_PRIVATE_KEY;
 process.env.CUSTOMER_ACCOUNT_ID='repeat.testnet';process.env.CUSTOMER_PRIVATE_KEY=KeyPair.fromRandom('ed25519').toString();let sends=0,exists=false;
 const send=Account.prototype.signAndSendTransaction,state=Account.prototype.getState;
 Account.prototype.getState=async()=>({balance:{total:100000000000000000000000000n,available:100000000000000000000000000n}}) as any;
 Account.prototype.signAndSendTransaction=async()=>{sends++;exists=true;return {transaction:{hash:'repeat-hash'},transaction_outcome:{outcome:{receipt_ids:['r']}},receipts_outcome:[{id:'r',outcome:{status:{SuccessValue:Buffer.from(JSON.stringify(result)).toString('base64')}}}]} as any;};
 globalThis.fetch=async(_u,opts)=>{const method=JSON.parse(String(opts?.body)).params.method_name;const data=method==='get_order'?(exists?{pending:false,trace:['accepted']}:null):method==='get_portal_nonce'?'1':method==='get_pending_external_payouts'?[{payout_id:'0',order_id:'repeat-id',recipient:'0x00',wei:'1',fee:'1'}]:method==='get_machine'?{machine:{nodes:{slot:{type:'CoinSlot',price:'1'}}}}:{order_storage_fee:'1'};return new Response(JSON.stringify({result:{result:[...Buffer.from(JSON.stringify(data))]}}));};
 const response=()=>{const r={code:0,data:null as any,setHeader:()=>{},status:(code:number)=>({json:(data:any)=>{r.code=code;r.data=data;}})};return r;};
 try{const req={method:'POST',body:{machineId:'lemon',orderId:'repeat-id'}};const a=response();await customer(req,a);assert.equal(a.code,200);const b=response();await customer(req,b);assert.equal(b.code,200);assert.equal(sends,1);assert.equal(b.data.orderId,'repeat-id');assert.equal(b.data.effects[0].payoutId,'0');}
 finally{globalThis.fetch=oldFetch;Account.prototype.signAndSendTransaction=send;Account.prototype.getState=state;if(oldId===undefined)delete process.env.CUSTOMER_ACCOUNT_ID;else process.env.CUSTOMER_ACCOUNT_ID=oldId;if(oldKey===undefined)delete process.env.CUSTOMER_PRIVATE_KEY;else process.env.CUSTOMER_PRIVATE_KEY=oldKey;}
});
test('payout status reads never submit retry_signature; post checks HTTP and content type',async()=>{
 const live=new LiveApi(localStorage,'');const old=fetch;
 try{
  globalThis.fetch=async()=>new Response(JSON.stringify({payoutId:'1',status:'signature_failed'}),{headers:{'content-type':'application/json'}});
  assert.equal((await live.getPayout('1')).status,'signature_failed');
  globalThis.fetch=async()=>new Response('<html>Gateway timeout</html>',{status:504});await assert.rejects(live.customerOrder('lemon','id'),/API 504/);
  globalThis.fetch=async()=>new Response('<html>unexpected</html>');await assert.rejects(live.customerOrder('lemon','id'),/non-JSON/);
 }finally{globalThis.fetch=old;}
});
test('reload after a successful response returns the durable result without a second spend, until UI acknowledgement',async()=>{
 mem.clear();const old=api.order;let spends=0;
 api.order=async(_m,_r,orderId)=>{spends++;return {...result,orderId:orderId!};};
 try {
  const first=await submitOrder('reload',false);
  assert.equal(pendingOrder()?.result?.orderId,first.orderId);
  const resumed=await submitOrder('reload',false);
  assert.equal(resumed.orderId,first.orderId);assert.equal(spends,1);
  finishOrder(first.orderId);assert.equal(pendingOrder(),null);
 } finally {api.order=old;}
});
test('recovered orders and payouts retain a single ledger row across reload recovery',()=>{
 const id=addRow({kind:'order',orderId:'dedup',title:'Submitted',status:'unknown'});
 assert.equal(addRow({kind:'order',orderId:'dedup',title:'Observed',status:'confirmed'}),id);
 assert.equal(getState().ledger.filter(r=>r.orderId==='dedup').length,1);
 const payout=addRow({kind:'payout',payoutId:'dedup-payout',title:'Portal',status:'pending'});
 assert.equal(addRow({kind:'payout',payoutId:'dedup-payout',title:'Portal',status:'pending'}),payout);
});
