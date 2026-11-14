import {launch} from './common.mjs';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const b=await launch(),base=process.env.UI_BASE??'http://localhost:4173',dir=new URL('../../docs/game9/',import.meta.url).pathname,stats=[];
try{
for(const [width,height] of [[1366,768],[1920,1080],[390,844]]){
 const p=await b.newPage({viewport:{width,height}});
 await p.addInitScript(()=>{
  const Original=window.AudioContext;
  window.__audio={peak:0,sum:0,n:0};window.__gains=[];
  window.AudioContext=class extends Original{
   createBufferSource(){const s=super.createBufferSource();(window.__musicLoops??=[]).push(s);return s;}
   createGain(){const g=super.createGain();window.__gains.push(g);return g;}
   createDynamicsCompressor(){const c=super.createDynamicsCompressor(),proc=this.createScriptProcessor(1024,2,2),connect=c.connect.bind(c);c.connect=(dest)=>{connect(proc);proc.connect(dest);return dest;};proc.onaudioprocess=e=>{for(let ch=0;ch<2;ch++){const input=e.inputBuffer.getChannelData(ch),output=e.outputBuffer.getChannelData(ch);output.set(input);for(const v of input){window.__audio.peak=Math.max(window.__audio.peak,Math.abs(v));window.__audio.sum+=v*v;window.__audio.n++;}}};return c;}
  };
 });
 await p.goto(base+'/?step=1');await p.getByTestId('start').click();await p.getByTestId('tutorial-skip').click();await p.getByTestId('card-go').click();
 await p.waitForTimeout(6500);assert.equal(await p.evaluate(()=>window.__musicLoops?.filter(s=>s.loop).length??0),2,'recorded synchronized loop layers loaded');assert.deepEqual((await p.evaluate(()=>window.__gains.slice(0,3).map(g=>Math.round(g.gain.value*100)/100))),[.8,.7,.85]);stats.push({width,mode:'default build mix',...await p.evaluate(()=>window.__audio)});
 await p.getByTestId('sound').click();await p.getByLabel('Volume',{exact:true}).fill('1');await p.getByLabel('Effects volume',{exact:true}).fill('1');await p.getByLabel('Music volume',{exact:true}).fill('1');await p.getByRole('button',{name:'Close',exact:true}).click();
 await p.evaluate(()=>{window.__audio={peak:0,sum:0,n:0};});
 for(let i=0;i<8;i++){await p.getByTestId('sound').click();await p.getByRole('button',{name:'Close',exact:true}).click();await p.waitForTimeout(100);}
 await p.waitForTimeout(4000);stats.push({width,mode:'100% all buses with UI effects',...await p.evaluate(()=>window.__audio)});
 await p.evaluate(()=>{localStorage.setItem('ww-jobs3-mock:mock-contract.testnet',JSON.stringify({intro:true,at:1,seen:{1:true},solved:{1:3},shipped:{},friends:{done:true,f1:'',f2:''},builds:{1:{r:{uid:'s',kind:'Splitter',shares:[60,20,20]},'r.0':{uid:'a',kind:'Payout',person:'ada'},'r.1':{uid:'b',kind:'Payout',person:'bola'},'r.2':{uid:'c',kind:'Payout',person:'chi'}}}}));});
 await p.goto(base+'/');await p.getByTestId('factory-view').waitFor();await p.waitForTimeout(900);
 const boxes=await p.locator('.j-plot-label').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y,`plot labels ${i+1}/${j+1} collide at ${width}`);}
 await p.screenshot({path:dir+`game10-${width}-factory-3d.png`});
 await p.getByTestId('sound').click();await p.screenshot({path:dir+`game10-${width}-sound-3d.png`});await p.keyboard.press('Escape');await p.screenshot({path:dir+`game10-${width}-closed-3d.png`});
 await p.clock.install();await p.clock.pauseAt(new Date(Date.now()+1000));await p.getByTestId('factory-next-action').click();const skip=p.getByTestId('skip-fly');assert.equal(await skip.isVisible(),true,'Fly has a visible skip');if(await skip.isVisible()){await p.screenshot({path:dir+`game10-${width}-skip-fly.png`});await skip.click();assert.equal(await p.evaluate(()=>localStorage.getItem('ww-skip-flight')),'1');}await p.getByTestId('job-card').waitFor();
 await p.close();
}
const fallback=await b.newPage();let mp3=0;await fallback.route('**/sounds/*.ogg',r=>r.fulfill({status:404,body:''}));fallback.on('response',r=>{if(r.url().endsWith('.mp3')&&r.status()===200)mp3++;});await fallback.goto(base+'/?webgl=0');await fallback.getByTestId('start').click();await fallback.waitForTimeout(1200);assert.equal(mp3,11,'Every OGG has a working MP3 fallback');await fallback.close();console.log('PASS MP3 fallback: 11/11');
for(const s of stats){assert.ok(s.peak<=1,`mix clips at ${s.width}/${s.mode}: ${s.peak}`);s.peakDb=20*Math.log10(s.peak);s.rmsDb=10*Math.log10(s.sum/s.n);delete s.sum;}writeFileSync(dir+'game10-audio-metrics.json',JSON.stringify(stats,null,2));console.log(JSON.stringify(stats));
}finally{await b.close();}
