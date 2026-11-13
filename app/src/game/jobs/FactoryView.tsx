import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../lib/store';
import { JOBS, PEOPLE, fmtN, fmtE, type Ctx, type PersonId } from './jobs';
import { addTotals, plotsFor, realTotals, simulatedSale, type FactoryProgress, type HouseTotals } from './factory';
import { createFactoryScene } from './factoryScene';
import { Face } from './Face';
import { sound } from './sound';
export function FactoryView({progress,ctx,onOpen,caption,balance,storageKey}:{progress:FactoryProgress;ctx:Ctx;onOpen:(n:number)=>void;caption:string;balance?:string;storageKey:string}) {
  const canvas=useRef<HTMLCanvasElement>(null), overlay=useRef<HTMLDivElement>(null);
  const scene=useRef<ReturnType<typeof createFactoryScene>|null>(null);
  const plots=useMemo(()=>plotsFor(progress),[progress]);
  const [totals,setTotals]=useState<HouseTotals>(()=>{try {return JSON.parse(localStorage.getItem(storageKey)??'{}',(_k,v)=>typeof v==='string'&&/^\d+n$/.test(v)?BigInt(v.slice(0,-1)):v);}catch{return {};}});
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(totals,(_k,v)=>typeof v==='bigint'?`${v}n`:v));}catch{/* storage unavailable */}},[totals,storageKey]);
  const [customers,setCustomers]=useState(0);
  const ledger=useApp(s=>s.ledger);
  const real=useMemo(()=>realTotals(ledger,progress,ctx),[ledger,progress,ctx]);
  const houses=[...new Set<PersonId>(['ada','bola','chi','dayo','you',...(ctx.friends??[])])];
  const abroad=ctx.friends?.find(f=>!!ctx.evm?.[f]);
  useEffect(()=>{
    const sc=createFactoryScene(canvas.current!,overlay.current!,plots,abroad);scene.current=sc;
    sound.ambience(true);
    return ()=>{sc.dispose();scene.current=null;sound.ambience(false);};
  },[plots,abroad]);
  useEffect(()=>{
    const sales=plots.filter(p=>p.state==='solved').map(p=>simulatedSale(p.n,p.build,api,ctx));
    const timer=setInterval(()=>{if(document.hidden)return;setTotals(t=>sales.reduce(addTotals,t));setCustomers(c=>c+sales.length);},6000);
    return ()=>clearInterval(timer);
  },[plots,ctx]);
  const observedRows=useRef(new Set(ledger.filter(r=>r.status==='confirmed').map(r=>r.id)));
  useEffect(()=>{
    const ships=[...Object.entries(progress.shipped),...Object.entries(progress.factoryHistory??{}).flatMap(([n,ss])=>ss.map(s=>[n,s] as const))];
    for(const row of ledger) {
      if(row.mock||row.status!=='confirmed'||row.kind!=='payout'||observedRows.current.has(row.id))continue;
      if(!row.tx?.hash||(!row.payoutId&&row.statusText!=='sent'))continue;
      const order=ledger.find(r=>r.kind==='order'&&r.orderId===row.orderId);
      const shipped=ships.find(([,s])=>row.payoutId?s.payoutId===row.payoutId:order?.detail?.includes(`machine ${s.machineId}`));
      if(shipped){observedRows.current.add(row.id);scene.current?.confirmed('ada',Number(shipped[0]));}
    }
  },[ledger,progress]);
  const open=async(n:number)=>{sound.play('tap');await scene.current?.fly(n);onOpen(n);};
  return <section className="j-factory-view" data-testid="factory-view">
    <canvas ref={canvas} className="j-canvas" aria-hidden />
    <div className="j-factory-heading"><h1>Your factory</h1><p>Simulated customers · not real money</p><small>{customers} simulated purchases · {plots.filter(p=>p.state==='solved').length} machines running</small>{caption&&<p role="status">{caption}</p>}</div>
    <div ref={overlay} className="j-factory-map">
      {plots.map(p=><div className={`j-plot-label ${p.state}`} key={p.n} data-factory-anchor={`plot:${p.n}`}>
        <button disabled={p.state==='locked'} onClick={()=>void open(p.n)} data-testid={`plot-${p.n}`}>{p.state==='locked'?<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>:<Face id={JOBS[p.n-1].client} size={26}/>}<span><b>{p.n===5?'Your shop':`${p.n}. ${JOBS[p.n-1].title}`}</b><small>{p.state==='locked'?'Locked':p.state==='next'?'Next job':p.state==='solved'?'★'.repeat(p.stars)+' · Edit machine':'Build your shop'}</small></span></button>
        {p.shipped&&<a href={p.shipped.link??`/m/${p.shipped.machineId}`}>{api.mode==='mock'?'MOCK':'TESTNET'} · Open app ↗</a>}
      </div>)}
      {houses.map(id=><div className={`j-house-label house-${id}`} key={id} data-factory-anchor={`house:${id}`} data-testid={`house-${id}`}><b>{PEOPLE[id].name}{id==='chi'&&progress.solved[3]?' · Ethereum':''}</b><span>Sim: {fmtN(totals[id]?.near??0n)} NEAR{(totals[id]?.wei??0n)>0n?` · ${fmtE(totals[id]!.wei)} ETH`:''}</span><span>Real: {fmtN(real[id]?.near??0n)} NEAR{(real[id]?.wei??0n)>0n?` · ${fmtE(real[id]!.wei)} ETH`:''}</span>{id==='you'&&balance&&<span>Observed balance: {fmtN(BigInt(balance))} NEAR{api.mode==='mock'?' · MOCK':''}</span>}</div>)}
    </div>
  </section>;
}
