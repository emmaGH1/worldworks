// Explicit saved-progress fixtures, no orders or session creation. Refresh overview stills only.
import {launch,watchErrors} from './common.mjs';
import {writeFileSync} from 'node:fs';
const errors=[],metrics=[];const browser=await launch();
for(const width of [1920,390])for(const fallback of [false,true])for(const state of ['fresh','two','all']) {
 const page=await browser.newPage({viewport:{width,height:width===390?844:1080},deviceScaleFactor:1});watchErrors(page,errors);
 await page.goto((process.env.UI_BASE??'http://127.0.0.1:4267')+'/?lowfx=1&step=1'+(fallback?'&webgl=0':''));
 await page.getByTestId('jobs-game').waitFor();
 await page.evaluate(state=>{const S=(uid,shares)=>({uid,kind:'Splitter',shares}),P=(uid,person)=>({uid,kind:'Payout',person});const builds={1:{r:S('s',[60,20,20]),'r.0':P('a','ada'),'r.1':P('b','bola'),'r.2':P('c','chi')},2:{r:S('s',[50,50]),'r.0':P('a','ada'),'r.1':S('s2',[75,25]),'r.1.0':P('b','bola'),'r.1.1':P('c','chi')},3:{r:S('s',[20,80]),'r.0':P('b','bola'),'r.1':S('s2',[5,95]),'r.1.0':{uid:'o',kind:'Portal',wei:'500000000000000'},'r.1.1':P('a','ada')},4:{r:S('s',[80,20]),'r.0':P('a','ada'),'r.1':{uid:'g',kind:'Gate'},'r.1.k':{uid:'k',kind:'Worker',person:'customer'},'r.1.p':P('d','dayo'),'r.1.f':P('c','customer')},5:{r:P('y','you')}};const solved=state==='fresh'?{}:state==='two'?{1:3,2:3}:{1:3,2:3,3:1,4:3,5:3};localStorage.setItem('ww-jobs3-mock:mock-contract.testnet',JSON.stringify({intro:true,at:1,seen:{1:true},solved,builds,shipped:{},friends:{f1:'',f2:'',done:true}}));localStorage.removeItem('ww-factory6-mock:mock-contract.testnet');},state);
 await page.reload();if(state==='fresh')await page.getByTestId('factory-home').click();await page.getByTestId('factory-view').waitFor();await page.evaluate(()=>window.__wwFactory.advance(1));
 const label=`${width}${fallback?'-2d':''}`;await page.screenshot({path:new URL(`../../docs/design/screens/g6-factory-${state}-${label}.png`,import.meta.url).pathname});metrics.push({label,state,...await page.evaluate(()=>window.__wwFactory.info())});await page.close();
}
await browser.close();writeFileSync(new URL('../../docs/game6-stills.json',import.meta.url),JSON.stringify({fixtureOnly:true,errors,metrics},null,2));if(errors.length)throw Error(JSON.stringify(errors));console.log('PASS fixture stills');
