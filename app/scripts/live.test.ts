import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import payout from '../api/payout.js';
import session from '../api/session.js';
import customer from '../api/customer.js';
import { confirmationClients } from '../api/payout.js';
import { keccak256 } from 'viem';
import { assemble, client } from '../api/portal.js';
import { body, type Request } from '../api/server-common.js';
function response() {
  const result = {code:0,data:null as any,setHeader:(_n:string,_v:string)=>{},status:(code:number)=>({json:(data:any)=>{result.code=code;result.data=data;}})};
  return result;
}
test('two independent matching receipts required; missing, altered, reverted and offline responses cannot confirm',async()=>{
  const fixture=JSON.parse(readFileSync(new URL('./portal-signature-fixture.json',import.meta.url),'utf8'));
  const hash=keccak256(assemble(fixture.payout));
  const priorFetch=globalThis.fetch;
  const clients=[...confirmationClients,client];
  const prior=clients.map(c=>({getChainId:c.getChainId,getTransactionReceipt:c.getTransactionReceipt,getTransaction:c.getTransaction}));
  globalThis.fetch=async(_url,opts)=>{
    const method=JSON.parse(String(opts?.body)).params.method_name;
    const data=method==='get_payout'?fixture.payout:fixture.derived_address;
    return new Response(JSON.stringify({result:{result:[...Buffer.from(JSON.stringify(data))]}}),{status:200});
  };
  try {
    for(const status of ['missing','pending','success','one-missing','reverted','offline','hash','sender','recipient','value']) {
      clients.forEach((c,i)=>{
        c.getChainId=async()=>11155111;
        c.getTransactionReceipt=async()=>{
          if(status==='offline' && i===1) throw Error('RPC offline');
          if(status==='missing'||status==='pending'||status==='one-missing'&&i===1) throw Object.assign(Error(),{name:'TransactionReceiptNotFoundError'});
          return {transactionHash:status==='hash'&&i===1?'0x00':hash,status:status==='reverted'?'reverted':'success',from:status==='sender'&&i===1?'0x00':fixture.derived_address,to:status==='recipient'&&i===1?'0x00':fixture.payout.recipient,blockHash:'0xabc',blockNumber:1n} as any;
        };
        c.getTransaction=async()=>{
          if(status==='missing') throw Object.assign(Error(),{name:'TransactionNotFoundError'});
          return {hash,from:fixture.derived_address,to:fixture.payout.recipient,value:status==='value'&&i===1?1n:BigInt(fixture.payout.wei),nonce:fixture.payout.nonce,blockHash:'0xabc'} as any;
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
  for(let n=0;n<5;n++) body(req,response(),'session');
  assert.throws(()=>body(req,response(),'session'),/rate limit/);
  assert.throws(()=>body({method:'GET'},response(),'session'),/POST required/);
});
