// GAME-1 acceptance (MOCK mode, no VITE_CONTRACT_ID): Level 1 drag-fix, Level 2 mock order through the Portal
// sequence, Open as app (/m/:id) with a second order, and the 390px phone flow with tap-to-place (no drag).
//   npm run build && npx vite preview --port 4240 &   UI_BASE=http://127.0.0.1:4240 node ui-tests/game-mock.mjs
// Stills: docs/design/screens/game-*.png. The VM has no GPU, so the world is paused and stepped deterministically
// (window.__ww.advance) for captures; API timing (mock) runs in real time.
import { mkdirSync } from 'node:fs';
import { launch, watchErrors } from './common.mjs';
const BASE = process.env.UI_BASE ?? 'http://127.0.0.1:4240';
const OUT = new URL('../../docs/design/screens/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok:', msg); };
const shot = async (page, name) => { await page.screenshot({ path: OUT + name }); console.log('still: docs/design/screens/' + name); };
const state = page => page.evaluate(() => window.__game.state());
const wstate = page => page.evaluate(() => window.__ww.state());
const advance = (page, s) => page.evaluate(sec => window.__ww.advance(sec), s);

async function open(page, path) {
  await page.goto(BASE + path);
  await page.waitForFunction(() => window.__ww && (window.__game || document.querySelector('[data-testid="checkout"]')), null, { timeout: 30000 });
  await page.evaluate(() => window.__ww.pause(true));
}
/** Steps the world while real time passes, until fn() is true. */
async function until(page, fn, what, timeout = 90000, step = 0.5) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return;
    await advance(page, step);
    await page.waitForTimeout(150);
  }
  throw new Error('timeout: ' + what);
}
const portalStatus = page => page.evaluate(() => document.querySelector('[data-testid="portal-card"]')?.getAttribute('data-status') ?? null);

async function level2Run(page, prefix, phone) {
  const t0 = Date.now();
  assert(await page.locator('[data-testid="ledger-button"] b').count() === 0, 'ledger empty before the run: simulated sales never enter it');
  await page.click('[data-testid="run-real"]');
  await until(page, async () => (await state(page)).run.phase === 'portal', 'order placed', 30000);
  const s = await state(page);
  console.log('caption:', await page.innerText('[data-testid="run-caption"]'));
  console.log('machine id:', s.run.machineId, '| vault', s.run.vault, '| portal fee', s.run.fee, '| wei', s.run.wei);
  assert(/^lemon-[0-9a-f]{8}-[a-z0-9]{1,12}$/.test(s.run.machineId), 'unique machine id per session: ' + s.run.machineId);
  await until(page, async () => (await wstate(page)).real.length > 0, 'MOCK coins leave the stand', 20000, 0.6);
  await advance(page, 2.2);
  await shot(page, `${prefix}04-mock-coins.png`);
  await until(page, async () => (await wstate(page)).real.some(r => r.shown !== 'none'), 'Portal reacts after the coins arrive', 30000, 1.0);
  const sw = await portalStatus(page);
  const shown = (await wstate(page)).real[0]?.shown;
  console.log('coins in the Portal; API status', sw, '→ world shows', shown);
  assert(shown !== 'popped' || sw === 'confirmed', 'never popped before confirmed');
  if (sw !== 'confirmed') assert(await page.locator('[data-testid="win2"]').count() === 0, 'no win before confirmed');
  if (shown === 'swirl') { await advance(page, 0.4); console.log('caption:', await page.innerText('[data-testid="run-caption"]')); await shot(page, `${prefix}05-portal-swirl.png`); }
  let seen = new Set([sw]);
  await until(page, async () => { const x = await page.evaluate(() => ({ st: document.querySelector('[data-testid="portal-card"]')?.getAttribute('data-status'), win: !!document.querySelector('[data-testid="win2"]') })); seen.add(x.st); if (x.st !== 'confirmed' && x.win) throw new Error('FAIL: premature win'); return x.st === 'broadcast' || x.st === 'confirmed'; }, 'broadcast', 60000, 0.3);
  if ((await portalStatus(page)) === 'broadcast') {
    await until(page, async () => (await wstate(page)).real.some(r => r.shown === 'beam') || (await portalStatus(page)) === 'confirmed', 'beam shown on broadcast', 15000, 0.3);
    await advance(page, 1.5);
    console.log('caption:', await page.innerText('[data-testid="run-caption"]'));
    if (!phone) await page.evaluate(() => window.__ww.setShot('portal'));
    await shot(page, `${prefix}06-portal-beam.png`);
    await page.evaluate(() => window.__ww.setShot(null));
  }
  await until(page, async () => { const st = await portalStatus(page); seen.add(st); return st === 'confirmed'; }, 'confirmed', 60000, 0.3);
  await until(page, async () => (await wstate(page)).popped.includes(s.run.flowKey), 'gem pop only after confirmed', 30000, 0.3);
  await advance(page, 0.5);
  await shot(page, `${prefix}07-confirmed.png`);
  console.log('Portal states seen:', [...seen].join(' → '), '| elapsed', ((Date.now() - t0) / 1000).toFixed(1) + 's');
  assert(await page.locator('[data-testid="win2"]').count() === 1, 'Level 2 goal met after confirmed');
  console.log('caption:', await page.innerText('[data-testid="run-caption"]'));
  assert(await page.locator('[data-testid="open-app"].pulse-target').count() === 1, 'next action: Open as app button pulses');
  assert(await page.locator('[data-testid="mock-badge"]').count() === 1, 'MOCK DATA label visible');
  return s.run.machineId;
}

