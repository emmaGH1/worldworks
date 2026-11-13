# WORLDWORKS demo video: storyboard

Planning doc, updated after the recording on 2026-11-13 (take 1, see [RECORDING-LOG.md](RECORDING-LOG.md)). Two deliverables:

- **Main cut:** 76 s, 1920×1080, 30 fps, H.264 + AAC. For the X post and the submission `demoUrl`.
- **Autoplay cut:** 15 s, same format, silent-safe. It autoplays muted in the X timeline, so every idea must be readable from the captions alone.

Every pixel of product footage is the **real live UI on NEAR testnet + Sepolia**, recorded with Playwright. Title card, captions, speed labels and end card are the only drawn parts. Explorer pages are real pages, recorded live.

Binding rules: [docs/CLAIMS.md](../CLAIMS.md) (the **G6 version**, "Claims after G6") and the official "The demo post" guidance (lead with the user problem; show one complete moment from a real action to a visible result; say concretely what NEAR does; give a next step). Section 7 checks every caption against CLAIMS.

> **Current configuration (README "Current configuration", G6):** price 0.10 test NEAR + **1.32 NEAR order storage fee** = 1.42 NEAR per order; template Portal payout **0.0001 Sepolia ETH**; "Confirmed" in the UI = matching successful receipts on **two independent Sepolia RPC hosts plus 3 more blocks on both**; the Portal admits **at most 20 payouts per epoch** (one take uses 2). The INT-1 values (0.77 NEAR fee, 0.87 total, 0.001 ETH) are historical and appear nowhere in the video. All numbers below were read off the UI in take 1 and match these values.

---

## 1. The story in one breath

A lemonade machine is losing money because its payment rule is wrong. One drag fixes the rule. A customer pays, 70% stays in an on-chain reserve, and the NEAR contract sends 0.0001 ETH on Sepolia using Chain Signatures. Both explorers show it. Then the same machine opens as its own payment page.

**The complete moment** (the official guidance asks for one): *drag Splitter → serve a customer → Portal goes from Signing to Confirmed → Sepolia receipt on Etherscan.* The main cut shows this unbroken except for labeled constant-speed stretches (4×, 2×, 8×). The 15 s cut shows it compressed.

---

## 2. Main cut: shot by shot (76 s)

Layout for every product shot: the recording plays on a "stage" scaled to **78%** (1498×842), top edge at y=54, centred, on the app's ground colour `#F4EEE3`, with radius 20 and card shadow `0 6px 0 #DED2BE`. The band below (y 912–970) holds the caption, so captions never cover the app's own Serve button or Reserve card. Punch-ins zoom the inner stage wrapper, never the timed `<video>`.

Source names refer to the recordings from §4 (`ws.mp4`, `app.mp4`, `near.mp4`, `sepolia.mp4`) and to the marks in `marks.json`. Put the real numbers from `marks.json` into the shot list before building.

