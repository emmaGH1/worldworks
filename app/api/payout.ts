import { ACCOUNT, view, assemble, client } from './portal.js';
import { keccak256 } from 'viem';
import type { Request, Response } from './server-common.js';
export default async function handler(req:Request,res:Response) {
  if(req.method !== 'POST') return res.status(405).json({error:'POST required'});
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const id = (data as any)?.payout_id;
    if(typeof id !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(id)) return res.status(400).json({error:'Invalid payout_id'});
    const p = await view(ACCOUNT,'get_payout',{payout_id:id});
    if(!p) return res.status(404).json({error:'Unknown payout'});
    const result:any = {payoutId:id,status:p.status,recipient:p.recipient,wei:p.wei,nonce:p.nonce,portalAddress:await view(ACCOUNT,'get_portal_address',{})};
    if(p.status === 'signed') {
      if(await client.getChainId() !== 11155111) throw Error('Sepolia only');
      const hash = keccak256(assemble(p));
      try {
        const receipt = await client.getTransactionReceipt({hash});
        if(receipt.status !== 'success') throw Error(`Sepolia transaction reverted: ${hash}`);
        result.status='confirmed'; result.evmTx={hash,explorerUrl:`https://sepolia.etherscan.io/tx/${hash}`};
      } catch(error) {
        if((error as Error).name !== 'TransactionReceiptNotFoundError') throw error;
        try { await client.getTransaction({hash}); result.status='broadcast'; result.evmTx={hash,explorerUrl:`https://sepolia.etherscan.io/tx/${hash}`}; }
        catch(error) { if((error as Error).name !== 'TransactionNotFoundError') throw error; }
      }
    }
    return res.status(200).json(result);
  } catch(error) { return res.status(502).json({error:String(error)}); }
}
