// New-player guide in both renderers. MOCK only; screenshots are WebGL unless named fallback.
import { launch, watchErrors } from './common.mjs';
const BASE=process.env.UI_BASE??'http://127.0.0.1:4261', OUT=new URL('../../docs/design/screens/',import.meta.url).pathname;
const errors=[], browser=await launch();
const check=(v,m)=>{if(!v)throw Error(m);console.log('ok',m);};
try {
 for(const mode of ['webgl','fallback']) for(const [label,viewport] of [['desktop',{width:1366,height:800}],['phone',{width:390,height:844}]]) {
  const ctx=await browser.newContext({viewport});const page=await ctx.newPage();watchErrors(page,errors);page.setDefaultTimeout(30000);
  await page.addInitScript(()=>setInterval(()=>{if(window.__capture)return;window.__ww2?.renderScale?.(.25);window.__ww2?.advance?.(.8);},100));
  const T=id=>page.locator(`[data-testid="${id}"]`);
  const guide=async target=>{await page.waitForFunction(t=>document.querySelector('[data-testid=tutorial]')?.getAttribute('data-guide-target')===t,target);};
  const shot=async name=>{if(mode!=='webgl')return;await page.evaluate(()=>{window.__capture=true;window.__ww2?.renderScale?.(1);window.__ww2?.advance?.(.01);});await page.screenshot({path:OUT+`g4-${name}-${label}.png`});await page.evaluate(()=>{window.__capture=false;});};
  await page.goto(BASE+'/?step=1&lowfx=1'+(mode==='fallback'?'&webgl=0':''));await T('start').click();await guide('job-card');
  const before=await T('jobs-game').getAttribute('data-next');await page.mouse.click(4,400);check(await T('jobs-game').getAttribute('data-next')===before,`${mode} ${label}: outside spotlight is inert`);
  await T('card-go').click();await guide('tray-Splitter');await shot('tutorial-spotlight');
  await T('tray-Splitter').first().click();await guide('socket-r');await T('socket-r').click();await guide('belt-add');await T('belt-add').click();await guide('sheet');await T('sheet-done').click();
  for(const [i,person] of ['ada','bola','chi'].entries()) {await guide('tray-Payout');await T('tray-Payout').first().click();await guide(`socket-r.${i}`);await T(`socket-r.${i}`).click();await guide(`who-${person}`);await T(`who-${person}`).click();}
  await guide('test');await T('test').click();await guide('fail-why');await shot('tutorial-fail');await T('fail-why').click();await guide('socket-r');await T('socket-r').click();await guide('sheet');
  for(let i=0;i<4;i++)await T('share-0-plus').click();for(let i=1;i<3;i++)for(let j=0;j<2;j++)await T(`share-${i}-minus`).click();await T('sheet-done').click();await guide('test');await T('test').click();await guide('ship');
  await page.waitForFunction(()=>/ [1-9][0-9]* customers/.test(document.querySelector('[data-testid=factory-counter]')?.textContent??''));
  check((await T('factory-counter').innerText()).includes('Ada 0.06'),`${mode} ${label}: simulated factory totals accumulate`);
  if(mode==='webgl'&&label==='desktop'){await page.setViewportSize({width:1920,height:1080});await T('tutorial').evaluate(e=>e.style.visibility='hidden');await shot('factory-1920');await T('tutorial').evaluate(e=>e.style.visibility='');await page.setViewportSize(viewport);}
  await T('ship').click();await T('inside-machine').waitFor();await shot('wait-order');
  await T('live-link').waitFor();check(await T('tutorial').count()===0,`${mode} ${label}: Ship completes guide`);
  await T('help').click();await T('start').click();await T('tutorial-skip').waitFor();await T('tutorial-skip').click();check(await T('tutorial').count()===0,`${mode} ${label}: replay is skippable`);
  await ctx.close();
 }
 check(errors.length===0,errors.join('\n'));console.log('RESULT: PASS; 0 console errors');
}finally{await browser.close();}
