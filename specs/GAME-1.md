# GAME-1 — Ship the 2.5D game (vertical slice), live on testnet

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Context
The user rated the old flat UI 1/10 and APPROVED the UI-2 concept (`app/concepts/ui2/`, `docs/design/ui2/REPORT.md`, stills in `docs/design/ui2/`). Build the hackathon-cut vertical slice from that report. Target: playable in live mode by ~20:00 UTC Nov 13.

## Scope
1. Replace the main app experience (`/`) with the Three.js game, moving the concept code into `app/src/game/` (one app, one build). Keep `/verify` working; keep the old React components only if reused.
2. **Level 1 — Lemonade stand**: starts BROKEN (losing money: all coins leave via Payout/Portal, the Vault stays empty, meter red). The player drags a Splitter from the dock onto a highlighted slot on the belt (slot-based building: highlighted drop tiles, drag or tap-to-place, works on touch). Simulated customers then show 70/30; goal met.
3. **Level 2 — Pay your supplier on Ethereum**: Portal unlocked; goal is one REAL order. "Run it for real": `session()` (sponsored, wallet-free) → `publish()` (unique id per session) → `customerOrder()` → REAL coins (tagged REAL, distinct look) → Portal states driven ONLY by `getPayout`/`relay` status: awaiting/waiting_for_signature/signed → swirl; broadcast → beam over water; confirmed (both RPCs) → gem pops with links to the NEAR tx and the Sepolia tx. Slow states must feel alive and honest (show elapsed seconds, "NEAR network signing…", "seen on Sepolia, waiting for 3 blocks…").
4. **Ledger**: compact, every real thing with an explorer link (`TxRef.explorerUrl`); simulated items never appear in it.
5. **Open as app** (`/m/:id`): the standalone checkout in the same visual language (a small 3D stand + pay button that does a real order and shows the same Portal sequence). Must work for any published machine id.
6. Optional if time: Level 3 Gate + Worker (pending order, Worker walks over, approve). Do not start it before 1–5 pass.
7. Mock mode (no `VITE_CONTRACT_ID`) must still work end-to-end with the MOCK DATA label, for local testing and screeners.
8. Performance: cap pixel ratio, shadow map adaptive; add `?lowfx=1` and auto-fallback when fps < 30 for 3 s. Must not break on phones (390px portrait camera as in the concept).
9. Accessibility minimum: every action reachable by button (no drag-only), visible focus, text labels on parts.

## API boundary
Use `app/src/api/` (`WorldworksApi`) only. Sol is concurrently fixing the API facade (`approve` returning effects, explicit "submitted, result unknown" observation state) and Vercel deployment — do NOT edit `app/src/api/*`, `app/api/*`, `vercel.json`. If you need an API change, write it in your report.

## Acceptance (write to docs/EVIDENCE-game.md)
1. `npm run typecheck && npm run build` pass; bundle sizes stated.
2. New Playwright scripts: `ui-tests/game-mock.mjs` (level 1 fix + level 2 in mock) and `ui-tests/game-live.mjs` (level 2 real order against ww-portal-261112.testnet with the local API `scripts/dev-api.ts`, env from /opt/ww-secrets/live.env — do not print secrets). Paste output with real NEAR + Sepolia links. 0 console errors.
3. Stills of each state to `docs/design/screens/game-*.png` (desktop + 390px).
4. Honest list of what is unfinished.

## Constraints
Testnet only. Never print or commit secrets. Do not commit or push (orchestrator commits). Disk is tight: npm cache /opt/ww-npm-cache; remove `app/concepts/ui2/node_modules` once code is moved. Chromium: /data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome; playwright-core: /opt/ww-shot/node_modules/playwright-core. The VM has no GPU (≈5 fps in SwiftShader) — use deterministic stepping for captures and don't chase fps here.
