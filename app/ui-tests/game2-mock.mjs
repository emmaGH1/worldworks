// GAME-2 jobs, MOCK API: plays jobs 1–3 with deliberately wrong builds that fail Test with the right one-line reason,
// then fixes them, ships (mock), and checks the one-highlighted-action rule. Desktop + 390px phone. 0 console errors.
//   npx vite --port 4250 &   UI_BASE=http://127.0.0.1:4250 node ui-tests/game2-mock.mjs
// UI_SHOTS=1 writes stills to docs/design/screens/g2-*.png.
import { launch, watchErrors } from './common.mjs';
import { mkdirSync } from 'node:fs';
const BASE = process.env.UI_BASE ?? 'http://127.0.0.1:4250';
const SHOTS = process.env.UI_SHOTS === '1';
const DIR = new URL('../../docs/design/screens/', import.meta.url).pathname;
if (SHOTS) mkdirSync(DIR, { recursive: true });
const errors = []; const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
function check(c, msg) { if (!c) throw new Error('FAIL: ' + msg); log('ok', msg); }

async function run(label, viewport) {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport, isMobile: viewport.width < 500, hasTouch: viewport.width < 500, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); watchErrors(page, errors);
  page.setDefaultTimeout(20000);
  if (process.env.UI_ADVANCE === '1') await page.addInitScript(() => { let scaled = false; setInterval(() => { const w = window.__ww2; if (!w) return; if (!scaled) { w.renderScale?.(0.5); scaled = true; } if (w.state().coins) w.advance(0.6); }, 600); });
  const T = id => page.locator(`[data-testid="${id}"]`);
  const next = () => T('jobs-game').getAttribute('data-next');
  const shot = async name => { if (SHOTS) { await page.evaluate(() => window.__ww2?.renderScale?.(1)); await page.screenshot({ path: `${DIR}g2-${name}-${label}.png` }); if (process.env.UI_ADVANCE === '1') await page.evaluate(() => window.__ww2?.renderScale?.(0.5)); } };
  const tapPlace = async (kind, socket) => { await T(`tray-${kind}`).first().click(); await page.waitForFunction(() => document.querySelector('[data-testid=jobs-game]')?.getAttribute('data-next')?.startsWith('socket:')); await T(`socket-${socket}`).click(); };
  const who = async id => { await T(`who-${id}`).click(); };
  const waitIdle = async (timeout = 90000) => page.waitForFunction(() => { const b = document.querySelector('[data-testid=test]'); const s = document.querySelector('[data-testid=ship]'); return (b && !b.disabled) || s; }, null, { timeout });
  const tapWhileTesting = async (n) => { for (let i = 0; i < n; i++) { await T('tap-approve').waitFor({ timeout: 60000 }); if (i === 0) await shot('gate-wait'); await T('tap-approve').click(); } };

  await page.goto(`${BASE}/?lowfx=1${process.env.UI_2D === '1' ? '&webgl=0' : ''}`);
  await T('intro').waitFor();
  check(/Money that runs itself/.test(await T('point').innerText()), `${label}: intro states the point`);
  check(await page.locator('.is-next').count() === 1, `${label}: intro has exactly one highlighted action`);
  await shot('intro');
  await T('start').click();

  // ---------------- job 1 ----------------
  check((await next()).startsWith('tray:'), `${label}: first next action is a tray part`);
  await shot('job-card');
  await tapPlace('Splitter', 'hub'); await T('sheet').waitFor();
  await T('sheet-done').click();
  for (const [s, p] of [['end0', 'ada'], ['end1', 'bola'], ['end2', 'chi']]) { await tapPlace('Payout', s); await who(p); }
  check(await next() === 'test', `${label}: all placed → Test is the next action`);
  check(await page.locator('.is-next').count() === 1, `${label}: build screen has one highlighted action`);
  await shot('build');
  await T('test').click();
  await T('fail-why').waitFor({ timeout: 60000 });
  const why1 = await T('fail-why').innerText();
  check(why1 === 'Ada got 40%, needs 60%.', `${label}: wrong split fails with "${why1}"`);
  check(await next() === 'socket:hub', `${label}: after the fail the Splitter is highlighted`);
  check(await T('req-ada').getAttribute('data-ok') === 'false', `${label}: Ada row shows ✗`);
  await shot('test-fail');
  await T('socket-hub').click();
  for (let i = 0; i < 4; i++) await T('share-0-plus').click();
  for (const l of [1, 2]) for (let i = 0; i < 2; i++) await T(`share-${l}-minus`).click();
  await T('sheet-done').click();
  await T('test').click();
  await T('ship').waitFor({ timeout: 90000 });
  for (const r of ['ada', 'bola', 'chi']) check(await T(`req-${r}`).getAttribute('data-ok') === 'true', `${label}: job 1 ${r} ✓`);
  check((await T('req-ada').innerText()).includes('+0.06 NEAR'), `${label}: Ada row shows +0.06 NEAR`);
  check(await next() === 'ship', `${label}: solved → Ship is the next action`);
  await shot('test-pass');
  await T('ship').click();
  await T('live-link').waitFor({ timeout: 60000 });
  check(await T('receipt-ada').count() === 1 && await T('receipt-bola').count() === 1 && await T('receipt-chi').count() === 1, `${label}: job 1 real-run receipts for Ada, Bola, Chi`);
  check(/\/m\/bakery-/.test(await T('live-link').innerText()), `${label}: live shop link shown`);
  await shot('ship');
  check(await next() === 'nextjob', `${label}: next action is the next job`);
  await T('next-job').click();

  // ---------------- job 2 ----------------
  check(await T('jobs-game').getAttribute('data-job') === '2', `${label}: job 2 open`);
  check(await next() === 'test', `${label}: job 2 starts ready to test (Chi still on a NEAR Payout)`);
  await T('test').click();
  await T('fail-why').waitFor({ timeout: 60000 });
  check(await T('fail-why').innerText() === 'Chi got NEAR, but Chi only uses Ethereum now.', `${label}: job 2 wrong build explains Chi only uses Ethereum`);
  check(await next() === 'socket:end2', `${label}: Chi's Payout spot is highlighted`);
  // drag the Portal onto Chi's spot (real pointer drag)
  const from = await T('tray-Portal').boundingBox(); const to = await T('socket-end2').boundingBox();
  if (viewport.width < 500) { await T('tray-Portal').click(); await T('socket-end2').click(); }
  else {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + 10, to.y + 10, { steps: 8 }); await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 }); await page.mouse.up();
  }
  check((await T('socket-end2').innerText()).includes('Portal'), `${label}: Portal placed in Chi's spot`);
  if (await T('sheet').count()) await T('sheet-done').click();
  await T('test').click();
  await page.waitForFunction(() => window.__ww2?.state().portal === 'beam' || document.querySelector('[data-testid=ship]'), null, { timeout: 60000 });
  await shot('portal-test');
  await T('ship').waitFor({ timeout: 90000 });
  check(await T('req-chi').getAttribute('data-ok') === 'true', `${label}: Chi is paid on Ethereum ✓ (simulated)`);
  await T('ship').click();
  await Promise.race([T('portal-card').waitFor({ timeout: 60000 }), T('ship-error').waitFor({timeout: 60000}).then(async()=>{throw Error(await T('ship-error').innerText());})]);
  await T('ship-close').click();
  check(await T('ship-panel').count() === 0, `${label}: Close works while payout tracks`);
  await T('levels').click(); await T('level-1').click();
  await page.reload(); await T('jobs-game').waitFor();
  await T('levels').click(); await T('level-2').click();
  await T('live-link').waitFor({ timeout: 120000 });
  check(await T('portal-card').getAttribute('data-status') === 'confirmed', `${label}: star/done only after the payout is confirmed`);
  check((await T('receipt-chi').innerText()).includes('ETH on Sepolia'), `${label}: Chi's receipt shows ETH on Sepolia`);
  await page.waitForTimeout(1500);
  await shot('portal-gem');
  await T('next-job').click();

  // ---------------- job 3 ----------------
  check(await T('jobs-game').getAttribute('data-job') === '3', `${label}: job 3 open`);
  await tapPlace('Gate', 'mid1');
  await tapPlace('Worker', 'key1'); await who('dayo');
  await tapPlace('Payout', 'end1'); await who('dayo');
  check(await next() === 'test', `${label}: job 3 placed`);
  await T('test').click();
  await tapWhileTesting(2);
  await T('fail-why').waitFor({ timeout: 60000 });
  check((await T('fail-why').innerText()).startsWith('The rider can’t confirm their own delivery'), `${label}: rider holding the Key fails with the right reason`);
  check(await next() === 'socket:key1', `${label}: the Key spot is highlighted`);
  await T('socket-key1').click(); await who('customer');
  await T('test').click();
  await tapWhileTesting(2);
  await T('ship').waitFor({ timeout: 90000 });
  check(await T('req-dayo').getAttribute('data-ok') === 'true' && await T('req-key').getAttribute('data-ok') === 'true', `${label}: job 3 solved`);
  await T('ship').click();
  await T('approve-real').waitFor({ timeout: 60000 });
  check(await next() === 'approve', `${label}: real run waits for Delivered`);
  check((await T('receipts').innerText()).includes('waiting at the Gate'), `${label}: receipt shows Dayo's share waiting`);
  await T('approve-real').click();
  await T('live-link').waitFor({ timeout: 60000 });
  check(await T('receipt-dayo').count() === 1, `${label}: Dayo receipt after delivery`);

  // level select shows stars + live links; reload keeps progress
  await T('levels').click();
  check(await T('level-list').locator('.star').count() === 3, `${label}: level select shows 3 stars`);
  check(await T('level-list').locator('.live-link').count() === 3, `${label}: level select shows 3 live links`);
  await page.reload(); await T('jobs-game').waitFor();
  check(await T('intro').count() === 0, `${label}: intro not repeated after reload`);

  // standalone shop
  await T('levels').click(); await T('level-1').click();
  await T('levels').click();
  const link = await T('level-list').locator('.live-link').first().getAttribute('href');
  await page.goto(`${BASE}${link}?lowfx=1`);
  await page.waitForSelector('[data-testid=shop-title]', { timeout: 30000 });
  const title = await page.locator('[data-testid=shop-title]').innerText();
  check(/Ada/.test(title), `${label}: standalone shop says whose shop it is ("${title}")`);
  await shot('live-shop');
  await browser.close();
}

try {
  await run('desktop', { width: 1366, height: 800 });
  await run('phone', { width: 390, height: 844 });
  if (errors.length) { console.log(errors.join('\n')); throw new Error(`console errors: ${errors.length}`); }
  console.log(`RESULT: PASS; console errors: 0 (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} catch (e) { console.log(errors.join('\n')); console.log('RESULT: FAIL', e.message); process.exit(1); }
