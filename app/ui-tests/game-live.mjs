// GAME-1 acceptance (LIVE, NEAR testnet + Sepolia): Level 2 "Run it for real" on ww-portal-261112.testnet.
// Sends real testnet transactions: a sponsored session (new browser), publish, one seeded-customer order and one
// Portal payout; then the standalone app (/m/:id) places one more order from the session account.
//   API_PORT=3027 node --env-file=/opt/ww-secrets/live.env --import tsx scripts/dev-api.ts &
//   VITE_CONTRACT_ID=ww-portal-261112.testnet VITE_RELAYER_URL=http://127.0.0.1:3027 npx vite build --outDir <dir>
//   npx vite preview --outDir <dir> --port 4241 &
//   UI_BASE=http://127.0.0.1:4241 node ui-tests/game-live.mjs        (UI_SKIP_APP=1 skips the /m/:id order)
// Never prints secrets. The world runs in real time (not paused); stills use ?fx=high.
import { mkdirSync } from 'node:fs';
import { launch, watchErrors } from './common.mjs';
const BASE = process.env.UI_BASE ?? 'http://127.0.0.1:4241';
const OUT = new URL('../../docs/design/screens/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const errors = [];
const t0 = Date.now();
const ts = () => `[${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s]`;
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log(ts(), 'ok:', msg); };
const shot = async (page, name) => { if(process.env.UI_SHOTS==='0')return; await page.screenshot({ path: OUT + name }); console.log(ts(), 'still: docs/design/screens/' + name); };
const NEAR_TX = /^https:\/\/(testnet\.nearblocks\.io\/txns|explorer\.testnet\.near\.org\/transactions|testnet\.near\.rocks\/tx)\/[1-9A-HJ-NP-Za-km-z]{40,}$/;
const SEPOLIA_TX = /^https:\/\/sepolia\.etherscan\.io\/tx\/0x[0-9a-fA-F]{64}$/;

function observe(page) {
  const proofs = new Map();
  page.on('response', async r => {
    if (!r.url().includes('/api/')) return;
    if (r.status() >= 400) { console.log(ts(), 'API error', r.status(), r.url(), (await r.text().catch(() => '')).slice(0, 300)); return; }
    if (!r.url().endsWith('/api/payout')) return;
    try { const p = await r.json(); if (p.status === 'confirmed' && !proofs.has(p.payoutId)) { proofs.set(p.payoutId, p); console.log(ts(), 'API confirmed payout', p.payoutId, 'evmTx', p.evmTx?.hash, 'RPC proofs', (p.confirmations ?? []).map(c => new URL(c.rpc).hostname).join(', ')); } } catch { /* not json */ }
  });
  return proofs;
}
const portalStatus = page => page.evaluate(() => document.querySelector('[data-testid="portal-card"]')?.getAttribute('data-status') ?? null);
const wstate = page => page.evaluate(() => window.__ww.state());

/** Follows the Portal from the UI; asserts the world never pops before the API confirmed; stills per state. */
async function followPortal(page, proofs, prefix) {
  let prev = null; const shots = new Set();
  const poppedBefore = (await wstate(page)).popped.length;
  const end = Date.now() + 240000;
  while (Date.now() < end) {
    const snap = await page.evaluate(() => ({ st: document.querySelector('[data-testid="portal-card"]')?.getAttribute('data-status') ?? null, win: !!document.querySelector('[data-testid="win2"]'), w: window.__ww.state() }));
    const st = snap.st, w = snap.w;
    const shown = w.real[0]?.shown ?? '-';
    if (st !== prev) { console.log(ts(), `Portal status ${st} · world ${shown} · caption: ${await page.innerText('[data-testid="run-caption"]').catch(() => '(app page)')}`); prev = st; }
    if (st !== 'confirmed') {
      if (w.real.some(r => r.shown === 'popped' || r.shown === 'travel')) throw new Error('FAIL: gem shown before confirmed');
      if (snap.win) throw new Error('FAIL: win shown before confirmed');
    }
    if (shown === 'swirl' && !shots.has('swirl')) { shots.add('swirl'); await shot(page, `${prefix}swirl.png`); }
    if (shown === 'beam' && !shots.has('beam')) { shots.add('beam'); await page.waitForTimeout(1500); await shot(page, `${prefix}beam.png`); }
    if (st === 'confirmed' && w.popped.length > poppedBefore) {
      assert(proofs.size > 0, 'UI confirmed only after the API reported confirmed');
      const p = [...proofs.values()].at(-1);
      assert(p.confirmations?.length === 2 && new Set(p.confirmations.map(x => new URL(x.rpc).hostname)).size === 2, 'two independent Sepolia RPC proofs');
      assert(p.confirmations.every(x => x.status === 1 && x.hash === p.evmTx.hash), 'both receipts successful and matching');
      await page.waitForTimeout(1200);
      await shot(page, `${prefix}confirmed.png`);
      return p;
    }
    if (st === 'signature_failed') throw new Error('FAIL: signature_failed');
    await page.waitForTimeout(700);
  }
  throw new Error('FAIL: Portal confirmation timeout, last status ' + prev);
}

