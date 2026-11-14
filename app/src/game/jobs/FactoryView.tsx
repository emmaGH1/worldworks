import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import { useApp } from '../../lib/store';
import { JOBS, PEOPLE, fmtN, fmtE, type Ctx, type PersonId } from './jobs';
import { addTotals, confirmedPlots, plotsFor, realTotals, simulatedSale, type FactoryProgress, type HouseTotals } from './factory';
import { createFactoryScene } from './factoryScene';
import { Face } from './Face';
import { simClock } from './simClock';
import { exact, partReason } from './reasoning';
import { sound } from './sound';
export function FactoryView({progress,ctx,onOpen,caption,balance,storageKey,fast,setFast,live}:{progress:FactoryProgress;ctx:Ctx;onOpen:(n:number)=>void;caption:string;balance?:string;storageKey:string;fast:boolean;setFast:(value:boolean)=>void;live:boolean}) {
  const canvas=useRef<HTMLCanvasElement>(null), overlay=useRef<HTMLDivElement>(null);
  const contextRef=useRef(ctx);contextRef.current=ctx;
  const scene=useRef<ReturnType<typeof createFactoryScene>|null>(null);
  const ledgerRows=useApp(s=>s.ledger);
  const confirmedKey=useMemo(()=>[...confirmedPlots(ledgerRows,progress)].sort().join(','),[ledgerRows,progress]);
  const plots=useMemo(()=>{const ok=new Set(confirmedKey.split(',').filter(Boolean).map(Number));return plotsFor(progress).map(p=>({...p,confirmed:ok.has(p.n)}));},[progress,confirmedKey]);
  const [totals,setTotals]=useState<HouseTotals>(()=>{try {return JSON.parse(localStorage.getItem(storageKey)??'{}',(_k,v)=>typeof v==='string'&&/^\d+n$/.test(v)?BigInt(v.slice(0,-1)):v);}catch{return {};}});
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(totals,(_k,v)=>typeof v==='bigint'?`${v}n`:v));}catch{/* storage unavailable */}},[totals,storageKey]);
  const [intro,setIntro]=useState(()=>{try{return !localStorage.getItem(storageKey+'-meaning');}catch{return true;}});
  const totalsRef=useRef(totals);totalsRef.current=totals;
  const [shownTotals,setShownTotals]=useState(totals);
  const shownRef=useRef(totals);
  useEffect(()=>{const from=shownRef.current;let step=0;const timer=setInterval(()=>{step++;const next:HouseTotals={};for(const id of Object.keys(totals) as PersonId[]){const a=from[id]??{near:0n,wei:0n},b=totals[id]!;next[id]={near:a.near+(b.near-a.near)*BigInt(step)/4n,wei:a.wei+(b.wei-a.wei)*BigInt(step)/4n};}shownRef.current=next;setShownTotals(next);if(step===4)clearInterval(timer);},45);return()=>clearInterval(timer);},[totals]);
  const [customers,setCustomers]=useState(0);
  const [paused,setPaused]=useState(false), [flying,setFlying]=useState<number|null>(null);
  const flyEpoch=useRef(0);
  const nextPlot=plots.find(p=>p.state==='next')??plots.find(p=>p.state==='open')??plots.find(p=>p.n===5)!;
  const running=plots.filter(p=>p.state==='solved').length;
  const skipFly=()=>{const n=flying;if(n===null)return;try{localStorage.setItem('ww-skip-flight','1');}catch{/* unavailable */}flyEpoch.current++;setFlying(null);onOpen(n);};
  const ledger=useApp(s=>s.ledger);
  const real=useMemo(()=>realTotals(ledger,progress,ctx),[ledger,progress,ctx]);
  const houses=[...new Set<PersonId>(['ada','bola','chi','dayo','you',...(ctx.friends??[])])];
  const abroad=ctx.friends?.find(f=>!!ctx.evm?.[f]);
  useEffect(()=>{
    const sc=createFactoryScene(canvas.current!,overlay.current!,plots,abroad,api.mode!=='mock',()=>contextRef.current);scene.current=sc;sc.setTotals(totalsRef.current); // keep coin piles across rebuilds
    sound.ambience(true);
    return ()=>{sc.dispose();scene.current=null;sound.ambience(false);};
  },[plots,abroad]);
  const previewSales=useMemo(()=>plots.filter(p=>p.state==='solved').map(p=>simulatedSale(p.n,p.build,api,ctx)),[plots,ctx]);
  const previewTotal=useMemo(()=>previewSales.reduce(addTotals,{}),[previewSales]);
  useEffect(()=>{
    const sales=previewSales;
    let elapsed=5.85, last=performance.now();
    const timer=setInterval(()=>{const now=performance.now(),dt=(now-last)/1000;last=now;if(document.hidden||paused)return;elapsed+=simClock.delta(dt,true);if(elapsed<6)return;elapsed%=6;
      const incoming=sales.reduce(addTotals,{});scene.current?.arrive(incoming);sound.play('coin');
      // Persist the complete WASM sale immediately; only the displayed counter interpolates.
      setTotals(t=>addTotals(t,incoming));
      setCustomers(c=>c+sales.length);
    },50);
    return ()=>clearInterval(timer);
  },[plots,ctx,previewSales,paused]);
  useEffect(()=>{scene.current?.setTotals(totals);},[totals]);
  useEffect(()=>{scene.current?.setPaused(paused);},[paused,plots]);
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
  const open=async(n:number)=>{if(flying!==null)return;try{if(localStorage.getItem('ww-skip-flight')==='1'){onOpen(n);return;}}catch{/* unavailable */}const epoch=++flyEpoch.current;setFlying(n);sound.play('tap');await scene.current?.fly(n);if(epoch!==flyEpoch.current)return;setFlying(null);onOpen(n);};
  return <section className="j-factory-view" data-testid="factory-view">
    <canvas ref={canvas} className="j-canvas" aria-hidden onClick={skipFly} />{flying!==null&&<button className="j-skip-animation j-btn" data-testid="skip-fly" onClick={skipFly}>Skip flight →</button>}
    <div className="j-factory-heading"><h1>Your factory</h1>{!plots.some(p=>p.state==='solved')&&<p>Demo preview · solve a job to run your own machine</p>}<p>Endless simulated preview · nothing to wait for · not real money</p><div className="j-preview-controls"><button className="j-mini j-fast" data-testid="factory-fast-forward" aria-pressed={fast && !live} disabled={live} title={live?"Real transactions run at network speed":"Speeds simulated time only"} onClick={()=>setFast(!fast)}>⏩ 4×{fast&&!live?" · SIMULATED":""}</button><button className="j-mini" data-testid="pause-preview" aria-pressed={paused} onClick={()=>setPaused(v=>!v)}>{paused?'Resume preview':'Pause preview'}</button></div><small>{customers} simulated purchases · {running} simulated {running===1?'machine':'machines'} running</small>{intro&&<p className="j-counter-meaning">Real totals need confirmed receipts. <button aria-label="Dismiss counter explanation" onClick={()=>{setIntro(false);try{localStorage.setItem(storageKey+'-meaning','1');}catch{/* unavailable */}}}>×</button></p>}{caption&&<p role="status">{caption}</p>}</div>
    <button className="j-btn j-factory-next" data-testid="factory-next-action" onClick={()=>void open(nextPlot.n)}>{nextPlot.state==='solved'?'Open your shop':'Next job: '+JOBS[nextPlot.n-1].title} →<small>No need to wait for the preview</small></button><div ref={overlay} className="j-factory-map">
      {plots.map(p=><div className={`j-plot-label ${p.state}`} key={p.n} data-factory-anchor={`plot:${p.n}`}>
        <button disabled={p.state==='locked'} onClick={()=>void open(p.n)} title={p.state==='locked'?'Complete the preceding job to unlock':undefined} data-testid={`plot-${p.n}`} className={p.n===nextPlot.n?'j-next-plot':''}>{p.state==='locked'?<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>:<Face id={JOBS[p.n-1].client} size={26}/>}<span><b>{p.n===5?'Your shop':`${p.n}. ${JOBS[p.n-1].title}`}</b><small>{p.state==='locked'?'Locked':p.state==='next'?'Next job':p.state==='solved'?'★'.repeat(p.stars)+' · Edit machine':'Build your shop'}</small></span></button>
        {p.shipped&&<a href={p.shipped.link??`/m/${p.shipped.machineId}`}>{api.mode==='mock'?'MOCK':'⚑ TESTNET'} · Open app ↗</a>}
      </div>)}
      {plots.filter(p=>p.state==='solved').flatMap(p=>Object.entries(p.build).filter(([,part])=>part).map(([id])=><button key={`${p.n}:${id}`} className="j-factory-hit" aria-label={`Inspect ${p.build[id]!.kind}`} data-factory-anchor={`part:${p.n}:${id}`} data-reason={partReason(p.build,id,ctx)} />))}
      {houses.map(id=><div data-reason={`${PEOPLE[id].name}: one delivered simulated purchase at each running shop pays ${exact(previewTotal[id]?.near??0n)} NEAR and ${exact(previewTotal[id]?.wei??0n,18)} ETH. Real totals require confirmed receipts.`} className={`j-house-label house-${id}`} key={id} data-factory-anchor={`house:${id}`} data-testid={`house-${id}`}><b>{PEOPLE[id].name}{id==='chi'&&progress.solved[3]?' · Ethereum':''}</b><span>Sim: {fmtN(shownTotals[id]?.near??0n)} NEAR{(shownTotals[id]?.wei??0n)>0n?` · ${fmtE(shownTotals[id]!.wei)} ETH`:''}</span><span className="j-real-total">Real: {fmtN(real[id]?.near??0n)} NEAR{(real[id]?.wei??0n)>0n?` · ${fmtE(real[id]!.wei)} ETH`:''}</span>{id==='you'&&balance&&<span>Observed balance: {fmtN(BigInt(balance))} NEAR{api.mode==='mock'?' · MOCK':''}</span>}</div>)}
    </div>
  </section>;
}
