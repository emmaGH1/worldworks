# WORLDWORKS demo video: storyboard

Planning doc. Nothing here has been recorded or rendered yet. Two deliverables:

- **Main cut:** 76 s, 1920×1080, 30 fps, H.264 + AAC. For the X post and the submission `demoUrl`.
- **Autoplay cut:** 15 s, same format, silent-safe. It autoplays muted in the X timeline, so every idea must be readable from the captions alone.

Every pixel of product footage is the **real live UI on NEAR testnet + Sepolia**, recorded with Playwright. Title card, captions, speed labels and end card are the only drawn parts. Explorer pages are real pages, recorded live.

Binding rules: [docs/CLAIMS.md](../CLAIMS.md) (the **G6 version**, "Claims after G6") and the official "The demo post" guidance (lead with the user problem; show one complete moment from a real action to a visible result; say concretely what NEAR does; give a next step). Section 7 checks every caption against CLAIMS.

> **G6 note (2026-11-13):** G6 changed the fee configuration and the confirmation rule (Sepolia inclusion now needs matching receipts on two RPC hosts **plus three more blocks on both**). Prices, fees and wait times quoted from the INT-1 evidence (0.10 NEAR price, 0.77 NEAR storage fee, 0.87 total, 5–23 s steps) are **historical**. Captions below avoid fee numbers. Read the real numbers off the UI in the take and use those. Re-check this doc against `docs/CLAIMS.md` and `docs/EVIDENCE-g6.md` before recording.

---

## 1. The story in one breath

A lemonade machine is losing money because its payment rule is wrong. One drag fixes the rule. A customer pays, 70% stays in an on-chain reserve, and the NEAR contract sends 0.001 ETH on Sepolia using Chain Signatures. Both explorers show it. Then the same machine opens as its own payment page.

**The complete moment** (the official guidance asks for one): *drag Splitter → serve a customer → Portal goes from Signing to Confirmed → Sepolia receipt on Etherscan.* The main cut shows this unbroken except for one labeled speed-up. The 15 s cut shows it compressed.

---

## 2. Main cut: shot by shot (76 s)

Layout for every product shot: the recording plays on a "stage" scaled to **78%** (1498×842), top edge at y=54, centred, on the app's ground colour `#F4EEE3`, with radius 20 and card shadow `0 6px 0 #DED2BE`. The band below (y 912–970) holds the caption, so captions never cover the app's own Serve button or Reserve card. Punch-ins zoom the inner stage wrapper, never the timed `<video>`.

Source names refer to the recordings from §4 (`ws.mp4`, `app.mp4`, `near.mp4`, `sepolia.mp4`) and to the marks in `marks.json`. Put the real numbers from `marks.json` into the shot list before building.

