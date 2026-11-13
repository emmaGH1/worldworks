// Records the WORLDWORKS demo footage against a LIVE testnet app (docs/demo/STORYBOARD.md §4).
// Sends real NEAR testnet + Sepolia transactions (one publish, two orders, two Portal payouts). Never mainnet.
//
//   UI_BASE=http://127.0.0.1:4202 INSTABOX_HEADLESS=1 [DEMO_OUT=/opt/ww-video/take-N] [DEMO_RECIPIENT=0x...] \
//     node ui-tests/record-demo.mjs
//   Explorer pages only, for an existing take: DEMO_OUT=<take dir> DEMO_EXPLORERS_FROM=<take dir> node ui-tests/record-demo.mjs
//
// Refuses to record (and deletes any partial video) if the app is in mock mode or MOCK DATA appears anywhere.
// Screencast frames (Chrome's own timestamps) are piped straight into ffmpeg as constant-30 fps H.264,
// so no JPEG frames are kept on disk. Stills for docs are viewport-only screenshots (no fullPage resize,
// which would show in the screencast).
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium, CHROME, BASE, SOCKET } from './common.mjs';
import { observe } from './live-common.mjs';

const OUT = process.env.DEMO_OUT ?? '/opt/ww-video/take-' + new Date().toISOString().replace(/[:.]/g, '-');
const RECIPIENT = process.env.DEMO_RECIPIENT ?? '0x000000000000000000000000000000000000dEaD';
const FPS = 30;
// 1440×810 CSS px at device scale 4/3 = 1920×1080 output pixels: the same layout as the docs screenshots, with ~33% larger text in the video.
const VIEW = { width: 1440, height: 810 }, DSF = 4 / 3;
mkdirSync(OUT + '/stills', { recursive: true });

const marks = [];
const clips = {};
const links = {};
const mark = (name, extra = {}) => { const m = { name, epoch: Date.now() / 1000, ...extra }; marks.push(m); console.log('mark', name, JSON.stringify(extra)); };
const bbox = async (page, sel) => (await page.locator(sel).first().boundingBox().catch(() => null)) ?? null;
const hold = (page, ms) => page.waitForTimeout(ms);
const save = (extra = {}) => writeFileSync(OUT + '/marks.json', JSON.stringify({ base: BASE, recipient: RECIPIENT, fps: FPS, viewport: VIEW, deviceScaleFactor: DSF, bboxUnits: 'CSS px (× deviceScaleFactor = video px)', clips, marks, links, ...extra }, null, 1));
const still = (page, name) => page.screenshot({ path: `${OUT}/stills/${name}.png` });

// ---- Mock guard -----------------------------------------------------------------------------------
async function assertLive(page, where) {
  const badge = await page.locator('[data-testid="mock-badge"]').count();
  const text = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '');
  if (badge || /mock data|simulated by the mock/i.test(text)) throw Error(`MOCK DATA present (${where}): refusing to record`);
}

