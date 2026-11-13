# GAME-2 — Puzzle jobs: a reason to play, one thing at a time

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Why (user playtest, 2026-11-13, on a phone)
"It runs smoothly but I still don't get the point of the game. Judges would be confused. Nobody would understand the point or what they're doing or what to do. A lot of things happening at once and still nothing happening at all."
Diagnosis: (1) the player makes ONE drag then watches; no decisions. (2) "Keep 70%" is bookkeeping, no person, no stakes. (3) Ambient customers, coins, NEAR, ETH, storage fee, Sepolia address, long account ids all at once. (4) Game vs payment form, point never stated.
The user chose: **Puzzle jobs.** Keep the 3D world and look (it runs smoothly on a real phone), rebuild the game layer.

## The one-sentence point (show it on screen, first thing)
"Money that runs itself: solve a real person's money problem with parts, then ship it as a real payment app on NEAR."

## Core loop (every level)
1. **JOB card**: a person with a face + one human sentence + 2-3 checkable requirements. E.g. Ada (baker): "I pay my two helpers by hand every evening. Make my shop pay everyone automatically." Requirements: Ada gets 60% · Bola gets 20% · Chi gets 20%.
2. **BUILD**: the world is quiet (no ambient customers, no flowing coins). Empty glowing sockets on the belt; a small parts tray containing only the parts this job needs plus 1 distractor. Player places parts into sockets (drag or tap-tap) and sets values (Splitter shares with +/- steppers, Payout recipient chosen from the job's people as avatar chips). Wrong builds are allowed.
3. **TEST** button: exactly 3 simulated customers, ONE AT A TIME, slow and readable (~3 s each): one customer pays → coins move → each requirement row ticks ✓ or ✗ with the amount ("Chi +0.02 ✓"). Simulated via the wasm engine `preview` (label: "Test · simulated"). A failed test explains in one line what went wrong ("Bola got 30%, needs 20%") and the player fixes it. This is the puzzle — the player must think.
4. **SOLVED** → "Ship it for real" (explained before tapping: "Puts this machine on NEAR testnet and runs 1 real sale. ~1 min. No wallet."): sponsored session → publish → seeded customer `customerOrder` → each person's avatar gets a real receipt (NEAR explorer link per payout; Sepolia link for the Portal). Status captions in plain words from API state only. Then "Your shop is live: anyone can pay at worldworks.vercel.app/m/<id>" with a copy/share button and "Open it".
5. Next job unlocks. Level select shows solved jobs with a ★ and their live links.

## Jobs (build in this order; ship 1–3, 4 only if time)
1. **Ada's bakery — split**: Coin Slot → Splitter (3 ways) → 3 Payouts (Ada, Bola, Chi). Teaches Splitter shares + Payout. Distractor: Vault.
2. **Chi moved abroad — pay on another blockchain**: Chi now only uses Ethereum. Replace Chi's Payout with a Portal (Chi's Sepolia address shown as "Chi's Ethereum wallet"). Requirement: "Chi gets paid on Ethereum". This is the wow: the Portal sequence (swirl while NEAR signs → beam when broadcast → gem in Chi's hands when confirmed by 2 RPCs). Explain on screen in one line: "NEAR signs an Ethereum payment itself (Chain Signatures). No bridge, no Ethereum wallet for Ada."
3. **Dayo the delivery rider — pay after delivery**: Gate + Worker: rider's share waits at the Gate until the customer confirms delivery (Worker approves). Requirement: "Dayo is paid only after delivery". Test shows coins waiting, then the approve tap.
4. (Optional) **Rent jar** — Vault: keep 10% for rent.

## Hard rules
- One thing moves at a time. No ambient crowds/coins during build. Max ~6 words per floating label; no raw yocto, no long account ids (truncate, tap for details), no "storage fee" in the main flow (show it in the receipt details: "1.32 NEAR deposit kept by the contract for storage").
- Every screen has exactly ONE highlighted next action.
- The intro is ONE card: the point sentence + "Start job 1". "?" replays help.
- Real vs simulated: Test = simulated (labeled), Ship = real (labeled TESTNET, explorer links). Never mix in the ledger. Gem/receipts only on API `confirmed`.
- People's NEAR accounts: payouts must go to real testnet accounts. Create (or reuse) fixed demo recipient accounts ww-ada/bola/chi/dayo-261112.testnet funded minimally by the sponsor (orchestrator can do this — list what you need), or use implicit accounts. Chi's Ethereum address: a fixed demo Sepolia address we control or 0x…dEaD is NOT ok (looks fake) — use a real address and label it "Chi's wallet (demo)".
- `/m/:id` standalone shop: clear "This is Ada's bakery. Pay 0.10 NEAR → it splits automatically" with the same people/avatars showing who gets what; uses the GAME-1-fix robustness (balance check, unknown outcomes).
- Keep `?lowfx=1`, WebGL fallback, error boundaries (Sol is adding these in GAME-1-fix).

## Engine/contract fit (check first, report blockers immediately)
Confirm with engine/MACHINE_FORMAT.md and the wasm: 3-way Splitter with bps; Payout to account; Portal fee ≥ min_fee_yocto_per_wei × wei and wei ≤ max_wei_per_payout; Gate + Worker approval; trapped-escrow rule at publish (Gate must have an expiry path). Pick prices so every share is valid (e.g. price 0.1 NEAR, Portal share must cover the fee for 0.0001 ETH). Do not change contract/ or engine/.

## Ownership / concurrency
Sol (GAME-1-fix) is editing app/src/api/*, app/api/*, app/src/lib/store.ts, AppPage.tsx, main.tsx, world.ts (dispose + WebGL flag). Until Sol finishes (orchestrator will tell you), build in new files (app/src/game/jobs/*, new HUD components) and do not edit those files; after Sol finishes you may integrate (merge carefully, keep their fixes). You own GamePage.tsx, hud.tsx and the level logic.

## Acceptance (docs/EVIDENCE-game2.md)
- typecheck/build/unit tests pass; `ui-tests/game2-mock.mjs` plays jobs 1–3 in mock (including one deliberately wrong build that fails Test with the right message, then fixed), desktop + 390px; 0 console errors.
- `ui-tests/game2-live.mjs`: ship job 2 for real (one order) with NEAR + Sepolia links; 0 console errors.
- Stills `docs/design/screens/g2-*.png` (job card, build, test fail, test pass, ship, Portal gem, live shop) desktop + 390px.
- A 5-person "hallway test" substitute: write the exact on-screen text of the first 60 seconds in the report so the orchestrator can check it reads clearly.

## Constraints
Testnet only. Never print/commit secrets. Do not commit/push. Target: playable in mock in ~8h, live-shipped jobs 1–3 by ~23:00 UTC Nov 13. Report blockers early via your final message rather than guessing.
