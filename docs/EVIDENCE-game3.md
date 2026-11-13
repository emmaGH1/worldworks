# GAME-3 evidence: real puzzles, your own stake, the world as the star

Implementation sub-agent, shared checkout at `5919c2b`. No commits, no pushes. No changes in `contract/` or `engine/`. Testnet only. No secret was printed or written to the repository.

## Engine and contract check (done before designing the puzzles)

These were checked against the checked-in wasm, `contract/src/lib.rs` / `portal.rs` and live `get_limits`. There is **no blocker**. Every puzzle below is made from things the engine and contract already do.

| Question | Finding | Consequence for the design |
|---|---|---|
| Chained Splitters | Supported: any Splitter output may target another Splitter, and merges are allowed (one person can be paid by two Payouts). Remainders go to belt 0. A chained ⅓ is **not** exact (50% → 6667/3333 gives Bola 0.033335 vs Chi 0.016665). | Puzzle ratios use exact numbers: job 2 uses 50% → 75/25, so Bola 0.0375 = 3 × Chi 0.0125 exactly. |
| Splitter granularity | The engine takes basis points. The game dial clicks in 5% steps, a stated game rule. | Job 2's 37.5% / 12.5% cannot be dialled on one Splitter, so it needs a chain. |
| Gate expiry / refund | `NeedsApproval` Gates need distinct pass/fail targets (`IdenticalApprovalTargets` otherwise). The contract `expire()` is block-based (`expiry_blocks`, published as 100), and anyone may call it after that. A fail port into a Vault validates. | The Gate has two real exits, "delivered" and "time up". The player chooses what sits on each. A Vault on "time up" is allowed by the engine, so the **rule checker** fails it with a plain reason. |
| Portal fee rule | The browser preview does **not** enforce the fee. The contract enforces `fee ≥ wei × min_fee_yocto_per_wei` at publish (`check_portal_paths`) and on payout. Extra fee is kept by the contract. There is one Portal per machine, the per-payout cap is 0.002 ETH, and there are ≤ 4 NEAR transfers + ≤ 1 Portal per resolution path. | Job 3 checks the fee in the rule checker using the live `rate` (1,000,000 yocto/wei = 1 NEAR per ETH). Extra fee is scored as waste: ★★★ for zero. |
| Portal funds / gas | The Portal treasury held **0.0039 Sepolia ETH**. A payout reserves `wei + 21000 × 100 gwei` (0.0021 ETH). Chi's wallet estimates 21,000 gas. A never-used address estimates **204,600** gas, and the contract signs a fixed 21,000. | Portal amounts offered are 0.0005 / 0.001 ETH. The live run used 0.0005 ETH. The GAME-2 gas preflight is kept and now also guards friends' Ethereum addresses. |
| Ethereum recipient | The recipient is supplied **per order by the payer** (`submit_order(external_recipient)`), not stored in the machine. | A player's shop link carries it as `?to=0x…` and the standalone page pre-fills it. See the unfinished list. |

## What was built (`app/src/game/jobs/*`)

- **Tree builds.** Sockets are paths (`r`, `r.0`, `r.1.p`, …). A Splitter (2–3 belts at the root, 2 deeper) opens child sockets. A Gate opens "delivered", "time up" and a Key hook. The depth limit is 3 levels. Any node part fits any non-leaf socket; the deepest sockets take Payout/Portal/Vault. Drag, tap-part-then-spot, and tap-spot-then-part all work. Removing a part returns its whole subtree to the tray.
- **Four puzzle jobs + Your shop** (`jobs.ts`). Each job has goals, not answers, a parts budget (the tray), Test over 3 simulated customers through the wasm engine, a one-line failure reason, and stars:

| Job | Goal text (what the player sees) | Best (★★★) | Other valid solutions |
|---|---|---|---|
| 1 Ada's bakery | "I keep three times what each helper gets, and my helpers get the same." | one 3-way Splitter 60/20/20, 4 parts | 60/40 → 50/50 chain, 5 parts ★★ |
| 2 Ada steps back | "I take half. Of the rest, Bola gets three times what Chi gets." | 50/50 → (75/25), 5 parts | 50/25/25 + 50/50 merge into Bola, 6 parts ★★ |
| 3 Chi moved abroad | "Send me at least 0.0005 ETH for every loaf. Bola keeps her 20%. Ada gets everything else." | 75/20/5 → (90/10 Ada/Portal): the Portal gets exactly its 0.0005 NEAR fee | 75/20/5 with the Portal directly: passes, but the Portal keeps 0.0045 NEAR extra ★ |
| 4 Dayo delivers | "Pay my 20% only after the customer has it. If the bread never arrives, the customer gets that money back. Ada gets the other 80%." | 80/20 → Gate(Dayo / refund), Key = customer: Ada is paid at once | Gate on the whole sale ★★ ("Ada waited for the delivery too") |
| Your shop | "Every sale pays you for real on NEAR testnet. Add up to two friends." | — | any split; a friend may be a NEAR account (Payout) or one Sepolia address (Portal) |

  Example failure lines (exact strings, unit-tested): `Ada got 0.04, needs 3× Bola’s 0.03 = 0.09.` · `Bola got 0.035, needs 3× Chi’s 0.015 = 0.045.` · `The Portal needs 0.0005 NEAR to send 0.0005 ETH but gets 0.00025. The contract would refuse it.` · `The bread never arrived and the customer got nothing back: a Vault kept 0.02.` · `The rider can’t confirm their own delivery. Give the Key to the customer.` · `Friend 2 got nothing.`
- **The world is the star.** The job card opens once per job and then collapses into a chip (face, title, stars) plus compact requirement pills, and expands on tap. Measured chrome while building (top bar + pills + tray/button): **16.0% of 1366×800, 19.5% of 390×844**. During Test the tray hides. The 3D layout is computed from the build: belts, sockets and parts move as the tree grows, and the Portal's beam is rebuilt to wherever the Portal sits. During Test, coins travel flow by flow (staggered), and **each pill ticks ✓/✗ when the coins of the people it is about land**. The Gate holds coins until the Key tap, then they run down the "delivered" or "time up" belt.
- **Portal moment** (live or mock, job 3 and Your shop): the page goes full-screen over the world. The camera swings to frame the Portal, the water and the Ethereum island. The text runs "NEAR is signing an Ethereum transaction · Ns" with real seconds from `PayoutView`; coins keep diving into the Portal while it signs. The beam crosses the water on `broadcast`, and the gem lands on Chi on `confirmed`, with "Confirmed · seen by 2 RPCs" from the API proofs. The why line: "Ada never touched Ethereum. Her NEAR machine paid Chi there by itself." It is driven only by API status, never by a timer.
- **Your own stake.** The shop setup takes up to two friends (NEAR account, or one `0x` address; malformed input is rejected). It checks named NEAR accounts exist (live) and runs the gas preflight for the Ethereum friend. Ship gives the real `/m/:id` link (+`?to=` when there is a Portal) with **Share** (Web Share API, else copy), **Copy link**, a pre-written **Post on X**, and **Open it**. The player's balance is read before the sale and polled after: "Your account 4.68772 → 4.75772 NEAR +0.07" with an explorer link.
- **Receipts**: a compact grid (32px avatar circle, name, amount, explorer pills), with Details collapsed. `/m/:id` reads chained Splitters and Gates back from the machine (`shopPeople`), names the owner and friends, and pre-fills `?to=`.
- **Visual bugs from the phone screenshots, fixed.** Stretched avatars: `.j-face` is now `flex:none; aspect-ratio:1`, and receipts use a grid; the GAME-2 bug was the `li > span {flex:1}` rule hitting the avatar span. Truncated, overlapping "Payou" labels: sockets are one-line icon + name, and deeper sockets stack icon over name at ≤640px. Leaves spread wider. Blurred text through stacked sheets: one sheet at a time, the ship panel replaces the job card, and the Portal moment hides the chrome. Result sheet over the job card: the card is closed while a run panel is open.
- Kept from GAME-2: Test/Ship flow, durable order intent and resume, unknown-outcome handling, payout tracking and retry, gas/limits preflight, MOCK/TESTNET/SIMULATED labels, ledger, 2D fallback.

