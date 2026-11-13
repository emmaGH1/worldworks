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
await page.addInitScript(entries => { if (!sessionStorage.getItem('g3-seeded')) { for (const x of entries) localStorage.setItem(x.name, x.value); sessionStorage.setItem('g3-seeded', 'yes'); } }, entries);
page.on('request', r => { if (r.url().endsWith('/api/customer')) orders++; });
page.on('response', async r => { if (r.url().endsWith('/api/payout')) { try { const p = await r.json(); if (p.status === 'confirmed' && !proofs.some(x => x.payoutId === p.payoutId)) proofs.push(p); } catch { /* ignore */ } } });
if (process.env.UI_ADVANCE === '1') await page.addInitScript(() => { let scaled = false; setInterval(() => { const w = window.__ww2; if (!w) return; if (!scaled) { w.renderScale?.(0.5); scaled = true; } if (w.state().coins) w.advance(0.6); }, 600); });
const T = id => page.locator(`[data-testid="${id}"]`);
const check = (v, m) => { if (!v) throw Error(m); console.log('ok', m); };
const shot = async name => { await page.evaluate(() => window.__ww2?.renderScale?.(1)); await page.screenshot({ path: `${OUT}g3-live-${name}-desktop.png` }); if (process.env.UI_ADVANCE === '1') await page.evaluate(() => window.__ww2?.renderScale?.(0.5)); };
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
  // ---------------- job 3 live: Chi on Ethereum ----------------
  await page.goto(BASE + '/?job=3&lowfx=1'); await T('start').click({ timeout: 60000 }); await T('card-go').click();
  await place('Splitter', 'r'); await shares('r', [75, 20, 5]);
  await pay('r.0', 'ada'); await pay('r.1', 'bola');
  await place('Splitter', 'r.2'); await shares('r.2', [90, 10]);
  await pay('r.2.0', 'ada'); await place('Portal', 'r.2.1'); await T('sheet-done').click();
  await T('test').click(); await T('ship').waitFor({ timeout: 180000 });
  check((await T('pass-note').innerText()).startsWith('★★★'), 'job 3 test passes ★★★ (exact Portal fee)');
  await shot('job3-test-pass');
  const t0 = Date.now();
  await T('ship').click();
  await Promise.race([T('portal-moment').waitFor({ timeout: 300000 }), T('ship-error').waitFor({ timeout: 300000 }).then(async () => { throw Error(await T('ship-error').innerText()); })]);
  await page.waitForTimeout(4000); await shot('portal-moment');
  await page.waitForFunction(() => ['confirmed', 'signature_failed'].includes(document.querySelector('[data-testid=portal-moment]')?.getAttribute('data-status') ?? ''), null, { timeout: 420000 });
  check(await T('portal-moment').getAttribute('data-status') === 'confirmed', 'Portal moment reached confirmed');
  await page.waitForTimeout(1800); await shot('portal-gem');
  const p3 = proofs[0];
  check(p3?.confirmations?.length === 2 && new Set(p3.confirmations.map(c => new URL(c.rpc).hostname)).size === 2, 'confirmed by two independent Sepolia RPCs');
  check(p3.confirmations.every(c => c.status === 1 && c.hash === p3.evmTx.hash), 'matching successful receipts');
  await T('moment-close').click(); await T('live-link').waitFor();
  check(await T('receipt-chi').locator('a[href^="https://sepolia.etherscan.io/tx/"]').count() === 1, 'Chi has a real Sepolia receipt link');
  await shot('job3-receipts');
  const r3 = await runState();
  evidence.job3 = { machineId: r3.machineId, orderId: r3.orderId, publishTx: r3.publishTx, orderTx: r3.orderTx, effects: r3.effects, payout: p3, seconds: Math.round((Date.now() - t0) / 1000) };
  check(orders === 1, 'exactly one seeded-customer order so far');

  // ---------------- Your shop live: the player's own account gets paid ----------------
  await page.goto(BASE + '/?job=5&lowfx=1'); await T('shop-setup').waitFor({ timeout: 60000 });
  await T('friend-f1').fill('c7aaf34cd0000ea3928cada72e5c0da7f137dd6253570653f679181d547f0c4b'); // Bola's demo account stands in for a friend
  await T('shop-go').click();
  await place('Splitter', 'r'); await shares('r', [70, 30]);
  await pay('r.0', 'you'); await pay('r.1', 'f1');
  await T('test').click(); await T('ship').waitFor({ timeout: 180000 });
  await T('ship').click();
  await Promise.race([T('live-link').waitFor({ timeout: 300000 }), T('ship-error').waitFor({ timeout: 300000 }).then(async () => { throw Error(await T('ship-error').innerText()); })]);
  await T('balance-delta').waitFor({ timeout: 60000 });
  const delta = (await T('balance-delta').innerText()).trim();
  check(delta === '+0.07', `player's live balance went up by ${delta}`);
  await shot('your-shop');
  const r5 = await runState();
  evidence.shop = { machineId: r5.machineId, orderId: r5.orderId, publishTx: r5.publishTx, orderTx: r5.orderTx, effects: r5.effects, account: r5.account, balanceBefore: r5.balanceBefore, balanceAfter: r5.balanceAfter, link: await T('open-shop').getAttribute('href') };
  check(r5.effects.some(e => e.kind === 'payout' && e.account === r5.account && e.amount === '70000000000000000000000'), 'order effects pay 0.07 NEAR to the player account');
  check(orders === 2, 'exactly two seeded-customer orders in total');
  await page.goto(BASE + evidence.shop.link + (evidence.shop.link.includes('?') ? '&' : '?') + 'lowfx=1'); await T('shop-people').waitFor({ timeout: 60000 });
  await shot('shop-page');
  writeFileSync('/tmp/g3-live-evidence.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  check(errors.length === 0, '0 console errors');
  console.log('RESULT: PASS');
} catch (e) { console.log('RESULT: FAIL', e.message); writeFileSync('/tmp/g3-live-evidence.json', JSON.stringify(evidence, null, 2)); await page.screenshot({ path: '/tmp/g3-live-fail.png' }); process.exitCode = 1; }
finally { await ctx.storageState({ path: '/opt/ww-secrets/game3-live-state.json' }); chmodSync('/opt/ww-secrets/game3-live-state.json', 0o600); await browser.close(); console.log('customer orders:', orders, 'console errors:', errors.length); for (const e of errors) console.log(e); }
