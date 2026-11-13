# GAME-7: Make the factory feel alive, add fast-forward, explain the machine's reasoning

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Context
- HEAD is `34e006b`, deployed at https://worldworks.vercel.app.
- Read `docs/EVIDENCE-game6.md`, `docs/RULES.md` and `README.md` first, then `app/src/game/jobs/*` (FactoryView.tsx, factory.ts, factoryScene.ts, scene.ts, JobsGame.tsx, sound.ts).
- Judges will mostly play on a PC (1366–1920). The trailer will be cut from this build, so the factory view is also the hero shot.

## 1. The factory must look like a living factory (top priority)
Today, overview machines are flat coloured blocks (see `docs/design/screens/g6-factory-all-1920.png`). Every total starts at 0, and the first seconds look empty.
- **Real machines on the plots.** Show recognisable miniature machines: the shop with its awning, a Splitter with its dial colours, Payout posts with flags, a Vault box, a Gate arch, and a Portal swirl. Reuse or simplify the editor meshes. Keep the draw-call budget below 150 by using instancing or merged geometry.
- **Motion from the first frame.** Customers are already walking when the overview opens. Coins flow along every belt. Houses bounce slightly when coins arrive, and floating +0.06 amounts appear. Totals count up smoothly. Everything moving stays labeled SIMULATED, exactly as now.
- **Factory feel.**
  - Belts have moving arrow textures.
  - Each house has a small coin pile that grows with its simulated total.
  - A soft day light and gentle shadows, or baked ambient-occlusion blobs under objects.
  - Ambient sound: belts humming and coins clinking, quiet, following the existing Effects toggle.
- **Phone layout.** The Ethereum island must be visible in the phone factory view: frame it, or show an edge indicator "Ethereum →" that pans to it on tap.
- **Real money stands out.** A plot whose machine is shipped (real) shows a gold TESTNET flag, and its Real total row is gold. Real totals still come only from confirmed receipts.

## 2. Fast-forward (the official games brief asks for it)
- Add a "⏩ 4×" toggle in Test and on the factory view. It speeds up simulated time only: coins, customers and Test pacing. Clearly label it on screen while it is active.
- It never affects real runs. During a live Ship it is hidden or disabled, with the tooltip "Real transactions run at network speed".

## 3. Reasoning tooltip (the official games brief asks for it)
Hovering on a PC, or long-pressing on a phone, over any placed part, belt or person shows a small tooltip. The tooltip explains what that part does with the money, using the numbers from the last Test or the current preview. Examples:
- "Splitter 60/20/20: of 0.10 NEAR, sends 0.06 to belt 1, 0.02 to belt 2, 0.02 to belt 3."
- "Gate: holds 0.02 until the Key holder says Delivered; after 100 blocks anyone can refund it."
- "Portal: turns 0.0005 NEAR into a 0.0005 ETH payment that NEAR signs itself."

A failing requirement pill gets the same treatment: it explains why it fails and which part to change.

## 4. Small fixes
- First-time factory view: show the counters' meaning once, in one line ("Simulated customers buy at your shops; real money shows in gold.").
- Nothing on the factory view overlaps at 390, 1366 or 1920.

## Acceptance (`docs/EVIDENCE-game7.md`)
- typecheck, api typecheck, build and all unit tests pass. Add tests for the fast-forward clock (simulated only, disabled in live runs) and for the tooltip text generators (exact amounts).
- `ui-tests/game6-mock.mjs` (updated) passes at 1366, 1920 and 390, plus the 2D fallback, with 0 console errors.
- Stills at 1920 and 390:
  - `g7-factory-alive-*.png`: mid-motion, with coins visible on belts.
  - `g7-tooltip-*.png`
  - `g7-ff-*.png`
  - `g7-factory-phone-eth.png`
- Draw calls and triangle counts for the factory with all five machines.
- No live orders and no new sponsored sessions.
- An honest unfinished list.

## Constraints
- Testnet only. Never print or commit secrets (/opt/ww-secrets).
- No contract or engine changes. Do not commit or push.
- Disk is tight: npm cache at /opt/ww-npm-cache.
- Chromium: /data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome.
- playwright-core: /opt/ww-shot/node_modules/playwright-core.
- No GPU: use the deterministic stepping hook.
- Keep the build green at every step. If something can't be made solid, leave the current behaviour and say so.
- Target: item 1 in about 3 hours, all items in about 5 hours.
