// Acceptance check 2: headless screenshots of the key states, saved to docs/design/screens/.
import { launch, watchErrors, openWorkshop, dropSplitterOnPipe, BASE } from './common.mjs';
import { mkdirSync } from 'node:fs';
const OUT = new URL('../../docs/design/screens/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);
const want = n => !only.length || only.includes(n);
const errors = [];
const saved = [];
const shot = async (page, name, opts = {}) => { await page.screenshot({ path: OUT + name, ...opts }); saved.push(name); console.log('saved', 'docs/design/screens/' + name); };

const browser = await launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watchErrors(page, errors);
  if (want('workshop')) {
    await openWorkshop(page);
    await shot(page, '01-workshop-broken.png');
    await dropSplitterOnPipe(page);
    await page.mouse.move(700, 600);
    await page.waitForTimeout(600);
    await shot(page, '02-splitter-inserted.png');
    await page.click('[data-testid="serve"]');
    await page.waitForTimeout(5600);
    await shot(page, '03-coins-flowing.png');
    await page.waitForSelector('[data-testid="portal-steps"]');
    await page.waitForTimeout(3000);
    await shot(page, '04-portal-pending.png');
    await page.waitForSelector('[data-testid="portal-steps"][data-status="broadcast"]', { timeout: 30000 });
    await page.waitForTimeout(2500);
    await shot(page, '05-portal-broadcast.png');
    await page.waitForSelector('[data-testid="portal-steps"][data-status="confirmed"]', { timeout: 30000 });
    await page.waitForTimeout(1800);
    await shot(page, '06-portal-confirmed.png');
    await page.click('[data-testid="ledger-button"]');
    await page.waitForTimeout(700);
    await shot(page, '07-ledger-drawer.png');
  }
  if (want('app')) {
    await page.goto(BASE + '/m/lemonade');
    await page.waitForSelector('[data-testid="checkout"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="app-pay"]')?.hasAttribute('disabled') || true);
    await page.waitForTimeout(1200);
    await shot(page, '08-app-lemonade.png', { fullPage: true });
    await page.fill('[data-testid="app-recipient"]', '0x5eeD00000000000000000000000000000000c0DE');
    await page.click('[data-testid="app-pay"]');
    await page.waitForSelector('[data-testid="app-receipts"]', { timeout: 15000 });
    await page.waitForTimeout(4000);
    await shot(page, '09-app-lemonade-paid.png', { fullPage: true });
  }
  if (want('verify')) {
    await page.goto(BASE + '/verify');
    await page.waitForSelector('[data-testid="real-table"]');
    await page.waitForTimeout(900);
    await shot(page, '10-verify.png', { fullPage: true });
  }
  if (want('escrow')) {
    await openWorkshop(page);
    await page.click('[data-testid="templates-button"]');
    await page.click('text=Escrow with an Inspector');
    await page.waitForTimeout(900);
    await shot(page, '11-escrow-template.png');
  }
  if (want('mobile')) {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mp = await m.newPage();
    watchErrors(mp, errors);
    await openWorkshop(mp);
    await shot(mp, '12-workshop-390.png');
    await mp.goto(BASE + '/m/lemonade');
    await mp.waitForSelector('[data-testid="checkout"]');
    await mp.waitForTimeout(900);
    await shot(mp, '13-app-390.png', { fullPage: true });
  }
} finally {
  await browser.close();
}
console.log(errors.length ? `CONSOLE ERRORS (${errors.length}):\n` + errors.join('\n') : 'console errors: 0');
