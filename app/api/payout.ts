import { ACCOUNT, view, assemble, client } from './portal.js';
import { createPublicClient, http, keccak256, recoverTransactionAddress } from 'viem';
import { sepolia } from 'viem/chains';
import type { Request, Response } from './server-common.js';
export const confirmationUrls = [process.env.SEPOLIA_CONFIRM_RPC_1 ?? 'https://rpc.sepolia.ethpandaops.io',process.env.SEPOLIA_CONFIRM_RPC_2 ?? 'https://sepolia.gateway.tenderly.co'];
if(new URL(confirmationUrls[0]).hostname === new URL(confirmationUrls[1]).hostname) throw Error('Confirmation requires independent RPC hosts');
export const confirmationClients = confirmationUrls.map(url=>createPublicClient({chain:sepolia,transport:http(url,{timeout:15000,retryCount:1})}));
export async function confirm(payoutId:string) {
  const p = await view(ACCOUNT,'get_payout',{payout_id:payoutId});
  if(!p) throw Error('Unknown payout');
  const portalAddress = await view(ACCOUNT,'get_portal_address',{});
  const result:any = {payoutId,status:p.status,recipient:p.recipient,wei:p.wei,nonce:p.nonce,portalAddress};
  if(p.status !== 'signed') {
    const limits = await view(ACCOUNT,'get_limits',{});
    const block = await clientBlock();
    result.retryEligible = p.status === 'signature_failed' || p.status === 'awaiting_signature' && BigInt(block) >= BigInt(p.requested_at)+BigInt(limits.signature_timeout_blocks);
    return result;
  }
  const raw = assemble(p), hash = keccak256(raw);
  if((await recoverTransactionAddress({serializedTransaction:raw})).toLowerCase() !== portalAddress.toLowerCase()) throw Error('Signer mismatch');
  const proofs = await Promise.all(confirmationClients.map(async(rpc,i)=>{
    if(await rpc.getChainId() !== 11155111) throw Error('Sepolia only');
    try {
      const receipt = await rpc.getTransactionReceipt({hash});
      const tx = await rpc.getTransaction({hash});
      // RPC indexes can expose a mined receipt before their transaction index catches up.
      // A pending transaction is no confirmation proof; poll again instead of a transport error.
      if (tx.blockHash === null) return null;
      if(receipt.transactionHash.toLowerCase() !== hash || tx.hash.toLowerCase() !== hash || receipt.status !== 'success' || receipt.from.toLowerCase() !== portalAddress.toLowerCase() || tx.from.toLowerCase() !== portalAddress.toLowerCase() || receipt.to?.toLowerCase() !== p.recipient.toLowerCase() || tx.to?.toLowerCase() !== p.recipient.toLowerCase() || tx.value !== BigInt(p.wei) || tx.nonce !== p.nonce || receipt.blockHash !== tx.blockHash) throw Error('Sepolia receipt/transaction mismatch or revert');
      const head = await rpc.getBlockNumber();
      if(head < receipt.blockNumber + 3n) return null;
      return {head:head.toString(),depth:(head-receipt.blockNumber).toString(),rpc:confirmationUrls[i],hash,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber.toString(),from:receipt.from,to:receipt.to,value:tx.value.toString(),status:1};
    } catch(error) {
      if((error as Error).name === 'TransactionReceiptNotFoundError') return null;
      throw error;
    }
  }));
  if(proofs.every(Boolean)) {
    if(proofs[0]!.blockHash !== proofs[1]!.blockHash) throw Error('RPCs disagree about receipt block');
    result.status='confirmed'; result.confirmations=proofs;
  } else {
    try { const tx=await client.getTransaction({hash}); if(tx.hash.toLowerCase() !== hash) throw Error('RPC transaction hash mismatch'); result.status='broadcast'; }
    catch(error) { if((error as Error).name !== 'TransactionNotFoundError') throw error; }
  }
  if(result.status === 'broadcast' || result.status === 'confirmed') result.evmTx={hash,explorerUrl:`https://sepolia.etherscan.io/tx/${hash}`};
  return result;
}
async function clientBlock() {
  const {rpc} = await import('./portal.js');
  return (await rpc('block',{finality:'final'})).header.height as number;
}
export default async function handler(req:Request,res:Response) {
  if(req.method !== 'POST') return res.status(405).json({error:'POST required'});
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const id = (data as any)?.payout_id;
    if(typeof id !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(id)) return res.status(400).json({error:'Invalid payout_id'});
    return res.status(200).json(await confirm(id));
  } catch(error) { return res.status(502).json({error:String(error)}); }
}
