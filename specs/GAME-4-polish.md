# GAME-4 — Polish ("juice"), close GAME-3 gaps, title screen

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Context
GAME-3 is committed (3834c4c) and deployed at https://worldworks.vercel.app. Read docs/EVIDENCE-game3.md (including its "Honest unfinished list") and specs/GAME-3.md first. Code: app/src/game/jobs/*. A competitor (a 3D medieval NEAR game with a cinematic trailer) beats us on first impression; we win on what the machine does (Chain Signatures payout, standalone app). So: polish what exists, no new mechanics. The Portal moment must be the shot people remember, and a judge must understand the game in 30 seconds.

## Scope (priority order; stop adding when time runs out, never leave things half-broken)
1. **Title screen** (first load only, skippable, "?" replays): game name, the one-sentence point ("Money that runs itself: solve a real person's money problem with parts, then ship it as a real payment app on NEAR."), a slow camera move over the island, one button "Start job 1". No wall of text.
2. **Portal moment polish** (the hero shot): at 390px the headline currently overlaps the top-bar chips and the scene (see docs/design/screens/g3-portal-moment-phone.png) — give text its own clear band, hide the top bar fully, keep the three-step progress (NEAR signs → Beam to Ethereum → Lands in Chi's wallet) readable. Add juice: portal swirl speeds up while signing, beam pulse, gem arrival burst + camera nudge, a confirmed stamp. Still driven only by API status.
3. **Juice everywhere, cheap**: coin pickup/landing pops, part-placed squash, Test pass confetti/stars reveal, fail shake on the offending socket; optional WebAudio blips (coin, place, pass, fail, portal hum, gem chime) generated in code (no asset files), with a mute button, default ON after first tap, respects `?lowfx=1`.
4. **Lighting/look pass**: soft shadows or baked contact shadows, warmer light, slight depth fog on the water, so stills look less flat. Must keep phone fps (the user's phone ran GAME-2 smoothly) and `?lowfx=1`.
5. **Test camera**: frame the machine (not the whole island) during Test; frame both islands only in the Portal moment (unfinished item 5).
6. **Job 4 live path**: expose `expire` (API + a "Bread never arrived — refund the customer" button shown only when the contract allows it, i.e. after the expiry height) so a live undelivered order cannot hang forever (unfinished item 2). If the contract call does not exist as assumed, report instead of faking.
7. **Cleanup**: delete or update `app/ui-tests/game2-*.mjs`; friends' custom names (stored in the machine label if the format allows, else localStorage for the owner only and say so).

## Acceptance (docs/EVIDENCE-game4.md)
- typecheck, api typecheck, build, unit tests pass; `ui-tests/game3-mock.mjs` still passes at 1366 and 390 (update it for the title screen); 0 console errors.
- New stills `docs/design/screens/g4-*.png` phone + desktop: title, build, test running, Portal moment (signing, beam, gem), receipts.
- ONE live run only if item 6 changed live behaviour (job 4 deliver path or expire); otherwise none (sponsor NEAR is scarce: each new session costs 4.5 NEAR, each order 1.42 — reuse the existing session noted in EVIDENCE-game3).
- An honest unfinished list.

## Constraints
Testnet only. Never print/commit secrets (/opt/ww-secrets). No contract/engine changes (report blockers). Do not commit or push (orchestrator commits and deploys). Disk tight: npm cache /opt/ww-npm-cache. Chromium /data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome; playwright-core /opt/ww-shot/node_modules/playwright-core; the VM has no GPU, use the deterministic stepping hook. Another agent is doing a read-only completeness audit at the same time; it will not edit files. Target: items 1–3 in ~3h, all in ~6h.
