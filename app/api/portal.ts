function decodeBase58(input: string): Uint8Array {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const c of input) { const i = alphabet.indexOf(c); if (i < 0) throw Error('Invalid base58'); n = n * 58n + BigInt(i); }
  const bytes: number[] = [];
  while (n) { bytes.unshift(Number(n & 255n)); n >>= 8n; }
  for (const c of input) { if (c !== '1') break; bytes.unshift(0); }
  return Uint8Array.from(bytes);
}
import { createPublicClient, http, keccak256, toHex, getAddress, serializeTransaction, recoverTransactionAddress, type Hex, type TransactionSerializableEIP1559 } from 'viem';
import { sepolia } from 'viem/chains';


export const ACCOUNT = process.env.PORTAL_CONTRACT ?? 'ww-portal-261112.testnet';
if(ACCOUNT !== 'ww-portal-261112.testnet') throw Error('Pinned testnet contract only');
const PATH = 'worldworks/portal/sepolia/v1';
export const client = createPublicClient({chain: sepolia, transport: http(process.env.SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.ethpandaops.io', {timeout:15000, retryCount:1})});
export async function rpc(method: string, params: unknown): Promise<any> {
  const res = await fetch('https://rpc.testnet.fastnear.com', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0', id:1, method, params}), signal:AbortSignal.timeout(30000)});
  const body = await res.json() as any;
  if (!res.ok || body.error) throw Error(JSON.stringify(body));
  return body.result;
}
export async function view(account: string, method: string, args: unknown): Promise<any> {
  const data = await rpc('query', {request_type:'call_function',finality:'final',account_id:account,method_name:method,args_base64:Buffer.from(JSON.stringify(args)).toString('base64')});
  return JSON.parse(Buffer.from(data.result).toString());
}
export async function derive(): Promise<`0x${string}`> {
  const key = await view('v1.signer-prod.testnet','derived_public_key',{predecessor:ACCOUNT,path:PATH,domain_id:0});
  const bytes = decodeBase58(key.split(':')[1]);
  if(bytes.length !== 64) throw Error('Unexpected secp256k1 public key');
  return getAddress('0x' + keccak256(toHex(bytes)).slice(-40));
}
export function assemble(p: any) {
  if(p.status !== 'signed' || !p.signature_json) throw Error('Signature unavailable');
  if(p.chain_id !== 11155111 || p.gas_limit !== 21000) throw Error('Testnet/transfer policy mismatch');
  const tx: TransactionSerializableEIP1559 = {type:'eip1559',chainId:p.chain_id,nonce:p.nonce,to:p.recipient,value:BigInt(p.wei),data:'0x',gas:BigInt(p.gas_limit),maxFeePerGas:BigInt(p.max_fee_per_gas),maxPriorityFeePerGas:BigInt(p.max_priority_fee_per_gas),accessList:[]};
  const unsigned = serializeTransaction(tx);
  if (unsigned !== toHex(p.unsigned_tx) || keccak256(unsigned) !== toHex(p.payload)) throw Error('On-chain transaction/hash mismatch');
  const response = JSON.parse(p.signature_json);
  const sig = response.signature ?? response;
  const r = ('0x' + sig.big_r.affine_point.slice(2,66)) as Hex;
  const s = ('0x' + sig.s.scalar) as Hex;
  if(sig.recovery_id !== 0 && sig.recovery_id !== 1) throw Error('Unsupported recovery id');
  return serializeTransaction(tx, {r,s,yParity:sig.recovery_id});
}
export async function relay(id: string) {
  const target = await view(ACCOUNT,'get_payout',{payout_id:id});
  if(!target) throw Error('Unknown payout');
  const derived = await derive();
  const stored = await view(ACCOUNT,'get_portal_address',{});
  if(getAddress(stored) !== derived || derived !== '0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7') throw Error('Portal address mismatch');
  if(await client.getChainId() !== 11155111) throw Error('Sepolia only');
  const targetRaw=assemble(target), targetHash=keccak256(targetRaw);
  if(await recoverTransactionAddress({serializedTransaction:targetRaw}) !== derived) throw Error('Signer address mismatch');
  const next = await client.getTransactionCount({address:derived,blockTag:'latest'});
  if(next > target.nonce) {
    const known=await client.getTransaction({hash:targetHash});
    if(known.hash.toLowerCase() !== targetHash) throw Error('RPC transaction hash mismatch');
  }
  const waiting = await relayPredecessors(next,target.nonce,
    nonce=>view(ACCOUNT,'get_payout',{payout_id:String(nonce)}),
    async p=>{
      const raw=assemble(p);
      if(await recoverTransactionAddress({serializedTransaction:raw}) !== derived) throw Error('Signer address mismatch');
      await broadcast(raw);
    });
  if(waiting) return waiting;
  return {status:'broadcast',evm_tx_hash:targetHash};
}
// IDs and reserved nonces are equal for this contract; walk every predecessor.
export async function relayPredecessors(next:number,target:number,lookup:(nonce:number)=>Promise<any>,send:(p:any)=>Promise<unknown>) {
  for(let nonce=next;nonce<=target;nonce++) {
    const p=await lookup(nonce);
    if(!p || p.nonce !== nonce || p.status !== 'signed') return {status:'waiting_for_earlier_nonce',waitingPayoutId:String(nonce)};
    await send(p);
  }
}
export async function broadcast(raw: Hex, rpcClient: {
  getChainId(): Promise<number>;
  sendRawTransaction(args: {serializedTransaction: Hex}): Promise<Hex>;
  getTransaction(args: {hash: Hex}): Promise<unknown>;
} = client) {
  if(await rpcClient.getChainId() !== 11155111) throw Error('Sepolia only');
  const hash = keccak256(raw);
  try {
    const returned = await rpcClient.sendRawTransaction({serializedTransaction:raw});
    if(returned.toLowerCase() !== hash) throw Error('RPC transaction hash mismatch');
  }
  catch (error) {
    // Accept only a transaction the RPC can actually find by its exact hash.
    if(String(error).includes('hash mismatch')) throw error;
    try { const tx = await rpcClient.getTransaction({hash}) as {hash?:string}; if(tx.hash?.toLowerCase() !== hash) throw error; }
    catch { throw error; }
  }
  return {evm_tx_hash:hash};
}
