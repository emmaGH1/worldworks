# GAME-1 evidence: the 2.5D game (vertical slice), live on testnet

Spec: `specs/GAME-1.md`, plus the orchestrator's comprehension update (user feedback: "I don't understand anything about it right now"). Date: 2026-11-13. Contract: `ww-portal-261112.testnet`. Testnet only.

## What shipped

| Path | What |
|---|---|
| `app/src/game/world.ts` | The Three.js world, built from the approved UI-2 concept. Coins come only from a `Flow`, which is built from engine or API effects. The Portal shows real states only when the game pushes them in from `PayoutView.status`. |
| `app/src/game/model.ts` | Effects → coins. 1 coin = 0.01 NEAR; bigger prices use bigger coins. Also: `PayoutStatus` → Portal phase, level machines, and machine ids (`lemon-<hash8>-<account12>`, unique per session account). |
| `app/src/game/GamePage.tsx` | `/`: Level 1 (fix the leak, simulated) and Level 2 (one real order). Also the intro, the next-action pointer, tooltips, the run panel and the ledger. |
| `app/src/game/AppPage.tsx` | `/m/:id`: any published machine as a standalone checkout in the same 3D language, with the same Portal sequence. |
| `app/src/game/hud.tsx` | `PortalCard` (driven only by `getPayout`/`relay` status), `LedgerPanel`, mode pills, explorer links. |
| `app/src/game/game.css` | HUD styles. Classes are scoped and prefixed with `g-`, so they don't collide with `app.css`. |
| `app/src/main.tsx` | `/` → game, `/m/:id` → app page. Both are lazy-loaded into one shared Three.js chunk. `/verify` is unchanged. |
| `app/ui-tests/game-mock.mjs`, `app/ui-tests/game-live.mjs` | Acceptance scripts (output below). |

`app/src/api/*`, `app/api/*` and `vercel.json` were not touched. `three@0.187.0` and `@types/three@0.187.0` were added to `app/package.json`. `app/concepts/ui2/node_modules` (43 MB) was removed.

## 1. Typecheck, build, bundle sizes

`npm run typecheck && npm run build` pass. Sizes from a mock build of the final code:

```
index.html                                        0.81 kB │ gzip:   0.44 kB
assets/worldworks_engine_wasm_bg-5coomDFX.wasm  411.00 kB │ gzip: 122.40 kB
assets/game-*.css                                26.28 kB │ gzip:   6.00 kB
assets/index-D8N4ew1r.css                        47.40 kB │ gzip:   9.91 kB
assets/AppPage-*.js                              11.05 kB │ gzip:   4.03 kB
assets/GamePage-*.js                             24.37 kB │ gzip:   8.37 kB
assets/index-*.js                               252.98 kB │ gzip:  80.41 kB   (React, router, /verify, API facade)
assets/game-*.js                                626.00 kB │ gzip: 162.65 kB   (three.js + world, lazy: only / and /m/:id)
```

The live build adds the near-api-js adapter: `index` is 254 kB, 81 kB gzip. Vite warns that the lazy `game` chunk is over 500 kB minified. It is loaded only by the game routes.

## 2. Playwright

Setup: mock preview from `npm run build` on :4240. Live preview built with `VITE_CONTRACT_ID=ww-portal-261112.testnet VITE_RELAYER_URL=http://127.0.0.1:3027` on :4241. The local API runs with `API_PORT=3027 node --env-file=/opt/ww-secrets/live.env --import tsx scripts/dev-api.ts`. No secret was printed.

The VM has no GPU. For the mock stills the world is paused and stepped with `window.__ww.advance`, while the mock API runs in real time. In the live run the world runs in real time at about 5 fps under SwiftShader.

### `ui-tests/game-mock.mjs` (MOCK mode)

Covers the first-visit intro, the Level 1 drag-fix and the next-action pointer. Level 2 runs end to end against the mock API, with checks that the gem never pops before `confirmed` and that the ledger holds no simulated rows. Then: Open as app, a second order on `/m/:id`, an unknown machine id, and `/verify`. On a 390 px phone it does tap-to-place (no drag) and Level 2. Last, keyboard-only placement and `?lowfx=1`.

