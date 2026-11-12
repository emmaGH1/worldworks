import { mkdirSync } from 'node:fs';
import { launch, watchErrors, BASE } from './common.mjs';
export { BASE };
const OUT = process.env.UI_ARTIFACT_DIR ?? new URL('../../docs/design/screens/', import.meta.url).pathname;
mkdirSync(OUT,{recursive:true});
export const assert=(ok,msg)=>{if(!ok)throw Error(msg);console.log('ok:',msg);};
export async function shot(page,name){const path=OUT.replace(/\/$/,'')+'/'+name;await page.screenshot({path,fullPage:true});console.log('screenshot:',path);}
export function observe(page){const proofs=new Map();page.on('response',async r=>{if(!r.url().endsWith('/api/payout'))return;try{const p=await r.json();if(p.status==='confirmed'){proofs.set(p.payoutId,p);console.log('API confirmation:',JSON.stringify(p));}}catch{}});return proofs;}
export async function confirmed(page,proofs){
 await page.waitForSelector('[data-testid="portal-steps"]',{timeout:90000});
 let prev;const end=Date.now()+180000;
 while(Date.now()<end){const s=await page.getAttribute('[data-testid="portal-steps"]','data-status');if(s!==prev){console.log('Portal:',s);prev=s;}
 if(s==='confirmed'){assert(proofs.size>0,'UI confirmed only after API confirmed');const p=[...proofs.values()][0];assert(p.confirmations.length===2 && new Set(p.confirmations.map(x=>new URL(x.rpc).hostname)).size===2,'two independent Sepolia RPC proofs');assert(p.confirmations.every(x=>x.status===1 && x.hash===p.evmTx.hash),'matching successful receipts');assert(p.confirmations.every(x=>BigInt(x.head)>=BigInt(x.blockNumber)+3n && BigInt(x.depth)>=3n),'at least three additional blocks on both RPCs');assert((await page.locator('[data-testid="portal-steps"]').innerText()).includes('included on Sepolia, seen by two RPCs'),'honest Sepolia inclusion copy');assert(await page.locator('[data-testid="receipts"] a[href^="https://sepolia.etherscan.io/tx/0x"]').count()>0,'real Sepolia link');return p;}
 assert(await page.locator('[data-testid="receipts"]').count()===0,'no premature confirmed receipts');await page.waitForTimeout(1500);}
 throw Error('Portal confirmation timeout: '+await page.locator('[data-testid="portal-steps"]').innerText());
}
export async function run(test){const b=await launch();const errors=[];try{const c=await b.newContext({...(process.env.UI_STORAGE_STATE ? {storageState:process.env.UI_STORAGE_STATE} : {}),viewport:{width:1440,height:900}});const p=await c.newPage();watchErrors(p,errors);p.on('response',async r=>{if(r.url().includes('/api/') && r.status()>=400)console.log('API error:',r.status(),await r.text());});await p.addInitScript(()=>{new MutationObserver(()=>{const t=document.querySelector('[role=alert],.toast');if(t && t.textContent!==window.__lastToast){window.__lastToast=t.textContent;console.log('UI notice:',t.textContent);}}).observe(document,{subtree:true,childList:true});});try {await test(p,c);} catch(e) { console.log('UI failure state:',await p.locator('body').innerText());await shot(p,'live-failure.png');throw e;} finally {await c.storageState({path:'/opt/ww-secrets/int1-last-ui-state.json'});}}catch(e){console.error(e);process.exitCode=1;}finally{await b.close();}console.log('console errors: '+errors.length);if(errors.length){console.log(errors.join('\n'));process.exitCode=1;}console.log(process.exitCode?'RESULT: FAIL':'RESULT: PASS');}
