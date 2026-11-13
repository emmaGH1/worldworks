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
export const txRef = (hash: string): TxRef => ({hash,explorerUrl:`https://testnet.near.rocks/tx/${hash}`});
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
export async function placeOrder(who: Account, machineId: string, recipient = DEMO_RECIPIENT, orderId:string = crypto.randomUUID(), onSubmitted?:(tx:TxRef)=>void): Promise<OrderResult> {
  checkLegacyId(machineId);
  const machine = await view('get_machine',{machine_id:machineId});
  if (!machine) throw Error('Unknown machine');
  checkId(orderId,64);
  const existing = await readOrder(machineId, orderId);
  if (existing) return existing;
  const {result,tx} = await send(who,'submit_order',{machine_id:machineId,order_id:orderId,external_recipient:recipient},BigInt(price(machine.machine)) + BigInt((await limits()).orderFee));
  onSubmitted?.(tx);
  // Decode the submit receipt itself: detached signer/recovery receipts have
  // their own return values and must never be mistaken for the order result.
  let observed=result;
  try { observed=await rpc('EXPERIMENTAL_tx_status',{tx_hash:tx.hash,sender_account_id:who.accountId,wait_until:'FINAL'}); } catch {}
  const outcome = receiptResult(result, 'submit_order');
  if (!outcome) return {tx,orderId,pending:false,observation:'unknown',effects:[],trace:['Submitted; receipt observation unavailable. Check this transaction before retrying.']};
  return {tx,orderId,...withSettlement(observed,outcome)};

}

export function receiptResult(result:any, method:string): Pick<OrderResult,'pending'|'effects'|'trace'> | undefined {
  const root = result.transaction_outcome?.outcome;
  const receiptId = root?.receipt_ids?.[0];
  const receipt = result.receipts_outcome?.find((r:any)=>r.id === receiptId);
  if(receipt?.outcome.status?.Failure || result.status?.Failure) throw Object.assign(Error(method+' failed'),{definitive:true});
  const encoded = receipt?.outcome.status?.SuccessValue;
  if(!encoded) return undefined;
  try {
    const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))));
    if(typeof data.pending !== 'boolean' || !Array.isArray(data.effects) || !Array.isArray(data.trace)) return undefined;
    return data;
  } catch { return undefined; }
}

// Contract order existence is authoritative; only structured payout records supply recovered effects.
export async function readOrder(machineId:string, orderId:string, knownTx?:TxRef):Promise<OrderResult|null> {
  checkLegacyId(machineId); checkId(orderId,64);
  const order = await view('get_order',{machine_id:machineId,order_id:orderId});
  if(!order) return null;
  const machine = await view('get_machine',{machine_id:machineId});
  const effects:OrderResult['effects'] = reconstructEffects(machine?.machine,order);
  const nonce=Number(await view('get_portal_nonce',{}));
  for(let from=0;from<nonce;from+=200) {
    const payouts = await view('get_pending_external_payouts',{machine_id:machineId,from_index:String(from),limit:200});
    for(const p of payouts) if(p.order_id === orderId) effects.push({kind:'external',payoutId:p.payout_id,recipient:p.recipient,wei:p.wei,fee:p.fee});
  }
  let recoveredEffects=effects;
  if(knownTx?.hash) {
    try {
      const result=await rpc('EXPERIMENTAL_tx_status',{tx_hash:knownTx.hash,sender_account_id:order.payer,wait_until:'FINAL'});
      // A saved approval hash describes only the release, whereas the trace covers the whole order.
      const method=result.transaction?.actions?.find((a:any)=>a.FunctionCall)?.FunctionCall?.method_name;
      if(['submit_order','approve','expire'].includes(method)) {
        const decoded=receiptResult(result,method);
        if(decoded) {
          const actual=withSettlement(result,decoded).effects.filter(e=>e.kind!=='external');
          const sinks=effects.filter(e=>e.kind!=='external');
          const offset=method==='submit_order'?0:sinks.length-actual.length;
          for(let i=0;i<actual.length;i++) {
            const a=actual[i],b=sinks[offset+i];
            if(a.kind==='payout' && b?.kind==='payout' && a.account===b.account && a.amount===b.amount)b.settled=a.settled;
          }
        }
      }
    } catch { /* recovered transfers remain explicitly unknown */ }
  }
  return {orderId,tx:knownTx ?? {hash:'',explorerUrl:''},pending:order.pending,effects:recoveredEffects,trace:order.trace,recovered:true,resolution:orderResolution(order)};
}

/** Trace markers come from engine::release; absence of pending alone is not approval proof. */
export function orderResolution(order:{pending:boolean;trace:string[]}): NonNullable<OrderResult['resolution']> {
  if(order.pending)return 'pending';
  const markers=order.trace.filter(t=>/^Order '.*': (approved|expired)$/.test(t));
  return markers.at(-1)?.endsWith(': expired')?'expired':markers.at(-1)?.endsWith(': approved')?'approved':'completed';
}
/** Recover sink amounts from the persisted engine trace, including approval/expiry routes. */
export function reconstructEffects(machine:any,order:{payer:string;trace:string[]}):OrderResult['effects'] {
  const effects:OrderResult['effects']=[];
  for(const line of order.trace) {
    const match=/^(.+): (\d+) yoctoNEAR$/.exec(line);if(!match)continue;
    const p=machine?.nodes?.[match[1]],amount=match[2];
    if(p?.type==='Payout')effects.push({kind:'payout',account:p.account==='$payer'?order.payer:p.account,amount,settled:'unknown'});
    if(p?.type==='Vault')effects.push({kind:'vault',name:p.name,amount});
  }
  return effects;
}
/** Require an actual descendant Transfer action, its outcome, and successful recovery callback on failure. */
export function withSettlement(result:any,outcome:Pick<OrderResult,'pending'|'effects'|'trace'>):typeof outcome {
  const outcomes=new Map<string,any>((result.receipts_outcome ?? []).map((r:any)=>[r.id,r.outcome]));
  const reachable=new Set<string>();
  const visit=(id:string)=>{if(reachable.has(id))return;reachable.add(id);for(const child of outcomes.get(id)?.receipt_ids ?? [])visit(child);};
  for(const id of result.transaction_outcome?.outcome?.receipt_ids ?? [])visit(id);
  const used=new Set<string>();
  return {...outcome,effects:outcome.effects.map(e=>{
    if(e.kind!=='payout')return e;
    const receipt=(result.receipts ?? []).find((r:any)=>reachable.has(r.receipt_id) && !used.has(r.receipt_id) && r.receiver_id===e.account && r.receipt?.Action?.actions?.some((a:any)=>String(a.Transfer?.deposit)===e.amount));
    let settled:true|false|'unknown'='unknown';
    if(receipt) {
      used.add(receipt.receipt_id);const o=outcomes.get(receipt.receipt_id);
      if(o?.status && 'SuccessValue' in o.status)settled=true;
      if(o?.status?.Failure && (result.receipts ?? []).some((cb:any)=>{
        const id=cb.receipt_id;
        const outputs=receipt.receipt?.Action?.output_data_receivers ?? [];
        if(!o.receipt_ids?.includes(id) && !outputs.some((d:any)=>cb.receipt?.Action?.input_data_ids?.includes(d.data_id)))return false;
        return cb?.receiver_id===CONTRACT && cb.receipt?.Action?.actions?.some((a:any)=>a.FunctionCall?.method_name==='on_transfer') && outcomes.get(id)?.status && 'SuccessValue' in outcomes.get(id).status;
      }))settled=false;
    }
    return {...e,settled};
  })};
}