```
ok: MOCK DATA badge in mock mode
intro 1/3: This is your lemonade stand
still: docs/design/screens/game-00-intro-1.png
intro 2/3: Right now, you keep nothing
still: docs/design/screens/game-00-intro-2.png
intro 3/3: Fix it
still: docs/design/screens/game-00-intro-3.png
ok: intro dismissed
ok: next action: drag the Splitter (pointer on the dock button)
ok: Level 1 starts broken (losing money)
ok: Vault empty, no Splitter: every coin leaves
still: docs/design/screens/game-01-broken.png
ok: next action while dragging: drop it here (pointer on the slot)
still: docs/design/screens/game-02-dragging.png
ok: Splitter dropped on the slot (drag)
still: docs/design/screens/game-03-splitter.png
ok: simulated customers keep 70% (engine preview): 70
still: docs/design/screens/game-04-level1-won.png
still: docs/design/screens/game-05-level2-intro.png
ok: next action: Run it for real, explained before tapping
run button: Run it for real | MOCK API · no chain · ~30 s
ok: tap the Portal: Portal: sends a payment to Ethereum, another blockchain. NEAR’s network signs it (Chain Signatures).
still: docs/design/screens/game-05-level2.png
ok: ledger empty before the run: simulated sales never enter it
caption: Mock money split: 0.07 NEAR in your savings, 0.03 NEAR into the Portal. NEAR’s network is signing the payment to Ethereum… 1s
machine id: lemon-ca78234e-ww8fu47p | vault 70000000000000000000000 | portal fee 30000000000000000000000 | wei 100000000000000
ok: unique machine id per session: lemon-ca78234e-ww8fu47p
still: docs/design/screens/game-l2-04-mock-coins.png
coins in the Portal; API status signed → world shows swirl
ok: never popped before confirmed
ok: no win before confirmed
caption: Payment sent to Ethereum Sepolia. Waiting for 3 blocks to confirm it… 0s
still: docs/design/screens/game-l2-05-portal-swirl.png
caption: Payment sent to Ethereum Sepolia. Waiting for 3 blocks to confirm it… 5s
still: docs/design/screens/game-l2-06-portal-beam.png
still: docs/design/screens/game-l2-07-confirmed.png
Portal states seen: signed → broadcast → confirmed | elapsed 48.8s
ok: Level 2 goal met after confirmed
caption: Done! Your supplier got paid on Ethereum (mock data). Both receipts are linked below.
ok: next action: Open as app button pulses
ok: MOCK DATA label visible
ok: ledger has a publish row
ok: publish row labeled mock
ok: publish row has no explorer link in mock (fake hash)
ok: ledger has a order row
ok: order row labeled mock
ok: order row has no explorer link in mock (fake hash)
ok: ledger has a payout row
ok: payout row labeled mock
ok: payout row has no explorer link in mock (fake hash)
ok: ledger holds only the 3 mock-API rows (no simulated sales)
still: docs/design/screens/game-08-ledger.png
ok: Open as app → /m/lemon-ca78234e-ww8fu47p
still: docs/design/screens/game-09-app.png
still: docs/design/screens/game-10-app-paying.png
still: docs/design/screens/game-11-app-confirmed.png
ok: standalone app: real-path order + same Portal sequence (mock API)
ok: unknown machine id handled
ok: /verify still renders: Don’t trust the cartoon. Check the chain.
still: docs/design/screens/game-p00-intro.png
still: docs/design/screens/game-p01-broken.png
ok: locked part explains itself: Gate: holds money until a rule is met. Locked: comes in Level 3 (not in this build yet).
still: docs/design/screens/game-p02-armed.png
ok: phone: tap Splitter, tap “Place Splitter here” (button path, no drag)
ok: ledger empty before the run: simulated sales never enter it
caption: Mock money split: 0.07 NEAR in your savings, 0.03 NEAR into the Portal. NEAR’s network is signing the payment to Ethereum… 1s
machine id: lemon-ca78234e-wwv8xz6q | vault 70000000000000000000000 | portal fee 30000000000000000000000 | wei 100000000000000
ok: unique machine id per session: lemon-ca78234e-wwv8xz6q
still: docs/design/screens/game-p-04-mock-coins.png
coins in the Portal; API status awaiting_signature → world shows swirl
ok: never popped before confirmed
ok: no win before confirmed
caption: Mock money split: 0.07 NEAR in your savings, 0.03 NEAR into the Portal. NEAR’s network is signing the payment to Ethereum… 14s
still: docs/design/screens/game-p-05-portal-swirl.png
caption: Payment sent to Ethereum Sepolia. Waiting for 3 blocks to confirm it… 3s
still: docs/design/screens/game-p-06-portal-beam.png
still: docs/design/screens/game-p-07-confirmed.png
Portal states seen: awaiting_signature → broadcast → confirmed | elapsed 44.7s
ok: Level 2 goal met after confirmed
caption: Done! Your supplier got paid on Ethereum (mock data). Both receipts are linked below.
ok: next action: Open as app button pulses
ok: MOCK DATA label visible
ok: ?lowfx=1: shadows off, pixel ratio 1
ok: keyboard: Enter on the dock Splitter, Enter on “Place Splitter here”
console errors: 0
RESULT: PASS
```

### `ui-tests/game-live.mjs` (LIVE: NEAR testnet + Sepolia), final run