const browser = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(process.env.UI_STORAGE_STATE ? { storageState: process.env.UI_STORAGE_STATE } : {}) });
  const page = await ctx.newPage();
  watchErrors(page, errors);
  const proofs = observe(page);
  await page.goto(BASE + (process.env.UI_LOWFX==='1'?'/?level=2&lowfx=1&intro=0':'/?level=2&fx=high&intro=0'));
  await page.waitForFunction(() => window.__ww && window.__game, null, { timeout: 60000 });
  assert(await page.locator('[data-testid="mock-badge"]').count() === 0, 'live mode (no MOCK DATA badge)');
  assert((await page.evaluate(() => window.__game.state().mode)) === 'live', 'API mode live');
  await page.waitForTimeout(4000);
  console.log(ts(), 'next action:', await page.innerText('[data-testid="next-hint"]'));
  console.log(ts(), 'run button:', (await page.innerText('[data-testid="run-real"]')).replace(/\n/g, ' | '));
  await shot(page, 'game-live-01-ready.png');
  await page.click('[data-testid="run-real"]');
  let last = '';
  const endOrder = Date.now() + 180000;
  while (Date.now() < endOrder) {
    const s = await page.evaluate(() => window.__game.state().run);
    const cap = await page.innerText('[data-testid="run-caption"]').catch(() => '');
    if (s.phase !== last) { console.log(ts(), 'phase', s.phase, '·', cap); last = s.phase; }
    if (s.phase === 'error') throw new Error('FAIL: run error: ' + s.error);
    if (s.phase === 'unknown') throw new Error('FAIL: order outcome unknown');
    if (s.phase === 'portal' || s.phase === 'done') break;
    await page.waitForTimeout(500);
  }
  const run = await page.evaluate(() => window.__game.state().run);
  console.log(ts(), 'account', run.account, '| machine', run.machineId, run.reused ? '(already published)' : '');
  console.log(ts(), 'publish tx', run.publishTx?.explorerUrl ?? '(reused)');
  console.log(ts(), 'order tx  ', run.orderTx?.explorerUrl, '| vault', run.vault, 'portal fee', run.fee, 'wei', run.wei);
  assert(NEAR_TX.test(run.orderTx?.explorerUrl ?? ''), 'order has a real NEAR explorer link');
  await page.waitForTimeout(2500);
  await shot(page, 'game-live-02-real-coins.png');
  const proof = await followPortal(page, proofs, 'game-live-03-');
  console.log(ts(), 'Sepolia tx', proof.evmTx?.explorerUrl);
  assert(await page.locator('[data-testid="win2"]').count() === 1, 'Level 2 goal met (real)');
  const links = await page.locator('[data-testid="portal-card"] a').evaluateAll(xs => xs.map(x => x.href));
  console.log(ts(), 'Portal card links:', links.join(' '));
  assert(links.some(u => NEAR_TX.test(u)) && links.some(u => SEPOLIA_TX.test(u)), 'Portal card links the NEAR tx and the Sepolia tx');

  await page.click('[data-testid="ledger-button"]');
  const kinds = run.reused ? ['order', 'payout'] : ['publish', 'order', 'payout'];
  for (const kind of kinds) {
    const row = page.locator(`[data-testid="ledger"] [data-testid="ledger-${kind}"]`).first();
    assert(await row.getAttribute('data-status') === 'confirmed', `ledger ${kind} confirmed`);
    const urls = await row.locator('a').evaluateAll(xs => xs.map(x => x.href));
    assert(urls.some(u => NEAR_TX.test(u)), `ledger ${kind} links NEAR: ${urls.join(' ')}`);
    if (kind === 'payout') assert(urls.some(u => SEPOLIA_TX.test(u)), 'ledger payout links Sepolia');
  }
  const rowsText = await page.innerText('[data-testid="ledger"]');
  assert(!/simulated/i.test(rowsText.replace(/Simulated customers never appear here[^.]*\./, '')), 'no simulated rows in the ledger');
  await shot(page, 'game-live-04-ledger.png');
  await page.click('[aria-label="Close ledger"]');

  if (!process.env.UI_SKIP_APP) {
    await page.click('[data-testid="open-app"]');
    await page.waitForURL('**/m/**');
    await page.waitForSelector('[data-testid="app-title"]', { timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="app-pay"]')?.disabled, null, { timeout: 60000 });
    console.log(ts(), 'app URL', page.url(), '| total', await page.innerText('[data-testid="app-total"]'));
    await page.waitForTimeout(1500);
    await shot(page, 'game-live-05-app.png');
    const proofs2 = observe(page);
    await page.click('[data-testid="app-pay"]');
    await page.waitForSelector('[data-testid="app-receipt"]', { timeout: 120000 });
    console.log(ts(), 'app order tx', await page.locator('[data-testid="app-receipt"] header a').first().getAttribute('href'));
    const p2 = await followPortal(page, proofs2, 'game-live-06-app-');
    console.log(ts(), 'app Sepolia tx', p2.evmTx?.explorerUrl);
  }
  await ctx.storageState({ path: '/opt/ww-secrets/game-live-state.json' });
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
console.log('console errors: ' + errors.length);
if (errors.length) { console.log(errors.join('\n')); process.exitCode = 1; }
console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS');
