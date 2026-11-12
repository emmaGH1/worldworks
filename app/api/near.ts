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
  if(!id.length || new TextEncoder().encode(id).length > max) throw Error(`Identifier must be 1–${max} bytes`);
}
export async function limits() {
  const l = await view('get_limits',{});
  return {orderFee:l.order_storage_fee,publishDeposit:l.publish_storage_deposit,rate:l.min_fee_yocto_per_wei,epochBudgetWei:l.epoch_budget_wei,epochRemainingWei:l.remaining_budget_wei,maxWeiPerPayout:l.max_wei_per_payout};
}
export async function placeOrder(who: Account, machineId: string, recipient = DEMO_RECIPIENT): Promise<OrderResult> {
  checkId(machineId);
  const machine = await view('get_machine',{machine_id:machineId});
  if (!machine) throw Error('Unknown machine');
  const orderId = crypto.randomUUID();
  const {result,tx} = await send(who,'submit_order',{machine_id:machineId,order_id:orderId,external_recipient:recipient},BigInt(price(machine.machine)) + BigInt((await limits()).orderFee));
  const order = await view('get_order',{machine_id:machineId,order_id:orderId});
  const external = await view('get_pending_external_payouts',{machine_id:machineId});
  const effects: OrderResult['effects'] = [];
  // Trace amounts are emitted by the deployed engine, not a speculative preview.
  for (const line of order.trace as string[]) {
    const match = /^([^:]+): ([0-9]+) yoctoNEAR$/.exec(line);
    if (!match) continue;
    const node = machine.machine.nodes[match[1]];
    if (node?.type === 'Vault') effects.push({kind:'vault',name:node.name,amount:match[2]});
    if (node?.type === 'Payout') effects.push({kind:'payout',account:node.account === '$payer' ? who.accountId : node.account,amount:match[2]});
  }
  for (const p of external.filter((p:any) => p.order_id === orderId)) effects.push({kind:'external',payoutId:p.payout_id,recipient:p.recipient,wei:p.wei,fee:p.fee});
  const failures = result.receipts_outcome.filter((r:any) => r.outcome.status?.Failure);
  if (failures.length) throw Error(`Order ${tx.explorerUrl} has failed receipt(s): ${JSON.stringify(failures)}`);
  return {tx,orderId,pending:order.pending,effects,trace:order.trace};
}
