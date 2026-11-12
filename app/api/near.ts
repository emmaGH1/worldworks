// Browser-safe testnet primitives shared by the live adapter and server handlers.
import { Account, KeyPair, KeyPairSigner, actions } from 'near-api-js';
import type { OrderResult, TxRef } from '../src/api/types.js';
export { Account, KeyPair, KeyPairSigner, actions };
export const RPC = 'https://rpc.testnet.fastnear.com';
export const CONTRACT = 'ww-portal-261112.testnet';
export const DEMO_RECIPIENT = '0x000000000000000000000000000000000000dEaD';
export const GAS = 300_000_000_000_000n;
export function account(id: string, secret: string) {
  if (!id.endsWith('.testnet')) throw Error('NEAR testnet accounts only');
  return new Account(id, RPC, KeyPairSigner.fromSecretKey(secret as `ed25519:${string}`));
}
export async function rpc(method: string, params: unknown): Promise<any> {
  const res = await fetch(RPC, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}), signal:AbortSignal.timeout(60000)});
  const body = await res.json();
  if (!res.ok || body.error || body.result?.error) throw Error(JSON.stringify(body));
  return body.result;
}
export async function view(method: string, args: unknown): Promise<any> {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  const data = await rpc('query',{request_type:'call_function',finality:'final',account_id:CONTRACT,method_name:method,args_base64:btoa(String.fromCharCode(...bytes))});
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(data.result)));
}
export const txRef = (hash: string): TxRef => ({hash,explorerUrl:`https://explorer.testnet.near.org/transactions/${hash}`});
export async function send(who: Account, method: string, args: object, deposit = 0n) {
  const result = await who.signAndSendTransaction({receiverId:CONTRACT,actions:[actions.functionCall(method,args,GAS,deposit)],waitUntil:'FINAL'});
  return {result, tx:txRef(result.transaction.hash)};
}
export function price(machine: any): string {
  const slots = Object.values(machine.nodes).filter((p:any) => p.type === 'CoinSlot') as {price:string}[];
  if (slots.length !== 1) throw Error('Expected one CoinSlot');
  return slots[0].price;
}
export function checkId(id:string, max=32) {
  if(!new RegExp(`^[a-z0-9_-]{1,${max}}$`).test(id)) throw Error(`Identifier must be 1–${max} characters of [a-z0-9_-]`);
}
// Reads and owner withdrawals must still reach machines published before G6.
export function checkLegacyId(id:string, max=32) {
  if(!id.length || new TextEncoder().encode(id).length > max) throw Error(`Identifier must be 1–${max} bytes`);
}
export async function limits() {
  const l = await view('get_limits',{});
  return {orderFee:l.order_storage_fee,publishDeposit:l.publish_storage_deposit,rate:l.min_fee_yocto_per_wei,epochBudgetWei:l.epoch_budget_wei,epochRemainingWei:l.remaining_budget_wei,maxWeiPerPayout:l.max_wei_per_payout};
}
export async function placeOrder(who: Account, machineId: string, recipient = DEMO_RECIPIENT): Promise<OrderResult> {
  checkLegacyId(machineId);
  const machine = await view('get_machine',{machine_id:machineId});
  if (!machine) throw Error('Unknown machine');
  const orderId = crypto.randomUUID();
  const {result,tx} = await send(who,'submit_order',{machine_id:machineId,order_id:orderId,external_recipient:recipient},BigInt(price(machine.machine)) + BigInt((await limits()).orderFee));
  // Decode the submit receipt itself: detached signer/recovery receipts have
  // their own return values and must never be mistaken for the order result.
  const outcome = receiptResult(result, 'submit_order');
  if (!outcome) return {tx,orderId,pending:true,effects:[],trace:['Submitted; receipt observation unavailable. Check this transaction before retrying.']};
  return {tx,orderId,...outcome};

}

export function receiptResult(result:any, method:string): Pick<OrderResult,'pending'|'effects'|'trace'> | undefined {
  const root = result.transaction_outcome?.outcome;
  const receiptId = root?.receipt_ids?.[0];
  const receipt = result.receipts_outcome?.find((r:any)=>r.id === receiptId);
  if(receipt?.outcome.status?.Failure || result.status?.Failure) throw Error(method+' failed');
  const encoded = receipt?.outcome.status?.SuccessValue;
  if(!encoded) return undefined;
  try {
    const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))));
    if(typeof data.pending !== 'boolean' || !Array.isArray(data.effects) || !Array.isArray(data.trace)) return undefined;
    return data;
  } catch { return undefined; }
}
