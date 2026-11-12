import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import payout from '../api/payout.js';
import session from '../api/session.js';
import customer from '../api/customer.js';
import { confirmationClients } from '../api/payout.js';
import { keccak256 } from 'viem';
import { assemble, client } from '../api/portal.js';
import { body, quota, type Request } from '../api/server-common.js';
import { Account, KeyPair, CONTRACT, placeOrder } from '../api/near.js';
function response() {
  const result = {code:0,data:null as any,setHeader:(_n:string,_v:string)=>{},status:(code:number)=>({json:(data:any)=>{result.code=code;result.data=data;}})};
  return result;
}
test('two independent matching receipts required; missing, altered, reverted and offline responses cannot confirm',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('./portal-signature-fixture.json',import.meta.url),'utf8'));
  const hash=keccak256(assemble(fixture.payout));
  const priorFetch=globalThis.fetch;
  const clients=[...confirmationClients,client];
  const prior=clients.map(c=>({getChainId:c.getChainId,getBlockNumber:c.getBlockNumber,getTransactionReceipt:c.getTransactionReceipt,getTransaction:c.getTransaction}));
  globalThis.fetch=async(_url,opts)=>{
    const method=JSON.parse(String(opts?.body)).params.method_name;
    const data=method==='get_payout'?fixture.payout:fixture.derived_address;
    return new Response(JSON.stringify({result:{result:[...Buffer.from(JSON.stringify(data))]}}),{status:200});
  };
  try {
    for(const status of ['missing','pending','index-pending','shallow','one-shallow','success','one-missing','reverted','offline','hash','sender','recipient','value']) {
      clients.forEach((c,i)=>{
        c.getChainId=async()=>11155111;
        c.getBlockNumber=async()=>status==='shallow'||status==='one-shallow'&&i===1?3n:4n;
        c.getTransactionReceipt=async()=>{
          if(status==='offline' && i===1) throw Error('RPC offline');
          if(status==='missing'||status==='pending'||status==='one-missing'&&i===1) throw Object.assign(Error(),{name:'TransactionReceiptNotFoundError'});
          return {transactionHash:status==='hash'&&i===1?'0x00':hash,status:status==='reverted'?'reverted':'success',from:status==='sender'&&i===1?'0x00':fixture.derived_address,to:status==='recipient'&&i===1?'0x00':fixture.payout.recipient,blockHash:'0xabc',blockNumber:1n} as any;
        };
        c.getTransaction=async()=>{
          if(status==='missing') throw Object.assign(Error(),{name:'TransactionNotFoundError'});
          return {hash,from:fixture.derived_address,to:fixture.payout.recipient,value:status==='value'&&i===1?1n:BigInt(fixture.payout.wei),nonce:fixture.payout.nonce,blockHash:status==='index-pending' && i<2 ? null : '0xabc'} as any;
        };
      });
      const res=response();await payout({method:'POST',body:{payout_id:'0'}},res);
      if(['reverted','offline','hash','sender','recipient','value'].includes(status)) {assert.equal(res.code,502,status);assert(!res.data.status);}
      else {assert.equal(res.code,200,status);assert.equal(res.data.status,status==='success'?'confirmed':status==='missing'?'signed':'broadcast',status);if(status==='success') assert.equal(res.data.confirmations.length,2);}
    }
  } finally {globalThis.fetch=priorFetch;clients.forEach((c,i)=>Object.assign(c,prior[i]));}
});
test('session rejects malformed keys; customer rejects oversized identifiers and invalid recipients',async()=>{
  for(const key of ['ed25519:invalid','secp256k1:abc',null]) {const res=response();await session({method:'POST',body:{publicKey:key},socket:{remoteAddress:String(key)}},res);assert.equal(res.code,400);}
  for(const data of [{machineId:'x'.repeat(129)},{machineId:'ok',recipient:'not-an-address'}]) {const res=response();await customer({method:'POST',body:data},res);assert.equal(res.code,400);}
});
test('per-IP session rate limit rejects sixth request and method guard rejects GET',()=>{
  const req:Request={method:'POST',body:{},socket:{remoteAddress:'rate-test'}};
  for(let n=0;n<5;n++) quota(req,'session');
  assert.throws(()=>quota(req,'session'),/rate limit/);
  assert.throws(()=>body({method:'GET'},response(),'session'),/POST required/);
});

