// Normal-effects smoke: real pointer gesture, WebAudio scheduling, camera navigation, title resume. MOCK only.
import {launch,watchErrors} from './common.mjs';
import {writeFileSync} from 'node:fs';
const browser=await launch(),page=await browser.newPage({viewport:{width:1366,height:800}}),errors=[];watchErrors(page,errors);
const check=(v,m)=>{if(!v)throw Error(m);console.log('ok',m);};
await page.addInitScript(()=>{window.__audioStats={notes:0,contexts:[]};const Audio=window.AudioContext;window.AudioContext=class extends Audio {constructor(...args){super(...args);window.__audioStats.contexts.push(this);}createOscillator(){window.__audioStats.notes++;return super.createOscillator();}};setInterval(()=>window.__ww2?.renderScale(.25),500);});
await page.goto((process.env.UI_BASE??'http://127.0.0.1:4267')+'/?step=1');await page.getByTestId('intro').waitFor();
await page.evaluate(()=>{const S={uid:'s',kind:'Splitter',shares:[60,20,20]},P=(uid,person)=>({uid,kind:'Payout',person});localStorage.setItem('ww-jobs3-mock:mock-contract.testnet',JSON.stringify({intro:true,at:1,solved:{1:3},seen:{1:true},shipped:{},builds:{1:{r:S,'r.0':P('a','ada'),'r.1':P('b','bola'),'r.2':P('c','chi')}},friends:{f1:'',f2:'',done:false}}));});
await page.goto((process.env.UI_BASE??'http://127.0.0.1:4267')+'/');await page.getByTestId('factory-view').waitFor();
await page.getByTestId('sound').click();await page.getByTestId('sound-popover').getByLabel('Music',{exact:true}).check();await page.getByTestId('sound-popover').getByLabel('Effects',{exact:true}).check();await page.getByTestId('sound-popover').getByRole('button',{name:'Close'}).click();
await page.waitForTimeout(1800);const audio=await page.evaluate(()=>({notes:window.__audioStats.notes,states:window.__audioStats.contexts.map(c=>c.state)}));check(audio.notes>2&&audio.states.includes('running'),'gesture unlock schedules music/effects');
await page.getByTestId('plot-2').click();await page.getByTestId('job-card').waitFor();check(await page.getByTestId('jobs-game').getAttribute('data-job')==='2','normal camera enters job 2');await page.getByTestId('card-go').click();
await page.getByTestId('menu').click();await page.getByTestId('menu-sheet').getByRole('button',{name:'Title screen'}).click();check(await page.getByTestId('start').innerText()==='Continue: job 2','title resumes current job');await page.getByTestId('start').click();check(await page.getByTestId('jobs-game').getAttribute('data-job')==='2','Continue keeps job 2');
await page.getByTestId('factory-home').click();await page.getByTestId('factory-view').waitFor();const info=await page.evaluate(()=>window.__wwFactory.info());check(info.calls<150&&info.triangles<120000,'normal factory renderer budget');
check(errors.length===0,JSON.stringify(errors));writeFileSync(new URL('../../docs/game6-normal.json',import.meta.url),JSON.stringify({audio,info,errors},null,2));await browser.close();console.log('PASS normal effects');
