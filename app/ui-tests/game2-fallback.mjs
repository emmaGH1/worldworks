// Regression: the phone's job card must not cover the Key socket. Normal taps only.
import {launch,watchErrors} from './common.mjs';
const b=await launch(),errors=[];const BASE=process.env.UI_BASE??'http://127.0.0.1:4253';
try{for(const width of [1366,390]){const ctx=await b.newContext({viewport:{width,height:844}}),p=await ctx.newPage();watchErrors(p,errors);const T=id=>p.locator(`[data-testid="${id}"]`);p.setDefaultTimeout(10000);
 await p.goto(BASE+'/?job=3&webgl=0&lowfx=1');await T('start').click();
 for(const [part,socket,person] of [['Gate','mid1'],['Worker','key1','customer'],['Payout','end1','dayo']]){await T(`tray-${part}`).click();await T(`socket-${socket}`).click();if(person)await T(`who-${person}`).click();}
 await T('test').click();for(let i=0;i<2;i++){await T('tap-approve').waitFor();await T('tap-approve').click();}
 await T('ship').waitFor();await T('ship').click();await T('approve-real').waitFor();await T('approve-real').click();await T('live-link').waitFor();
 if(await T('receipt-dayo').count()!==1)throw Error('Missing Dayo receipt');console.log('PASS fallback Gate/Key/approval',width);await ctx.close();}
 if(errors.length)throw Error(errors.join('\n'));console.log('RESULT: PASS; console errors: 0');}finally{await b.close();}