test('structured receipt effects preserve names that broke trace parsing and never query post-order history',async()=>{
  const {receiptResult}=await import('../api/near.js');
  const data={pending:false,effects:[{kind:'vault',name:'a: "vault"',amount:'2'},{kind:'external',payoutId:'7',recipient:'0x'+'11'.repeat(20),wei:'1',fee:'1'}],trace:['a: "vault": 2 yoctoNEAR']};
  const result={transaction_outcome:{outcome:{receipt_ids:['submit']}},receipts_outcome:[{id:'submit',outcome:{status:{SuccessValue:Buffer.from(JSON.stringify(data)).toString('base64')}}},{id:'sign',outcome:{status:{SuccessValue:'dHJ1ZQ=='}}}]};
  assert.deepEqual(receiptResult(result,'submit_order'),data);
  assert.equal(receiptResult({},'submit_order'),undefined);
});
test('unsigned target has its own state after signed predecessors advance',async()=>{
  const {relayPredecessors}=await import('../api/portal.js');
  const sent:number[]=[];
  assert.deepEqual(await relayPredecessors(0,2,async nonce=>({nonce,status:nonce===2?'awaiting_signature':'signed'}),async p=>{sent.push(p.nonce);}),{status:'waiting_for_signature',waitingPayoutId:'2'});
  assert.deepEqual(sent,[0,1]);
});
test('trusted Vercel client identities are distinct; malformed JSON consumes no quota',()=>{
  const old=process.env.VERCEL;process.env.VERCEL='1';
  try {
    for(let n=0;n<20;n++) assert.throws(()=>body({method:'POST',body:'{',headers:{'x-vercel-forwarded-for':'bad-json'}},response(),'session'),/JSON/);
    for(let n=0;n<5;n++) quota({headers:{'x-vercel-forwarded-for':'client-a'}},'session');
    assert.throws(()=>quota({headers:{'x-vercel-forwarded-for':'client-a'}},'session'),/rate limit/);
    quota({headers:{'x-vercel-forwarded-for':'client-b'}},'session');
  } finally {if(old===undefined)delete process.env.VERCEL;else process.env.VERCEL=old;}
});
test('session validation precedes quota; repeat idempotency key neither creates nor funds twice',async()=>{
  const env={id:process.env.SPONSOR_ACCOUNT_ID,key:process.env.SPONSOR_PRIVATE_KEY};
  const fetch=globalThis.fetch, create=Account.prototype.createAccount, state=Account.prototype.getState;
  process.env.SPONSOR_ACCOUNT_ID='session-fixture.testnet';
  process.env.SPONSOR_PRIVATE_KEY=KeyPair.fromRandom('ed25519').toString();
  const publicKey=KeyPair.fromRandom('ed25519').getPublicKey().toString();
  let exists=false,creates=0,balance=100_000_000_000_000_000_000_000_000n;
  globalThis.fetch=async()=>new Response(JSON.stringify(exists?{result:{amount:'9000000000000000000000000'}}:{error:{message:'UNKNOWN_ACCOUNT'}}));
  Account.prototype.getState=async()=>({balance:{total:balance,available:balance}}) as any;
  Account.prototype.createAccount=async()=>{creates++;exists=true;balance-=9_000_000_000_000_000_000_000_000n;return {transaction:{hash:'fixture-session-hash'}} as any;};
  try {
    for(let n=0;n<8;n++) {const r=response();await session({method:'POST',body:{publicKey:'bad'},socket:{remoteAddress:'idempotency-test'}},r);assert.equal(r.code,400);}
    const req={method:'POST',body:{publicKey,idempotencyKey:publicKey},socket:{remoteAddress:'idempotency-test'}};
    const first=response();await session(req,first);assert.equal(first.code,200);assert.equal(first.data.isNew,true);
    // Even exhausted client quota cannot block observing an already-created account.
    for(let i=0;i<4;i++)quota(req,'session');
    const second=response();await session(req,second);assert.equal(second.code,200);assert.equal(second.data.isNew,false);
    assert.equal(second.data.accountId,first.data.accountId);assert.equal(creates,1);
    const mismatch=response();await session({...req,body:{publicKey,idempotencyKey:'another'}},mismatch);assert.equal(mismatch.code,400);
  } finally {
    globalThis.fetch=fetch;Account.prototype.createAccount=create;Account.prototype.getState=state;
    if(env.id===undefined)delete process.env.SPONSOR_ACCOUNT_ID;else process.env.SPONSOR_ACCOUNT_ID=env.id;
    if(env.key===undefined)delete process.env.SPONSOR_PRIVATE_KEY;else process.env.SPONSOR_PRIVATE_KEY=env.key;
  }
});
test('placeOrder returns submitted tx/order when observation is absent; no history RPC or trace parsing',async()=>{
  const prior=globalThis.fetch;let submitted=false;const calls:string[]=[];
  globalThis.fetch=async(_url,opts)=>{
    assert(!submitted,'post-submit observation must not query history');
    const method=JSON.parse(String(opts?.body)).params.method_name;calls.push(method);
    const data=method==='get_machine'?{machine:{nodes:{slot:{type:'CoinSlot',price:'2',output:'bad:node'},'bad:node':{type:'Vault',name:'v'}}}}:{order_storage_fee:'1320000000000000000000000'};
    return new Response(JSON.stringify({result:{result:[...Buffer.from(JSON.stringify(data))]}}));
  };
  try {
    const who={signAndSendTransaction:async(args:any)=>{assert.equal(args.receiverId,CONTRACT);submitted=true;return {transaction:{hash:'submitted-hash'}};}} as any;
    const result=await placeOrder(who,'legacy');
    assert.equal(result.tx.hash,'submitted-hash');assert.match(result.orderId,/^[a-z0-9-]{36}$/);
    assert.deepEqual(result.effects,[]);assert.match(result.trace[0],/observation unavailable/);
    assert.deepEqual(calls,['get_machine','get_limits']);
  } finally {globalThis.fetch=prior;}
});
test('aggregate spend caps use account balance deltas and reject before sending',async()=>{
  const {withSpend,CUSTOMER_HOURLY_CAP}=await import('../api/server-common.js');
  let balance=100_000_000_000_000_000_000_000_000n,sent=0;
  const who={accountId:'spend-fixture.testnet',getState:async()=>({balance:{total:balance}})} as any;
  await withSpend('CUSTOMER',who,CUSTOMER_HOURLY_CAP,async()=>{sent++;balance-=CUSTOMER_HOURLY_CAP-1n;});
  await assert.rejects(withSpend('CUSTOMER',who,2n,async()=>{sent++;}),/hourly spend/);
  assert.equal(sent,1);
});
