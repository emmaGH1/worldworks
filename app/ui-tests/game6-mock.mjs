// GAME-6: actual first-two-job play; fixture-only overview captures are identified below. No chain calls.
import {launch,watchErrors} from './common.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.UI_BASE??'http://127.0.0.1:4266';
const DIR=new URL('../../docs/design/screens/',import.meta.url).pathname;mkdirSync(DIR,{recursive:true});
const errors=[],metrics=[];
process.on('uncaughtException',async e=>{console.error(e);if(globalThis.page){console.error(await globalThis.page.locator('body').innerText());await globalThis.page.screenshot({path:'/tmp/g6-failed.png'});}process.exit(1);});
const check=(v,m)=>{if(!v)throw Error(m);console.log('ok',m);};
for(const width of (process.env.UI_WIDTH?[Number(process.env.UI_WIDTH)]:[1366,1920,390])) for(const fallback of (process.env.UI_FALLBACK?[process.env.UI_FALLBACK==='1']:[false,true])) {
 const browser=await launch(),page=await browser.newPage({viewport:{width,height:width<500?844:1080},deviceScaleFactor:1});watchErrors(page,errors);globalThis.page=page;
 const label=`${width}${fallback?'-2d':''}`;
 const T=id=>page.getByTestId(id);
 await page.addInitScript(()=>{setInterval(()=>{window.__ww2?.renderScale?.(.25);window.__ww2?.advance(.8);window.__wwFactory?.advance(.8);},150);});
 console.log('start',label);
 await page.goto(`${BASE}/?lowfx=1&step=1${fallback?'&webgl=0':''}`);
 await T('intro').waitFor();await page.screenshot({path:`${DIR}g6-title-${label}.png`});await T('start').click();await T('tutorial').waitFor();check(await T('jobs-game').getAttribute('data-job')==='1',label+' tutorial job 1');await T('tutorial-skip').click();await T('card-go').click();
 check(!await T('job-card').count(),label+' card collapses');
 await page.screenshot({path:`${DIR}g6-topbar-${label}.png`});
 if(width===390&&!fallback){await page.setViewportSize({width:360,height:844});await page.screenshot({path:`${DIR}g6-topbar-360.png`});const boxes=await page.locator('.j-top button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height};}));check(boxes.every(r=>r.x>=0&&r.right<=360&&r.height>=44),'360 HUD fits and touch targets');await page.setViewportSize({width:390,height:844});}
 const place=async(k,s)=>{await T(`tray-${k}`).first().click();await T(`socket-${s}`).click();};
 const pay=async(s,p)=>{await place('Payout',s);await T(`who-${p}`).click();};
 const split=async(s,w)=>{await place('Splitter',s);if(w.length===3)await T('belt-add').click();for(let i=0;i<w.length;i++){let current=Number((await T(`share-${i}`).locator('b').innerText()).replace('%',''));while(current!==w[i]){await T(`share-${i}-${current<w[i]?'plus':'minus'}`).click();current+=current<w[i]?5:-5;}}await T('sheet-done').click();};
 await split('r',[60,20,20]);await pay('r.0','ada');await pay('r.1','bola');await pay('r.2','chi');await T('test').click();await T('factory-view').waitFor({timeout:90000});
 check((await T('factory-view').innerText()).includes('1 machines running'),label+' solved pulls out');
 await page.screenshot({path:`${DIR}g6-factory-one-${label}.png`});
 await T('plot-2').click();await T('card-go').click();if(await page.locator('.j-new-hint button').count())await page.locator('.j-new-hint button').click();
 await split('r',[50,50]);await pay('r.0','ada');await split('r.1',[75,25]);await pay('r.1.0','bola');await pay('r.1.1','chi');await T('test').click();await T('ship').waitFor({timeout:90000});
 await T('menu').click();await T('help').click();await T('help-sheet').waitFor();check(await T('jobs-game').getAttribute('data-job')==='2',label+' contextual help stays job 2');await page.screenshot({path:`${DIR}g6-help-${label}.png`});await T('help-sheet').getByRole('button',{name:'Show me again'}).click();check(await page.locator('.j-new-hint').count()===1,label+' job 2 hint replay');await page.locator('.j-new-hint button').click();
 await T('menu').click();for(const name of ['Jobs','Real transactions','Help','Replay tutorial','Restart this job','Title screen','Close'])check(await T('menu-sheet').getByRole('button',{name,exact:true}).count()===1,label+' menu '+name);await T('menu-sheet').getByRole('button',{name:'Close',exact:true}).click();
 await T('sound').click();await T('sound-popover').getByLabel('Music',{exact:true}).check();await T('sound-popover').getByLabel('Effects',{exact:true}).uncheck();await T('sound-popover').getByRole('slider').fill('0.3');await page.screenshot({path:`${DIR}g6-sound-${label}.png`});await T('sound-popover').getByRole('button',{name:'Close'}).click();
 await T('factory-home').click();await T('factory-view').waitFor();check((await T('factory-view').innerText()).includes('2 machines running'),label+' two machines persist');
 await page.waitForTimeout(6200);check(!(await T('house-ada').innerText()).includes('Sim: 0 NEAR'),label+' simulated totals advance');check((await T('house-ada').innerText()).includes('Real: 0 NEAR'),label+' no fabricated real totals');
 await page.screenshot({path:`${DIR}g6-factory-two-${label}.png`});metrics.push({label,...await page.evaluate(()=>window.__wwFactory.info())});
 await page.reload();await T('factory-view').waitFor();check(!(await T('house-ada').innerText()).includes('Sim: 0 NEAR'),label+' simulation persists across reload');await T('sound').click();check(await T('sound-popover').getByLabel('Music',{exact:true}).isChecked(),label+' music persists');check(!await T('sound-popover').getByLabel('Effects',{exact:true}).isChecked(),label+' effects persist');check(await T('sound-popover').getByRole('slider').inputValue()==='0.3',label+' volume persists');await T('sound-popover').getByRole('button',{name:'Close'}).click();
 // Fresh/all-five stills use owner-local progress fixtures, never fabricated receipts or API states.
 for(const state of ['fresh','all']) {
 await page.evaluate(state=>{const key='ww-jobs3-mock:mock-contract.testnet',p=JSON.parse(localStorage.getItem(key));if(state==='fresh'){p.solved={};p.builds={};localStorage.removeItem('ww-factory6-mock:mock-contract.testnet');}else{const S=(uid,shares)=>({uid,kind:'Splitter',shares}),P=(uid,person)=>({uid,kind:'Payout',person});p.solved={1:3,2:3,3:3,4:3,5:3};p.builds[1]={r:S('s',[60,20,20]),'r.0':P('a','ada'),'r.1':P('b','bola'),'r.2':P('c','chi')};p.builds[2]={r:S('s',[50,50]),'r.0':P('a','ada'),'r.1':S('s2',[75,25]),'r.1.0':P('b','bola'),'r.1.1':P('c','chi')};p.builds[3]={r:S('s',[20,80]),'r.0':P('b','bola'),'r.1':S('s2',[5,95]),'r.1.0':{uid:'o',kind:'Portal',wei:'500000000000000'},'r.1.1':P('a','ada')};p.builds[4]={r:S('s',[80,20]),'r.0':P('a','ada'),'r.1':{uid:'g',kind:'Gate'},'r.1.k':{uid:'k',kind:'Worker',person:'customer'},'r.1.p':P('d','dayo'),'r.1.f':P('c','customer')};p.builds[5]={r:P('y','you')};p.friends.done=true;}localStorage.setItem(key,JSON.stringify(p));},state);
 await page.reload();if(state==='fresh'){if(await T('job-card').isVisible())await T('card-go').click();await T('factory-home').click();}await T('factory-view').waitFor();await page.waitForTimeout(300);await page.screenshot({path:`${DIR}g6-factory-${state}-${label}.png`});const info=await page.evaluate(()=>window.__wwFactory.info());check(info.calls<150&&info.triangles<120000,label+' renderer budget '+state);metrics.push({label,state,...info});
 }
 await browser.close();
}
writeFileSync(new URL('../../docs/game6-ui.json',import.meta.url),JSON.stringify({errors,metrics},null,2));check(errors.length===0,JSON.stringify(errors));console.log('PASS GAME-6');
