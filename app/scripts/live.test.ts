import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import payout from '../api/payout.js';
import session from '../api/session.js';
import customer from '../api/customer.js';
import { client } from '../api/portal.js';
import { body, type Request } from '../api/server-common.js';
function response() {
  const result = {code:0,data:null as any,setHeader:(_n:string,_v:string)=>{},status:(code:number)=>({json:(data:any)=>{result.code=code;result.data=data;}})};
  return result;
}
test('payout status requires successful Sepolia receipt; missing, pending, reverted and RPC errors stay honest',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('./portal-signature-fixture.json',import.meta.url),'utf8'));
  const priorFetch=globalThis.fetch;
  const prior={getChainId:client.getChainId,getTransactionReceipt:client.getTransactionReceipt,getTransaction:client.getTransaction};
  globalThis.fetch=async(_url,opts)=>{
    const method=JSON.parse(String(opts?.body)).params.method_name;
    const data=method==='get_payout'?fixture.payout:fixture.derived_address;
    return new Response(JSON.stringify({result:{result:[...Buffer.from(JSON.stringify(data))]}}),{status:200});
  };
  const req={method:'POST',body:{payout_id:'0'}};
  const missing=(name:string)=>Object.assign(Error(name),{name});
  try {
    client.getChainId=async()=>11155111;
    for(const status of ['missing','pending','success','reverted','offline']) {
      client.getTransactionReceipt=async()=>{
        if(status==='offline') throw Error('RPC offline');
        if(status==='missing'||status==='pending') throw missing('TransactionReceiptNotFoundError');
        return {status:status==='success'?'success':'reverted'} as any;
      };
      client.getTransaction=async()=>{if(status==='missing') throw missing('TransactionNotFoundError');return {} as any;};
      const res=response();await payout(req,res);
      if(status==='reverted'||status==='offline') {assert.equal(res.code,502);assert(!res.data.status);}
      else {assert.equal(res.code,200);assert.equal(res.data.status,{missing:'signed',pending:'broadcast',success:'confirmed'}[status]);}
    }
    client.getChainId=async()=>1;
    const res=response();await payout(req,res);assert.equal(res.code,502);
  } finally {globalThis.fetch=priorFetch;Object.assign(client,prior);}
});
test('session rejects malformed keys; customer rejects oversized identifiers and invalid recipients',async()=>{
  for(const key of ['ed25519:invalid','secp256k1:abc',null]) {const res=response();await session({method:'POST',body:{publicKey:key},socket:{remoteAddress:String(key)}},res);assert.equal(res.code,400);}
  for(const data of [{machineId:'x'.repeat(129)},{machineId:'ok',recipient:'not-an-address'}]) {const res=response();await customer({method:'POST',body:data},res);assert.equal(res.code,400);}
});
test('per-IP session rate limit rejects sixth request and method guard rejects GET',()=>{
  const req:Request={method:'POST',body:{},socket:{remoteAddress:'rate-test'}};
  for(let n=0;n<5;n++) body(req,response(),'session');
  assert.throws(()=>body(req,response(),'session'),/rate limit/);
  assert.throws(()=>body({method:'GET'},response(),'session'),/POST required/);
});