Other files: `app/src/api/mock.ts`: a mock payout to this browser's mock account raises its mock balance, as the contract would. `app/src/game/AppPage.tsx`: generic shop people, `?to=` pre-fill. `app/src/game/jobs/portalPreflight.ts`: the message names whose wallet. `app/scripts/check-secrets.ts`: skips deleted tracked files and also checks Chi's Sepolia key. `app/scripts/game2.test.ts` is **deleted**, superseded by `game3.test.ts`, because GAME-2's job definitions no longer exist.

## Verification

- `npm run typecheck`: **PASS**. `npx tsc --noEmit -p api/tsconfig.json`: **PASS**.
- `node --import tsx --test scripts/*.test.ts`: **46/46 PASS**. New `scripts/game3.test.ts` (14 tests) covers, for every job, the correct build(s) with stars and at least two wrong builds with their exact one-line reason. It also covers the tree helpers, contract-valid ids, `shopPeople` on chained/gated machines, contract effect bounds (≤ 4 transfers, ≤ 1 Portal on every path) for all best builds, and the gas preflight.
- `npm run build` (mock) and the live-pinned build (`VITE_CONTRACT_ID=ww-portal-261112.testnet`): **PASS**. The existing bundle-size advisory remains.
- `node --import tsx scripts/check-secrets.ts`: **PASS**, 362 repository files against 25 private keys/seed phrases, plus Chi's Sepolia key; values not printed.
- `UI_BASE=http://127.0.0.1:4261 UI_ADVANCE=1 UI_SHOTS=1 node ui-tests/game3-mock.mjs` against the production mock build: FINAL_MOCK_RESULT. It covers jobs 1–4 and Your shop at **1366×800 and 390×844**. Each viewport plays at least one wrong build per job that fails with the expected sentence and highlights the spot to fix, then fixes it and passes with the expected stars. It ships mock runs of jobs 1, 3 and 4 and Your shop; job 2 uses "Skip". Also checked: a real pointer drag on desktop, taps on the phone, one highlighted action, pills ticking, 32px receipt avatars, the Portal moment's exact copy, Gate taps and the Delivered approval. Your shop is checked for the +0.07 balance, Share/X, the `?to=` link and the standalone page with the split and the pre-filled wallet. Rendering uses the existing deterministic stepping hook (software GPU; the render scale is reduced between captures and restored for every still).

## ONE live run (production-style local: `vite preview` of the live-pinned build + `scripts/dev-api.ts` with `/opt/ww-secrets/live.env`)

`UI_BASE=http://127.0.0.1:4262 UI_ADVANCE=1 node ui-tests/game3-live.mjs` → **RESULT: PASS, 0 console errors, exactly 2 seeded-customer orders, 0 retries**. The run reused the existing funded GAME-2 session `p83ed05965fc83a2d2141.ww-sponsor-g4-261112.testnet` (no new 4.5 NEAR grant). Public data: [game3-live.json](game3-live.json).

**Job 3: Chi paid on Ethereum (Portal moment)**: built 75/20/5 → (90/10) and passed Test ★★★, then shipped. 117 s from Ship to confirmed.

