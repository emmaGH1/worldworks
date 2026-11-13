import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSettlement, reconstructEffects, orderResolution, CONTRACT, readOrder } from '../api/_near.js';
import { checkoutRecipient, checkPortalGas, portalAdmission, checkoutPortalRoutes } from '../src/game/jobs/portalPreflight.js';
import { api } from '../src/api/index.js';
import { submitOrder, pendingOrder, finishOrder } from '../src/lib/orders.js';
import { LiveApi } from '../src/api/live.js';
import { submitApproval, approvalIntent } from '../src/lib/approvals.js';
const mem=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>mem.get(k)??null,setItem:(k:string,v:string)=>mem.set(k,v),removeItem:(k:string)=>mem.delete(k)},configurable:true});
const result={orderId:'one',tx:{hash:'hash',explorerUrl:''},pending:false,effects:[],trace:[]};
test('1: gas preflight fails closed and admission rejects budget, cap and fee',async()=>{
 for(const response of [{result:'0x5209'},{error:'offline'},{}])await assert.rejects(checkPortalGas('from','to','1',async()=>new Response(JSON.stringify(response))));
 await checkPortalGas('from','to','1',async()=>new Response(JSON.stringify({result:'0x5208'})));
 const limits={rate:'2',maxWeiPerPayout:'10',epochRemainingWei:'99999999999999999'};
 assert.throws(()=>portalAdmission('11','22',limits));assert.throws(()=>portalAdmission('1','1',limits));assert.throws(()=>portalAdmission('1','2',{...limits,epochRemainingWei:'0'}));portalAdmission('1','2',limits);
});
test('2: settlement needs matching descendant transfer and recovery proof; true false unknown',()=>{
 const outcome={pending:false,trace:[],effects:[{kind:'payout' as const,account:'r.testnet',amount:'4'}]};
 const fixture=(status:any)=>({transaction_outcome:{outcome:{receipt_ids:['root']}},receipts:[{receipt_id:'transfer',receiver_id:'r.testnet',receipt:{Action:{actions:[{Transfer:{deposit:'4'}}],output_data_receivers:[{data_id:'d'}]}}},{receipt_id:'cb',receiver_id:CONTRACT,receipt:{Action:{input_data_ids:['d'],actions:[{FunctionCall:{method_name:'on_transfer'}}]}}}],receipts_outcome:[{id:'root',outcome:{receipt_ids:['transfer','cb']}},{id:'transfer',outcome:{status}},{id:'cb',outcome:{status:{SuccessValue:''}}}]});
 const settled=(f:any)=>(withSettlement(f,outcome).effects[0] as any).settled;
 assert.equal(settled(fixture({SuccessValue:''})),true);assert.equal(settled(fixture({Failure:{}})),false);assert.equal(settled({}), 'unknown');
 const missing=fixture({Failure:{}});missing.receipts_outcome.pop();assert.equal(settled(missing),'unknown');
 const unrelated=fixture({SuccessValue:''});unrelated.transaction_outcome.outcome.receipt_ids=[];assert.equal(settled(unrelated),'unknown');
});
test('3/5: persisted trace reconstructs ordinary sinks and resolution without claiming settlement',()=>{
 const machine={nodes:{pay:{type:'Payout',account:'$payer'},vault:{type:'Vault',name:'savings'}}};
 const effects=reconstructEffects(machine,{payer:'payer.testnet',trace:['pay: 10 yoctoNEAR','vault: 20 yoctoNEAR']});
 assert.deepEqual(effects,[{kind:'payout',account:'payer.testnet',amount:'10',settled:'unknown'},{kind:'vault',name:'savings',amount:'20'}]);
 assert.equal(orderResolution({pending:false,trace:["Order 'o': expired"]}),'expired');assert.equal(orderResolution({pending:false,trace:["Order 'o': approved"]}),'approved');assert.equal(orderResolution({pending:true,trace:[]}),'pending');assert.equal(orderResolution({pending:false,trace:[]}),'completed');
});
test('4: definitive clears intent; ambiguity bounds checks; explicit resend preserves id',async()=>{
 const old={order:api.order,get:api.getOrder};let id='',sends=0;
 try {
 api.order=async()=>{throw Object.assign(Error('submit rejected safely'),{definitive:true});};
 await assert.rejects(submitOrder('m',false),/rejected safely/);assert.equal(pendingOrder(),null);
 api.order=async(_m,_r,i)=>{id=i!;sends++;throw Error('lost response');};api.getOrder=async()=>null;
 await assert.rejects(submitOrder('m',false,undefined,undefined,{maxWaitMs:0}),/not observed/);assert.equal(sends,1);assert.equal(pendingOrder()?.orderId,id);
 api.order=async(_m,_r,i)=>{assert.equal(i,id);sends++;return {...result,orderId:i!};};
 const r=await submitOrder('m',false,undefined,undefined,{resend:true});assert.equal(sends,2);finishOrder(r.orderId);
 }finally{api.order=old.order;api.getOrder=old.get;}
});
test('4/10: post preserves safe structured errors and adds timeout',async()=>{
 const old=fetch;globalThis.fetch=async(_u,opts)=>{assert(opts?.signal);return new Response(JSON.stringify({error:'Testnet sponsor is low on funds',definitive:true}),{status:503});};
 try{await assert.rejects((new LiveApi(localStorage) as any).post('session',{}),(e:any)=>e.definitive===true && /sponsor is low/.test(e.message));}finally{globalThis.fetch=old;}
});
test('5: approval intent survives lost response, preventing repeat approval',async()=>{
 const old=api.approve;let sends=0;api.approve=async()=>{sends++;throw Error('lost');};
 try{await assert.rejects(submitApproval('m','held'));assert(approvalIntent('m','held'));await assert.rejects(submitApproval('m','held'),/already/);assert.equal(sends,1);}finally{api.approve=old;}
});
test('9: unrelated shops require payer wallet, Chi jobs default, valid suggestion wins',()=>{
 const chi='0x'+'1'.repeat(40),suggestion='0x'+'2'.repeat(40);
 assert.equal(checkoutRecipient('shop-abc',null,chi),'');assert.equal(checkoutRecipient('cross-chain-vending',null,chi),'');assert.equal(checkoutRecipient('abroad3-abc',null,chi),chi);assert.equal(checkoutRecipient('shop-abc',suggestion,chi),suggestion);assert.equal(checkoutRecipient('shop-abc','bad',chi),'');
});
test('3: ordinary order read returns recovered effects even with no transaction hash',async()=>{
 const old=fetch;
 globalThis.fetch=async(_u,opts)=>{
 const method=JSON.parse(String(opts?.body)).params.method_name;
 const value=method==='get_order'?{payer:'buyer.testnet',pending:false,trace:['sink: 40 yoctoNEAR']}:method==='get_machine'?{machine:{nodes:{sink:{type:'Payout',account:'payee.testnet'}}}}:method==='get_portal_nonce'?'0':[];
 return new Response(JSON.stringify({result:{result:[...Buffer.from(JSON.stringify(value))]}}));
 };
 try{const r=await readOrder('ordinary','one');assert.equal(r?.recovered,true);assert.deepEqual(r?.effects,[{kind:'payout',account:'payee.testnet',amount:'40',settled:'unknown'}]);assert.equal(r?.resolution,'completed');}finally{globalThis.fetch=old;}
});

test('1: admission includes Portal fees on approval and expiry paths',()=>{
 assert.deepEqual(checkoutPortalRoutes({nodes:{slot:{type:'CoinSlot',price:'20',output:'gate'},gate:{type:'Gate',condition:{type:'NeedsApproval'},pass:'portal',fail:'refund'},portal:{type:'Portal',wei:'3'},refund:{type:'Payout'}}}),[{wei:'3',fee:'20'}]);
});