| # | Time | On screen (source → what happens) | Caption (burned in, bottom band) | Optional voiceover |
|---|---|---|---|---|
| S0 | 0:00.0–0:03.5 | **Title card** (drawn). Ground `#F4EEE3`. Line 1 appears word by word (blur 6px→0, 0.067 s apart): **"Payment rules hide inside app code."** At 1.6 s line 2 fades from light grey to ink: **"So you can't see where the money goes."** Small WORLDWORKS logo mark bottom-left. | (the title is the caption) | "Payment rules hide inside app code. So you can't see where your money goes." |
| S1 | 0:03.5–0:09.0 | `ws.mp4` at 1×, from `ready` for 5.5 s. Lemonade Machine, **BROKE** stamp, headline "Your machine is losing money." Slow move 1.00→1.06 toward the pipe and the "drop a Splitter here" hint (power2.inOut, the whole shot). | **This machine pays every coin straight out. Nothing is kept.** | "This lemonade machine has a visible bug: every coin goes straight out. Nothing refills the reserve." |
| S2 | 0:09.0–0:15.0 | `ws.mp4` at 1×, from `drag-start − 0.4 s` to `splitter-in + 3.0 s`. The demo cursor picks up **Splitter** from the parts bin, glides along the pipe and drops it on the **+** socket. Stamp flips to **RUNNING**, headline becomes "Now it keeps 70% of every sale.", toast confirms. Punch-in 1.0→1.18 on the canvas centre during the drag, back to 1.0 as the headline changes. | **Drop a Splitter on the pipe. Now 70% stays in a reserve.** | "One drag. A Splitter keeps 70% of every sale in a reserve vault." |
| S3 | 0:15.0–0:23.0 | `ws.mp4`: (a) 1×, 1.5 s: cursor clicks **Serve a customer**; the seeded customer walks in. (b) `serve-click → order-done` at **4×** with the speed tag (§3). (c) 1×, 2.5 s after `order-done`: Reserve ring shows 70% and "vault on chain 0.07 NEAR"; punch-in 1.0→1.3 on the Reserve card (bbox `reserve` in marks). | (a–b) **A seeded test customer pays 0.10 NEAR (+1.32 NEAR storage fee).** (c) **0.07 NEAR is now in the reserve, on chain.** | "A test customer pays. The machine is published to a NEAR contract, and 0.07 NEAR lands in the on-chain reserve." |
| S4 | 0:23.0–0:37.0 | `ws.mp4`: `portal-visible → portal-confirmed` at **4×** with the speed tag and the real-time counter. The Portal card walks *Signing on NEAR → Signed → Broadcast to Sepolia → Confirmed*. Then 1×, 3.0 s on the confirmed card; punch-in 1.0→1.4 onto the two receipt boxes (bbox `receipts`). | During signing: **The NEAR contract writes an Ethereum payment.** At `signed`: **NEAR Chain Signatures signs it. The relayer only broadcasts.** During the block wait: **Then it waits for 3 more Sepolia blocks on two RPCs.** At confirmed: **0.0001 ETH included on Sepolia, seen by two RPCs.** | "The contract builds the Sepolia transaction itself and asks NEAR Chain Signatures to sign it. Our relayer just broadcasts the signed bytes. It only shows Confirmed once two separate RPCs return the same successful receipt, three blocks deep." |
| S5 | 0:36.3–0:49.5 | **Proof.** (a) `near.mp4`, 6.2 s: the order transaction from the Portal card's NEAR receipt link. That link (explorer.testnet.near.org) is now an explorer *selector* page, so the shot opens the same hash on the selector's recommended explorer, **testnet.near.rocks**, and scrolls to the receipt where `ww-portal-261112.testnet` calls `sign` on `v1.signer-prod.testnet`. (b) `sepolia.mp4`, 7.0 s: the Sepolia transaction; Etherscan served a Cloudflare bot check to the headless recorder, so the planned fallback **eth-sepolia.blockscout.com** is shown (third-party ad requests blocked). Punch-in to **Status: Success** (bbox `sepolia-success`), then pan to **From: 0x694A…8b7** (bbox `sepolia-from`). A drawn browser bar above each shows the **real URL** in mono, plus a corner tag **"live explorer page · … · recorded 2026-11-13"**. | (a) **NEAR testnet: the order, then the contract's signing request.** (b) **Sepolia: Success, from the address NEAR derived for our contract.** | "Don't take the app's word for it. Here's the order on NEAR, and here's the payment on Sepolia: success, sent from the address Chain Signatures derives for our contract." |
| S6 | 0:47.0–0:51.0 | `ws.mp4` at 1×, from `ledger-open`, 4.0 s: the Ledger drawer slides in with Portal → Sepolia, Seeded customer bought one, Published "Lemonade Machine", Sponsored testnet session, all with explorer links. | **Every step has an explorer link.** | "Every step is in the ledger, with its explorer link." |
| S7 | 0:51.0–1:03.0 | (a) `ws.mp4` 1×, 1.0 s: cursor clicks **Open as app**. Match cut on the click into (b) `app.mp4` 1×, from `app-loaded`, 2.5 s: standalone **Lemonade Machine** payment page, checkout card. (c) 1×, 2.0 s: the address is typed into "Your Ethereum address"; cursor clicks the **Pay** button (label shows the current total). (d) **Cut card**, 1.5 s, full stage ground colour: **"⏭ 66 s later · cut · same steps as above"**. (e) `app.mp4` 1×, from `app-portal-confirmed`, 3.5 s: page scrolled to **Your receipts**, all four steps green, NEAR receipt + Sepolia receipt. | (a–b) **Open as app: same machine, now a payment page with its own URL.** (c–e) **Paid from its own page. Same contract, same rules.** | "Open as app turns the same published machine into a payment page with its own URL. Same contract, same rules." |
| S8 | 1:03.0–1:08.0 | `app.mp4` 1×, from `verify-loaded`, 5.0 s: the **/verify** page ("what's real?"), smooth scroll of ~600 px. | **Testnet only. The app lists what is real and what is simulated.** | "It's a testnet prototype, and the app says exactly what is real and what is simulated." |
| S9 | 1:08.0–1:16.0 | **End card** (drawn). Wordmark **WORLDWORKS**; line **"See your payment rules. Run them on NEAR."**; two rows in mono: **Code → https://github.com/emmaGH1/worldworks** and **Live demo link in the post** (the hosted URL is not known yet; no placeholder is rendered); footer **"Built at NEAR HACKATHON · testnet prototype"**; question chip **"What would you wire first?"**. Behind it, a still of the RUNNING machine (`still-confirmed.png`) at 12% opacity. Hold dead still from 1:10.5. | (the card is the caption) | "Try it in your browser, no wallet needed, and tell us what you'd wire first." |

