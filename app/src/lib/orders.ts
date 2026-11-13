import { addRow, updateRow } from './store.js';
import { api } from '../api/index.js';
import type { OrderResult } from '../api/types.js';
export const GAS_MARGIN = 50_000_000_000_000_000_000_000n;
export function canPay(balance:string,price:bigint,fee:bigint) { return BigInt(balance)>=price+fee+GAS_MARGIN; }
export const fundingMessage = 'Your free test account is out of test NEAR — the demo gives each visitor 4.5 NEAR.';
type Intent = { machineId:string; orderId:string; customer:boolean; recipient?:string; result?:OrderResult; rowId?:string };
const key=()=>`ww-order-${api.mode}`;
export function pendingOrder():Intent|null { try { return JSON.parse(localStorage.getItem(key()) ?? 'null'); } catch { return null; } }
const pause=()=>new Promise(r=>setTimeout(r,2000));
/** Never submit again after an ambiguous response. A missing final read alone cannot prove failure. */
export async function submitOrder(machineId:string,customer:boolean,recipient?:string,onUnknown?:(result?:OrderResult)=>void):Promise<OrderResult & {customer?:string}> {
  const saved=pendingOrder();
  if(saved && (saved.machineId!==machineId || saved.customer!==customer)) throw Error('An earlier order is still being checked. Open its machine before making another payment.');
  const intent:Intent=saved ?? {machineId,customer,recipient,orderId:crypto.randomUUID()};
  localStorage.setItem(key(),JSON.stringify(intent));
  let result=intent.result;
  if(saved?.result && saved.result.observation!=='unknown') return saved.result;
  if(!saved) {
    try {
      result=customer?await api.customerOrder(machineId,intent.orderId):await api.order(machineId,recipient,intent.orderId);
      intent.result=result;localStorage.setItem(key(),JSON.stringify(intent));
      if(result.observation!=='unknown') return result;
    } catch(error) {
      const e=error as Error & {status?:number};
      if((e.status && e.status<500) || /submit_order failed/.test(e.message)) {localStorage.removeItem(key());throw error;}
    }
  }
  if(!intent.rowId) {intent.rowId=addRow({kind:'order',orderId:intent.orderId,title:'Order submitted — result not confirmed yet',status:'unknown',statusText:'Outcome unknown — checking…',tx:result?.tx,detail:[`machine ${machineId}`,`order ${intent.orderId}`]});localStorage.setItem(key(),JSON.stringify(intent));}
  onUnknown?.(result);
  for(;;) {
    try {
      const found=await api.getOrder(machineId,intent.orderId);
      if(found) {
        intent.result={...result,...found,observation:undefined,tx:result?.tx.hash?result.tx:found.tx};
        localStorage.setItem(key(),JSON.stringify(intent));
        updateRow(intent.rowId,{status:'confirmed',statusText:'Order observed on chain',tx:result?.tx.hash?result.tx:found.tx});
        return {...result,...found,observation:undefined,tx:result?.tx.hash?result.tx:found.tx};
      }
    } catch { /* remain unknown; never re-spend */ }
    await pause();
  }
}

export function finishOrder(orderId:string) { if(pendingOrder()?.orderId===orderId) localStorage.removeItem(key()); }