// ---- Master capture: CDP screencast → ffmpeg (constant 30 fps from Chrome's frame timestamps) -------
async function screencast(context, page, label) {
  const file = `${OUT}/${label}.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', '-',
    '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-g', String(FPS),
    '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r));
  const cdp = await context.newCDPSession(page);
  let t0 = null, written = 0, last = null, frames = 0;
  cdp.on('Page.screencastFrame', async f => {
    const buf = Buffer.from(f.data, 'base64');
    const ts = f.metadata.timestamp;
    if (t0 === null) t0 = ts;
    const target = Math.floor((ts - t0) * FPS);
    while (last && written < target) { ff.stdin.write(last); written++; }
    last = buf; frames++;
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  let stopped = false;
  const stop = async ({ discard = false } = {}) => {
    if (stopped) return; stopped = true;
    try { await cdp.send('Page.stopScreencast'); } catch {}
    const end = Date.now() / 1000;
    if (last && t0 !== null) { const target = Math.floor((end - t0) * FPS); while (written <= target) { ff.stdin.write(last); written++; } }
    ff.stdin.end(); await done;
    clips[label] = { file: `${label}.mp4`, t0, end, frames, written, seconds: written / FPS };
    if (discard || !last) { rmSync(file, { force: true }); clips[label].discarded = true; }
    console.log('clip', label, JSON.stringify(clips[label]));
  };
  return stop;
}

// ---- A visible cursor drawn in the page (headless video has none), plus a drag image for HTML5 drags,
// standing in for the browser's own drag image that headless screencasts do not paint. ----------------
const CURSOR = () => {
  const add = () => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div'); c.id = '__demo_cursor';
    c.innerHTML = '<div id="__demo_ghost" style="position:absolute;left:14px;top:18px;opacity:.85;display:none;filter:drop-shadow(0 6px 0 rgba(36,32,58,.18))"></div><svg width="28" height="34" viewBox="0 0 28 34" style="position:relative"><path d="M3 2l20 18-9 1.5 5 10-4 2-5-10-7 6z" fill="#24203A" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px);transition:scale .08s';
    document.documentElement.appendChild(c);
    const ghost = c.querySelector('#__demo_ghost');
    const move = e => { if (e.clientX || e.clientY) c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`; };
    for (const t of ['mousemove', 'dragover', 'drag']) addEventListener(t, move, true);
    addEventListener('mousedown', () => (c.style.scale = '0.86'), true);
    addEventListener('mouseup', () => (c.style.scale = '1'), true);
    addEventListener('dragstart', e => { const el = e.target.closest?.('[draggable="true"]'); if (el) { const k = el.cloneNode(true); k.removeAttribute('data-testid'); k.classList.remove('try'); k.style.cssText = `width:${el.offsetWidth}px;pointer-events:none;margin:0`; ghost.replaceChildren(k); ghost.style.display = 'block'; } }, true);
    const end = () => { c.style.scale = '1'; ghost.style.display = 'none'; ghost.replaceChildren(); };
    addEventListener('drop', end, true); addEventListener('dragend', end, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', add); else add();
};

async function glideTo(page, sel, steps = 28) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw Error('no bbox for ' + sel);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y, { steps });
  return { x, y };
}
async function clickVisible(page, sel) { await glideTo(page, sel); await hold(page, 250); await page.click(sel); }

// Mirrors live-common.confirmed(), but marks every status change for the edit.
async function portalMarks(page, prefix, proofs, root = '') {
  const sel = `${root} [data-testid="portal-steps"]`.trim();
  await page.waitForSelector(sel, { timeout: 90000 });
  mark(prefix + 'portal-visible');
  let prev; const end = Date.now() + 300000;
  while (Date.now() < end) {
    const s = await page.getAttribute(sel, 'data-status');
    if (s !== prev) { mark(prefix + 'portal-' + s); prev = s; await assertLive(page, prefix + 'portal-' + s); }
    if (s === 'confirmed') {
      if (proofs.size === 0) throw Error('UI confirmed before API confirmation was observed');
      return [...proofs.values()].at(-1);
    }
    if (s === 'signature_failed') throw Error('Portal signature failed');
    await hold(page, 200);
  }
  throw Error('Portal confirmation timeout');
}

