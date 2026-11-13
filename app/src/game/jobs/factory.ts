// Factory presentation/model only. Engine, contract and shipping behavior are unchanged.
import { JOBS, PEOPLE, runTest, type Build, type Ctx, type Engine, type PersonId } from './jobs.js';
import type { LedgerRow } from '../../lib/store.js';
export const FACTORY_ENABLED = true;
export type FactoryProgress = { factoryHistory?:Record<number,{machineId:string;payoutId?:string}[]>; solved: Record<number,number>; builds: Record<number,Build>; shipped: Record<number,{machineId:string;link?:string;payoutId?:string}> };
export type Plot = { n:number; state:'solved'|'next'|'open'|'locked'; stars:number; build:Build; shipped?:FactoryProgress['shipped'][number] };
export type HouseTotals = Partial<Record<PersonId,{near:bigint;wei:bigint}>>;
export function plotsFor(p:FactoryProgress):Plot[] {
  const next=JOBS.find(j=>!p.solved[j.n])?.n;
  return JOBS.map(j=>({n:j.n,state:p.solved[j.n]?'solved':j.n===next?'next':j.n===5&&p.solved[1]?'open':'locked',stars:p.solved[j.n]??0,build:p.builds[j.n]??{},shipped:p.shipped[j.n]}));
}
export function housesFor(build:Build,abroad:PersonId='chi') {
  return Object.entries(build).flatMap(([socket,p])=>p?.kind==='Payout'&&p.person?[{socket,person:p.person,portal:false}]:p?.kind==='Portal'?[{socket,person:abroad,portal:true}]:[]);
}
export function addTotals(a:HouseTotals,b:HouseTotals):HouseTotals {
  const out=structuredClone(a);
  for(const [id,v] of Object.entries(b)) { if(!v) continue; const p=id as PersonId, old=out[p]??{near:0n,wei:0n}; out[p]={near:old.near+v.near,wei:old.wei+v.wei}; }
  return out;
}
/** Amounts come from the same wasm preview and resolved Gate preview as Test. */
export function simulatedSale(n:number,build:Build,engine:Engine,ctx:Ctx):HouseTotals {
  const r=runTest(JOBS[n-1],build,engine,ctx), out:HouseTotals={};
  if(!r.ok||!r.totals) return out;
  for(const p of new Set([...Object.keys(r.totals.near),...Object.keys(r.totals.wei)]) as Set<PersonId>) out[p]={near:r.totals.near[p]??0n,wei:r.totals.wei[p]??0n};
  return out;
}
function decimal(value:string,decimals:number) { if(!/^\d+(\.\d+)?$/.test(value))return 0n;const [whole,frac='']=value.split('.');return BigInt(whole)*10n**BigInt(decimals)+BigInt(frac.padEnd(decimals,'0').slice(0,decimals)); }
/** Only settled, confirmed, non-mock ledger receipts belonging to this factory scope count. */
export function realTotals(rows:LedgerRow[],p:FactoryProgress,ctx:Ctx):HouseTotals {
  const out:HouseTotals={}, seen=new Set<string>();
  const ships=[...Object.entries(p.shipped),...Object.entries(p.factoryHistory??{}).flatMap(([n,ss])=>ss.map(s=>[n,s] as const))];
  const machineIds=new Set(ships.map(([,s])=>s.machineId));
  const orders=new Set(rows.filter(r=>r.kind==='order'&&r.detail?.some(d=>d.startsWith('machine ')&&machineIds.has(d.slice(8)))).map(r=>r.orderId));
  for(const row of rows) {
    if(row.mock||row.status!=='confirmed'||row.kind!=='payout'||!row.tx?.hash||!row.amount)continue;
    let person:PersonId|undefined, unit:'near'|'wei'='near';
    if(row.title.startsWith('NEAR → ')&&row.statusText==='sent'&&row.orderId&&orders.has(row.orderId)) {
      const account=row.title.slice(7);
      person=(Object.entries(ctx.accounts??{}).find(([,a])=>a===account)?.[0]??Object.values(PEOPLE).find(p=>p.account===account)?.id) as PersonId|undefined;
    } else if(row.unit==='ETH'&&row.payoutId) {
      const sh=ships.find(([,s])=>s.payoutId===row.payoutId);
      if(sh) {person=Number(sh[0])===5?ctx.friends?.find(f=>!!ctx.evm?.[f]):'chi';unit='wei';}
    }
    const key=row.payoutId??`${row.orderId}:${row.detail?.find(d=>d.startsWith('effect '))??row.id}`;
    if(!person||seen.has(key))continue;seen.add(key);
    const v=out[person]??{near:0n,wei:0n};out[person]={...v,[unit]:v[unit]+decimal(row.amount,unit==='near'?24:18)};
  }
  return out;
}