Run with `UI_STORAGE_STATE=/opt/ww-secrets/game-live-seed-state.json`. That file holds the browser state of an existing sponsored test session (`p83ed05965fc83a2d2141…`, about 7.5 NEAR at the time). The reason: the live `/api/session` returned **503 "Testnet sponsor is low on funds; please refill the sponsor"** for a new browser (see "Unfinished"). The machine `lemon-ca78234e-5fc83a2d2141` had been published by this session in the previous live run (publish tx below), so this run reused it.

```
[   8.2s] ok: live mode (no MOCK DATA badge)
[   9.4s] ok: API mode live
[  13.4s] next action: Run it for real: 1 real order on NEAR testnet + a real payout on Ethereum Sepolia (~1 min). No wallet.
▼
[  13.8s] run button: Run it for real | real NEAR testnet + Ethereum Sepolia · ~1 min
[  21.0s] still: docs/design/screens/game-live-01-ready.png
[  35.5s] phase session · Putting your lemonade stand on the NEAR blockchain… 1s
[  37.4s] phase publish · A test customer is buying one lemonade with real testnet NEAR… 0s
[  39.7s] phase order · A test customer is buying one lemonade with real testnet NEAR… 1s
[  50.0s] phase portal · Real money split: 0.07 NEAR in your savings, 0.03 NEAR into the Portal. NEAR’s network is signing the payment to Ethereum… 2s
[  50.6s] account p83ed05965fc83a2d2141.ww-sponsor-g4-261112.testnet | machine lemon-ca78234e-5fc83a2d2141 (already published)
[  50.7s] publish tx (reused)
[  50.7s] order tx   https://testnet.near.rocks/tx/5riWEd1RLPczSZyhA2PqSuWiCyuS6WziNcSVZLwAKmyp | vault 70000000000000000000000 portal fee 30000000000000000000000 wei 100000000000000
[  50.7s] ok: order has a real NEAR explorer link
[  59.3s] still: docs/design/screens/game-live-02-real-coins.png
[  60.6s] Portal status signed · world none · caption: Signed! Handing the payment to Ethereum…
[  65.2s] Portal status broadcast · world none · caption: Payment sent to Ethereum Sepolia. Waiting for 3 blocks to confirm it… 0s
[  86.1s] still: docs/design/screens/game-live-03-swirl.png
[  93.4s] still: docs/design/screens/game-live-03-beam.png
[ 114.5s] API confirmed payout 22 evmTx 0x1771de7ace784d0552d7030a52e41d1efb66c846c6640137eb6fed49f4637e92 RPC proofs rpc.sepolia.ethpandaops.io, sepolia.gateway.tenderly.co
[ 114.5s] Portal status confirmed · world beam · caption: Done! Your supplier got paid on Ethereum. Both receipts are linked below.
[ 117.8s] ok: UI confirmed only after the API reported confirmed
[ 117.8s] ok: two independent Sepolia RPC proofs
[ 117.8s] ok: both receipts successful and matching
[ 125.1s] still: docs/design/screens/game-live-03-confirmed.png
[ 125.1s] Sepolia tx https://sepolia.etherscan.io/tx/0x1771de7ace784d0552d7030a52e41d1efb66c846c6640137eb6fed49f4637e92
[ 126.2s] ok: Level 2 goal met (real)
[ 128.3s] Portal card links: https://testnet.near.rocks/tx/5riWEd1RLPczSZyhA2PqSuWiCyuS6WziNcSVZLwAKmyp https://sepolia.etherscan.io/tx/0x1771de7ace784d0552d7030a52e41d1efb66c846c6640137eb6fed49f4637e92
[ 128.3s] ok: Portal card links the NEAR tx and the Sepolia tx
[ 137.5s] ok: ledger order confirmed
[ 138.9s] ok: ledger order links NEAR: https://testnet.near.rocks/tx/5riWEd1RLPczSZyhA2PqSuWiCyuS6WziNcSVZLwAKmyp
[ 139.8s] ok: ledger payout confirmed
[ 141.2s] ok: ledger payout links NEAR: https://testnet.near.rocks/tx/5riWEd1RLPczSZyhA2PqSuWiCyuS6WziNcSVZLwAKmyp https://sepolia.etherscan.io/tx/0x1771de7ace784d0552d7030a52e41d1efb66c846c6640137eb6fed49f4637e92
[ 141.2s] ok: ledger payout links Sepolia
[ 141.9s] ok: no simulated rows in the ledger
[ 146.9s] still: docs/design/screens/game-live-04-ledger.png
[ 188.8s] app URL http://127.0.0.1:4241/m/lemon-ca78234e-5fc83a2d2141 | total 1.42 NEAR
[ 196.0s] still: docs/design/screens/game-live-05-app.png
[ 218.2s] app order tx https://testnet.near.rocks/tx/Cr5ZwUfVEqWFchj628egvA3ytDoqEHcZgy4CWwYcfBnM
[ 220.1s] Portal status awaiting_signature · world none · caption: (app page)
[ 272.3s] API confirmed payout 23 evmTx 0x73bbe2bcdb84ab989c76b5cb67fd35912f5878ae6fee8e3c8d668422446eb936 RPC proofs rpc.sepolia.ethpandaops.io, sepolia.gateway.tenderly.co
[ 272.3s] API confirmed payout 23 evmTx 0x73bbe2bcdb84ab989c76b5cb67fd35912f5878ae6fee8e3c8d668422446eb936 RPC proofs rpc.sepolia.ethpandaops.io, sepolia.gateway.tenderly.co
[ 251.1s] Portal status broadcast · world beam · caption: (app page)
[ 285.1s] still: docs/design/screens/game-live-06-app-beam.png
[ 286.6s] Portal status confirmed · world - · caption: (app page)
[ 316.6s] ok: UI confirmed only after the API reported confirmed
[ 316.6s] ok: two independent Sepolia RPC proofs
[ 316.6s] ok: both receipts successful and matching
[ 320.3s] still: docs/design/screens/game-live-06-app-confirmed.png
[ 320.3s] app Sepolia tx https://sepolia.etherscan.io/tx/0x73bbe2bcdb84ab989c76b5cb67fd35912f5878ae6fee8e3c8d668422446eb936
console errors: 0
RESULT: PASS
```