// ---- S5: the real explorer pages for the payout just recorded --------------------------------------
// The app's NEAR links go to explorer.testnet.near.org, which is now an explorer *selector* page; the NEAR
// proof opens the same transaction on the selector's "Recommended" explorer, NEAR Rocks (NearBlocks as the
// fallback). Sepolia: Etherscan first; if it serves a bot challenge (Cloudflare does to headless Chrome),
// wait and retry once, then Blockscout. No attempt is made to get past a challenge.
// DEMO_EXPLORERS_FROM=<take dir> re-records only these pages from that take's links (no new transactions).
async function recordExplorers() {
  const xctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF, userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36' });
  await xctx.addInitScript(CURSOR);
  // Third-party ad requests are blocked (as an ad blocker would): Blockscout otherwise fills its "Sponsored"
  // row with a display ad. Explorer content itself is not altered.
  const AD_HOSTS = /(^|\.)(doubleclick\.net|googlesyndication\.com|adtrafficquality\.google|adx\.ws|id5-sync\.com|amazon-adsystem\.com|coinzilla\.(io|com)|bitmedia\.io|slise\.xyz|hypelab\.com)$/;
  await xctx.route(u => AD_HOSTS.test(u.hostname), r => r.abort());
  const challenged = async p => /just a moment|attention required|access denied|forbidden|verify you are human|explorer selector/i.test((await p.title().catch(() => '')) + ' ' + (await p.evaluate(() => document.body?.innerText.slice(0, 400) ?? '').catch(() => '')));
  const nearTx = links.near?.split('/').pop();
  for (const [label, url, fallback] of [
    ['near', `https://testnet.near.rocks/tx/${nearTx}`, `https://testnet.nearblocks.io/txns/${nearTx}`],
    ['sepolia', links.sepolia, links.sepolia?.replace('https://sepolia.etherscan.io/tx/', 'https://eth-sepolia.blockscout.com/tx/')],
  ]) {
    const p = await xctx.newPage();
    let shown = url;
    await p.goto(url, { waitUntil: 'load', timeout: 60000 }).catch(() => {});
    await hold(p, 6000);
    if (await challenged(p)) { await hold(p, 15000); }
    if (await challenged(p)) { await p.reload({ waitUntil: 'load', timeout: 60000 }).catch(() => {}); await hold(p, 12000); }
    if (await challenged(p)) {
      if (!fallback) throw Error(label + ' explorer page unavailable');
      mark(label + '-fallback', { from: url, url: fallback }); await p.goto(fallback, { waitUntil: 'load', timeout: 60000 }); shown = fallback; await hold(p, 8000);
    }
    await p.mouse.move(300, 220);
    // Record the settled page (the loading flash is not useful footage).
    const stop = await screencast(xctx, p, label);
    await hold(p, 300);
    const box = re => p.getByText(re).first().boundingBox({ timeout: 4000 }).catch(() => null);
    mark(label + '-loaded', { url: shown, title: await p.title(), success: await box(/^\s*success\s*$/i), from: await box(/0x694a/i) });
    await still(p, `${label}-explorer`);
    await p.mouse.move(570, 390, { steps: 25 });
    await hold(p, 4500);
    // NEAR: scroll to the receipt where the contract calls the Chain Signatures signer.
    const signer = label === 'near' ? await p.getByText('v1.signer-prod.testnet').first().boundingBox({ timeout: 3000 }).catch(() => null) : null;
    if (signer) {
      mark('near-scroll', { to: signer });
      await p.evaluate(y => window.scrollTo({ top: y, behavior: 'smooth' }), Math.max(0, signer.y - 260));
      await hold(p, 1500);
      mark('near-signer', { box: await p.getByText('v1.signer-prod.testnet').first().boundingBox().catch(() => null) });
      await still(p, 'near-explorer-signer');
      await hold(p, 4500);
    } else if (label === 'sepolia') {
      // Bring the From row (the Chain Signatures treasury) into frame together with Status.
      mark('sepolia-scroll');
      await p.evaluate(() => window.scrollTo({ top: 230, behavior: 'smooth' }));
      await hold(p, 1500);
      mark('sepolia-scrolled', { success: await box(/^\s*success\s*$/i), from: await box(/0x694a/i) });
      await still(p, 'sepolia-explorer-from');
      await hold(p, 4500);
    } else await hold(p, 4500);
    await stop();
    links[label + 'Shown'] = shown;
    await p.close();
  }
  await xctx.close();
}

if (process.env.DEMO_EXPLORERS_FROM) {
  const prev = JSON.parse(readFileSync(process.env.DEMO_EXPLORERS_FROM + '/marks.json', 'utf8'));
  marks.push(...prev.marks.filter(m => !/^(near|sepolia)-/.test(m.name)));
  Object.assign(clips, prev.clips); delete clips.near; delete clips.sepolia;
  Object.assign(links, prev.links);
  links.nearApp = links.near;
}

