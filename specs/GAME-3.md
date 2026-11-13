# GAME-3 — Real puzzles, your own stake, the world as the star

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Why (orchestrator diagnosis, agreed by the user after playing GAME-2 on a phone)
1. **Quiz, not a game**: "Ada gets 60%" → set 60%. The answer is in the question. No thinking, no aha, no replay.
2. **No stake**: the player does paperwork for fictional people; the reward is a receipt list.
3. **World hidden**: cards cover ~80% of a phone screen; the 3D scene is wallpaper; money moving is barely visible.
4. **The wow is a sentence**: Chain Signatures is a purple text box.
5. **Visual bugs** (phone screenshots): avatars stretched into flat ellipses in the receipt sheet; Payout labels truncated ("Payou") and overlapping; blurred text bleeding through stacked sheets; result sheet overlapping the job card.

## Build on GAME-2 (app/src/game/jobs/*, docs/EVIDENCE-game2.md). Keep everything that works (Test/Ship flow, live wiring, recovery, preflight, honesty rules).

### 1. Real puzzles (requirements are goals and limits, never the answer)
Design 4 jobs (keep characters Ada, Bola, Chi, Dayo) where the player must reason. Each job: goal rules checked by Test over 3 simulated customers, a **parts budget** and a **score** (parts used and/or "coins wasted/kept"), ≥2 valid solutions where possible, ★★★ for the best. Examples (adapt to what the engine supports — verify against engine/MACHINE_FORMAT.md and the wasm before designing):
- Job 1 Ada's bakery: "I keep three times what each helper gets. Helpers get the same." (player derives 60/20/20.)
- Job 2 Chained: "Ada takes half. Of the rest, Bola gets twice Chi." → needs two Splitters in a chain (50% → 2/3·1/3), or one 3-way at 50/33/17 with rounding consequences shown; a budget of parts that rewards the elegant answer.
- Job 3 Chi moved abroad: Chi must receive on Ethereum, the Portal has a fee (from limits()), "Chi must end up with at least X"; the player chooses where the Portal goes and how much share it needs. Then the Portal moment (below).
- Job 4 Dayo the rider: "Pay Dayo only after delivery; if it never arrives, the customer gets the money back" (Gate + Worker + expiry path, the contract rejects trapped escrow).
Wrong builds must fail Test with a one-line reason in plain words ("Ada got 0.05, needs 3× Bola's 0.02 = 0.06").
Building: sockets may accept any part from the tray; allow chaining (a Splitter output feeding another socket). Drag and tap-tap; works at 390px.

### 2. Your own stake (finale)
After job 4 (or as "Your shop" sandbox unlocked by job 1): **the player's own sponsored account is one of the people** ("You"), plus up to 2 friends (NEAR account or Ethereum address input, with the gas preflight for fresh EVM addresses). Ship it → real link `/m/:id` with "Share" (Web Share API / copy) and pre-written X text. When anyone pays on the link, the split really reaches the player's account (show the player's live balance going up with an explorer link). Real vs simulated rules unchanged.

### 3. The world is the star
- Cards collapse into small chips (job chip top-left, requirement checks as compact pills); expand on tap. Max ~25% of a 390×844 screen covered while the machine runs.
- During Test, the camera frames the machine; coins visibly travel; each requirement pill ticks as its coins land. One thing moves at a time.
- **Portal moment** (live, job 3): fills the screen — coins dive into the Portal while NEAR signs (show "NEAR is signing an Ethereum transaction" with real seconds), the beam crosses the water on broadcast, the gem lands in Chi's hands on confirmed (2 RPCs). One line of why it matters: "Ada never touched Ethereum. Her NEAR machine paid Chi there by itself."
- Receipts: a compact list (avatar circle 32px, name, amount, explorer pill), never stretched; Details collapsed.

### 4. Fix the visual bugs listed in "Why" #5 and anything similar at 390px and 1366px.

## Acceptance (docs/EVIDENCE-game3.md)
- typecheck, api typecheck, build, unit tests pass; new unit tests for each job's rule checker (correct + 2 wrong builds each).
- `ui-tests/game3-mock.mjs`: all 4 jobs + "Your shop" at 1366 and 390, including a wrong build per job; 0 console errors.
- ONE live run at the end (production-style local or the deployed preview): job 3 ship with Sepolia receipt, and "Your shop" ship + one payment by the seeded customer that credits the player's account. Links in the report. 0 console errors.
- Stills `docs/design/screens/g3-*.png` (phone and desktop): job card collapsed, test running with coins visible, test fail, Portal moment, receipts, your shop + share.
- The exact on-screen text of the first 90 seconds.
- An honest unfinished list.

## Constraints
Testnet only. Never print/commit secrets (/opt/ww-secrets). No contract/engine changes (report blockers). Do not commit or push (orchestrator commits and deploys). Disk tight: npm cache /opt/ww-npm-cache. Chromium /data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome; playwright-core /opt/ww-shot/node_modules/playwright-core; the VM has no GPU, use deterministic stepping. Fresh Sepolia addresses need ~205k gas but the Portal signs 21k: keep the preflight; Chi's demo address is initialized. Target: mock-complete in ~6h, live-verified in ~9h.
