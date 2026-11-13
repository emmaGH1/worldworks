# UI-2 — Concept sprint: make it a game, not a web page

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Why this exists
The user rated the current UI and demo 1/10. Treat the UI as not started. Diagnosis (orchestrator, agreed):
- It is a web page with a 4-box flowchart, a giant headline and sidebars. Nothing about it says "game" or "Factorio".
- Money is invisible: no coins you can see travel, pile up, split, vanish into a portal.
- No play: one scripted fix, no goal pressure, no customers, no stakes, no scale, no reward.
- The cross-chain wow is a checklist card of receipts, not a spectacle.
- Huge empty space; the machine occupies ~20% of the screen.

## Target feel (bar: a stranger stops scrolling on X)
A living, tactile toy factory seen from a 2.5D / isometric camera (references in docs/design/refs: shapez2_*, factorio_belts, mini-motorways_*, dorfromantik, townscaper, islanders_hud, opus-magnum_*, infinifactory, poly-bridge_stress, bruno-simon_og). Parts are chunky physical machines on a tile grid. Coins are physical objects that roll along belts, split visibly at the Splitter (7 go left, 3 go right), stack up in the Vault, wait at a Gate, get picked up by a Worker. Customers are little characters queueing at the Coin Slot. The Portal is a real portal: coins fall in on the NEAR island and pop out on a separate "Ethereum island" across the water, with the real Sepolia tx landing as the moment it pops out. Juice: squash/stretch, particles, sound, camera punch-in on the Portal. Small, readable HUD (goal, coins, real/simulated label); no hero headline.

Play loop: levels with a goal and a meter ("Lemonade stand is losing money — keep 70% of sales", "Pay the courier only after delivery" (Gate+Worker), "Pay your supplier on Ethereum" (Portal)). Simulated customers run in the browser using the same wasm engine (labeled SIMULATED); the player hits "Run it for real" to put the machine on testnet and send one real order. Keep wallet-free sessions.

## This sprint (concepts only, ~90 min)
Build ONE direction as a real running prototype (not mockups, not AI images): `app/concepts/ui2/` (a separate Vite entry or standalone page; do not modify existing app/src). Three.js (or PixiJS if 2.5D sprites read better — your call, justify) rendering the Lemonade level: belts, Coin Slot with queueing customers, Splitter splitting coins 70/30, Vault stacking, Portal sending coins to the Ethereum island. Simulated only, labeled. Must hit 60fps on a laptop and work at 390px width (portrait camera framing).

Deliver: 4 stills to `docs/design/ui2/` (wide shot, splitter close-up, portal moment, phone) + a 10-second screen capture (webm) of coins flowing and one portal jump, using Chromium at /data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome and playwright-core at /opt/ww-shot/node_modules/playwright-core. Report: library choice, how this plugs into the existing engine wasm + WorldworksApi (app/src/api/types.ts, unchanged), and an honest hour estimate to ship the full game on this direction including live chain wiring.

## Constraints
No contract/engine/api changes. Testnet only. No commits/pushes. Disk is tight (~3 GB free on /): keep deps lean, npm cache /opt/ww-npm-cache. Keep the North Star.

## Carry into the full UI-2 build (from Sol G6 completeness check)
1. Approval payouts: `live.ts` approve decodes Portal effects but returns only TxRef, so Workshop/MachineApp never track/relay payouts created by approval. The new UI must track and relay Portal effects from approve (extend the API facade; add a Gate -> approve -> Portal regression).
2. Unknown observation: `app/api/near.ts` returns `pending:true` when the receipt can't be decoded; the old UI showed this as "held at a Gate" and offered approval. The new UI must show "submitted, result unknown" with the tx link instead.