const headless = process.env.INSTABOX_HEADLESS !== '0';
const browser = await chromium.launch({ executablePath: CHROME, headless, args: ['--no-sandbox', '--hide-scrollbars'] });
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF });
await context.addInitScript(CURSOR);
const page = await context.newPage();
const proofs = observe(page);
let stopWs = null;

try {
  if (process.env.DEMO_EXPLORERS_FROM) { await recordExplorers(); save(); console.log('EXPLORERS RECORDED', OUT, links.nearShown, links.sepoliaShown); process.exit(0); }
  // ---- S1: the broken machine (screencast starts only once live mode is proven) ----------------------
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="part-slot"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="serve"]')?.disabled, null, { timeout: 120000 });
  await page.evaluate(() => document.fonts.ready);
  await assertLive(page, 'workshop load');
  if ((await page.locator('[data-testid="stamp"]').innerText()) !== 'BROKE') throw Error('machine did not open broken');
  await page.mouse.move(720, 560);
  await hold(page, 800);
  stopWs = await screencast(context, page, 'ws');
  await hold(page, 400);
  mark('ready', { stamp: await bbox(page, '[data-testid="stamp"]'), socket: await bbox(page, SOCKET), serveText: await page.locator('[data-testid="serve"]').innerText() });
  await still(page, 'live-01-broken');
  await hold(page, 6000);

  // ---- S2: drag the Splitter onto the pipe ----------------------------------------------------------
  await page.waitForSelector(SOCKET);
  mark('drag-start', { palette: await bbox(page, '[data-testid="palette-Splitter"]') });
  await glideTo(page, '[data-testid="palette-Splitter"]', 30);
  await hold(page, 350);
  await page.mouse.down();
  const s = await bbox(page, SOCKET);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2, { steps: 40 });
  await hold(page, 250);
  await page.mouse.up();
  try { await page.waitForSelector('[data-part-type="Splitter"]', { timeout: 3000 }); }
  catch { mark('drag-fallback'); await page.dragAndDrop('[data-testid="palette-Splitter"]', SOCKET); await page.waitForSelector('[data-part-type="Splitter"]'); }
  mark('splitter-drop');
  await hold(page, 700);
  if ((await page.locator('[data-testid="stamp"]').innerText()) !== 'RUNNING') throw Error('Splitter did not validate');
  mark('splitter-in', { serveText: await page.locator('[data-testid="serve"]').innerText() });
  await page.mouse.move(900, 480, { steps: 20 });
  await hold(page, 1200);
  await still(page, 'live-02-splitter');
  await hold(page, 2300);

  // ---- S3: serve a customer -------------------------------------------------------------------------
  await clickVisible(page, '[data-testid="serve"]');
  mark('serve-click');
  await page.mouse.move(1080, 600, { steps: 18 });
  await page.waitForSelector('[data-testid="goal-1"][data-state="done"]', { timeout: 120000 });
  if (!(Number(await page.locator('[data-testid="kept-total"]').innerText()) > 0)) throw Error('no real reserve after sale');
  await assertLive(page, 'order done');
  mark('order-done', { reserve: await bbox(page, '[data-testid="reserve"]'), kept: await page.locator('[data-testid="kept-total"]').innerText() });

  // ---- S4: the Portal walks to Confirmed ------------------------------------------------------------
  const p1 = await portalMarks(page, '', proofs);
  await page.waitForSelector('[data-testid="receipts"]');
  await hold(page, 400);
  links.near = await page.locator('[data-testid="receipts"] .receipt.near a').first().getAttribute('href');
  links.sepolia = await page.locator('[data-testid="receipts"] a[href^="https://sepolia.etherscan.io/tx/0x"]').first().getAttribute('href');
  links.proof = p1;
  mark('portal-confirmed-boxes', { card: await bbox(page, '[data-testid="portal-card"]'), receipts: await bbox(page, '[data-testid="receipts"]'), vault: await page.locator('[data-testid="vault-on-chain"]').innerText().catch(() => null), steps: await page.locator('[data-testid="portal-steps"]').innerText() });
  save();
  await still(page, 'live-04-confirmed');
  await hold(page, 4000);

  // ---- S6: the ledger --------------------------------------------------------------------------------
  await clickVisible(page, '[data-testid="ledger-button"]');
  await page.waitForSelector('[data-testid="ledger-drawer"] [data-testid="ledger-payout"]');
  await hold(page, 700);
  mark('ledger-open', { drawer: await bbox(page, '[data-testid="ledger-drawer"]') });
  links.ledger = await page.locator('[data-testid="ledger-drawer"] a').evaluateAll(xs => xs.map(x => x.href));
  await still(page, 'live-05-ledger');
  await hold(page, 4000);
  await glideTo(page, '[aria-label="Close ledger"]', 16);
  await page.click('[aria-label="Close ledger"]');
  await hold(page, 700);

  // ---- S7: open as app, pay from the standalone page ------------------------------------------------
  await clickVisible(page, '[data-testid="open-app"]');
  mark('open-app-click');
  await page.waitForURL('**/m/**', { timeout: 120000 });
  await page.waitForSelector('[data-testid="checkout"]', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await assertLive(page, 'standalone page');
  links.app = page.url();
  mark('app-loaded', { checkout: await bbox(page, '[data-testid="checkout"]') });
  await hold(page, 3000);
  await clickVisible(page, '[data-testid="app-recipient"]');
  await page.locator('[data-testid="app-recipient"]').fill('');
  mark('app-type');
  await page.locator('[data-testid="app-recipient"]').pressSequentially(RECIPIENT, { delay: 28 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="app-pay"]')?.disabled, null, { timeout: 60000 });
  await assertLive(page, 'standalone ready');
  mark('app-ready', { total: await page.locator('[data-testid="app-total"]').innerText(), pay: await page.locator('[data-testid="app-pay"]').innerText() });
  await still(page, 'live-06-app');
  await hold(page, 500);
  await clickVisible(page, '[data-testid="app-pay"]');
  mark('app-pay-click');
  await page.mouse.move(1180, 560, { steps: 18 });
  await page.waitForSelector('[data-testid="app-receipts"]', { timeout: 120000 });
  links.appNear = await page.locator('[data-testid="app-receipts"] a').first().getAttribute('href');
  await page.locator('[data-testid="app-receipts"]').evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  const p2 = await portalMarks(page, 'app-', proofs);
  links.appProof = p2;
  await page.locator('[data-testid="app-receipts"]').evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await hold(page, 900);
  links.appSepolia = await page.locator('[data-testid="app-receipts"] a[href^="https://sepolia.etherscan.io/tx/0x"]').first().getAttribute('href').catch(() => null);
  mark('app-receipts-boxes', { receipts: await bbox(page, '[data-testid="app-receipts"]') });
  await still(page, 'live-07-app-paid');
  await hold(page, 4500);

  // ---- S8: what's real ------------------------------------------------------------------------------
  await page.goto(BASE + '/verify');
  await page.waitForSelector('[data-testid="verify-page"]');
  await page.evaluate(() => document.fonts.ready);
  mark('verify-loaded');
  await hold(page, 2000);
  mark('verify-scroll');
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await hold(page, 4000);
  await stopWs(); stopWs = null;
  save();

  // ---- S5: the real explorers (recorded last, placed after S4 in the edit) ---------------------------
  await recordExplorers();
  save();
  console.log('RECORDED', OUT, JSON.stringify({ near: links.near, sepolia: links.sepolia, nearShown: links.nearShown, sepoliaShown: links.sepoliaShown, app: links.app }));
} catch (e) {
  console.error(e);
  const mock = /MOCK DATA/.test(String(e));
  if (stopWs) await stopWs({ discard: mock });
  if (mock) for (const f of ['ws.mp4', 'near.mp4', 'sepolia.mp4']) if (existsSync(`${OUT}/${f}`)) rmSync(`${OUT}/${f}`);
  save({ error: String(e) }); process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
