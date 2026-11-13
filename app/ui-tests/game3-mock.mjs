// GAME-3 jobs, MOCK API: plays jobs 1–4 and "Your shop" with at least one deliberately wrong build per job that
// fails Test with the right one-line reason, then fixes it and ships (mock). Desktop 1366×800 + phone 390×844. 0 console errors.
//   npx vite --port 4260 &   UI_BASE=http://127.0.0.1:4260 UI_ADVANCE=1 node ui-tests/game3-mock.mjs
// UI_SHOTS=1 writes stills to docs/design/screens/g3-*.png. UI_ONLY=phone|desktop runs one viewport.
import { launch, watchErrors } from './common.mjs';
import { mkdirSync } from 'node:fs';
const BASE = process.env.UI_BASE ?? 'http://127.0.0.1:4260';
const SHOTS = process.env.UI_SHOTS === '1';
const DIR = new URL('../../docs/design/screens/', import.meta.url).pathname;
if (SHOTS) mkdirSync(DIR, { recursive: true });
const errors = []; const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
function check(c, msg) { if (!c) throw new Error('FAIL: ' + msg); log('ok', msg); }

async function run(label, viewport) {
  const browser = await launch();
  const phone = viewport.width < 500;
  const ctx = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); watchErrors(page, errors); globalThis.__page = page;
  page.setDefaultTimeout(30000);
  if (process.env.UI_ADVANCE === '1') await page.addInitScript(() => { let scaled = false; setInterval(() => { const w = window.__ww2; if (!w) return; if (!scaled) { w.renderScale?.(0.5); scaled = true; } if (w.state().coins) w.advance(0.6); }, 600); });
  const T = id => page.locator(`[data-testid="${id}"]`);
  const next = () => T('jobs-game').getAttribute('data-next');
  const shot = async name => { if (!SHOTS) return; await page.evaluate(() => window.__ww2?.renderScale?.(1)); await page.screenshot({ path: `${DIR}g3-${name}-${label}.png` }); if (process.env.UI_ADVANCE === '1') await page.evaluate(() => window.__ww2?.renderScale?.(0.5)); };
  const oneNext = async where => check(await page.locator('.is-next').count() <= 1, `${label}: ${where}: at most one highlighted action`);
  const place = async (kind, socket) => { await T(`tray-${kind}`).first().click(); await T(`socket-${socket}`).click(); };
  const pay = async (socket, person) => { await place('Payout', socket); await T(`who-${person}`).click(); };
  const shares = async (socket, want) => {
    if (!(await T('sheet').count())) await T(`socket-${socket}`).click();
    for (let i = 0; i < want.length; i++) {
      for (let k = 0; k < 20; k++) {
        const v = Number((await T(`share-${i}`).locator('b').innerText()).replace('%', ''));
        if (v === want[i]) break;
        await T(`share-${i}-${v < want[i] ? 'plus' : 'minus'}`).click();
      }
    }
    await T('sheet-done').click();
  };
  const splitter = async (socket, want) => { await place('Splitter', socket); while ((await T('sheet').locator('[data-testid^=share-][data-testid$=-minus]').count()) < want.length) await T('belt-add').click(); await shares(socket, want); };
  const testFail = async (expect, where) => {
    await T('test').click();
    await T('fail-why').waitFor({ timeout: 90000 });
    const why = await T('fail-why').innerText();
    check(why === expect, `${label}: ${where} fails with "${why}"`);
    check((await next()).startsWith('socket:'), `${label}: after the fail a spot is highlighted (${await next()})`);
    return why;
  };
  const testPass = async (where, wantStars) => {
    await T('test').click();
    await T('ship').waitFor({ timeout: 120000 });
    const note = await T('pass-note').innerText();
    check(note.startsWith(wantStars), `${label}: ${where} passes: "${note}"`);
    for (const li of await T('requirements').locator('li').all()) check(await li.getAttribute('data-ok') === 'true', `${label}: ${where}: pill "${await li.innerText()}" ✓`);
  };
  const shipDone = async () => {
    await T('ship').click();
    await T('live-link').waitFor({ timeout: 120000 });
    check(await T('receipts').count() === 1, `${label}: receipts listed`);
    const faces = await T('receipts').locator('.j-face').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
    check(faces.length > 0 && faces.every(([w, h]) => w === 32 && h === 32), `${label}: receipt avatars are 32px circles (${JSON.stringify(faces)})`);
  };

  await page.goto(`${BASE}/?lowfx=1${process.env.UI_2D === '1' ? '&webgl=0' : ''}`);
  await T('intro').waitFor({ timeout: 60000 });
  await oneNext('intro');
  await T('start').click();

  // ---------------- job 1: Ada keeps 3× each helper ----------------
  check(await next() === 'card', `${label}: job 1 opens with its card`);
  await shot('job-card-open');
  await T('card-go').click();
  check(await T('requirements').count() === 1, `${label}: card collapsed into pills`);
  const cover = await page.evaluate(() => { let a = 0; for (const s of ['.j-top', '.j-reqpills', '.j-bottom']) { const e = document.querySelector(s); if (e) { const r = e.getBoundingClientRect(); a += r.width * r.height; } } return a / (innerWidth * innerHeight); });
  log(`${label}: chrome covers ${(cover * 100).toFixed(1)}% of the screen while building`);
  await shot('job-card');
  check((await next()).startsWith('tray:'), `${label}: first next action is the Splitter in the tray`);
  if (!phone) {
    const from = await T('tray-Splitter').first().boundingBox(); const to = await T('socket-r').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + 10, to.y + 10, { steps: 8 }); await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 }); await page.mouse.up();
    check(await T('sheet').count() === 1, `${label}: Splitter dragged onto the first spot`);
    await T('belt-add').click(); await T('sheet-done').click();
  } else { await place('Splitter', 'r'); await T('belt-add').click(); await T('sheet-done').click(); }
  for (const [s, p] of [['r.0', 'ada'], ['r.1', 'bola'], ['r.2', 'chi']]) await pay(s, p);
  check(await next() === 'test', `${label}: all placed → Test is next`);
  await oneNext('build');
  await shot('build');
  await T('test').click();
  await page.waitForFunction(() => (window.__ww2?.state().coins ?? 1) > 0, null, { timeout: 30000 });
  await page.waitForTimeout(phone ? 900 : 1500);
  await shot('test-running');
  await T('fail-why').waitFor({ timeout: 90000 });
  check(await T('fail-why').innerText() === 'Ada got 0.04, needs 3× Bola’s 0.03 = 0.09.', `${label}: job 1 even split fails with the 3× reason`);
  check(await next() === 'socket:r', `${label}: the Splitter glows after the fail`);
  check(await T('req-ada').getAttribute('data-ok') === 'false', `${label}: Ada pill shows ✗`);
  await shot('test-fail');
  await shares('r', [60, 20, 20]);
  await testPass('job 1 (one 3-way Splitter)', '★★★');
  await shot('test-pass');
  await shipDone();
  check((await T('live-link').innerText()).includes('/m/bake3-'), `${label}: job 1 live link`);
  await shot('receipts');
  await T('next-job').click();

  // ---------------- job 2: half, then Bola 3× Chi (needs a chain) ----------------
  check(await T('jobs-game').getAttribute('data-job') === '2', `${label}: job 2 open`);
  await T('card-go').click();
  await splitter('r', [50, 35, 15]);
  for (const [s, p] of [['r.0', 'ada'], ['r.1', 'bola'], ['r.2', 'chi']]) await pay(s, p);
  await testFail('Bola got 0.035, needs 3× Chi’s 0.015 = 0.045.', 'job 2 one Splitter');
  await T('socket-r').click(); await T('belt-remove').click(); await shares('r', [50, 50]);
  await place('Splitter', 'r.1');
  await shares('r.1', [75, 25]);
  await pay('r.1.0', 'bola'); await pay('r.1.1', 'chi');
  await testPass('job 2 (Splitter → Splitter)', '★★★');
  await shot('chain');
  await T('skip-ship').click();

  // ---------------- job 3: Chi abroad, the Portal fee ----------------
  check(await T('jobs-game').getAttribute('data-job') === '3', `${label}: job 3 open`);
  await T('card-go').click();
  await splitter('r', [60, 20, 20]);
  for (const [s, p] of [['r.0', 'ada'], ['r.1', 'bola'], ['r.2', 'chi']]) await pay(s, p);
  await testFail('Chi got 0.02 NEAR, but Chi only uses Ethereum now.', 'job 3 Chi on NEAR');
  await T('socket-r').click(); await T('remove-part').click();
  await splitter('r', [75, 20, 5]);
  await pay('r.0', 'ada'); await pay('r.1', 'bola');
  await splitter('r.2', [95, 5]);
  await pay('r.2.0', 'ada');
  await place('Portal', 'r.2.1'); check((await T('portal-inflow').innerText()) === '0.00025 NEAR', `${label}: Portal sheet shows what flows in`); await T('sheet-done').click();
  await testFail('The Portal needs 0.0005 NEAR to send 0.0005 ETH but gets 0.00025. The contract would refuse it.', 'job 3 Portal underfunded');
  await shares('r.2', [90, 10]);
  await testPass('job 3 (exact Portal fee)', '★★★');
  await T('ship').click();
  await T('portal-moment').waitFor({ timeout: 60000 });
  check(/NEAR is signing an Ethereum transaction/.test(await T('moment-head').innerText()), `${label}: Portal moment says NEAR is signing`);
  check((await T('portal-moment').innerText()).includes('Ada never touched Ethereum. Her NEAR machine paid Chi there by itself.'), `${label}: Portal moment says why it matters`);
  await page.waitForTimeout(2500);
  await shot('portal-moment');
  await page.waitForFunction(() => document.querySelector('[data-testid=portal-moment]')?.getAttribute('data-status') === 'confirmed', null, { timeout: 120000 });
  await page.waitForTimeout(1600);
  await shot('portal-gem');
  check(await next() === 'moment', `${label}: after confirmation the one action is to see the receipts`);
  await T('moment-close').click();
  await T('live-link').waitFor();
  check((await T('receipt-chi').innerText()).includes('ETH'), `${label}: Chi receipt shows ETH`);
  await T('next-job').click();

  // ---------------- job 4: Dayo after delivery, refund on time-out ----------------
  check(await T('jobs-game').getAttribute('data-job') === '4', `${label}: job 4 open`);
  await T('card-go').click();
  await splitter('r', [80, 20]);
  await pay('r.0', 'ada');
  await place('Gate', 'r.1');
  await place('Worker', 'r.1.k'); await T('who-customer').click();
  await pay('r.1.p', 'dayo');
  await place('Vault', 'r.1.f');
  await T('test').click();
  for (let i = 0; i < 2; i++) { await T('tap-approve').waitFor({ timeout: 90000 }); if (i === 0) await shot('gate-wait'); await T('tap-approve').click(); }
  await T('fail-why').waitFor({ timeout: 90000 });
  check(await T('fail-why').innerText() === 'The bread never arrived and the customer got nothing back: a Vault kept 0.02.', `${label}: job 4 refund into a Vault fails`);
  check(await next() === 'socket:r.1.f', `${label}: the time-up exit glows`);
  await pay('r.1.f', 'customer');
  await T('test').click();
  for (let i = 0; i < 2; i++) { await T('tap-approve').waitFor({ timeout: 90000 }); await T('tap-approve').click(); }
  await T('ship').waitFor({ timeout: 120000 });
  check((await T('pass-note').innerText()).startsWith('★★★'), `${label}: job 4 ★★★`);
  await T('ship').click();
  await T('approve-real').waitFor({ timeout: 60000 });
  check(await next() === 'approve', `${label}: real run waits for Delivered`);
  await T('approve-real').click();
  await T('live-link').waitFor({ timeout: 60000 });
  check(await T('receipt-dayo').count() === 1, `${label}: Dayo receipt after delivery`);
  await T('next-job').click();

  // ---------------- Your shop ----------------
  check(await T('jobs-game').getAttribute('data-job') === '5', `${label}: Your shop open`);
  await T('shop-setup').waitFor();
  await T('friend-f1').fill('bola-friend.testnet');
  await T('friend-f2').fill('0xE53AA3F186Dd3f580D2b6259bCa8aA86B10Eaeb2');
  await T('shop-go').click();
  await splitter('r', [70, 30]);
  await pay('r.0', 'you'); await pay('r.1', 'f1');
  await testFail('Friend 2 got nothing.', 'shop without the Ethereum friend');
  await T('socket-r').click(); await T('belt-add').click(); await shares('r', [70, 25, 5]);
  await pay('r.0', 'you'); await pay('r.1', 'f1');
  await place('Portal', 'r.2'); await T('sheet-done').click();
  await testPass('your shop', '★★★');
  await T('ship').click();
  await T('portal-moment').waitFor({ timeout: 60000 });
  check((await T('portal-moment').innerText()).includes('You never touched Ethereum.'), `${label}: shop Portal moment speaks to you`);
  await page.waitForFunction(() => document.querySelector('[data-testid=portal-moment]')?.getAttribute('data-status') === 'confirmed', null, { timeout: 120000 });
  await T('moment-close').click();
  await T('live-link').waitFor();
  await T('balance-delta').waitFor({ timeout: 40000 });
  check((await T('balance-delta').innerText()).trim() === '+0.07', `${label}: your balance went up by your 70% (${await T('balance-delta').innerText()})`);
  check(await T('share').count() === 1 && /x\.com\/intent\/post/.test(await T('share-x').getAttribute('href')), `${label}: Share + pre-written X post`);
  const href = await T('open-shop').getAttribute('href');
  check(/^\/m\/shop-[a-z0-9_-]+\?to=0x/i.test(href), `${label}: shop link carries the Ethereum recipient (${href})`);
  await shot('your-shop');
  await T('levels').click();
  check(await T('level-list').locator('.live-link').count() === 4, `${label}: level list shows 4 live shops`);
  await T('levels').click();
  await page.goto(`${BASE}${href}&lowfx=1`);
  await page.waitForSelector('[data-testid=shop-people]', { timeout: 60000 });
  const ppl = await T('shop-people').innerText();
  check(/70%/.test(ppl) && /25%/.test(ppl) && /5%/.test(ppl), `${label}: standalone shop lists the split (${ppl.replace(/\n/g, ' | ')})`);
  check((await T('app-recipient').inputValue()).toLowerCase() === '0xe53aa3f186dd3f580d2b6259bca8aa86b10eaeb2', `${label}: standalone shop pre-fills the friend's Ethereum wallet`);
  await shot('shop-page');
  await browser.close();
}

try {
  if (process.env.UI_ONLY !== 'phone') await run('desktop', { width: 1366, height: 800 });
  if (process.env.UI_ONLY !== 'desktop') await run('phone', { width: 390, height: 844 });
  if (errors.length) { console.log(errors.join('\n')); throw new Error(`console errors: ${errors.length}`); }
  console.log(`RESULT: PASS; console errors: 0 (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} catch (e) { console.log(errors.join('\n')); console.log('RESULT: FAIL', e.message); try { await globalThis.__page?.screenshot({ path: '/tmp/claude-1000/g3-mock-fail.png' }); console.log('next:', await globalThis.__page?.locator('[data-testid=jobs-game]').getAttribute('data-next')); } catch { /* closed */ } process.exit(1); }
