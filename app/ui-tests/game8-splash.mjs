// MOCK-only title/layout checks. No sessions, orders, or chain calls.
import {mkdirSync} from 'node:fs';
import {launch,watchErrors} from './common.mjs';
const base=process.env.UI_BASE??'http://localhost:4310';
const dir=new URL('../../docs/design/screens/',import.meta.url).pathname;mkdirSync(dir,{recursive:true});
const browser=await launch();const errors=[];
for(const width of [360,390,412,768,1366,1920]){
 const page=await browser.newPage({viewport:{width,height:width<500?844:width===768?1024:1080},deviceScaleFactor:1});watchErrors(page,errors);
 await page.goto(base+'/?lowfx=1&webgl=0');await page.getByTestId('intro').waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${dir}g8-splash-${width}.png`});
 const fit=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,start:document.querySelector('[data-testid=start]').getBoundingClientRect().toJSON(),logo:document.querySelector('.j-splash-logo').getBoundingClientRect().toJSON(),animations:[...document.querySelectorAll('.j-splash-art img,.j-splash-logo,.j-portal-glow')].map(el=>getComputedStyle(el).animationName)}));console.log(width,JSON.stringify(fit));if(fit.overflow || fit.start.right>width || fit.logo.right>width || fit.animations.some(a=>a!=='none'))throw Error('splash layout/motion regression');
 if(width===390){await page.getByRole('button',{name:'How it works'}).click();await page.getByTestId('help-sheet').waitFor();await page.getByTestId('help-sheet').getByRole('button',{name:'Close',exact:true}).click();await page.locator('body').click({position:{x:5,y:5}});await page.keyboard.press('Enter');await page.getByTestId('intro').waitFor({state:'detached'});}
 if(width===360){await page.getByTestId('start').click();await page.getByTestId('tutorial-skip').click();await page.getByTestId('card-go').click();await page.screenshot({path:`${dir}g8-topbar-360.png`});}
 if(width===412){
  await page.getByTestId('start').click();await page.getByTestId('tutorial-skip').click();
  await page.getByTestId('menu').click();await page.getByRole('button',{name:'Title screen',exact:true}).click();
  await page.getByRole('button',{name:'Continue: job 1',exact:true}).waitFor();await page.getByRole('button',{name:'Factory',exact:true}).click();await page.getByTestId('factory-view').waitFor();
 }
 await page.close();
}
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});watchErrors(page,errors);
await page.goto(base+'/?webgl=0');await page.getByTestId('intro').waitFor();
if(!await page.locator('.j-splash-logo').evaluate(e=>getComputedStyle(e).animationName==='none'))throw Error('reduced motion');
await page.goto(base+'/m/lemonade?webgl=0');await page.getByRole('banner').getByRole('button',{name:'Built in WORLDWORKS',exact:true}).waitFor();
await page.getByTestId('app-title').waitFor();await page.screenshot({path:`${dir}g8-standalone-390.png`});await page.close();
console.log('Errors',JSON.stringify(errors));await browser.close();if(errors.length)process.exitCode=1;