| # | Time | On screen (source → what happens) | Caption (burned in, bottom band) | Optional voiceover |
|---|---|---|---|---|
| S0 | 0:00.0–0:03.5 | **Title card** (drawn). Ground `#F4EEE3`. Line 1 appears word by word (blur 6px→0, 0.067 s apart): **"Payment rules hide inside app code."** At 1.6 s line 2 fades from light grey to ink: **"So you can't see where the money goes."** Small WORLDWORKS logo mark bottom-left. | (the title is the caption) | "Payment rules hide inside app code. So you can't see where your money goes." |
| S1 | 0:03.5–0:09.0 | `ws.mp4` at 1×, from `ready` for 5.5 s. Lemonade Machine, **BROKE** stamp, headline "Your machine is losing money." Slow move 1.00→1.06 toward the pipe and the "drop a Splitter here" hint (power2.inOut, the whole shot). | **This machine pays every coin straight out. Nothing is kept.** | "This lemonade machine has a visible bug: every coin goes straight out. Nothing refills the reserve." |
| S2 | 0:09.0–0:15.0 | `ws.mp4` at 1×, from `drag-start − 0.4 s` to `splitter-in + 3.0 s`. The demo cursor picks up **Splitter** from the parts bin, glides along the pipe and drops it on the **+** socket. Stamp flips to **RUNNING**, headline becomes "Now it keeps 70% of every sale.", toast confirms. Punch-in 1.0→1.18 on the canvas centre during the drag, back to 1.0 as the headline changes. | **Drop a Splitter on the pipe. Now 70% stays in a reserve.** | "One drag. A Splitter keeps 70% of every sale in a reserve vault." |
| S3 | 0:15.0–0:23.0 | `ws.mp4`: (a) 1×, 1.5 s: cursor clicks **Serve a customer**; the seeded customer walks in. (b) `serve-click → order-done` at **4×** with the speed tag (§3). (c) 1×, 2.5 s after `order-done`: Reserve ring shows 70% and "vault on chain 0.07 NEAR"; punch-in 1.0→1.3 on the Reserve card (bbox `reserve` in marks). | (a–b) **A seeded test customer pays 0.10 NEAR on NEAR testnet.** (c) **0.07 NEAR is now in the reserve, on chain.** | "A test customer pays. The machine is published to a NEAR contract, and 0.07 NEAR lands in the on-chain reserve." |
| S4 | 0:23.0–0:37.0 | `ws.mp4`: `portal-visible → portal-confirmed` at **4×** with the speed tag and the real-time counter. The Portal card walks *Signing on NEAR → Signed → Broadcast to Sepolia → Confirmed*. Then 1×, 3.0 s on the confirmed card; punch-in 1.0→1.4 onto the two receipt boxes (bbox `receipts`). | During signing: **The NEAR contract writes an Ethereum payment.** At `signed`: **NEAR Chain Signatures signs it. The relayer only broadcasts.** At confirmed: **Included on Sepolia, seen by two RPCs.** | "The contract builds the Sepolia transaction itself and asks NEAR Chain Signatures to sign it. Our relayer just broadcasts the signed bytes. It only shows Confirmed once two separate RPCs return the same successful receipt, three blocks deep." |
| S5 | 0:37.0–0:47.0 | **Proof.** (a) `near.mp4`, 4.0 s: the order transaction on the NEAR testnet explorer (the URL captured from the Portal card's NEAR receipt link), with a slow push toward the status. (b) `sepolia.mp4`, 6.0 s: the Sepolia transaction on **sepolia.etherscan.io**. Punch-in to **Status: Success** (bbox `sepolia-success`), then pan to **From: 0x694A…8b7** (bbox `sepolia-from`). A drawn browser bar above each shows the **real URL** in mono, plus a corner tag **"live explorer page · recorded {{RECORD_DATE}}"**. | (a) **NEAR testnet: the order on the explorer.** (b) **Sepolia: Success. Sent from the address NEAR derived for our contract.** | "Don't take the app's word for it. Here's the order on NEAR, and here's the payment on Sepolia: success, sent from the address Chain Signatures derives for our contract." |
| S6 | 0:47.0–0:51.0 | `ws.mp4` at 1×, from `ledger-open`, 4.0 s: the Ledger drawer slides in with Portal → Sepolia, Seeded customer bought one, Published "Lemonade Machine", Sponsored testnet session, all with explorer links. | **Every step has an explorer link.** | "Every step is in the ledger, with its explorer link." |
| S7 | 0:51.0–1:03.0 | (a) `ws.mp4` 1×, 1.0 s: cursor clicks **Open as app**. Match cut on the click into (b) `app.mp4` 1×, from `app-loaded`, 2.5 s: standalone **Lemonade Machine** payment page, checkout card. (c) 1×, 2.0 s: the address is typed into "Your Ethereum address"; cursor clicks the **Pay** button (label shows the current total). (d) **Cut card**, 0.8 s, full stage ground colour: **"⏭ {{APP_WAIT_S}} s later · cut"**. (e) `app.mp4` 1×, from `app-portal-confirmed`, 3.5 s: page scrolled to **Your receipts**, all four steps green, NEAR receipt + Sepolia receipt. | (a–b) **"Open as app": the same machine is now a payment page with its own URL.** (c–e) **Paid from its own page. Same contract, same rules.** | "Open as app turns the same published machine into a payment page with its own URL. Same contract, same rules." |
| S8 | 1:03.0–1:08.0 | `app.mp4` 1×, from `verify-loaded`, 5.0 s: the **/verify** page ("what's real?"), smooth scroll of ~600 px. | **Testnet only. The app lists what is real and what is simulated.** | "It's a testnet prototype, and the app says exactly what is real and what is simulated." |
| S9 | 1:08.0–1:16.0 | **End card** (drawn). Wordmark **WORLDWORKS**; line **"See your payment rules. Run them on NEAR."**; two rows in mono: **Try it → {{HOSTED_URL}}**, **Code → {{REPO_URL}}**; footer **"Built at NEAR HACKATHON · testnet prototype"**; question chip **"What would you wire first?"**. Behind it, a still of the RUNNING machine (`still-confirmed.png`) at 12% opacity. Hold dead still from 1:10.5. | (the card is the caption) | "Try it in your browser, no wallet needed, and tell us what you'd wire first." |

Total: **76.0 s**. If the real waits run long, S4 is the shot that grows (up to 0:40) and S8 shrinks to 3 s. Never shorten S5 below 8 s; it is the proof.

### Timing rules

- A product shot holds one framing for its whole length; motion comes from the UI itself and from at most one punch-in per shot (hyperframes motion rules: no floating, pulsing or click rings).
- Hold 0.4 s on the final state before each payoff caption (RUNNING, Confirmed, Success).
- Captions: Nunito 800, 40 px, ink `#24203A` on white card, radius 18, padding 14×28, shadow `0 6px 0 #DED2BE`. Max 9 words per line, 2 lines. Enter 0.25 s (opacity + 8 px rise), exit 0.15 s, swap captions on a cut, never mid-word of the VO.

---

## 3. The signing wait: how it is handled honestly

The Portal step has real network waits: NEAR order + publish (~10–20 s), MPC signing (shown in the UI as "usually ~15 s"; ~14 s in rehearsal, 5 s in the INT-1 take), Sepolia mining (10–23 s in the INT-1 takes), and since G6 **three more Sepolia blocks on both RPCs** before Confirmed (~36 s more at 12 s blocks). Expect 60–90 s from Serve to Confirmed. Watching that at 1× kills the video. Rules:

1. **Speed-up, labelled (main method).** Each waiting stretch is its own `<video>` clip with a **constant** `data-playback-rate="4"`. Do not use a `rate` automation ramp: during a ramp the true speed is neither 1× nor 4×, so a "4×" label would be wrong for part of the clip. Constant clips make the label exactly true for its whole length.
2. **Speed tag**, visible for exactly the length of each 4× clip, top-right of the stage: pill, ink background, white mono text **"▶▶ 4× speed · real time 0:14"**. The real-time counter runs from 0 to the measured wait, computed from timeline time: `real = (t − clipStart) × 4`. It must end on the number in `marks.json` (`portal-confirmed − portal-visible`), not on a rounded guess.
3. **Ceiling.** If a wait at 4× would last more than 8 s on screen, raise the constant rate (6×, 8×, at most 10×) and change the tag to match. If the wait from `portal-broadcast` to `portal-confirmed` is long (the three-block wait), it may be a separate clip at a higher rate with its own tag, e.g. "▶▶ 10× speed · waiting for 3 more blocks". Never hide a wait without a tag or a cut card.
4. **Cut, labelled (second method, S7 only).** The standalone payment repeats a step the viewer has just seen, so it is cut, not sped up: a 0.8 s card **"⏭ {{APP_WAIT_S}} s later · cut"**, where `APP_WAIT_S = app-portal-confirmed − app-pay-click`, rounded down to whole seconds.
5. Never cut inside the workshop Portal sequence in the main cut. The viewer must see Signing → Signed → Broadcast → Confirmed happen in order.

---

## 4. Recording: Playwright script

### Prerequisites

- Live API + live frontend, exactly as in [EVIDENCE-ui-live.md § Reproduce](../EVIDENCE-ui-live.md), or the hosted deployment once it exists (preferred: then the footage is the thing judges will open). `UI_BASE` points at it.
- `playwright-core` and Chromium as pinned in `app/ui-tests/common.mjs`. `ffmpeg` on PATH.
- **Funds per take** (this script sends real testnet transactions): one publish deposit + 2 orders (price + storage fee, current values per `EVIDENCE-g6.md`; INT-1 historical: 0.40 deposit, 0.87 NEAR per order) from the sponsored session, and 2 Sepolia payouts × (0.001 ETH + gas) from the shared treasury `0x694A…8b7`. G6 adds per-client session quotas and an epoch payout policy (max 20 payouts per epoch): one take uses 2. Check the sponsor and treasury before each take; budget 3 takes.
- Network fonts must load (Bricolage Grotesque, Nunito, JetBrains Mono from Google Fonts). The script waits for `document.fonts.ready`.
- The script refuses to record if the **MOCK DATA** badge is present. Mock footage must never appear in the video.

### Capture method

Two captures run at once:

- **Master:** Chrome DevTools `Page.startScreencast` JPEG frames (quality 92) at exactly 1920×1080, with Chrome's own frame timestamps. Turned into a constant-30 fps MP4 with ffmpeg. Text stays sharp.
- **Backup:** Playwright `recordVideo` (1920×1080 WebM). Lower bitrate and softer text; use only if the screencast fails.

Headless is fine (`INSTABOX_HEADLESS=1`); the cursor is drawn in the page by the script, because headless video has no system cursor. Watch it live on the desktop instead by leaving `INSTABOX_HEADLESS` unset.

### `app/ui-tests/record-demo.mjs` (builder creates this file)

Selectors come from `flow-live.mjs`, `app-live.mjs`, `live-common.mjs`, `common.mjs` and the app source (`data-testid`s listed there). The drag uses the same palette and socket selectors as `dropSplitterOnPipe`, but moves the real mouse in 40 steps so the drag is visible. If the native drag does not register, it falls back to `page.dragAndDrop` and records `drag-fallback` (re-take in that case, because the fallback drag is instant on screen).

```js
// Records the WORLDWORKS demo footage against a LIVE deployment. Sends real testnet transactions.
// UI_BASE=<url> [DEMO_RECIPIENT=0x...] [DEMO_OUT=/data/workspace/ww-demo/take-N] node ui-tests/record-demo.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, CHROME, BASE, SOCKET } from './common.mjs';
import { observe } from './live-common.mjs';

const OUT = process.env.DEMO_OUT ?? '/data/workspace/ww-demo/take-' + new Date().toISOString().replace(/[:.]/g, '-');
const RECIPIENT = process.env.DEMO_RECIPIENT ?? '0x000000000000000000000000000000000000dEaD';
mkdirSync(OUT + '/frames', { recursive: true });

const marks = [];
const mark = (name, extra = {}) => { const m = { name, epoch: Date.now() / 1000, ...extra }; marks.push(m); console.log('mark', name, JSON.stringify(extra)); };
const bbox = async (page, sel) => (await page.locator(sel).first().boundingBox()) ?? null;
const hold = (page, ms) => page.waitForTimeout(ms);
const save = (extra = {}) => writeFileSync(OUT + '/marks.json', JSON.stringify({ base: BASE, recipient: RECIPIENT, marks, ...extra }, null, 1));

// Master capture: CDP screencast, one JPEG per frame change, with Chrome's epoch timestamps.
async function screencast(context, page, label) {
  const cdp = await context.newCDPSession(page);
  const index = []; let n = 0;
  cdp.on('Page.screencastFrame', async f => {
    const file = `${label}-${String(n++).padStart(6, '0')}.jpg`;
    writeFileSync(`${OUT}/frames/${file}`, Buffer.from(f.data, 'base64'));
    index.push({ file, ts: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  return async () => { try { await cdp.send('Page.stopScreencast'); } catch {} index.push({ end: Date.now() / 1000 }); writeFileSync(`${OUT}/frames/${label}.json`, JSON.stringify(index)); };
}

// A visible cursor drawn in the page (headless video has none). Follows mouse AND HTML5 drag events.
const CURSOR = () => {
  const add = () => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div'); c.id = '__demo_cursor';
    c.innerHTML = '<svg width="28" height="34" viewBox="0 0 28 34"><path d="M3 2l20 18-9 1.5 5 10-4 2-5-10-7 6z" fill="#24203A" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>';
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-200px,-200px);transition:scale .08s';
    document.documentElement.appendChild(c);
    const move = e => { if (e.clientX || e.clientY) c.style.transform = `translate(${e.clientX - 3}px,${e.clientY - 2}px)`; };
    for (const t of ['mousemove', 'dragover', 'drag']) addEventListener(t, move, true);
    addEventListener('mousedown', () => (c.style.scale = '0.86'), true);
    addEventListener('mouseup', () => (c.style.scale = '1'), true);
    addEventListener('drop', () => (c.style.scale = '1'), true);
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
async function portalMarks(page, prefix, proofs) {
  await page.waitForSelector('[data-testid="portal-steps"]', { timeout: 90000 });
  mark(prefix + 'portal-visible');
  let prev; const end = Date.now() + 180000;
  while (Date.now() < end) {
    const s = await page.getAttribute('[data-testid="portal-steps"]', 'data-status');
    if (s !== prev) { mark(prefix + 'portal-' + s); prev = s; }
    if (s === 'confirmed') {
      if (proofs.size === 0) throw Error('UI confirmed before API confirmation was observed');
      return;
    }
    await hold(page, 200);
  }
  throw Error('Portal confirmation timeout');
}

const browser = await chromium.launch({ executablePath: CHROME, headless: process.env.INSTABOX_HEADLESS !== '0', args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  recordVideo: { dir: OUT + '/backup', size: { width: 1920, height: 1080 } },
});
await context.addInitScript(CURSOR);
const page = await context.newPage();
const proofs = observe(page);
const links = {};
const stopWs = await screencast(context, page, 'ws');

try {
  // ---- S1: the broken machine ------------------------------------------------
  await page.goto(BASE);
  await page.waitForSelector('[data-testid="part-slot"]');
  await page.waitForFunction(() => !document.querySelector('[data-testid="serve"]')?.disabled, null, { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator('[data-testid="mock-badge"]').count()) throw Error('MOCK DATA badge present: refusing to record');
  if ((await page.locator('[data-testid="stamp"]').innerText()) !== 'BROKE') throw Error('machine did not open broken');
  await page.mouse.move(960, 700);
  mark('ready', { stamp: await bbox(page, '[data-testid="stamp"]'), socket: await bbox(page, SOCKET) });
  await page.screenshot({ path: OUT + '/still-broken.png' });
  await hold(page, 6000);

  // ---- S2: drag the Splitter onto the pipe ------------------------------------
  await page.waitForSelector(SOCKET);
  mark('drag-start');
  await glideTo(page, '[data-testid="palette-Splitter"]', 30);
  await hold(page, 350);
  await page.mouse.down();
  const s = await bbox(page, SOCKET);
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2, { steps: 40 });
  await hold(page, 250);
  await page.mouse.up();
  try { await page.waitForSelector('[data-part-type="Splitter"]', { timeout: 3000 }); }
  catch { mark('drag-fallback'); await page.dragAndDrop('[data-testid="palette-Splitter"]', SOCKET); await page.waitForSelector('[data-part-type="Splitter"]'); }
  await hold(page, 700);
  if ((await page.locator('[data-testid="stamp"]').innerText()) !== 'RUNNING') throw Error('Splitter did not validate');
  mark('splitter-in');
  await page.mouse.move(1200, 640, { steps: 20 });
  await hold(page, 3500);

  // ---- S3: serve a customer ---------------------------------------------------
  await clickVisible(page, '[data-testid="serve"]');
  mark('serve-click');
  await page.waitForSelector('[data-testid="goal-1"][data-state="done"]', { timeout: 90000 });
  if (!(Number(await page.locator('[data-testid="kept-total"]').innerText()) > 0)) throw Error('no real reserve after sale');
  mark('order-done', { reserve: await bbox(page, '[data-testid="reserve"]') });

  // ---- S4: the Portal walks to Confirmed --------------------------------------
  await portalMarks(page, '', proofs);
  mark('portal-confirmed-boxes', { card: await bbox(page, '[data-testid="portal-card"]'), receipts: await bbox(page, '[data-testid="receipts"]') });
  links.near = await page.locator('[data-testid="receipts"] .receipt.near a').first().getAttribute('href');
  links.sepolia = await page.locator('[data-testid="receipts"] a[href^="https://sepolia.etherscan.io/tx/0x"]').first().getAttribute('href');
  await page.screenshot({ path: OUT + '/still-confirmed.png' });
  await hold(page, 4000);

  // ---- S6: the ledger ---------------------------------------------------------
  await clickVisible(page, '[data-testid="ledger-button"]');
  await page.waitForSelector('[data-testid="ledger-drawer"] [data-testid="ledger-payout"]');
  mark('ledger-open');
  await page.screenshot({ path: OUT + '/still-ledger.png' });
  await hold(page, 4500);
  await page.click('[aria-label="Close ledger"]');
  await hold(page, 600);

  // ---- S7: open as app, pay from the standalone page --------------------------
  await clickVisible(page, '[data-testid="open-app"]');
  mark('open-app-click');
  await page.waitForURL('**/m/**');
  await page.waitForSelector('[data-testid="checkout"]', { timeout: 45000 });
  await page.evaluate(() => document.fonts.ready);
  links.app = page.url();
  mark('app-loaded', { checkout: await bbox(page, '[data-testid="checkout"]') });
  await hold(page, 3000);
  await clickVisible(page, '[data-testid="app-recipient"]');
  await page.locator('[data-testid="app-recipient"]').fill('');
  await page.locator('[data-testid="app-recipient"]').pressSequentially(RECIPIENT, { delay: 28 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="app-pay"]')?.disabled, null, { timeout: 60000 });
  if (await page.locator('[data-testid="mock-badge"]').count()) throw Error('MOCK DATA on standalone page');
  await hold(page, 500);
  await clickVisible(page, '[data-testid="app-pay"]');
  mark('app-pay-click');
  await page.waitForSelector('[data-testid="app-receipts"]', { timeout: 90000 });
  links.appNear = await page.locator('[data-testid="app-receipts"] a').first().getAttribute('href');
  await page.locator('[data-testid="app-receipts"]').evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await portalMarks(page, 'app-', proofs);
  await page.locator('[data-testid="app-receipts"]').evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  await hold(page, 800);
  mark('app-receipts-boxes', { receipts: await bbox(page, '[data-testid="app-receipts"]') });
  await page.screenshot({ path: OUT + '/still-app-paid.png' });
  await hold(page, 4500);

  // ---- S8: what's real ----------------------------------------------------------
  await page.goto(BASE + '/verify');
  await page.waitForSelector('[data-testid="verify-page"]');
  await page.evaluate(() => document.fonts.ready);
  mark('verify-loaded');
  await hold(page, 2000);
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'smooth' }));
  await hold(page, 4000);
  await stopWs();

  // ---- S5: the real explorers (recorded last, placed after S4 in the edit) -----
  for (const [label, url, fallback, focus] of [
    ['near', links.near, links.near?.replace('https://explorer.testnet.near.org/transactions/', 'https://testnet.nearblocks.io/txns/'), /success/i],
    ['sepolia', links.sepolia, links.sepolia?.replace('https://sepolia.etherscan.io/tx/', 'https://eth-sepolia.blockscout.com/tx/'), /success/i],
  ]) {
    const p = await context.newPage();
    const stop = await screencast(context, p, label);
    await p.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
    await hold(p, 4000);
    let shown = url;
    if (/just a moment|attention required/i.test(await p.title())) {   // bot challenge: wait once, then fall back
      await hold(p, 15000);
      if (/just a moment|attention required/i.test(await p.title())) { mark(label + '-fallback', { url: fallback }); await p.goto(fallback, { waitUntil: 'load', timeout: 45000 }); shown = fallback; await hold(p, 4000); }
    }
    mark(label + '-loaded', {
      url: shown,
      success: await p.getByText(focus).first().boundingBox().catch(() => null),
      from: await p.getByText(/0x694a/i).first().boundingBox().catch(() => null),
    });
    await p.screenshot({ path: `${OUT}/still-${label}.png` });
    await p.mouse.move(700, 500, { steps: 20 });
    await hold(p, 6000);
    await stop();
    await p.close();
  }
  save({ links });
  console.log('RECORDED', OUT, JSON.stringify(links));
} catch (e) {
  console.error(e); save({ links, error: String(e) }); process.exitCode = 1;
} finally {
  await context.close();   // finalises the backup WebM
  await browser.close();
}
```

Notes on the script:

- The order of recording is S1→S2→S3→S4→S6→S7→S8→S5. The edit puts S5 (explorers) right after S4.
- `portalMarks` keeps the honesty checks of `live-common.confirmed()`: it refuses a UI "confirmed" unless the `/api/payout` confirmation response was seen. Run `flow-live.mjs` separately when you need the full two-RPC assertions on record.
- Status names are taken from `data-status` as the app sets them (`awaiting_signature`, `signed`, `broadcast`, `confirmed` in the INT-1 takes). Since G6 the stretch between `broadcast` and `confirmed` includes the three-block wait; the Confirmed step's subtitle reads "requires success and three more blocks on both RPCs" while waiting. Any other status (a queue or retry state) is marked too. If one appears, check that take before using it.
- `DEMO_RECIPIENT` defaults to the same demo address used in all evidence (`0x…dEaD`). If you set your own Sepolia address, the caption in S7 stays the same.

### Frames → MP4 (per label: `ws`, `near`, `sepolia`)

Screencast frames only arrive when the page changes, so each frame lasts until the next one:

```sh
cd "$DEMO_OUT"
for L in ws near sepolia; do
node -e '
const L=process.argv[1], idx=require("./frames/"+L+".json"); const end=idx.pop().end;
const lines=[]; idx.forEach((f,i)=>{const next=i+1<idx.length?idx[i+1].ts:end; lines.push(`file frames/${f.file}`,`duration ${Math.max(next-f.ts,1/30).toFixed(4)}`);});
lines.push(`file frames/${idx.at(-1).file}`); require("fs").writeFileSync(L+".txt",lines.join("\n"));
console.log(L,"firstTs",idx[0].ts);' $L
ffmpeg -y -f concat -safe 0 -i $L.txt -vf "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p" -c:v libx264 -crf 14 -preset slow -movflags +faststart $L.mp4
done
```

`ws.mp4` covers the workshop **and** the standalone page and /verify (same tab); in the edit, `app.mp4` is simply `ws.mp4` from `open-app-click` onwards. **Source time of a mark** = `mark.epoch − firstTs` of that label. Write these numbers into the shot table before building.

Check each MP4: `ffprobe` duration ≈ last mark + hold, and look at one frame per shot. Hard-to-read text means the screencast missed frames; use `backup/*.webm` for that shot.

---

## 5. Assembly with HyperFrames

Use the installed skills: `/hyperframes` (contract), `/hyperframes-core` (clips, variables), `/hyperframes-keyframes` (punch-ins), `/hyperframes-registry` (search before hand-making a caption or end card), `/media-use` (music, sfx, optional VO), `/hyperframes-cli` (check, snapshot, render).

### Project layout

```
ww-demo-video/                      # outside the repo, e.g. /data/workspace/ww-demo-video
  index.html                        # root: 1920x1080, data-fps 30, data-duration 76; scene hosts + audio only
  compositions/
    title.html      # S0
    workshop.html   # S1–S4, S6 and S7a: clips of assets/ws.mp4, stage wrapper, punch-ins
    proof.html      # S5: near.mp4 + sepolia.mp4 in a drawn browser bar with the real URL
    app.html        # S7b–e, S8: clips of assets/ws.mp4 from open-app-click on, cut card
    end.html        # S9
    captions.html   # the ONE captions host (data-track-kind="captions"), all caption groups
    speedtag.html   # "▶▶ 4× speed · real time m:ss" pills, timed to the 4× clips
  assets/ ws.mp4 near.mp4 sepolia.mp4 still-confirmed.png music.mp3 sfx-*.mp3
          fonts/ BricolageGrotesque-ExtraBold.woff2 Nunito-ExtraBold.woff2 JetBrainsMono-Medium.woff2
```

Start with `npx hyperframes init ww-demo-video --skip-skills --skill=hyperframes`. Fonts are not bundled, so each needs `@font-face` to a file in `assets/fonts/` (same families as the app: `tokens.css`).

### Variables (root `index.html`)

| Variable | Used in | Value |
|---|---|---|
| `hosted_url` | end card, S7 caption bar | `{{HOSTED_URL}}` until hosting exists |
| `repo_url` | end card | `{{REPO_URL}}` |
| `record_date` | S5 corner tag | the take's date, e.g. `2026-11-14` |
| `app_wait_s` | S7 cut card | `app-portal-confirmed − app-pay-click`, whole seconds, rounded down |
| `sign_wait_s` | S4 speed tag end value | `portal-confirmed − portal-visible` |
| `near_url`, `sepolia_url` | S5 browser bars | `links.near`, `links.sepolia` (or the `-fallback` URL if marked) |

No fetches at render time: copy numbers from `marks.json` into the HTML by hand or with a one-off script.

### Constant-speed clips (the honest speed-up)

Inside `workshop.html` (times are local to the scene; `M(x)` = source seconds of mark `x`):

```html
<!-- S3b: serve-click → order-done at 4× -->
<video id="ws-order-4x" class="clip" src="assets/ws.mp4" muted
  data-start="1.5" data-duration="{{(M(order-done) − M(serve-click)) / 4}}"
  data-media-start="{{M(serve-click)}}" data-playback-rate="4"></video>

<!-- S4: portal-visible → portal-confirmed at 4× -->
<video id="ws-portal-4x" class="clip" src="assets/ws.mp4" muted
  data-start="…" data-duration="{{(M(portal-confirmed) − M(portal-visible)) / 4}}"
  data-media-start="{{M(portal-visible)}}" data-playback-rate="4"></video>
```

In `speedtag.html`, each pill is a `.clip` with the **same** `data-start`/`data-duration` as its 4× video (shifted to root time). The counter is a GSAP tween on a plain object, `ease: "none"`, from 0 to `sign_wait_s`, whose `onUpdate` writes `m:ss` into the pill: seek-safe, no timers.

### Captions

One host, `data-track-kind="captions"`, one `.clip` group per caption from §2 (ids `cap-s1`, `cap-s2`, `cap-s3a`, …). Search the registry first (`npx hyperframes catalog --query "caption card" --json`); restyle to the spec in §2. Captions sit in the 80% title-safe box (y ≤ 972). Also export the same lines as an `.srt` for X's caption upload (optional).

### Stage and punch-ins

The stage wrapper (`#stage`, 78%, top 54) is a plain div; the timed `<video>` clips sit inside `#stage .inner`. Punch-ins tween `#stage .inner` (scale + x/y from the bbox in `marks.json`, converted from 1920×1080 page pixels), using `power2.inOut`, 0.6–0.8 s in, held, 0.4 s out. Max scale 1.4 so UI text stays sharp.

### Audio

- Music bed: light, warm, ~95 BPM, no vocals, −20 LUFS under VO (or −16 without VO), fade-in 1 s, fade-out over the end card. Source with `/media-use`.
- Sfx (soft, toy-like) on: Splitter drop (S2), Serve click (S3), each Portal step turning green (S4, 4 hits even at 4×), Pay click (S7). The app's own sounds are off and not captured.
- Optional voiceover: lines in §2, about 140 words in all; record or generate with `/media-use`, then duck the bed with `/hyperframes-audio`. The video must work without VO because X autoplays muted.

### Check, review, render

```sh
npx hyperframes check --json            # fix every error
npx hyperframes snapshot --review       # look at every shot; write REVIEW.md
npx hyperframes preview --background    # watch it once at full speed before rendering
npx hyperframes render --quality delivery -o worldworks-demo-76s.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 worldworks-demo-76s.mp4   # expect 76.0
```

X limits: MP4 H.264/AAC, ≤ 2:20, ≤ 512 MB, 1920×1080 fine.

---

## 6. The 15-second autoplay cut

Separate HyperFrames project `ww-demo-15/` that reuses the same `assets/`, captions component and speed tag. No title card: the first frame is already the problem. Captions are larger (Nunito 800, 52 px), one line each, because the clip is watched muted and small.

| Time | On screen | Caption |
|---|---|---|
| 0.0–2.0 | S1 footage, BROKE stamp, slight push-in | **This machine loses every coin.** |
| 2.0–4.6 | S2 drag → RUNNING (1×, trimmed to the drag and the stamp flip) | **One drag: 70% now stays in a reserve.** |
| 4.6–5.3 | Cursor clicks Serve a customer (1×) | **A test customer pays on NEAR.** |
| 5.3–9.3 | Portal card Signing → Confirmed. With the G6 three-block wait (60–90 s real), this will almost always be the cut version: Signing → Signed → Broadcast at a constant **10×** with tag "▶▶ 10× speed" for ~2.5 s, then a 0.4 s chip "⏭ {{N}} s later · cut", then the Confirmed card for 1.1 s. Only if the whole wait is ≤ 40 s, play it at a constant 10× with no cut. | **NEAR signs an Ethereum payment.** |
| 9.3–12.5 | `sepolia.mp4`: punch-in to Status **Success** and From **0x694A…8b7** | **Included on Sepolia: Success.** |
| 12.5–15.0 | Standalone payment page (`still-app-paid.png` or 1× footage), then a bottom strip: **WORLDWORKS · testnet · {{HOSTED_URL}}** | **Same machine, now its own payment page.** |

Render: `npx hyperframes render --quality delivery -o worldworks-demo-15s.mp4`, expect 15.0 s. Attach the **15 s cut to the first post** (it autoplays) and the 76 s cut in the thread, or attach only the 76 s cut if the user prefers one video; both are valid.

---

## 7. Caption ↔ CLAIMS check

| Caption / line | Why it is allowed |
|---|---|
| "A seeded test customer pays 0.10 NEAR on NEAR testnet." | Customer is seeded and labelled (README "Real versus simulated"); NEAR order is real testnet state. Check the price in the take. |
| "0.07 NEAR is now in the reserve, on chain." | UI reads it from chain ("vault on chain 0.07 NEAR"). G6 allows "vault owners can withdraw", but the video does not show withdrawal, so it does not say it. |
| "The NEAR contract writes an Ethereum payment." | CLAIMS: the contract constructs the Sepolia EIP-1559 transfers itself. |
| "NEAR Chain Signatures signs it. The relayer only broadcasts." | CLAIMS: keyless relayer that checks bytes and recovered sender and holds no keys. We do **not** say "trustless" or "only possible signing authority". |
| "Included on Sepolia, seen by two RPCs." | G6 CLAIMS: "Included on Sepolia, seen by two RPCs" is the accurate description. Not "confirmed payment", not "final"/"finality". |
| "Sepolia: Success. Sent from the address NEAR derived for our contract." | EVIDENCE-sepolia: treasury is the Chain Signatures address derived for `ww-portal-261112.testnet`. It is a **shared** treasury, not per machine; we don't say "the machine's own wallet". |
| "Open as app: the same machine is now a payment page with its own URL." | README: "own address" means a machine id + URL, not an account. |
| "Testnet only. The app lists what is real and what is simulated." | /verify page wording follows CLAIMS. |

Never on screen or in VO: immutable, no admin can move funds, exclusive signing authority, audited, secure, production(-ready/-safe), safe for mainnet, final/finality, trustless, guaranteed refund or inclusion, "confirmed payment" (use "included on Sepolia, seen by two RPCs"), "AI customer", "lifetime/total spending cap", "the epoch budget caps total spend", "own wallet/account/treasury" for a machine. Don't show or caption the **Withdraw reserve** button being used (not exercised live).

---

## 8. Take checklist

1. Funds checked (sponsor NEAR, treasury Sepolia ETH); live API healthy; `flow-live.mjs` passed today.
2. `node ui-tests/record-demo.mjs` → `RECORDED` line, no `drag-fallback`, no unexpected Portal status in `marks.json`.
3. Build MP4s, look at one frame per shot.
4. Fill the shot table with real mark times; fill `sign_wait_s`, `app_wait_s`, `record_date`, explorer URLs.
5. Build, `check`, `snapshot --review`, preview, render both cuts.
6. Put the recorded NEAR and Sepolia URLs into [X-POST.md](X-POST.md) (`{{NEAR_TX_URL}}`, `{{SEPOLIA_TX_URL}}`) and, if wanted, into the README's "Verify it yourself".