| Action | Receipt |
|---|---|
| Machine | `abroad3-2d8d1b47-c83a2d2141` |
| Publish | [NEAR CwDqjjkk…](https://testnet.near.rocks/tx/CwDqjjkkHjcdAGuJ2itYJBS2XBzYRmuVqvynNHoVmTa5) |
| Seeded-customer sale (order `ca740c84-c497-4e56-a311-22e17e155016`): Ada 0.075 + 0.0045 NEAR, Bola 0.02 NEAR, Portal fee 0.0005 NEAR | [NEAR Wckcgn6S…](https://testnet.near.rocks/tx/Wckcgn6SAXC8bvfMN9KBmfkxpfdbAf4uKfj8oCkw4G8) |
| Portal payout #32: 0.0005 ETH to Chi's demo wallet `0xE53A…aeb2`, **confirmed** | [Sepolia 0xe0d34930…](https://sepolia.etherscan.io/tx/0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a) |

Both `rpc.sepolia.ethpandaops.io` and `sepolia.gateway.tenderly.co` returned the same successful receipt (status 1, block 12,126,458, ≥ 3 blocks deep). The UI said "confirmed" only after the API returned both proofs.

**Your shop: the player's own account gets paid**: the shop setup used You (the session account) plus Friend 1 = Bola's demo implicit account (standing in for a friend), split 70/30. There is no Portal, so the treasury was not spent a second time.

| Action | Receipt |
|---|---|
| Machine / link | `shop-ab044e8b-c83a2d2141` → `/m/shop-ab044e8b-c83a2d2141` |
| Publish (by the player) | [NEAR yFpyrFes…](https://testnet.near.rocks/tx/yFpyrFesbzucpcZEmpot59jtfMz3pESMchSoNXvAyej) |
| One seeded-customer payment (order `8c1380d7-4932-4f34-be93-9b777ccd2105`): **0.07 NEAR to the player's account**, 0.03 NEAR to the friend | [NEAR EJeyoqAj…](https://testnet.near.rocks/tx/EJeyoqAjbMxrArWGt29PvfNfJ35rR9FRNp9B4GwjJ1eE) |
| Player balance (available, read from chain) | 4.687729870526234500 → **4.757729870526234500 NEAR (+0.07 exactly)**, [account](https://testnet.nearblocks.io/address/p83ed05965fc83a2d2141.ww-sponsor-g4-261112.testnet) |

Live stills (desktop): [test pass](design/screens/g3-live-job3-test-pass-desktop.png) · [Portal moment, signing](design/screens/g3-live-portal-moment-desktop.png) · [Portal moment, confirmed + gem](design/screens/g3-live-portal-gem-desktop.png) · [job 3 receipts](design/screens/g3-live-job3-receipts-desktop.png) · [Your shop, balance up](design/screens/g3-live-your-shop-desktop.png) · [standalone shop](design/screens/g3-live-shop-page-desktop.png).

## Stills (`docs/design/screens/`, MOCK unless named `g3-live-*`)

| State | Desktop 1366 | Phone 390 |
|---|---|---|
| Job card open (first time) | [PNG](design/screens/g3-job-card-open-desktop.png) | [PNG](design/screens/g3-job-card-open-phone.png) |
| Job card collapsed (chip + pills) | [PNG](design/screens/g3-job-card-desktop.png) | [PNG](design/screens/g3-job-card-phone.png) |
| Build | [PNG](design/screens/g3-build-desktop.png) | [PNG](design/screens/g3-build-phone.png) |
| Test running, coins visible | [PNG](design/screens/g3-test-running-desktop.png) | [PNG](design/screens/g3-test-running-phone.png) |
| Test fail | [PNG](design/screens/g3-test-fail-desktop.png) | [PNG](design/screens/g3-test-fail-phone.png) |
| Test pass ★★★ | [PNG](design/screens/g3-test-pass-desktop.png) | [PNG](design/screens/g3-test-pass-phone.png) |
| Chained Splitters (job 2) | [PNG](design/screens/g3-chain-desktop.png) | [PNG](design/screens/g3-chain-phone.png) |
| Gate waits for the Key (job 4) | [PNG](design/screens/g3-gate-wait-desktop.png) | [PNG](design/screens/g3-gate-wait-phone.png) |
| Portal moment (signing) | [PNG](design/screens/g3-portal-moment-desktop.png) | [PNG](design/screens/g3-portal-moment-phone.png) |
| Portal moment (confirmed, gem) | [PNG](design/screens/g3-portal-gem-desktop.png) | [PNG](design/screens/g3-portal-gem-phone.png) |
| Receipts | [PNG](design/screens/g3-receipts-desktop.png) | [PNG](design/screens/g3-receipts-phone.png) |
| Your shop + share + balance | [PNG](design/screens/g3-your-shop-desktop.png) | [PNG](design/screens/g3-your-shop-phone.png) |
| Standalone shop `/m/shop-…?to=` | [PNG](design/screens/g3-shop-page-desktop.png) | [PNG](design/screens/g3-shop-page-phone.png) |

## The first 90 seconds (exact on-screen text)

The full transcript of all 38 screen states is in [game3-first90.md](game3-first90.md) (raw: [game3-first90.json](game3-first90.json)). It is reproducible with `ui-tests/game3-first90.mjs` (390×844, 2D fallback with identical DOM copy, paced script, nothing shipped). The key moments follow verbatim; the world labels (sockets, people, stand) and the top bar are part of each full state in the transcript.

**0.0 s: intro**
```text
WORLDWORKS

Build money machines that really run on NEAR. Solve each job with the fewest parts, then ship it as a real shop anyone can pay.

Start job 1
```
**7.3 s: the job card (opens once)**
```text
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. I keep three times what each helper gets, and my helpers get the same. Make the shop do it.
○
Ada keeps 3× what each helper gets
○
Bola and Chi get the same
○
Every coin is paid out

A Splitter can have 2 or 3 belts. Its dials click in 5% steps.

Parts budget: 7 in the tray · fewest parts earns ★★★

Start building
```
**21.3 s: card collapsed to pills; the banner says what to do**
```text
○ Ada = 3× a helper   ○ Bola = Chi   ○ All paid out
Drag a part onto a glowing spot (or tap the spot, then a part).
```
**50.5 s: Test fails** (40/30/30 build)
```text
✗ Ada = 3× a helper   ✓ Bola = Chi   ✓ All paid out
✗ Ada got 0.04, needs 3× Bola’s 0.03 = 0.09.
```
**66.0–70.3 s: the fix (60/20/20) is tested; pills tick as coins land, then:**
```text
✓ Ada = 3× a helper   ✓ Bola = Chi   ✓ All paid out
★★★ It works! 4 parts: the best possible.
Ship it for real MOCK: no chain, fake hashes
Skip to the next job
```
(The pill rows above are condensed onto one line; on screen each pill is a separate chip. The full verbatim text is in the transcript.)

## Honest unfinished list

1. **The live run was local production-style on desktop 1366 only**, not on the deployed preview and not at 390px live. Phone behaviour is verified only in MOCK.
2. **Live job 4 (Gate) was not re-run in GAME-3.** The "time up" exit is only simulated in Test: the browser wasm has no `expire`, and the API/UI expose no `expire` call. On the real contract, anyone may call `expire()` after 100 blocks, but nothing in the game does it yet, so a live undelivered order would wait until someone does.
3. **The shop's Ethereum recipient travels in the link (`?to=0x…`).** The contract takes the recipient from each payer, so a payer can change it. This is how the contract works and the page says whose wallet it fills. Only one Ethereum friend is supported (one recipient per order). Never-used Sepolia addresses are refused by the gas preflight, because the contract signs a fixed 21,000 gas.
4. Friends are named "Friend 1/2" (address shown under the name); custom names are not stored.
5. The camera always frames the whole island during Test; there is no extra zoom on the machine. With the Ethereum island visible on a 390px phone, deep sockets get small (labels stack to fit).
6. `ui-tests/game2-*.mjs` were not updated and no longer match the UI. `scripts/game2.test.ts` was deleted, superseded by `game3.test.ts`. GAME-2 progress in localStorage is not migrated (new keys `ww-jobs3-*`). GAME-2 machines still open in `/m/:id`.
7. The +0.07 balance line shows the account's *available* balance before/after the order. Unrelated activity on the same account in that window would show in the difference.
8. MOCK Portal timings imitate testnet; the mock never touches a chain and its hashes are labeled MOCK. The software-GPU UI runs use the deterministic stepping hook, so real-time frame pacing on phones was not measured.
9. The existing bundle-size advisory remains.
