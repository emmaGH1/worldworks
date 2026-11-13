# GAME-7 implementation evidence

Implemented in the shared `main` checkout based on `34e006b`. No commit, push or deployment. No contract, engine or API implementation changes. No live orders or new sponsored sessions; `/opt/ww-secrets` was not read. Browser gameplay, saved-run fixtures and captures use MOCK mode only.

## Implemented

- Instanced factory miniatures: striped shop awnings with counters/posts, Splitter dials and coloured indicators, Payout flagposts, Vault lids/locks, Gate arches, Key rings and rotating Portal rings. Shipped live plots have gold flag geometry and a TESTNET app label; mock shipments stay labeled MOCK. Real total rows are gold and continue to use the existing scoped, confirmed-receipt filter without modification.
- Customers and distributed belt coins are present at the initial deterministic draw. An empty overview shows a clearly labeled demo machine, without awarding solves or crediting demo sales to player totals. Solved factories begin a preview purchase after approximately 150ms, then purchase every six simulated seconds. Displayed counters interpolate over four integer steps; each complete WASM sale is persisted immediately, so leaving during the animation cannot truncate a sale. House bodies bounce, bounded coin piles grow from saved Sim totals, and amount labels appear. Coins cover every route segment; all-five fixture has 128 coin instances and ten customers.
- Scrolling arrow textures and instanced moving markers on belts, soft daylight and baked plot shadow blobs. Procedural belt hum and coin clinks follow Effects/volume and the existing gesture unlock.
- Phone camera includes the Ethereum island. Phone plot labels are compact, house totals stay in the existing bottom layout, and the counter explanation appears once per storage scope with a dismiss control.
- Shared ⏩ 4× control in Test and Factory. Active controls explicitly say SIMULATED. Only local animation, preview traffic and Test pacing use the accelerated clock. Unresolved runs disable the controls with “Real transactions run at network speed”; live waits and network operations retain their original timing. Animation subdivides accelerated elapsed time into stable simulation steps.
- Hover, keyboard focus and touch-hold tooltips explain placed parts, belt inspection points, shop/Coin Slot, customers, people and requirement pills. Full integer-precision amount formatting is independent of rounded HUD formatting. Splitter arithmetic includes first-output remainder, Gate text explains the 100-block time-up exit and caller requirement, and Portal text distinguishes NEAR fees from treasury-funded Sepolia ETH. Failing requirements use their own checker explanation and identify an inspection socket. README and rules now describe the controls.

## Verification

- `cd app && npm run typecheck`: PASS.
- `cd app && npx tsc --noEmit -p api/tsconfig.json`: PASS.
- `cd app && npm run build`: PASS; existing >500 kB bundle advisory remains.
- `cd app && node --import tsx --test scripts/*.test.ts`: PASS, **66/66**. Five new tests cover simulated-only acceleration and the live guard, exact/chained Splitter amounts, sub-yocto-display precision, Gate/Key/Vault/Payout/Portal explanations, failing requirement repair text, and unconfigured parts without invented recipients or permissions. Existing factory tests retain confirmed-receipt and simulation separation coverage.
- `CARGO_TARGET_DIR=/opt/ww-target cargo test --manifest-path engine/Cargo.toml`: PASS, **40 tests** (39 engine and one cost test). Engine sources unchanged; contract sandbox suites were not rerun.
- `cd app && UI_BASE=http://127.0.0.1:4268 node ui-tests/game6-mock.mjs`: PASS at **1366×1080, 1920×1080, 390×844**, each WebGL and forced 2D, **0 console/page/request errors**. Updated checks exercise the actual job-1/job-2 build/Test loop, 4× state shared with Factory, exact 0.05 NEAR Splitter reasoning, persistence, Help/audio/navigation, and renderer budgets. The phone HUD is additionally checked at 360px. [Structured results](game7-ui.json). Matrix screenshots now go to `/tmp/worldworks-game7-ui/` by default so historical GAME-6 stills are preserved.
- `cd app && UI_BASE=http://127.0.0.1:4268 node ui-tests/game7-stills.mjs`: PASS, **0 errors**, normal-effects deterministic captures at 1920 and 390 plus fallback. [Metrics](game7-stills.json). All-five trees are explicit saved-progress fixtures, not a new full playthrough or live payments.
- `cd app && node ui-tests/game7-controls.mjs`: PASS, **0 errors**. Synthetic touch-pointer hold opens exact preview reasoning; a saved unresolved MOCK run disables both factory and editor controls and exposes the network-speed tooltip. No Ship invocation. [Control results](game7-controls.json).
- `git diff --check`: PASS. An intermediate final-capture attempt exposed a WebGL-context recreation failure; the preview context now updates through a ref, and disposal preserves a still-mounted canvas context. Final recaptures were rerun after the fix. Impeccable detector reports only the two pre-existing Gate delivered/time-up socket stripe warnings; no new findings.

All-five factory `renderer.info.render` measurements at both 1920 and 390: **11 draw calls / 21,236 triangles**. Forced fallback: **0 / 0**. This is substantially below the 150-call cap. These measurements use software Chromium and deterministic stepping; they do not establish real-device frame rates.

## Stills

All are simulated/MOCK; gold Real rows remain zero.

| State | Desktop | Phone |
|---|---|---|
| Factory alive, with belt coins | [1920](design/screens/g7-factory-alive-1920.png) | [390](design/screens/g7-factory-alive-390.png) |
| Exact Splitter tooltip | [1920](design/screens/g7-tooltip-1920.png) | [390](design/screens/g7-tooltip-390.png) |
| 4× simulated active | [1920](design/screens/g7-ff-1920.png) | [390](design/screens/g7-ff-390.png) |
| Fallback | [1920](design/screens/g7-factory-alive-1920-2d.png) | [390](design/screens/g7-factory-alive-390-2d.png) |

[Phone Ethereum island](design/screens/g7-factory-phone-eth.png).

## Not done / limits

- No deployment, commit, push, new live order, sponsored session or live gold-flag verification. The existing production URL still serves the previous deployment. Actual real-money totals continue to require confirmed receipts; this task adds no new chain evidence.
- No physical-phone performance or subjective audio listening test. Touch-hold is checked through synthetic touch pointer events; full gameplay uses desktop Chromium at phone dimensions. Existing normal-audio gesture checks were not rerun in this task.
- Miniatures are simplified authored instanced geometry, not full editor mesh copies. Portal ring motion and belt flows illustrate activity; neither is proof of a real signature or payment. Factory Gate traffic follows the delivered preview; Test retains separate delivery/refund branches.
- Fresh empty factories display demo motion but no demo earnings. The saved simulated economy runs only while the overview is visible; there is no background/offline income.
- Tooltips use small DOM inspection targets over the scenes. Factory belt inspection points cover route segments rather than every pixel of each belt; the 2D factory keeps its accessible plot/counter grid and does not draw the 3D miniature inspector. Editor reasoning works in both rendering paths. Fine-grained hit areas can be small on phones; no claim of exhaustive physical-touch usability.
- Baked shading is simplified plot-level blobs; no real-time shadows or postprocessing. Piles cap at 18 coins per house, customers at two per running plot; counters continue beyond those visual caps.
- All-five screenshots do not contain every possible machine kind: the saved fixture has no Vault. Vault explanation is unit-tested; geometry is present but lacks a dedicated still. No exhaustive visual regression test of arbitrary custom friend layouts or malformed saved builds.
