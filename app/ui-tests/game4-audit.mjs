// Lane B UI regressions. Explicit MOCK fixtures, no chain and no network mutations.
import { launch, watchErrors } from './common.mjs';
const browser = await launch(), page = await browser.newPage({viewport:{width:390,height:844}}), errors=[];
watchErrors(page, errors);
const BASE=process.env.UI_BASE ?? 'http://127.0.0.1:4261';
const T=id=>page.locator(`[data-testid="${id}"]`);
const check=(v,msg)=>{if(!v)throw Error(msg);console.log('ok',msg);};
const scope='mock:mock-contract.testnet';
const run={job:5,phase:'done',machineId:'shop-ui-audit',started:Date.now(),account:'owner.testnet',balanceBefore:'5000000000000000000000000',balanceAfter:'4000000000000000000000000',ctx:{accounts:{you:'owner.testnet',f1:'friend.testnet'}},effects:[{kind:'payout',account:'owner.testnet',amount:'70000000000000000000000',settled:'unknown'},{kind:'payout',account:'friend.testnet',amount:'30000000000000000000000',settled:false}]};
try {
  await page.addInitScript(({scope,run})=>{
    if(sessionStorage.getItem('audit-seeded'))return;
    localStorage.setItem(`ww-jobs3-${scope}`,JSON.stringify({intro:true,at:5,solved:{1:3,5:3},seen:{5:true},builds:{5:{r:{uid:'a',kind:'Splitter',shares:[70,30]},'r.0':{uid:'b',kind:'Payout',person:'you'},'r.1':{uid:'c',kind:'Payout',person:'f1'}}},friends:{f1:'friend.testnet',f2:'',done:true,names:{f1:'Mina'}}}));
    localStorage.setItem(`ww-jobs3-run-${scope}`,JSON.stringify(run));sessionStorage.setItem('audit-seeded','1');
  },{scope,run});
  await page.goto(BASE+'/?webgl=0&lowfx=1');await T('live-link').waitFor();
  check(await T('receipts').count()===0,'receipts require opt-in');
  await T('receipts-toggle').click();
  check((await T('receipt-you').innerText()).includes('transfer requested'),'unknown settlement says transfer requested');
  check(!(await T('receipt-you').innerText()).includes('+0.07'),'unknown settlement has no paid-plus claim');
  check((await T('receipt-f1').innerText()).includes('failed — held for the recipient to claim'),'failed transfer held for recipient');
  check((await T('receipt-f1').innerText()).includes('Mina'),'owner-only custom friend name');
  check((await T('balance-delta').innerText()).trim().startsWith('−'),'negative balance delta has minus, no plus');
  await T('balance-refresh').click();
  await T('job-chip').click();
  check(await T('job-card').isVisible() && await T('ship-panel').count()===0,'job card and ship panel mutually exclusive');
  check(await page.locator('.is-next').count()===1,'exactly one next action on expanded card');
  // An explicitly expired resolution must finish even without NEAR effects in the read.
  await page.evaluate(({scope})=>{
    localStorage.setItem(`ww-jobs3-run-${scope}`,JSON.stringify({job:4,phase:'unknown',machineId:'rider-ui-audit',orderId:'audit-order',approveTx:{hash:'mock-legacy-approval',explorerUrl:''},started:Date.now()}));
    const p=JSON.parse(localStorage.getItem(`ww-jobs3-${scope}`));p.at=4;p.seen[4]=true;localStorage.setItem(`ww-jobs3-${scope}`,JSON.stringify(p));
    const db={machines:{},held:{},payouts:{},nonce:0,...JSON.parse(localStorage.getItem('ww-mock-v2')??'{}')};db.orders={'rider-ui-audit/audit-order':{orderId:'audit-order',pending:false,resolution:'expired',recovered:true,effects:[],trace:[],tx:{hash:'mock-audit',explorerUrl:''}}};localStorage.setItem('ww-mock-v2',JSON.stringify(db));
  },{scope});
  await page.reload();await T('live-link').waitFor();
  check((await T('ship-caption').innerText()).includes('Order expired'),'recovered expiry is labeled expired, never approved');
  check(await T('approve-real').count()===0,'recovery does not offer repeat Delivered');
  await T('receipts-toggle').click();await T('next-job').click();await T('factory-counter').waitFor();
  check(true,'next job resets receipt opt-in so its solved factory runs');
  await page.evaluate(({scope})=>{
    const r={job:3,phase:'portal',machineId:'abroad3-audit',orderId:'portal-order',payoutId:'42',payoutRow:'audit-payout',started:Date.now()};
    localStorage.setItem(`ww-jobs3-run-${scope}`,JSON.stringify(r));
    const p=JSON.parse(localStorage.getItem(`ww-jobs3-${scope}`));p.at=3;p.seen[3]=true;localStorage.setItem(`ww-jobs3-${scope}`,JSON.stringify(p));
    localStorage.setItem('ww-ledger-mock',JSON.stringify([{id:'audit-payout',kind:'payout',payoutId:'42',status:'pending',title:'MOCK fixture',at:Date.now(),mock:true}]));
  },{scope});
  await page.reload(); await T('moment-retry').waitFor();
  check((await T('moment-head').innerText()).includes('Cannot read'),'Portal itself exposes read failure');
  await T('moment-retry').click();
  check(!(await T('moment-head').innerText()).includes('got'),'read failure never claims confirmation');
  check(await page.locator('.is-next').count()===0,'stalled Portal has a status and no spurious next highlight');
  await page.evaluate(()=>{
    const db=JSON.parse(localStorage.getItem('ww-mock-v2'));db.payouts['42']={createdAt:Date.now()-20000,view:{payoutId:'42',status:'awaiting_signature',recipient:'0xE53AA3F186Dd3f580D2b6259bCa8aA86B10Eaeb2',wei:'500000000000000',portalAddress:'0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7',nonce:42}};localStorage.setItem('ww-mock-v2',JSON.stringify(db));
  });
  await page.goto(BASE+'/?webgl=0&lowfx=1&mockCase=earlier');
  await page.waitForFunction(()=>document.querySelector('[data-testid=moment-head]')?.textContent.includes('Waiting for earlier payout #999'));
  check(true,'queued Portal names its nonce blocker');
  await page.goto(BASE+'/?webgl=0&lowfx=1');await T('continue-building').click();
  check(await T('jobs-game').getAttribute('data-job')==='4','next job starts during real-stage tracking');
  await page.waitForFunction(()=>document.querySelector('[data-testid=background-run]')?.textContent.includes('Ethereum confirmed'));
  check(true,'background tracking finishes and status chip pings confirmation');
  check(errors.length===0,JSON.stringify(errors));console.log('RESULT: PASS; 0 console errors');
} catch(e) { console.log('DEBUG',await page.locator('body').innerText(),errors); throw e; } finally {await browser.close();}