Total: **76.0 s**. Times above are the planned slots; the as-built edit (exact root times of every clip and caption) is in [RECORDING-LOG.md](RECORDING-LOG.md): S4 ends 0:36.3, S5 0:36.3–0:49.5, S6 0:49.5–0:53.5, S7 0:53.5–1:06.9, S8 1:06.9–1:10.9, S9 1:10.9–1:16. Never shorten S5 below 8 s; it is the proof.

### Timing rules

- A product shot holds one framing for its whole length; motion comes from the UI itself and from at most one punch-in per shot (hyperframes motion rules: no floating, pulsing or click rings).
- Hold 0.4 s on the final state before each payoff caption (RUNNING, Confirmed, Success).
- Captions: Nunito 800, 40 px, ink `#24203A` on white card, radius 18, padding 14×28, shadow `0 6px 0 #DED2BE`. Max 9 words per line, 2 lines. Enter 0.25 s (opacity + 8 px rise), exit 0.15 s, swap captions on a cut, never mid-word of the VO.

---

## 3. The signing wait: how it is handled honestly

The Portal step has real network waits. Measured in take 1: Serve → order done **19.2 s** (publish + order), Signing → Signed **5.3 s**, Signed → Broadcast **5.3 s**, Broadcast → Confirmed **40.2 s** (Sepolia block plus **three more blocks on both RPCs**), so Signing → Confirmed **50.8 s**; the standalone payment took **66.7 s** from Pay to Confirmed. Watching that at 1× kills the video. Rules:

1. **Speed-up, labelled (main method).** Each waiting stretch is its own `<video>` clip with a **constant** `data-playback-rate="4"`. Do not use a `rate` automation ramp: during a ramp the true speed is neither 1× nor 4×, so a "4×" label would be wrong for part of the clip. Constant clips make the label exactly true for its whole length.
2. **Speed tag**, visible for exactly the length of each sped-up clip, top-centre of the stage: pill, ink background, white mono text **"▶▶ 4× speed · real time 7.0 s"**. As built: order 4× (counter 0.1 → 19.2 s since Serve), signing 2× (2.0 → 10.6 s since Signing started), block wait 8× with "· 3 more blocks on 2 RPCs" (10.6 → 50.8 s). The real-time counter runs from 0 to the measured wait, computed from timeline time: `real = (t − clipStart) × 4`. It must end on the number in `marks.json` (`portal-confirmed − portal-visible`), not on a rounded guess.
3. **Ceiling.** If a wait at 4× would last more than 8 s on screen, raise the constant rate (6×, 8×, at most 10×) and change the tag to match. If the wait from `portal-broadcast` to `portal-confirmed` is long (the three-block wait), it may be a separate clip at a higher rate with its own tag, e.g. "▶▶ 10× speed · waiting for 3 more blocks". Never hide a wait without a tag or a cut card.
4. **Cut, labelled (second method, S7 only).** The standalone payment repeats a step the viewer has just seen, so it is cut, not sped up: a 1.5 s card **"⏭ 66 s later · cut"**, where 66 = `app-portal-confirmed − app-pay-click` (66.7 s) rounded down to whole seconds.
5. Never cut inside the workshop Portal sequence in the main cut. The viewer must see Signing → Signed → Broadcast → Confirmed happen in order.

---

## 4. Recording: Playwright script

### Prerequisites

