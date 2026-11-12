import bs58 from 'bs58';
import { createPublicClient, http, keccak256, toHex, getAddress, serializeTransaction, recoverTransactionAddress, type Hex, type TransactionSerializableEIP1559 } from 'viem';
import { sepolia } from 'viem/chains';
import { pathToFileURL } from 'node:url';

export const ACCOUNT = process.env.PROBE_ACCOUNT ?? 'ww-chainsig-261112.testnet';
const PATH = 'worldworks/sepolia/v1';
export const client = createPublicClient({chain: sepolia, transport: http(process.env.EVM_RPC ?? 'https://rpc.sepolia.ethpandaops.io', {timeout:15000, retryCount:1})});
export async function rpc(method: string, params: unknown): Promise<any> {
  const res = await fetch('https://rpc.testnet.near.org', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0', id:1, method, params}), signal:AbortSignal.timeout(30000)});
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
  const bytes = bs58.decode(key.split(':')[1]);
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
  const p = await view(ACCOUNT,'get_payout',{payout_id:id});
  const raw = assemble(p);
  const derived = await derive();
  if(await recoverTransactionAddress({serializedTransaction:raw}) !== derived) throw Error('Signer address mismatch');
  if(await client.getChainId() !== 11155111) throw Error('Sepolia only');
  const hash = await client.sendRawTransaction({serializedTransaction:raw});
  console.log(JSON.stringify({payout_id:id,hash,explorer:`https://sepolia.etherscan.io/tx/${hash}`,broadcast_at:new Date().toISOString()}));
  const receipt = await client.waitForTransactionReceipt({hash,timeout:180000});
  if(receipt.status !== 'success') throw Error('EVM receipt reverted');
  return {payout_id:id,hash,from:receipt.from,to:receipt.to,value:p.wei,nonce:p.nonce,block:receipt.blockNumber.toString(),gas_used:receipt.gasUsed.toString(),gas_price:receipt.effectiveGasPrice.toString(),receipt_at:new Date().toISOString()};
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];
  if(command === 'derive') console.log(JSON.stringify({account:ACCOUNT,path:PATH,address:await derive(),balance:(await client.getBalance({address:await derive()})).toString(),chainId:await client.getChainId()}));
  else if(command === 'relay' && process.argv[3]) console.log(JSON.stringify(await relay(process.argv[3])));
  else throw Error('Usage: tsx relay.ts derive | relay <payout_id>');
}
