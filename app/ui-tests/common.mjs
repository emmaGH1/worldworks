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
  page.on('requestfailed', r => {
    // Chromium may cancel an icon fetch when a fixture reloads or its context closes.
    if (r.failure()?.errorText === 'net::ERR_ABORTED' && /\/brand\/mark-(64|180)\.png$/.test(r.url())) return;
    if (!/fonts\.(googleapis|gstatic)/.test(r.url())) sink.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
}