**Changes after this live run.** All are UI-only and were re-verified by the final mock run above:
- renamed `portal-card` → `g-portal-card` and `mock-tag` → `g-mock-tag`, because `app.css` had a phone rule that absolutely positioned `.portal-card`
- a compact phone run panel
- the button label "Running (mock API)…" in mock mode

They don't touch the API path, the Portal state mapping or the desktop layout used by the live stills. I did not rerun the live suite after them, to save the seeded customer's remaining testnet NEAR (about 2.7 NEAR, roughly one more order) for the demo.

In this log, the caption after a `phase` line is sometimes the next phase's caption. The test samples the page between React updates, so the two can be one step apart.

### All real transactions made by this work (NEAR testnet → Sepolia)

| Run | What | NEAR tx | Sepolia tx (payout, confirmed by 2 RPCs) |
|---|---|---|---|
| live #1 (fresh session `p2ab5419f6ccf817729e8…`) | publish | https://testnet.near.rocks/tx/6sCu4ayBvQwL4MXeqfQtkURkT2XeHYVmUWvdZv1vfWKp | |
| | seeded-customer order (payout 18) | https://testnet.near.rocks/tx/ByWU46wAsux9YeQbkz5PX7sP4o2VqTAYYucn5KZQgbRK | https://sepolia.etherscan.io/tx/0x0d58cc424bf85996db9fd3df4cb4283dc19fb0a054ec1c95f849d861b1bbfb6a |
| live #2 (session `p83ed05965fc83a2d2141…`) | publish `lemon-ca78234e-5fc83a2d2141` | https://testnet.near.rocks/tx/ELgL4ASmu9MdezM7y9AoFFUuFBuDt3TzLoDLvYYeHRnG | |
| | seeded-customer order (payout 19) | https://testnet.near.rocks/tx/HewXtFbXDGBDRoEhYR1F23GDW827w4mgfb7YqfcewKhg | https://sepolia.etherscan.io/tx/0x59b496dc6994e8e8c3d8788d79d635103779ceca00236bcf0fbea3815d4dafae |
| live #3 (PASS) | seeded-customer order (payout 20) | https://testnet.near.rocks/tx/9kMK3fNpTv9bGHe9kVaKFanL34zbiBqcgcQwcaZJC1um | https://sepolia.etherscan.io/tx/0x3db59a6ed8e85447fcaa26e3efa2e0d43e3641a540c38b4239ff799bd379f593 |
| | `/m/:id` order from the session (payout 21) | https://testnet.near.rocks/tx/4dx6z3Kk6JTpnxBsDRSNfZ21mPYvpDyTiXqdm9XLXeF3 | https://sepolia.etherscan.io/tx/0x16417547a36a36ba786e1f00f070c85c9f1438b9ed10630dbb30dd27cb0aa651 |
| live #4 (final, PASS) | seeded-customer order (payout 22) | https://testnet.near.rocks/tx/5riWEd1RLPczSZyhA2PqSuWiCyuS6WziNcSVZLwAKmyp | https://sepolia.etherscan.io/tx/0x1771de7ace784d0552d7030a52e41d1efb66c846c6640137eb6fed49f4637e92 |
| | `/m/:id` order from the session (payout 23) | https://testnet.near.rocks/tx/Cr5ZwUfVEqWFchj628egvA3ytDoqEHcZgy4CWwYcfBnM | https://sepolia.etherscan.io/tx/0x73bbe2bcdb84ab989c76b5cb67fd35912f5878ae6fee8e3c8d668422446eb936 |

