import {launch} from './common.mjs';
import assert from 'node:assert/strict';
const browser=await launch(),base=process.env.UI_BASE??'http://localhost:4173';
try {
 for(const mode of ['ogg','mp3','procedural']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>{
   window.__sources=[];window.__oscillators=0;
   const Original=window.AudioContext;
   window.AudioContext=class extends Original {
    createBufferSource(){const source=super.createBufferSource();window.__sources.push(source);return source;}
    createOscillator(){window.__oscillators++;return super.createOscillator();}
   };
  });
  if(mode!=='ogg')await page.route('**/sounds/happy-clappy.ogg',r=>r.fulfill({status:404,body:''}));
  if(mode==='procedural')await page.route('**/sounds/happy-clappy.mp3',r=>r.fulfill({status:404,body:''}));
  await page.goto(base+'/?webgl=0');await page.getByTestId('start').click();await page.waitForTimeout(1800);
  const result=await page.evaluate(()=>({loops:window.__sources.filter(s=>s.loop).map(s=>({duration:s.buffer.duration,end:s.loopEnd})),oscillators:window.__oscillators}));
  if(mode==='procedural'){assert.equal(result.loops.length,0);assert.ok(result.oscillators>5,'procedural score starts after both files fail');}
  else{assert.equal(result.loops.length,2);for(const loop of result.loops){assert.ok(Math.abs(loop.duration-17.440635)<.001,'codec preserves exact loop length');assert.equal(loop.end,loop.duration);}assert.ok(result.oscillators<=1,'recorded music does not layer procedural voices');}
  console.log('PASS',mode,JSON.stringify(result));await page.close();
 }
}finally{await browser.close();}
