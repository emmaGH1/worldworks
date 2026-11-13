// Capture literal UI text for a paced, no-spend, 60-second first-job walkthrough.
import {launch} from './common.mjs';import {writeFileSync} from 'node:fs';
const b=await launch();const p=await b.newPage({viewport:{width:390,height:844}});const T=id=>p.locator(`[data-testid="${id}"]`);
await p.goto((process.env.UI_BASE??'http://127.0.0.1:4251')+'/?webgl=0&lowfx=1');await T('intro').waitFor();
await p.evaluate(()=>{window.__copy=[];const start=performance.now();let prior='';const capture=()=>{const text=(document.querySelector('[data-testid=intro]')??document.body).innerText;if(text!==prior){window.__copy.push({seconds:+((performance.now()-start)/1000).toFixed(1),text});prior=text;}};capture();const timer=setInterval(()=>{capture();if(performance.now()-start>=60000)clearInterval(timer);},250);});
await p.waitForTimeout(8000);await T('start').click();await p.waitForTimeout(5000);
await T('tray-Splitter').click();await p.waitForTimeout(2000);await T('socket-hub').click();await p.waitForTimeout(6000);await T('sheet-done').click();
for(const [i,who] of ['ada','bola','chi'].entries()){await p.waitForTimeout(1500);await T('tray-Payout').first().click();await p.waitForTimeout(1000);await T(`socket-end${i}`).click();await p.waitForTimeout(1500);await T(`who-${who}`).click();}
await p.waitForTimeout(4000);await T('test').click();await T('fail-why').waitFor();
await p.waitForTimeout(20000);
const rows=await p.evaluate(()=>window.__copy.filter(x=>x.seconds<=60));
writeFileSync(new URL('../../docs/game2-first60.json',import.meta.url),JSON.stringify(rows,null,2));
console.log('Captured',rows.length,'literal screen states; no shipment');await b.close();