- Live API + live frontend, exactly as in [EVIDENCE-ui-live.md § Reproduce](../EVIDENCE-ui-live.md), or the hosted deployment once it exists (preferred: then the footage is the thing judges will open). `UI_BASE` points at it.
- `playwright-core` and Chromium as pinned in `app/ui-tests/common.mjs`. `ffmpeg` on PATH.
- **Funds per take** (this script sends real testnet transactions): a new sponsored session (9 NEAR from the sponsor), one publish deposit (0.40 NEAR, unused part refunded) + 2 orders × 1.42 NEAR (0.10 price + 1.32 storage fee) from that session, and 2 Sepolia payouts × (0.0001 ETH + ≤ 21,000 × 3 gwei gas) from the shared treasury `0x694A…8b7`. The epoch admits at most 20 payouts; one take uses 2. Before take 1: sponsor 11.74 NEAR, treasury 0.514 Sepolia ETH, Sepolia base fee 15 wei (below the 3 gwei cap).
- Network fonts must load (Bricolage Grotesque, Nunito, JetBrains Mono from Google Fonts). The script waits for `document.fonts.ready`.
- The script refuses to record if the **MOCK DATA** badge is present. Mock footage must never appear in the video.

### Capture method (as built)

The script is [`app/ui-tests/game-mock.mjs`](../../app/ui-tests/game-mock.mjs). Differences from the first plan, all forced by the machine or by what the take showed:

- **Viewport 1440×810 CSS px at device scale 4/3**, so the screencast is exactly 1920×1080 but UI text is a third larger than at a 1920 px viewport (legible at 78% stage scale on a phone). Bounding boxes in `marks.json` are CSS px; multiply by 4/3 for video px.
- **No JPEG frames on disk.** CDP `Page.startScreencast` JPEG frames (quality 92) are piped straight into ffmpeg as constant 30 fps H.264 (CRF 17), each frame held until Chrome's next frame timestamp. The root disk had ~300 MB free when work started; one take is ~37 MB. No Playwright WebM backup is recorded.
- The screencast starts only after the workshop has loaded in live mode. **Mock guard:** before recording and at every Portal status change, the script checks for the `mock-badge` and for "MOCK DATA" / "simulated by the mock" in the page text; on a hit it throws, stops, and deletes the partial video.
- A drawn cursor (headless has none) plus a drag image that clones the dragged palette chip, because headless screencasts do not paint the browser's own drag image. It appears in the stills too.
- Explorer pages are recorded last, in a second context with a normal desktop user agent and third-party ad hosts blocked. NEAR: `testnet.near.rocks/tx/<hash>` (the app's explorer.testnet.near.org link is a selector page), NearBlocks as fallback. Sepolia: Etherscan, wait + one retry on a bot check, then Blockscout. `DEMO_EXPLORERS_FROM=<take dir>` re-records only these pages for an existing take, without new transactions.
- Viewport-only stills `stills/live-0*.png` (no fullPage screenshots, which would resize the viewport inside the recording) feed `docs/design/screens/live-*.png`.

```sh
# from app/: live API + live build (VITE_CONTRACT_ID set), as in game-live.mjs / EVIDENCE-ui-live.md
API_PORT=3009 node --env-file=/opt/ww-secrets/live.env --import tsx scripts/dev-api.ts
VITE_CONTRACT_ID=ww-portal-261112.testnet VITE_RELAYER_URL=http://127.0.0.1:3009 npx vite build --outDir /data/tmp/ww-demo/dist-live
npx vite preview --outDir /data/tmp/ww-demo/dist-live --host 127.0.0.1 --port 4202 --strictPort
UI_BASE=http://127.0.0.1:4202 INSTABOX_HEADLESS=1 DEMO_OUT=/opt/ww-video/take-1 node ui-tests/game-mock.mjs
```

**Source time of a mark** = `mark.epoch − clips[label].t0` from `marks.json`.

---

## 5. Assembly with HyperFrames

Use the installed skills: `/hyperframes` (contract), `/hyperframes-core` (clips, variables), `/hyperframes-keyframes` (punch-ins), `/hyperframes-registry` (search before hand-making a caption or end card), `/media-use` (music, sfx, optional VO), `/hyperframes-cli` (check, snapshot, render).

### Project layout

```
ww-demo-76/                         # outside the repo: /opt/ww-video/ww-demo-76 (and ww-demo-15)
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
| end card rows | end card | `https://github.com/emmaGH1/worldworks` and "Live demo link in the post" (no hosted URL yet; never a placeholder) |
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
| 4.8–9.8 | As built: order + Signing → Signed → Broadcast at a constant **10×** (29.8 s real → 3.0 s, tag "▶▶ 10× speed · real time"), then a 1.1 s card "⏭ 40 s later · cut" (the three-block wait), then the Confirmed card for 0.9 s with a punch-in on the receipts. | **NEAR signs an Ethereum payment.** |
| 9.3–12.5 | `sepolia.mp4`: punch-in to Status **Success** and From **0x694A…8b7** | **Included on Sepolia: Success.** |
| 12.5–15.0 | Standalone payment page (1× footage of the confirmed receipts) with a bottom strip: **WORLDWORKS · testnet · github.com/emmaGH1/worldworks** | **Same machine, now its own payment page.** |

Render: `npx hyperframes render --quality delivery -o worldworks-demo-15s.mp4`, expect 15.0 s. Attach the **15 s cut to the first post** (it autoplays) and the 76 s cut in the thread, or attach only the 76 s cut if the user prefers one video; both are valid.

---

## 7. Caption ↔ CLAIMS check

| Caption / line | Why it is allowed |
|---|---|
| "A seeded test customer pays 0.10 NEAR (+1.32 NEAR storage fee)." | Customer is seeded and labelled (README "Real versus simulated"); NEAR order is real testnet state. 1.32 NEAR is the retained order fee in CLAIMS and README; the take's Serve button reads "0.10 NEAR + 1.32 storage fee". |
| "0.07 NEAR is now in the reserve, on chain." | UI reads it from chain ("vault on chain 0.07 NEAR"). G6 allows "vault owners can withdraw", but the video does not show withdrawal, so it does not say it. |
| "The NEAR contract writes an Ethereum payment." | CLAIMS: the contract constructs the Sepolia EIP-1559 transfers itself. |
| "NEAR Chain Signatures signs it. The relayer only broadcasts." | CLAIMS: keyless relayer that checks bytes and recovered sender and holds no keys. We do **not** say "trustless" or "only possible signing authority". |
| "Then it waits for 3 more Sepolia blocks on two RPCs." | CLAIMS: inclusion is reported only after matching receipts on two RPC hosts and three additional blocks on both. |
| "0.0001 ETH included on Sepolia, seen by two RPCs." | G6 CLAIMS: "Included on Sepolia, seen by two RPCs" is the accurate description; 0.0001 ETH is the template payout (README). Not "confirmed payment", not "final"/"finality". |
| "NEAR testnet: the order, then the contract's signing request." | The NEAR Rocks page shows `submit_order` (1.42 Ⓝ) and the receipt where `ww-portal-261112.testnet` calls `sign` on `v1.signer-prod.testnet` (CLAIMS: Chain Signatures). |
| "Sepolia: Success, from the address NEAR derived for our contract." | EVIDENCE-sepolia: treasury is the Chain Signatures address derived for `ww-portal-261112.testnet`. It is a **shared** treasury, not per machine; we don't say "the machine's own wallet". |
| "Open as app: same machine, now a payment page with its own URL." | README: "own address" means a machine id + URL, not an account. |
| "Testnet only. The app lists what is real and what is simulated." | /verify page wording follows CLAIMS. |

Never on screen or in VO: immutable, no admin can move funds, exclusive signing authority, audited, secure, production(-ready/-safe), safe for mainnet, final/finality, trustless, guaranteed refund or inclusion, "confirmed payment" (use "included on Sepolia, seen by two RPCs"), "AI customer", "lifetime/total spending cap", "the epoch budget caps total spend", "own wallet/account/treasury" for a machine. Don't show or caption the **Withdraw reserve** button being used (not exercised live).

---

## 8. Take checklist

1. Funds checked (sponsor NEAR, treasury Sepolia ETH); live API healthy; `game-live.mjs` passed today.
2. `node ui-tests/game-mock.mjs` → `RECORDED` line, no `drag-fallback`, no unexpected Portal status in `marks.json`.
3. Build MP4s, look at one frame per shot.
4. Fill the shot table with real mark times; fill `sign_wait_s`, `app_wait_s`, `record_date`, explorer URLs.
5. Build, `check`, `snapshot --review`, preview, render both cuts.
6. Put the recorded NEAR and Sepolia URLs into [X-POST.md](X-POST.md) (`{{NEAR_TX_URL}}`, `{{SEPOLIA_TX_URL}}`) and, if wanted, into the README's "Verify it yourself".
