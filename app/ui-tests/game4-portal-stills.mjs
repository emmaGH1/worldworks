// Ship a real MOCK order through the adapter for final Portal/wait stills. Never selects live mode.
import {launch,watchErrors} from './common.mjs';
const BASE=process.env.UI_BASE??'http://127.0.0.1:4261',OUT=new URL('../../docs/design/screens/',import.meta.url).pathname;
const browser=await launch(), errors=[];
try{
 for(const [label,viewport] of [['desktop',{width:1366,height:800}],['phone',{width:390,height:844}]]){
  const ctx=await browser.newContext({viewport}),page=await ctx.newPage();watchErrors(page,errors);const T=id=>page.locator(`[data-testid="${id}"]`);
  await page.addInitScript(()=>{
   localStorage.setItem('ww-jobs3-mock:mock-contract.testnet',JSON.stringify({intro:true,at:3,seen:{3:true},solved:{1:3,2:3,3:3},builds:{3:{r:{uid:'a',kind:'Splitter',shares:[75,20,5]},'r.0':{uid:'b',kind:'Payout',person:'ada'},'r.1':{uid:'c',kind:'Payout',person:'bola'},'r.2':{uid:'d',kind:'Splitter',shares:[90,10]},'r.2.0':{uid:'e',kind:'Payout',person:'ada'},'r.2.1':{uid:'f',kind:'Portal',wei:'500000000000000'}}}}));
   let scaled=false;setInterval(()=>{if(window.__capture)return;const w=window.__ww2;if(!w)return;if(!scaled){w.renderScale(.25);scaled=true;}w.advance(.5);},200);
  });
  const shot=async name=>{await page.waitForTimeout(150);await page.evaluate(()=>{window.__capture=true;window.__ww2.advance(2);window.__ww2.renderScale(1);});await page.screenshot({path:OUT+`g4-${name}-${label}.png`});await page.evaluate(()=>{window.__ww2.renderScale(.25);window.__capture=false;});};
  await page.goto(BASE+'/?step=1&lowfx=1');await T('ship').waitFor();
  if(!(await page.locator('.j-pills').innerText()).includes('MOCK'))throw Error('Expected MOCK only');
  await T('ship').click();await T('portal-moment').waitFor({timeout:60000});
  await T('wait-toggle').click();await shot('wait-signing');await T('wait-toggle').click();await shot('portal-moment');
  await page.waitForFunction(()=>document.querySelector('[data-testid=portal-moment]')?.getAttribute('data-status')==='broadcast',null,{timeout:60000});await shot('portal-beam');
  await page.waitForFunction(()=>document.querySelector('[data-testid=portal-moment]')?.getAttribute('data-status')==='confirmed',null,{timeout:60000});await shot('portal-gem');
  await T('moment-close').click();await shot('portal-receipts');console.log(`ok ${label}: MOCK signing, beam, confirmed gem, wait history, receipts`);await ctx.close();
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('RESULT: PASS; 0 console errors; MOCK only');
}finally{await browser.close();}
