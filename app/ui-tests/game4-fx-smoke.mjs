import { launch, watchErrors } from './common.mjs';
const browser=await launch(), errors=[];
const BASE=process.env.UI_BASE ?? 'http://127.0.0.1:4261';
const OUT=new URL('../../docs/design/screens/',import.meta.url).pathname;
try {
 for(const [label,viewport] of [['desktop',{width:1366,height:800}],['phone',{width:390,height:844}]]) {
  const ctx=await browser.newContext({viewport}); const page=await ctx.newPage();watchErrors(page,errors);
  await page.addInitScript(()=>{const A=window.AudioContext;window.AudioContext=class extends A{constructor(){super();window.__audioContext=this;}};let scaled=false;setInterval(()=>{if(window.__ww2&&!scaled){window.__ww2.renderScale(.25);scaled=true;}},300);});
  const T=id=>page.locator(`[data-testid="${id}"]`);
  await page.goto(BASE+'/?step=1');await T('intro').waitFor({timeout:60000});
  await page.evaluate(()=>window.__ww2?.advance(4));
  if(await page.evaluate(()=>window.__ww2?.state().mode)!=='title')throw Error('title camera not active');
  await page.evaluate(()=>window.__ww2.renderScale(1));await page.screenshot({path:OUT+`g8-fx-title-${label}.png`});await page.evaluate(()=>window.__ww2.renderScale(.25));
  await T('start').click(); await page.waitForTimeout(200); if(await T('tutorial-skip').count()) await T('tutorial-skip').click();await page.waitForFunction(()=>window.__audioContext?.state==='running');
  await T('sound').click();
  await T('sound-popover').getByLabel('Music',{exact:true}).check();
  await T('sound-popover').getByLabel('Effects',{exact:true}).uncheck();
  await T('sound-popover').getByRole('button',{name:'Close',exact:true}).click();
  await page.reload();await T('sound').click();
  if(!await T('sound-popover').getByLabel('Music',{exact:true}).isChecked() || await T('sound-popover').getByLabel('Effects',{exact:true}).isChecked())throw Error('sound settings not persisted');
  await T('sound-popover').getByRole('button',{name:'Close',exact:true}).click();
  await T('menu').click();await T('menu-sheet').getByRole('button',{name:'Title screen',exact:true}).click();await T('intro').waitFor();
  await page.getByRole('button',{name:'How it works',exact:true}).click();await T('help-sheet').waitFor();await T('help-sheet').getByRole('button',{name:'Close',exact:true}).click();
  await T('start').click(); await page.waitForTimeout(200); if(await T('tutorial-skip').count()) await T('tutorial-skip').click();
  console.log(`ok ${label}: lit title, camera, gesture-unlocked audio context, sound settings persistence, title replay`);
  await ctx.close();
 }
 if(errors.length)throw Error(errors.join('\n'));console.log('RESULT: PASS; 0 console errors (audio context verified, no listening test)');
} finally {await browser.close();}