Why runs #1 and #2 were not passes:
- **Run #1** failed an over-strict assertion of mine: explorer links are now `testnet.near.rocks` (Sol's `txRef` change). Its browser closed while payout 18 was `signed`. The next relay broadcast it as a predecessor, and `/api/payout` reports it `confirmed`.
- **Run #2** confirmed on chain, but my test hit a race: it read the Portal status and the win banner in two separate calls. The fix reads both in one atomic snapshot.
- **Between #1 and #2**, a fresh-session attempt got the sponsor 503 and sent no transactions.

All payouts went to the demo burn address `0x…dEaD`.

## 3. Stills (`docs/design/screens/game-*.png`)

Desktop 1440×900 and phone 390×844 @2x. MOCK stills carry the MOCK DATA pill. LIVE stills carry the TESTNET pill and green REAL coins.

| State | Desktop | 390px |
|---|---|---|
| Intro cards (camera pans: stand → Portal → slot) | `game-00-intro-1..3.png` | `game-p00-intro.png` |
| Level 1 broken (losing money, savings 0%) | `game-01-broken.png` | `game-p01-broken.png` |
| Dragging the Splitter ("Drop it here") | `game-02-dragging.png` | `game-p02-armed.png` (tap-to-place) |
| Splitter close-up, 70/30 | `game-03-splitter.png` | |
| Level 1 won | `game-04-level1-won.png` | |
| Level 2 intro / ready ("Run it for real" explained) | `game-05-level2-intro.png`, `game-05-level2.png`, `game-live-01-ready.png` | |
| Real/mock coins on the belts | `game-l2-04-mock-coins.png`, `game-live-02-real-coins.png` | `game-p-04-mock-coins.png` |
| Portal swirl (NEAR signing) | `game-l2-05-portal-swirl.png`, `game-live-03-swirl.png` | `game-p-05-portal-swirl.png` |
| Beam over the water (broadcast, waiting for blocks) | `game-l2-06-portal-beam.png`, `game-live-03-beam.png` | `game-p-06-portal-beam.png` |
| Confirmed: gem, both links | `game-l2-07-confirmed.png`, `game-live-03-confirmed.png` | `game-p-07-confirmed.png` |
| Ledger | `game-08-ledger.png` (mock), `game-live-04-ledger.png` (real links) | |
| Open as app `/m/:id` | `game-09/10/11-app*.png` (mock), `game-live-05-app.png`, `game-live-06-app-beam.png`, `game-live-06-app-confirmed.png` | |

## Comprehension update: how each point is addressed

1. **First 10 seconds explain themselves.** First visit opens a skippable 3-card intro. Each card pans the camera to what it describes (`world.focus`):
   - "This is your lemonade stand. Every customer pays 0.10 NEAR… each gold coin is 0.01 NEAR" (stand)
   - "Right now, you keep nothing: all the coins roll into the Portal, which sends the money to your supplier on Ethereum (another blockchain)" (Portal and the Ethereum island)
   - "Fix it: drop a Splitter on the glowing slot… 70% to your savings" (slot)

   Level 2 has a one-card intro: "Now do it for real…". The **?** button replays the intro. `?intro=0` skips it (used by tests).
2. **One clear next action, always.** A single pulsing ▼ arrow with a one-line bubble points at the exact target:
   - the dock Splitter: "Drag the Splitter onto the glowing slot (or tap it)"
   - then the slot: "Drop it here"
   - then the savings: "Watch: 7 of every 10 coins now go to your savings (n/3)"
   - then the Run button, with the explainer text
   - during the run, the Portal or the Ethereum side, with the live caption
   - at the end, "Open as app", which pulses

   The tests assert the pointer text at each step.
3. **Plain names on screen.**
   - World tags read: "Your stand · Coin Slot", "Your savings · Vault", "Portal · sends payment to Ethereum", "Your supplier · on Ethereum", "Ethereum · another blockchain".
   - The dock says "Savings".
   - A coin legend reads "1 coin = 0.01 NEAR (money)". Level 2 adds "gold = simulated · green = real testnet".
   - Tapping any part in the world (stand, Splitter, savings, Portal, exit, supplier) or in the dock shows a short plain-word tooltip.
