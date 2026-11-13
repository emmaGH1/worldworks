// One real TESTNET shipment, job 2 only. Never buys from the resulting standalone shop.
import {launch,watchErrors} from './common.mjs';
import {readFileSync,writeFileSync,chmodSync} from 'node:fs';
const BASE=process.env.UI_BASE??'http://127.0.0.1:4252';
const stateFile=process.env.UI_STORAGE_STATE??'/opt/ww-secrets/game-live-seed-state.json';
const saved=JSON.parse(readFileSync(stateFile,'utf8'));
const browser=await launch();const errors=[];let orders=0;let proof;
const ctx=await browser.newContext({viewport:{width:1366,height:800}});
const page=await ctx.newPage();watchErrors(page,errors);page.setDefaultTimeout(30000);
// Copy only existing session credentials to this test origin. Never print or write them into evidence.
const entries=(saved.origins??[]).flatMap(o=>o.localStorage).filter(x=>x.name.startsWith('worldworks.testnet.'));
await page.addInitScript(entries=>{if(!sessionStorage.getItem('g2-seeded')){for(const x of entries)localStorage.setItem(x.name,x.value);sessionStorage.setItem('g2-seeded','yes');}},entries);
page.on('request',r=>{if(r.url().endsWith('/api/customer'))orders++;});
page.on('response',async r=>{if(r.url().endsWith('/api/payout')){try{const p=await r.json();if(p.status==='confirmed')proof=p;}catch{}}});
if (process.env.UI_ADVANCE === '1') await page.addInitScript(() => { let scaled=false; setInterval(() => { const w=window.__ww2; if(!w)return; if(!scaled){w.renderScale?.(0.5);scaled=true;} if(w.state().coins)w.advance(0.6); },600); });
const T=id=>page.locator(`[data-testid="${id}"]`);
const check=(v,m)=>{if(!v)throw Error(m);console.log('ok',m);};
try{
 await page.goto(BASE+'/?job=2&lowfx=1');await T('start').click();
 await T('tray-Portal').click();await T('socket-end2').click();
 await T('test').click();await T('ship').waitFor({timeout:180000});
 await page.evaluate(()=>window.__ww2?.renderScale?.(1));
 await page.screenshot({path:new URL('../../docs/design/screens/g2-live-test-pass-desktop.png',import.meta.url).pathname});
 if(process.env.UI_ADVANCE === '1')await page.evaluate(()=>window.__ww2?.renderScale?.(0.5));
 await T('ship').click();
 await Promise.race([T('live-link').waitFor({timeout:300000}), T('ship-error').waitFor({timeout:300000}).then(async()=>{throw Error(await T('ship-error').innerText());})]);
 check(orders===1,'exactly one seeded-customer order request');
 check(proof?.confirmations?.length===2,'confirmed by two RPCs');
 check(new Set(proof.confirmations.map(p=>new URL(p.rpc).hostname)).size===2,'independent RPC hosts');
 check(proof.confirmations.every(p=>p.status===1 && p.hash===proof.evmTx.hash && BigInt(p.depth)>=3n),'matching successful receipts, 3+ blocks deep');
 check(await T('receipt-chi').locator('a[href^="https://sepolia.etherscan.io/tx/"]').count()===1,'Chi has a real Sepolia receipt');
 const run=await page.evaluate(()=>JSON.parse(Object.entries(localStorage).find(([k])=>k.startsWith('ww-jobs-run-live:'))?.[1]??'null'));
 const publicEvidence={machineId:run.machineId,orderId:run.orderId,publishTx:run.publishTx,orderTx:run.orderTx,payout:proof,orders};
 writeFileSync('/tmp/g2-live-evidence.json',JSON.stringify(publicEvidence,null,2));
 console.log(JSON.stringify(publicEvidence));
 await page.waitForTimeout(1600);await page.evaluate(()=>window.__ww2?.renderScale?.(1));await page.screenshot({path:new URL('../../docs/design/screens/g2-live-portal-gem-desktop.png',import.meta.url).pathname});
 await ctx.storageState({path:'/opt/ww-secrets/game2-live-state.json'});chmodSync('/opt/ww-secrets/game2-live-state.json',0o600);
 const href=await T('open-shop').getAttribute('href');await page.goto(BASE+href+'?lowfx=1');await T('shop-title').waitFor();
 await page.screenshot({path:new URL('../../docs/design/screens/g2-live-shop-desktop.png',import.meta.url).pathname});
 check(errors.length===0,'0 console errors');console.log('RESULT: PASS');
}catch(e){console.log('RESULT: FAIL',e.message);console.log(await page.locator('body').innerText());await page.screenshot({path:'/tmp/g2-live-fail.png'});process.exitCode=1;}
finally{await ctx.storageState({path:'/opt/ww-secrets/game2-live-state.json'});chmodSync('/opt/ww-secrets/game2-live-state.json',0o600);await browser.close();console.log('console errors:',errors.length);for(const e of errors)console.log(e);}