const browser = await launch();
try {
  // ---------------- desktop ----------------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watchErrors(page, errors);
  await open(page, '/?fx=high');
  assert(await page.locator('[data-testid="mock-badge"]').count() === 1, 'MOCK DATA badge in mock mode');
  // first visit: a skippable 3-card intro with camera pans
  await page.waitForSelector('[data-testid="intro"]');
  for (let i = 1; i <= 3; i++) {
    await advance(page, 2.5);
    console.log(`intro ${i}/3:`, (await page.innerText('#intro-title')));
    await shot(page, `game-00-intro-${i}.png`);
    await page.click('[data-testid="intro-next"]');
  }
  assert(await page.locator('[data-testid="intro"]').count() === 0, 'intro dismissed');
  assert((await page.innerText('[data-testid="next-hint"]')).includes('Drag the Splitter'), 'next action: drag the Splitter (pointer on the dock button)');
  await advance(page, 7);
  assert((await page.innerText('[data-testid="stamp"]')).includes('LOSING MONEY'), 'Level 1 starts broken (losing money)');
  const w0 = await wstate(page);
  assert(w0.simVault === '0' && !w0.splitter, 'Vault empty, no Splitter: every coin leaves');
  await shot(page, 'game-01-broken.png');

  // drag the Splitter from the dock onto the highlighted slot
  const dock = await page.locator('[data-testid="dock-split"]').boundingBox();
  const slot = await page.evaluate(() => window.__game.slot());
  await page.mouse.move(dock.x + dock.width / 2, dock.y + dock.height / 2);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) { await page.mouse.move(dock.x + dock.width / 2 + (slot.x - dock.x - dock.width / 2) * i / steps, dock.y + dock.height / 2 + (slot.y - dock.y - dock.height / 2) * i / steps); }
  await page.evaluate(() => window.__ww.advance(0.1));
  assert((await page.innerText('[data-testid="next-hint"]')).includes('Drop it here'), 'next action while dragging: drop it here (pointer on the slot)');
  await shot(page, 'game-02-dragging.png');
  await page.mouse.up();
  await page.waitForSelector('[data-testid="game"][data-fixed="1"]');
  assert(true, 'Splitter dropped on the slot (drag)');
  await advance(page, 4);
  await page.evaluate(() => window.__ww.setShot('splitter'));
  await shot(page, 'game-03-splitter.png');
  await page.evaluate(() => window.__ww.setShot(null));
  await until(page, async () => (await state(page)).sales.fixedN >= 3, '3 sales after the fix', 60000, 1);
  const s1 = await state(page);
  assert(s1.sales.lastPct === 70, 'simulated customers keep 70% (engine preview): ' + s1.sales.lastPct);
  await page.waitForSelector('[data-testid="win1"]');
  await shot(page, 'game-04-level1-won.png');
  await page.click('[data-testid="go-level2"]');
  await page.waitForSelector('[data-testid="game"][data-level="2"]');
  await page.waitForSelector('[data-testid="intro"]');
  await advance(page, 2);
  await shot(page, 'game-05-level2-intro.png');
  await page.click('[data-testid="intro-next"]');
  await advance(page, 3);
  assert((await page.innerText('[data-testid="next-hint"]')).includes('Run it for real'), 'next action: Run it for real, explained before tapping');
  console.log('run button:', (await page.innerText('[data-testid="run-real"]')).replace(/\n/g, ' | '));
  // tap a part in the world: plain-word tooltip
  const pp = await page.evaluate(() => window.__game.anchor('portal'));
  await page.mouse.click(pp.x, pp.y);
  assert((await page.innerText('[data-testid="tip"]')).includes('Ethereum'), 'tap the Portal: ' + await page.innerText('[data-testid="tip"]'));
  await shot(page, 'game-05-level2.png');

  const machineId = await level2Run(page, 'game-l2-', false);
  await page.click('[data-testid="ledger-button"]');
  for (const kind of ['publish', 'order', 'payout']) {
    const row = page.locator(`[data-testid="ledger"] [data-testid="ledger-${kind}"]`).first();
    assert(await row.count() === 1, `ledger has a ${kind} row`);
    assert(await row.locator('.g-mock-tag').count() === 1, `${kind} row labeled mock`);
    assert(await row.locator('a').count() === 0, `${kind} row has no explorer link in mock (fake hash)`);
  }
  assert(await page.locator('[data-testid="ledger"] li').count() === 3, 'ledger holds only the 3 mock-API rows (no simulated sales)');
  await shot(page, 'game-08-ledger.png');
  await page.click('[aria-label="Close ledger"]');

  // ---------------- open as app ----------------
  await page.click('[data-testid="open-app"]');
  await page.waitForURL('**/m/**');
  assert(decodeURIComponent(new URL(page.url()).pathname.slice(3)) === machineId, 'Open as app → /m/' + machineId);
  await page.waitForFunction(() => window.__ww);
  await page.evaluate(() => window.__ww.pause(true));
  await page.waitForSelector('[data-testid="app-title"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="app-pay"]')?.disabled, null, { timeout: 20000 });
  await advance(page, 2);
  await shot(page, 'game-09-app.png');
  await page.click('[data-testid="app-pay"]');
  await page.waitForSelector('[data-testid="app-receipt"]', { timeout: 20000 });
  await until(page, async () => (await wstate(page)).real.some(r => r.shown === 'swirl'), 'app Portal swirl', 20000, 0.4);
  await shot(page, 'game-10-app-paying.png');
  await until(page, async () => (await portalStatus(page)) === 'confirmed', 'app confirmed', 60000, 0.4);
  await until(page, async () => (await wstate(page)).popped.length > 0, 'app gem pop', 30000, 0.3);
  await advance(page, 0.5);
  await shot(page, 'game-11-app-confirmed.png');
  assert(true, 'standalone app: real-path order + same Portal sequence (mock API)');

  // an unknown id renders the "no machine" state instead of crashing
  await open(page, '/m/does-not-exist-123');
  await page.waitForSelector('[data-testid="app-missing"]');
  assert(true, 'unknown machine id handled');
  await page.goto(BASE + '/verify');
  await page.waitForSelector('h1', { timeout: 20000 });
  assert(/real/i.test(await page.innerText('body')), '/verify still renders: ' + (await page.innerText('h1')).slice(0, 60));
  await ctx.close();

  // ---------------- phone 390px: tap-to-place (no drag), Level 2 ----------------
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const ph = await pctx.newPage();
  watchErrors(ph, errors);
  await open(ph, '/?fx=high');
  await ph.waitForSelector('[data-testid="intro"]');
  await advance(ph, 2.5);
  await shot(ph, 'game-p00-intro.png');
  await ph.click('[data-testid="intro-skip"]');
  await advance(ph, 6);
  await shot(ph, 'game-p01-broken.png');
  // tap a part in the world: plain-word tooltip
  const vp = await ph.evaluate(() => window.__game.slot());
  await ph.evaluate(() => window.__ww.advance(0.1));
  await ph.click('[data-testid="dock-gate"]');
  assert((await ph.innerText('[data-testid="tip"]')).includes('Locked'), 'locked part explains itself: ' + await ph.innerText('[data-testid="tip"]'));
  void vp;
  await ph.click('[data-testid="dock-split"]');
  await ph.evaluate(() => window.__ww.advance(0.2));
  await ph.waitForSelector('[data-testid="place-splitter"]');
  await shot(ph, 'game-p02-armed.png');
  await ph.click('[data-testid="place-splitter"]');
  await ph.waitForSelector('[data-testid="game"][data-fixed="1"]');
  assert(true, 'phone: tap Splitter, tap “Place Splitter here” (button path, no drag)');
  await until(ph, async () => (await state(ph)).sales.fixedN >= 3, 'phone: 3 sales', 60000, 1);
  await ph.waitForSelector('[data-testid="win1"]');
  await ph.click('[data-testid="go-level2"]');
  await ph.waitForSelector('[data-testid="intro"]');
  await ph.click('[data-testid="intro-next"]');
  await advance(ph, 2);
  await level2Run(ph, 'game-p-', true);
  await pctx.close();

  // keyboard-only placement on a fresh context
  const kctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const kp = await kctx.newPage();
  watchErrors(kp, errors);
  await open(kp, '/?fx=high&lowfx=1&intro=0');
  await kp.focus('[data-testid="dock-split"]');
  await kp.keyboard.press('Enter');
  await kp.evaluate(() => window.__ww.advance(0.2));
  await kp.waitForSelector('[data-testid="place-splitter"]');
  await kp.focus('[data-testid="place-splitter"]');
  await kp.keyboard.press('Enter');
  await kp.waitForSelector('[data-testid="game"][data-fixed="1"]');
  const info = await kp.evaluate(() => window.__ww.info());
  assert(info.fx === 2 && info.shadows === false && info.pixelRatio === 1, '?lowfx=1: shadows off, pixel ratio 1');
  assert(true, 'keyboard: Enter on the dock Splitter, Enter on “Place Splitter here”');
  await kctx.close();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
console.log('console errors: ' + errors.length);
if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS');