4. **Narrated money.** Each sale floats a caption over the belt: "7 coins → your savings · 3 coins → supplier". While broken it reads "10 coins → supplier · you keep 0" on a red tint. Real and mock orders get a REAL or MOCK label. The meter reads "You keep: 0% … goal 70%", with a red "LOSING MONEY · savings get 0%" stamp until it's fixed.
5. **"Run it for real" explains itself before the tap.** The button's subline reads "real NEAR testnet + Ethereum Sepolia · ~1 min". The pointer bubble says "Run it for real: 1 real order on NEAR testnet + a real payout on Ethereum Sepolia (~1 min). No wallet." During the run, a plain-language caption follows each step:
   - Creating your free test account…
   - Putting your lemonade stand on the NEAR blockchain…
   - A test customer is buying one lemonade with real testnet NEAR…
   - Real money split… NEAR's network is signing the payment to Ethereum… Ns
   - Payment sent to Ethereum Sepolia. Waiting for 3 blocks… Ns
   - Done!

   Every step comes from API state; none is on a timer. "Run it for real" uses `customerOrder`, so the seeded customer pays. The session only publishes.
6. **Locked parts look locked.** Gate, Worker and Payout show a 🔒 badge and "🔒 Level 3" under the label. In Level 1 the Portal shows "🔒 Level 2". Tapping a locked part explains it, e.g. "Gate: holds money until a rule is met. Locked: comes in Level 3 (not in this build yet)."

## Spec scope checklist

1. Done: `/` is the Three.js game (one app, one build), and `/verify` works (mock test checks it). The old `Workshop.tsx` and `MachineApp.tsx` are no longer routed. They are still on disk because Sol was editing them at the same time; the orchestrator can delete them, along with the components only they use.
2. Done: **Level 1** starts broken: every coin leaves through the Portal, savings stay empty, and the meter is red. You fix it by dragging, tap-to-place, the canvas tap or the keyboard. After that, simulated customers keep 70% (engine preview) and the goal is met after 3 sales.
3. Done: **Level 2** runs `session()` → `getMachine` (reuse if this session owns the id) or `publish()` → `customerOrder()`.
   - REAL coins are green, larger and sparkling, with a "REAL coins · testnet" tag; mock-API coins are coral and tagged MOCK.
   - The Portal goes swirl → beam → gem only from `PayoutView.status`, with a minimum 1.2 s swirl dwell for readability. The gem never pops before `confirmed`; the tests check this.
   - The Portal card shows elapsed seconds and the NEAR tx and Sepolia tx links. "Confirmed" shows "seen by 2 RPCs, 3+ blocks deep" when the API returns two confirmations.
   - `observation: 'unknown'` shows "sent, outcome unknown, check the explorer" and does not retry.
4. Done: **Ledger** is a compact drawer of store rows (session, publish, order, payout) with explorer links. Simulated sales never enter it. Mock rows are tagged mock and have no link.
5. Done: **Open as app** `/m/:id` works for any published id. It shows parts derived from the machine: Splitter, Vault, Portal, Payout mailbox, and held coins for Gate machines. Pay places a real `order()` from the session account and shows the same Portal sequence.
6. Not started: Level 3 (Gate + Worker). The app page has an Approve button for held orders when the session is the Worker, but it was not exercised.
7. Done: Mock mode works end to end, with a MOCK DATA pill (test above).
8. Done: **Performance**:
   - Pixel ratio is capped at 2 on desktop and 1.5 on touch.
   - Shadow map is 2048 on desktop and 1024 on touch or in reduced mode.
   - `?lowfx=1` turns shadows off and sets pixel ratio 1; the test checks this.
   - If fps stays under 30 for 3 s, graphics step down automatically (reduced, then low) with a one-line notice. `?fx=high` disables this for captures.
   - Static meshes are merged per toggle group, and each frame is split into steps of at most 1/30 s.
9. Done: **Accessibility**: every action has a button (dock part → "Place Splitter here"; Run; Open as app; level picker; ledger; help; mute). There is a visible `:focus-visible` ring and text labels on every part. The keyboard-only path is tested.

## API notes for Sol (no changes made by me)

- `/api/session` returns 503 "Testnet sponsor is low on funds" (`ww-sponsor-g4-261112.testnet` had 0.72 NEAR at 07:30 UTC). New browsers can't start a real run until the sponsor is refilled. The game shows the API's real message in the run caption.
- Explorer links are now `testnet.near.rocks/tx/…`. The game uses `TxRef.explorerUrl` as given.
- Suggestion: return `confirmations` on every `getPayout` after `broadcast`, not only at `confirmed`. Then the beam caption could say "seen in block N, k/3 confirmations" instead of the generic "waiting for 3 blocks".

## Unfinished / honest list

