import { PRICE, PEOPLE, PORTAL_WEI, DEFAULT_RATE, type Build, type Ctx, type PersonId, type Job, type TestResult } from './jobs.js';
/** Full integer precision: never round a tooltip's money amount. */
export function exact(value:bigint, decimals=24):string { if(value<0n)return '-'+exact(-value,decimals); const unit=10n**BigInt(decimals); const frac=(value%unit).toString().padStart(decimals,'0').replace(/0+$/,'');return `${value/unit}${frac?'.'+frac:''}`; }
export function inflow(build:Build,id:string):bigint {
  if(id==='r')return BigInt(PRICE);
  const parent=id.slice(0,id.lastIndexOf('.')),port=id.slice(id.lastIndexOf('.')+1),p=build[parent],amount=inflow(build,parent);
  if(p?.kind==='Gate')return port==='k'?0n:amount;
  if(p?.kind!=='Splitter')return 0n;
  const shares=p.shares??[],parts=shares.map(s=>amount*BigInt(s)/100n);
  if(parts.length)parts[0]+=amount-parts.reduce((a,b)=>a+b,0n);
  return parts[Number(port)]??0n;
}
export function partReason(build:Build,id:string,ctx:Ctx={}):string {
 const p=build[id];if(!p)return 'Empty socket: place a part to route the money.';
 const a=exact(inflow(build,id));
 switch(p.kind) {
 case 'Splitter':return `Splitter ${(p.shares??[]).join('/')}: of ${a} NEAR, sends ${(p.shares??[]).map((_,i)=>`${exact(inflow(build,`${id}.${i}`))} to belt ${i+1}`).join(', ')}.`;
 case 'Gate':return `Gate: holds ${a} NEAR until ${build[`${id}.k`]?.person ? PEOPLE[build[`${id}.k`]!.person!].name+', the Key holder' : 'a configured Key holder (none is set)'}, says Delivered. After 100 blocks anyone can request the time-up exit; its wiring determines the refund.`;
 case 'Worker':if(!p.person)return 'Key: choose its holder; an unconfigured Key cannot approve delivery and receives no money.';return `Key: ${PEOPLE[p.person??'customer'].name} may approve this Gate; the Key receives no money. Live demo uses the player's scoped key.`;
 case 'Payout':if(!p.person)return `Payout: ${a} NEAR reaches this part, but no recipient is selected. Choose who it pays.`;return `Payout: requests ${a} NEAR for ${PEOPLE[p.person??'customer'].name}${p.person==='customer'?' (the payer refund)':''}. Real money counts only after confirmed settlement.`;
 case 'Vault':return `Vault: keeps ${a} NEAR for the machine owner. Withdrawal is a separate transaction.`;
 case 'Portal':return `Portal: uses ${a} NEAR as a fee (minimum ${exact(BigInt(p.wei??PORTAL_WEI)*BigInt(ctx.rate??DEFAULT_RATE))}); requests ${exact(BigInt(p.wei??PORTAL_WEI),18)} Sepolia ETH from the shared treasury, signed by NEAR. No currency conversion. Test is simulated.`;
 }
}
export function personReason(id:PersonId,result?:TestResult|null) {return `${PEOPLE[id].name}: current simulated preview receives ${exact(result?.totals?.near[id]??0n)} NEAR and ${exact(result?.totals?.wei[id]??0n,18)} ETH per delivered sale. Real totals require confirmed receipts.`;}
export function requirementReason(job:Job,id:string,result:TestResult|null,fix:string) {
 const req=job.requirements.find(r=>r.id===id); if(!req)return '';
 const check=result?.totals?req.check(result.totals):undefined;
 return check&&!check.ok?`${check.why} Change the part at ${fix} (inspect its Payout, Splitter dials or Gate exits).`:check?`${req.text}: ${check.amount}. Passed in the simulated Test.`:`${req.text}. Run Test to inspect exact amounts.`;
}
