// Capture the literal on-screen text of the first 90 seconds of GAME-3 at 390px: a paced, no-spend walkthrough of job 1
// with one wrong build (even split) and the fix. Uses the 2D fallback (identical DOM copy) so software-GPU timing does not distort pacing.
//   UI_BASE=http://127.0.0.1:4260 node ui-tests/game3-first90.mjs   → docs/game3-first90.json
import { launch } from './common.mjs'; import { writeFileSync } from 'node:fs';
const b = await launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const T = id => p.locator(`[data-testid="${id}"]`);
await p.goto((process.env.UI_BASE ?? 'http://127.0.0.1:4260') + '/?webgl=0&lowfx=1'); await T('intro').waitFor({ timeout: 60000 });
await p.evaluate(() => {
  window.__copy = []; const start = performance.now(); window.__t0 = start; let prior = '';
  const visible = () => { const intro = document.querySelector('[data-testid=intro]'); if (intro) return intro.innerText; const card = document.querySelector('[data-testid=job-card]'); return (card ? card.innerText + '\n---\n' : '') + document.body.innerText.replace(card?.innerText ?? '\u0000', ''); };
  const capture = () => { const text = visible(); if (text !== prior) { window.__copy.push({ seconds: +((performance.now() - start) / 1000).toFixed(1), text }); prior = text; } };
  capture(); const timer = setInterval(() => { capture(); if (performance.now() - start >= 90000) clearInterval(timer); }, 250);
});
const w = ms => p.waitForTimeout(ms);
await w(7000); await T('start').click();
await w(14000); await T('card-go').click();          // reading the job
await w(3000); await T('tray-Splitter').first().click(); await w(1200); await T('socket-r').click();
await w(4000); await T('belt-add').click(); await w(2500); await T('sheet-done').click();
for (const [s, who] of [['r.0', 'ada'], ['r.1', 'bola'], ['r.2', 'chi']]) { await w(1500); await T('tray-Payout').first().click(); await w(900); await T(`socket-${s}`).click(); await w(1300); await T(`who-${who}`).click(); }
await w(2500); await T('test').click(); await T('fail-why').waitFor({ timeout: 60000 });
await w(6000); await T('socket-r').click(); await w(1500);
for (let i = 0; i < 4; i++) { await T('share-0-plus').click(); await w(500); }
for (const l of [1, 2]) for (let i = 0; i < 2; i++) { await T(`share-${l}-minus`).click(); await w(500); }
await w(1500); await T('sheet-done').click(); await w(1500); await T('test').click();
await T('ship').waitFor({ timeout: 60000 });
await p.waitForFunction(() => performance.now() - window.__t0 >= 90500, null, { timeout: 120000, polling: 500 });
const rows = await p.evaluate(() => window.__copy.filter(x => x.seconds <= 90));
writeFileSync(new URL('../../docs/game3-first90.json', import.meta.url), JSON.stringify(rows, null, 2));
console.log('Captured', rows.length, 'literal screen states; last at', rows.at(-1)?.seconds, 's; no shipment'); await b.close();