- **Sponsor out of funds**: a brand-new visitor's real run fails at "Creating your free test account" with the API's 503 message, until the sponsor account is refilled. The live acceptance used an existing funded test session.
- **Level 3 (Gate + Worker)** is not built: no Gate or Worker models, no Worker walk, no approve flow in the game. Those dock parts are locked and say so.
- **No free-form building**: building is limited to the one Splitter slot in Level 1. The Level 2 machine is fixed, with no part-editing UI (no rotate, delete or connect).
- **60 fps on real hardware is not verified.** This VM renders in software at about 5 fps, which is why the stills use deterministic stepping. The game has not been opened on a real phone GPU. Auto-fallback is in place but untested on real devices.
- **The live acceptance run is desktop only.** Phone stills are mock.
- **Real-time timing on a slow GPU**: if the device is slow, the Portal status can run ahead of the coin animation. The world then shows swirl → beam back to back once the coins arrive (≥1.2 s swirl). It never shows a state the API has not reached.
- **Old UI tests are obsolete**: `ui-tests/flow*.mjs`, `game-mock.mjs`, `game-live.mjs` and `game-mock.mjs` drive the old React Workshop, which is no longer routed. They will fail and should be retired or rewritten against `game-*.mjs`.
- **The `/m/:id` 3D scene is a fixed template.** Parts are toggled from the machine's node types; machines with several Splitters or Gates are not laid out as their actual graph.
- **Sound** is the concept's WebAudio synth, muted by default, placeholder quality.
- **Bundle**: the lazy `game` chunk is 163 kB gzip (three.js). It is not split further.
- **`app/concepts/ui2/`** (source plus an old `dist/`) is still in the tree, untracked. Only its `node_modules` was removed.

## GAME-1-fix

The orchestrator changed scope to a puzzle/jobs rewrite during verification. Final work is limited to the surviving API, store, standalone checkout, route boundary, world lifecycle and cleanup layers. `GamePage.tsx` and `hud.tsx` were restored to `976cee4` so Opus can replace them without these edits. Items 6/7 and game-specific copy, Close/level controls and run persistence are deferred to that rewrite. No contract changes, commits or pushes.

| Finding | Fix in surviving layer | File:line | Test |
|---|---|---|---|
| Earlier nonce stuck, unlimited retries, silent read failures | Advance `waitingPayoutId`; gate automatic signature retries by 15 seconds and cap at two per payout/page; stop after five failures with exposed error + manual retry; publish reactive state/subscription | `app/src/lib/store.ts:79`, `app/src/lib/store.ts:46` | predecessor, retry-bound, five-failures/manual-restart unit tests |
| Customer duplicates and ambiguous HTTP outcome | Browser UUID through API; contract-state existence check before spending; durable intent/result and read-only recovery after network/5xx; check HTTP and content type before parsing JSON | `app/src/lib/orders.ts:12`, `app/api/customer.ts:6`, `app/api/_near.ts:45`, `app/src/api/live.ts:14` | repeated-ID sends once; customer 504 resolves without a second submission; HTTP/content-type tests |
| Unknown observations appear confirmed | Neutral ledger status + order ID; unknown checkout/approval receipt text; resolve by contract order and structured external payout records; preserve known transaction link | `app/src/lib/store.ts:13`, `app/src/lib/orders.ts:30`, `app/src/game/AppPage.tsx:113` | unknown/link recovery test; approve observation fixture; standalone unknown mock |
| Route/chunk/WebGL crashes | Per-route boundaries with reload; safe decoding; exported `webglUnavailable` flag updated by `createWorld`; 2D fallback retains checkout and controls | `app/src/main.tsx:17`, `app/src/game/world.ts:1093` | forced-2D checkout and malformed client route mock; typecheck/build |
| Exhausted session funds | Fresh spendable balance includes price, order fee and gas margin; clear explanation; new grants/mock set to 4.5 NEAR | `app/src/lib/orders.ts:4`, `app/src/game/AppPage.tsx:81`, `app/api/session.ts:6` | balance boundaries/funding unit tests; actual live checkout purchase |
| Reload loses tracking or repeats spend | Persist ledger, order intent/result and checkout receipts; acknowledge result only after UI persistence; restore trackers; deduplicate order/payout rows | `app/src/lib/orders.ts:12`, `app/src/lib/store.ts:59`, `app/src/game/AppPage.tsx:33` | durable-result/no-second-spend unit test; ledger dedup test; standalone reload mock |
| GPU resource leaks | Collect active/retired geometries, materials, textures; dispose renderer and force context loss | `app/src/game/world.ts:78`, `app/src/game/world.ts:1075` | mock route transitions; typecheck/build |
| Helpers treated as endpoints | `_near.ts`, `_portal.ts`, `_server-common.ts`; imports updated; Vercel SPA rewrite still excludes `/api/*` | `app/api/_near.ts:1`, `app/api/_portal.ts:1`, `app/vercel.json:10` | API typecheck, build and live local API |
| Obsolete UI/tests | Remove Workshop/MachineApp, exclusive components and old UI scripts; keep common/live-common and update README/docs references | `app/src/pages/`, `app/ui-tests/`, `README.md:113` | typechecks/build and game mock |

