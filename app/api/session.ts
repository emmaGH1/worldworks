import { createHash } from 'node:crypto';
import { PublicKey } from 'near-api-js';
import { rpc, txRef } from './near.js';
import { body, quota, withSpend, envAccount, failure, serialized, type Request, type Response } from './server-common.js';
// 9 NEAR covers five (0.1 + 1.32) NEAR orders, publish, account storage and gas.
export const FUNDING = 9_000_000_000_000_000_000_000_000n;
export default async function handler(req:Request,res:Response) {
  try {
    const {publicKey,idempotencyKey} = body(req,res,'session');
    if(typeof publicKey !== 'string' || !publicKey.startsWith('ed25519:')) return res.status(400).json({error:'ed25519 public key required'});
    try { const key = PublicKey.fromString(publicKey); if(key.data.length !== 32) throw Error(); } catch { return res.status(400).json({error:'Invalid public key'}); }
    if(idempotencyKey !== publicKey) return res.status(400).json({error:'idempotencyKey must equal publicKey'});
    return await serialized(async()=>{
      const sponsor = envAccount('SPONSOR');
      const accountId = `p${createHash('sha256').update(publicKey).digest('hex').slice(0,20)}.${sponsor.accountId}`;
      if(accountId.length > 64) throw Error('Sponsor account name too long');
      try {
        const state = await rpc('query',{request_type:'view_account',finality:'final',account_id:accountId});
        return res.status(200).json({accountId,balance:state.amount,isNew:false,network:'testnet'});
      } catch(error) { if(!/UNKNOWN_ACCOUNT|account .*does not exist/.test(String(error))) throw error; }
      quota(req,'session');
      const state = await sponsor.getState();
      if(state.balance.available < FUNDING + 100_000_000_000_000_000_000_000n) throw Error('Testnet sponsor is low on funds; please refill the sponsor');
      const result = await withSpend('SPONSOR',sponsor,FUNDING+100_000_000_000_000_000_000_000n,()=>sponsor.createAccount({newAccountId:accountId,publicKey,nearToTransfer:FUNDING}));
      return res.status(200).json({accountId,balance:FUNDING.toString(),isNew:true,network:'testnet',tx:txRef(result.transaction.hash)});
    });
  } catch(error) { return failure(res,error); }
}
