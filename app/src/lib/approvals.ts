import { api } from '../api/index.js';
import type { TxRef } from '../api/types.js';
const key=(machineId:string,orderId:string)=>`ww-approval-${api.mode}-${machineId}-${orderId}`;
export function approvalIntent(machineId:string,orderId:string):{tx?:TxRef;action:'approve'|'expire'}|null {
  try{return JSON.parse(localStorage.getItem(key(machineId,orderId)) ?? 'null');}catch{return null;}
}
/** Write before sending so a lost response/reload cannot expose a second approval button. */
export async function submitApproval(machineId:string,orderId:string,action:'approve'|'expire'='approve') {
  if(approvalIntent(machineId,orderId))throw Error('An approval or refund is already being checked.');
  localStorage.setItem(key(machineId,orderId),JSON.stringify({action}));
  try {
    const result=action==='approve'?await api.approve(machineId,orderId):await api.expire!(machineId,orderId);
    localStorage.setItem(key(machineId,orderId),JSON.stringify({action,tx:result.tx}));
    return result;
  }catch(error){
    if((error as {definitive?:boolean}).definitive)localStorage.removeItem(key(machineId,orderId));
    throw error;
  }
}
export function finishApproval(machineId:string,orderId:string) {localStorage.removeItem(key(machineId,orderId));}