Game/jobs handoff:

- Import `submitOrder`, `pendingOrder`, `finishOrder`, `trackPayout`, `retryRelay`, `useApp`/`subscribeState` from the store. Persist the job run's order ID, payout IDs and transaction links before `finishOrder(orderId)` acknowledges it. Resume an existing intent before any new spend.
- Tracking survives component/level changes and `restoreLedger()` restarts unfinished payouts at boot. Keep Close and level switching enabled during payout tracking. Render `waitingPayoutId` as “waiting for an earlier payout #N”; render `relayError` for every phase and provide `retryRelay(id)` as manual Retry.
- Treat unknown order/approval observations as neutral. Do not show supplier-paid/star completion without a confirmed external effect. Key job completion by mode and contract ID. These are game-layer responsibilities under the revised scope.
- `webglUnavailable` is exported by `world.ts` and updated by `createWorld`; its returned fallback keeps the standalone checkout functional without WebGL.

Recovery uses `get_order` plus structured `get_pending_external_payouts`. Historical vault/direct effects are not reconstructed from trace strings. A completely lost submit response may leave no recoverable transaction hash; no explorer link is fabricated. A missing order read does not prove failure, so another spend stays blocked while the outcome is unknown.

Validation:

- `npm run typecheck` and `npx tsc --noEmit -p api/tsconfig.json`: PASS.
- `node --import tsx --test scripts/*.test.ts`: PASS, 32/32 tests.
- Mock and pinned-live Vite builds: PASS (existing size/browser-externalization advisories).
- The earlier full game-mock suite passed with zero console errors, including game-specific queue/Close/reload checks before those game edits were removed. The final scoped suite retains standalone unknown/reload, forced-2D checkout and malformed client route; its result is recorded below.
- Software-rendered VM runs use `UI_LOWFX=1 UI_SHOTS=0`; assertions still require API confirmation before a visual payment pop. The original swirl-only assertion was timing-sensitive and now accepts the current API-driven phase. Generated screenshot overwrites were restored.
- Interface detector: two pre-existing advisory bounce eases; appearance preserved.

Exactly one live script invocation ran with the local dev API using `/opt/ww-secrets/live.env`. **The scope change to one order arrived after the script had already submitted its standalone order**; this invocation therefore placed two orders, and no further orders/runs were made. Both payouts confirmed with matching successful receipts on two independent RPCs, 3+ blocks deep. **RESULT: PASS; console errors: 0** (238.4 seconds).

| Live action | Public evidence |
|---|---|
| Publish `lemon-ca78234e-36f08e99cf27` | [NEAR publish](https://testnet.near.rocks/tx/4k9k1NxR6GK7hAvE9RVdxAZoVBf788Y9E3KPVm8zeQzr) |
| Seeded-customer order | [NEAR order](https://testnet.near.rocks/tx/HpLp2LYGkNx24ZbpUsyCvZ4iJjLiPPX6Y93HNryMWydb) |
| Portal payout 27: 0.0001 Sepolia ETH | [Sepolia transfer](https://sepolia.etherscan.io/tx/0xbde42bb2245cba8879d85e173fa38c2e72b13ded23f362130a5e037f2fa4d79c) |
| Standalone checkout order | [NEAR order](https://testnet.near.rocks/tx/Fz2AAiGhgjnmk1FN8ru4NL9eMxz5MBi7QpB1szFgdYEa) |
| Portal payout 28: 0.0001 Sepolia ETH | [Sepolia transfer](https://sepolia.etherscan.io/tx/0x87168fde407b56e769d213517e75d8d1d2dfb7b74e0bf02e950039b489927b42) |

The live run used the pre-handoff game UI and the final surviving API/store/checkout behavior. The final WebGL flag export is additive; no live run was repeated after the scope change.

Final scoped verification after restoring GamePage/HUD:

- `UI_BASE=http://localhost:4240 UI_LOWFX=1 UI_SHOTS=0 node ui-tests/game-mock.mjs`: **RESULT: PASS; console errors: 0**. Desktop/phone/keyboard flow, standalone unknown-result recovery and reload with exactly one mock order, WebGL-off checkout and safe malformed client route all passed.
- Final source typechecks and all **32/32** unit tests passed again; final Vite artifact `/tmp/ww-gamefix-final` built successfully.
- Focused checks against that final artifact passed: 2D checkout unknown → observed → reload still has one order, with zero console errors; an intentionally blocked lazy GamePage chunk displayed “New version available, reload” and a Reload button. The failed fetch in the latter check was intentional.
- The store re-exports durable order helpers and exposes `subscribeState` alongside `useApp`/`getState`. Standalone checkout renders read-recovery Retry controls without modifying the shared HUD. Boot-time dynamic-chunk failures also expose Reload rather than silently switching to mock.
