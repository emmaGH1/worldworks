// Shared helpers for the UI checks (spec UI-1). Runs against `vite preview` in MOCK mode (no VITE_CONTRACT_ID).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const { chromium } = require('/opt/ww-shot/node_modules/playwright-core');
export const CHROME = '/data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome';
export const BASE = process.env.UI_BASE ?? 'http://127.0.0.1:4180';

export async function launch() {
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
}

/** Collects console errors and page errors so a run can assert there were none. */
export function watchErrors(page, sink) {
  page.on('console', m => { if (m.type() === 'error') sink.push(`console: ${m.text()} ${m.location()?.url ?? ''}`); });
  page.on('pageerror', e => sink.push(`pageerror: ${e.message}`));
  page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) sink.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
}

export const SOCKET = '[data-testid="socket-e|slot|out"]';

export async function openWorkshop(page) {
  await page.goto(BASE + '/');
  await page.waitForSelector('[data-testid="part-slot"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="serve"]')?.hasAttribute('disabled'), null, { timeout: 15000 });
  await page.waitForTimeout(500);
}

export async function dropSplitterOnPipe(page) {
  await page.waitForSelector(SOCKET);
  await page.dragAndDrop('[data-testid="palette-Splitter"]', SOCKET);
  await page.waitForSelector('[data-part-type="Splitter"]');
  await page.waitForTimeout(700);
}

export const text = async (page, sel) => (await page.textContent(sel))?.trim() ?? '';
