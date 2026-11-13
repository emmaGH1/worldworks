// GAME-3 ONE live run (TESTNET): job 3 ship with a Sepolia receipt (Portal moment), then "Your shop" ship where the seeded
// customer's one payment credits the player's own sponsored account. Exactly two seeded-customer orders, no retries.
//   UI_BASE=http://127.0.0.1:4262 UI_ADVANCE=1 node ui-tests/game3-live.mjs
// Reuses an existing funded session from /opt/ww-secrets (never printed). Public evidence → /tmp/g3-live-evidence.json.
import { launch, watchErrors } from './common.mjs';
import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
const BASE = process.env.UI_BASE ?? 'http://127.0.0.1:4262';
const stateFile = process.env.UI_STORAGE_STATE ?? '/opt/ww-secrets/game2-live-state.json';
const OUT = new URL('../../docs/design/screens/', import.meta.url).pathname;
const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
const browser = await launch(); const errors = []; let orders = 0; const proofs = [];
const ctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
const page = await ctx.newPage(); watchErrors(page, errors); page.setDefaultTimeout(30000);
const entries = (saved.origins ?? []).flatMap(o => o.localStorage).filter(x => x.name.startsWith('worldworks.testnet.'));
await page.addInitScript(entries => { if (!sessionStorage.getItem('g4-seeded')) { for (const x of entries) localStorage.setItem(x.name, x.value); sessionStorage.setItem('g4-seeded', 'yes'); } }, entries);
page.on('request', r => { if (r.url().endsWith('/api/customer')) orders++; });
page.on('response', async r => { if (r.url().endsWith('/api/payout')) { try { const p = await r.json(); if (p.status === 'confirmed' && !proofs.some(x => x.payoutId === p.payoutId)) proofs.push(p); } catch { /* ignore */ } } });
if (process.env.UI_ADVANCE === '1') await page.addInitScript(() => { let scaled = false; setInterval(() => { const w = window.__ww2; if (!w) return; if (!scaled) { w.renderScale?.(0.5); scaled = true; } if (w.state().coins) w.advance(0.6); }, 600); });
const T = id => page.locator(`[data-testid="${id}"]`);
const check = (v, m) => { if (!v) throw Error(m); console.log('ok', m); };
const shot = async name => { await page.evaluate(() => window.__ww2?.renderScale?.(1)); await page.screenshot({ path: `${OUT}g4-live-${name}-desktop.png` }); if (process.env.UI_ADVANCE === '1') await page.evaluate(() => window.__ww2?.renderScale?.(0.5)); };
const place = async (kind, socket) => { await T(`tray-${kind}`).first().click(); await T(`socket-${socket}`).click(); };
const pay = async (socket, who) => { await place('Payout', socket); await T(`who-${who}`).click(); };
const shares = async (socket, want) => {
  if (!(await T('sheet').count())) await T(`socket-${socket}`).click();
  while ((await T('sheet').locator('[data-testid$=-minus][data-testid^=share-]').count()) < want.length) await T('belt-add').click();
  for (let i = 0; i < want.length; i++) for (let k = 0; k < 20; k++) { const v = Number((await T(`share-${i}`).locator('b').innerText()).replace('%', '')); if (v === want[i]) break; await T(`share-${i}-${v < want[i] ? 'plus' : 'minus'}`).click(); }
  await T('sheet-done').click();
};
const runState = () => page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([k]) => k.startsWith('ww-jobs3-run-live:'))?.[1] ?? 'null'));
const evidence = {};
try {
  await page.goto(BASE + '/?job=4&lowfx=1'); await T('start').click({timeout:60000}); await T('card-go').click();
  await place('Splitter','r'); await shares('r',[80,20]); await pay('r.0','ada');
  await place('Gate','r.1'); await place('Worker','r.1.k'); await T('who-customer').click();
  await pay('r.1.p','dayo'); await pay('r.1.f','customer');
  await T('test').click();
  for(let i=0;i<2;i++) { await T('tap-approve').waitFor({timeout:120000}); await T('tap-approve').click(); }
  await T('ship').waitFor({timeout:120000}); await T('ship').click();
  await T('approve-real').waitFor({timeout:180000});
  check(orders === 1,'exactly one seeded customer order; existing session reused');
  check(await T('expire-real').count() === 0,'refund hidden before finalized expiry height');
  await shot('gate-wait');
  await T('expire-real').waitFor({timeout:240000}); await shot('refund-eligible');
  await T('expire-real').click(); await T('live-link').waitFor({timeout:180000});
  const r=await runState();
  check(r.effects.some(e=>e.kind==='payout' && e.account===r.customer && e.amount==='20000000000000000000000'),'customer refund 0.02 NEAR from contract receipt');
  check(!r.effects.some(e=>e.kind==='payout' && e.account!==r.customer && e.amount==='20000000000000000000000'),'no rider payout');
  check(orders === 1,'no additional orders');
  if (!(await T('receipts').count())) await T('receipts-toggle').click();
  await shot('refund-receipts');
  Object.assign(evidence,{machineId:r.machineId,orderId:r.orderId,customer:r.customer,publishTx:r.publishTx,orderTx:r.orderTx,expireTx:r.approveTx,effects:r.effects,orders,consoleErrors:errors});
  if(errors.length) throw Error('console errors: '+errors.length);
  writeFileSync(new URL('../../docs/game4-live.json',import.meta.url),JSON.stringify(evidence,null,2));
  console.log('RESULT: PASS; one live order, 0 console errors');
} catch(e) { console.log('RESULT: FAIL',e.message); process.exitCode=1; }
finally { await browser.close(); }
