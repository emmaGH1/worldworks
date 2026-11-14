// Local MOCK only. Real playthrough plus history/skip/audio regression checks.
import {launch,watchErrors} from './common.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.UI_BASE??'http://localhost:4173',dir=new URL('../../docs/game9/',import.meta.url).pathname;
mkdirSync(dir,{recursive:true});const browser=await launch(),errors=[],results=[];
try {
for(const [width,height] of [[1366,768],[390,844]]){
 const page=await browser.newPage({viewport:{width,height},hasTouch:width<500});page.setDefaultTimeout(15000);watchErrors(page,errors);
 const T=id=>page.getByTestId(id),shot=name=>page.screenshot({path:`${dir}${width}-${name}.png`});
 await page.addInitScript(()=>{setInterval(()=>window.__ww2?.advance(.5),80);});
 await page.goto(base+'/?webgl=0&step=1');await T('intro').waitFor();await shot('splash');await page.keyboard.press('x');await T('tutorial-skip').waitFor();await shot('skip-tutorial');await T('tutorial-skip').click();await T('card-go').click();
 const absent=async id=>assert.equal(await T(id).count(),0,id+' closed');
 // Three dismissal modes on each HUD overlay, with browser Back remaining in the game.
 for(const id of ['menu-sheet','sound-popover','help-sheet','level-list','ledger'])for(const mode of ['escape','outside','back']){
  if(id==='menu-sheet')await T('menu').click();
  else if(id==='sound-popover')await T('sound').click();
  else {await T('menu').click();await T('menu-sheet').getByRole('button',{name:id==='help-sheet'?/Help/:id==='level-list'?'Jobs':'Real transactions',exact:id!=='help-sheet'}).click();}
  await T(id).waitFor();if(id==='sound-popover'&&mode==='escape')await shot('sound');
  if(mode==='escape')await page.keyboard.press('Escape');else if(mode==='outside')await page.mouse.click(width-3,height-3);else await page.goBack();
  await T(id).waitFor({state:'detached'});assert.equal(new URL(page.url()).pathname,'/');
 }
 await shot('overlay-closed');
 // actual pointer placement and dial actions
 const place=async(k,s)=>{await T('tray-'+k).first().click();await T('socket-'+s).click();};
 const pay=async(s,p)=>{await place('Payout',s);await T('who-'+p).click();};
 const split=async(s,w)=>{await place('Splitter',s);while(await T('sheet').locator('[data-testid^=share-][data-testid$=-minus]').count()<w.length)await T('belt-add').click();for(let i=0;i<w.length;i++){let v=Number((await T('share-'+i).locator('b').innerText()).replace('%',''));while(v!==w[i]){await T(`share-${i}-${v<w[i]?'plus':'minus'}`).click();v+=v<w[i]?5:-5;}}await T('sheet-done').click();};
 const test=async()=>{await T('test').click();await T('skip-test').waitFor();await shot('skip-test');await T('skip-test').click();};
 await split('r',[60,20,20]);await pay('r.0','ada');await pay('r.1','bola');await pay('r.2','chi');await test();await T('factory-view').waitFor();
 assert.match(await T('factory-next-action').innerText(),/Ada steps back/);assert.match(await T('factory-view').innerText(),/1 simulated machine running/);assert.match(await T('house-ada').innerText(),/Real: 0 NEAR/);await shot('factory-cta');
 await T('pause-preview').click();assert.equal(await T('pause-preview').getAttribute('aria-pressed'),'true');await T('factory-next-action').click();await T('card-go').click();
 await split('r',[50,50]);await pay('r.0','ada');await split('r.1',[75,25]);await pay('r.1.0','bola');await pay('r.1.1','chi');await test();await T('ship').waitFor();await T('skip-ship').click();await T('card-go').click();
 await split('r',[75,20,5]);await pay('r.0','ada');await pay('r.1','bola');await split('r.2',[90,10]);await pay('r.2.0','ada');await place('Portal','r.2.1');await T('sheet-done').click();await test();await T('ship').waitFor();
 // Mock API is local; never submits to testnet.
 await T('ship').click();await T('portal-moment').waitFor({timeout:60000});await shot('skip-portal');await T('skip-portal').click();await T('portal-moment').waitFor({state:'detached'});await T('factory-home').click();await T('factory-next-action').click();await T('card-go').click();
 assert.equal(await T('jobs-game').getAttribute('data-job'),'4');
 await split('r',[80,20]);await pay('r.0','ada');await place('Gate','r.1');await place('Worker','r.1.k');await T('who-customer').click();await pay('r.1.p','dayo');await pay('r.1.f','customer');await T('test').click();await T('tap-approve').waitFor();await shot('skip-gate-wait');await page.keyboard.press('Escape');await T('tap-approve').waitFor({state:'detached'});await T('ship').waitFor();await T('skip-ship').click();await T('shop-go').click();
 await place('Payout','r');await T('who-you').click();await test();await T('ship').waitFor();await shot('job5');
 await T('factory-home').click();await T('factory-view').waitFor();assert.match(await T('factory-next-action').innerText(),/Open your shop/);
 // Direct shop fixture uses an existing mock machine; it does not create a real session.
 const machine=await page.evaluate(()=>JSON.parse(localStorage.getItem('ww-jobs3-mock:mock-contract.testnet')).shipped[3]?.machineId??JSON.parse(localStorage.getItem('ww-jobs3-run-mock:mock-contract.testnet'))?.machineId);assert.ok(machine,'Mock job 3 published an actual machine');await page.goto(base+'/m/'+machine);await T('app-title').waitFor();await shot('shop');assert.match(await page.locator('.g-app-brand').innerText(),/Back to game/);
 results.push({width,height,playthrough:'jobs 1–5 played with real UI and WASM checks; animations skipped',overlayModes:'Esc/outside/Back on menu, sound, help, jobs, ledger'});await page.close();
}
assert.equal(errors.length,0,errors.join('\n'));writeFileSync(dir+'results.json',JSON.stringify({results,errors},null,2));console.log('PASS GAME-9',JSON.stringify(results));
}finally{await browser.close();}
