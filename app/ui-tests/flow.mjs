// Acceptance check 3 + 4: the first-60-seconds flow in mock mode, asserted, with no console errors.
import { launch, watchErrors, openWorkshop, dropSplitterOnPipe, text } from './common.mjs';

const errors = [];
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)}s]`, ...a);
const assert = (cond, msg) => { if (!cond) { console.log('FAIL:', msg); process.exitCode = 1; throw new Error(msg); } log('ok  ', msg); };

const browser = await launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  watchErrors(page, errors);
  await openWorkshop(page);
  assert(await page.isVisible('[data-testid="mock-badge"]'), 'MOCK DATA badge is visible in mock mode');
  assert((await text(page, '[data-testid="stamp"]')) === 'BROKE', 'broken Lemonade Machine opens with the BROKE stamp');
  assert((await page.locator('[data-part-type="Splitter"]').count()) === 0, 'no Splitter on the board at start');
  assert((await page.getAttribute('[data-testid="goal-1"]', 'data-state')) === 'todo', 'goal 1 is open');

  await dropSplitterOnPipe(page);
  assert((await page.locator('[data-part-type="Splitter"]').count()) === 1, 'Splitter dropped onto the Coin Slot -> Portal pipe');
  assert((await page.locator('[data-part-type="Vault"]').count()) === 1, 'a reserve Vault came with it');
  assert((await text(page, '[data-testid="stamp"]')) === 'RUNNING', 'machine validates in the wasm engine (stamp RUNNING)');
  log('preview:', await text(page, '[data-testid="preview-line"]'));

  await page.click('[data-testid="serve"]');
  await page.waitForSelector('[data-testid="customer"][data-phase="walking"]', { timeout: 10000 });
  log('seeded customer walking in:', await text(page, '[data-testid="customer"] .bubble'));
  await page.waitForFunction(() => document.querySelector('[data-testid="goal-1"]')?.getAttribute('data-state') === 'done', null, { timeout: 20000 });
  const kept = await text(page, '[data-testid="kept-total"]');
  const vault = await text(page, '[data-testid="vault-on-chain"]').catch(() => '');
  log(`sales=${await text(page, '[data-testid="sales-count"]')} kept=${kept} NEAR vault=${vault} NEAR`);
  assert(Number(kept) > 0, `reserve > 0 after a sale (kept ${kept} NEAR)`);
  assert((await page.getAttribute('[data-testid="goal-2"]', 'data-state')) !== 'locked', 'goal 2 unlocked');
  await page.click('[data-testid="ledger-button"]');
  const order = page.locator('[data-testid="ledger-drawer"] [data-testid="ledger-order"]').first();
  assert((await order.getAttribute('data-status')) === 'confirmed', 'ledger drawer has the order row, marked confirmed (mock)');
  assert((await order.textContent()).includes('storage fee'), 'order row shows the storage fee');
  await page.click('[aria-label="Close ledger"]');

  await page.waitForSelector('[data-testid="portal-steps"]');
  const seen = new Set();
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const s = await page.getAttribute('[data-testid="portal-steps"]', 'data-status');
    if (!seen.has(s)) {
      seen.add(s); log('portal status:', s);
      if (s !== 'confirmed') assert(!(await page.isVisible('[data-testid="receipts"]')), `no receipts or "confirmed" shown while ${s}`);
    }
    if (s === 'confirmed') break;
    await page.waitForTimeout(400);
  }
  assert([...seen].join(' > ') === 'awaiting_signature > signed > broadcast > confirmed' || [...seen].join(' > ') === 'awaiting_signature > broadcast > confirmed', `Portal went through its states in order (${[...seen].join(' > ')})`);
  assert(await page.isVisible('[data-testid="receipts"]'), 'two receipts shown once confirmed');
  assert((await page.getAttribute('[data-testid="goal-2"]', 'data-state')) === 'done', 'goal 2 done: paid a customer on Ethereum (mock)');
  log(`total flow ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} finally {
  await browser.close();
}
console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):\n` + errors.join('\n') : 'console errors: 0');
if (errors.length) process.exitCode = 1;
console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS');
