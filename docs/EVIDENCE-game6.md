# GAME-6 implementation evidence

Shared `main` checkout, based on `ad3ce88`. No commit, push, deployment, contract/engine changes, live orders, or sponsored sessions. No reads of `/opt/ww-secrets`. All browser gameplay and captures below use the MOCK adapter and are not evidence of a new chain payment.

## Part A (implemented and checked before Part B)

- Single HUD: Factory, current-job chip, small MOCK/TESTNET badge, authored SVG sound and one menu. Menu contains Jobs, Real transactions, Help, Replay tutorial, Restart this job, Title screen and Close. HUD buttons have 44px minimum heights.
- Contextual Help lists the current goal and each available part. Show me again replays the current job's spotlight/hint. Help no longer opens the title or switches to job 1. Title is a separate menu action and says Continue: job N with progress.
- Title camera uses a three-quarter view on phones. The existing-run secondary action sits under Continue. The floating run-reopen action is hidden on the title.
- WebAudio-only 80 bpm pentatonic background loop, Test variation, Portal pad/hum and effects for tap, pickup, placement, dial, belt start, coin landing, requirement tick, fail, star reveals, Ship, beam, gem, unlock and factory ambience. Music, Effects and volume persist under `ww-audio6`, guarded for storage failure. Gesture unlock is retained; lowfx defaults sound off but allows enabling it.
- Tray uses full-width horizontal scrolling, nonshrinking complete part labels, a scroll edge/peek arrow on phones. Start building collapses the intro card.

Part A checkpoint: app typecheck, API typecheck, production build and all 56 existing unit tests passed before adding the factory model/view.

## Factory implementation

- `app/src/game/jobs/factory.ts`: pure scoped plot model, saved tree house mapping, wasm-backed simulated sale totals, independent confirmed-receipt real totals. Factory flag is module-level `FACTORY_ENABLED`.
- `FactoryView.tsx`: persistent owner-local simulated house totals; separate Real rows; observed Your shop balance remains separately labeled. Simulation never creates an order, ledger row or session. Hidden tabs stop purchase accumulation. Customers run only while the overview is mounted; lowfx keeps the view static with counters.
- `factoryScene.ts`: instanced island/foundations, tree parts and belts, shared houses and road, customers approaching solved shops, capped instanced coins, airborne Portal routes, locked foundations, next-job indication and shipped app chips. The tree topology and recipients come from the saved build. Overview parts use simplified geometry, not copies of the editor's detailed meshes.
- Solved plots reopen the existing editor, Test and Ship code. First job-1 success pulls out with the requested next-plot caption; Factory returns to the overview. Normal-effects plot entry animates the overview camera; lowfx and deterministic capture mode enter immediately. Overview mount animates the camera back out.
- Real receipts are restricted to non-mock, confirmed, settled ledger rows belonging to machines recorded in the current mode/contract progress scope. ETH also requires the scoped confirmed payout id. Unknown/requested/failed transfers and mock rows never increment Real. New confirmed totals show a gold TESTNET marker at the matching shipped plot. Your balance is the existing observation, not a synthesized payout total.
- Renderer has no shadows/postprocessing. Editor drawing is suppressed behind the overview. Coins cap at 72; customers cap at 10. No-WebGL uses a button grid with identical plot states/counters.

## Verification

- `cd app && npm run typecheck`: PASS.
- `cd app && npx tsc --noEmit -p api/tsconfig.json`: PASS.
- `cd app && npm run build`: PASS; existing >500 kB chunk advisory remains.
- `cd app && node --import tsx --test scripts/*.test.ts`: PASS, 61/61. Five GAME-6 model tests cover plot progression, tree/Portal/refund mapping, actual wasm preview totals, simulation/real separation, scoped confirmed receipt filtering, deduplication, and ETH units.

- `UI_BASE=http://127.0.0.1:4267 node ui-tests/game6-mock.mjs`: PASS at 1366×1080, 1920×1080 and 390×844, each in WebGL and forced 2D; **0 console/page/request errors**. Covers title → job-1 spotlight → real UI construction and passing Test → factory pull-out → plot 2 → real UI construction and passing Test → two saved machines → job-2 Help/hint replay without changing jobs → menu contents → audio Music/Effects/volume persistence → simulated totals advancing independently of Real and surviving reload. Also checks all HUD buttons at 360px fit and retain ≥44px height. Deterministic stepping and lowfx are used; no orders/session calls are made. Structured results: [game6-ui.json](game6-ui.json).
- `node ui-tests/game6-normal.mjs`: PASS, 0 errors. Normal-effects factory camera enters job 2, title says Continue: job 2 and resumes job 2, Factory returns. A real pointer gesture unlocks a running AudioContext and procedural oscillator scheduling is observed. This proves scheduling, not subjective audibility. [game6-normal.json](game6-normal.json).
- `node ui-tests/game6-stills.mjs`: PASS, 0 errors. Refreshes fresh/two/all-five overview fixtures at 1920 and 390, WebGL and fallback. All five saved trees are supplied explicitly; final overview stills are fixture captures. [game6-stills.json](game6-stills.json).
- `node --import tsx scripts/check-secrets.ts`: PASS; no matches, values not printed.
- `git diff --check`: PASS. HEAD stays `ad3ce88`; no contract/engine diff.
- Impeccable detector: only the same two pre-existing Gate delivered/refund socket stripe warnings recorded in GAME-4. No new detector warning.

Renderer budget is <150 calls and <120,000 triangles. Measured from `renderer.info.render` after deterministic draws, at both 1920 and 390: fresh **2 calls / 280 triangles**, two full machines **6 / 6,388**, all five full saved trees **6 / 9,096**. Coin instances cap at 72, customer instances at 10; lowfx hides motion. Fallback: 0 WebGL calls/triangles. The earlier matrix all-five fixture omitted job-1/2 build geometry after resetting progress; `game6-stills.mjs` fixes that capture fixture and records the larger final 9,096-triangle count. Neither figure measures device fps.

Initial development-server matrix attempts were interrupted by source refreshes and timed out in the fallback first job. The isolated fallback rerun passed; the complete production-preview matrix above then passed without development hot reload.

## Stills

All `docs/design/screens/g6-*.png` are MOCK. The final fresh/two/all-five overview stills at 1920 and 390 use saved-progress fixtures; they do not claim the five jobs were all solved in this browser run or shipped. One-job stills and the gameplay matrix follow actual UI construction and Test. The final two-job fixture uses the same passing trees. Requested states: factory fresh/two/all at 1920 and 390, top bar at 360/390/1366, contextual Help, audio popover, phone title. Fallback captures add `-2d` to the width.

## Limits and unfinished details

- No real phone/audio listening test and no claim about actual device fps. Software Chromium/deterministic stepping checks behavior and draw counts only.
- No new real payment was spent. Real totals and confirmation filtering are covered by unit fixtures; actual confirmation marker/balance behavior has not been exercised with a new live run.
- All-five overview is a saved-build fixture, not an end-to-end playthrough of jobs 3–5 in this task. Existing engine/job rule tests still cover these jobs. Their shipping code is reused.
- Factory miniature parts preserve the saved tree and recipient routing but use simplified colored geometry instead of the detailed editor meshes/dials. Customer and coin motion is illustrative; amounts are from wasm preview. Gate success simulation follows the delivered preview; refunds remain a separate Test branch.
- Simulated house totals persist across overview visits/reloads, while the displayed purchase count counts only the current overview visit. Simulation pauses outside the overview.
- The first-solve transition swaps editor/overview scenes; the overview camera animates out, but it is not one continuously shared camera/scene across both views.
- Available account balance can include unrelated activity. Unknown or out-of-scope ledger evidence is omitted rather than estimated.
- Factory confirmation markers and sound audibility are not proven by the UI matrix. Normal-effects camera navigation and oscillator scheduling have the separate smoke check above. On phones the distant Ethereum island is outside the compact overview frame; Chi’s house counter is explicitly labeled Ethereum and the beam leaves the main island toward it.

No live check is necessary for this presentation-only change. If the orchestrator elects to spend one: reuse an existing funded testnet session and already-published NEAR-only job, open its plot, submit exactly one seeded-customer order, return to Factory while the existing tracker runs, and check each settled ledger receipt against its recipient's Real row and gold TESTNET marker. Do not create a new sponsored session. Unknown settlement must stay excluded; the simulated total must remain separate. This one NEAR-only order does not prove a new Portal payment.

Final flag state: **ON** (`FACTORY_ENABLED = true`). Main editor, factory navigation, both rendering paths, build and tests are green. The visual/verification limitations above remain explicit.

Selected stills:

| State | 1920 | 390 |
|---|---|---|
| Fresh overview fixture | [PNG](design/screens/g6-factory-fresh-1920.png) | [PNG](design/screens/g6-factory-fresh-390.png) |
| Two machines fixture | [PNG](design/screens/g6-factory-two-1920.png) | [PNG](design/screens/g6-factory-two-390.png) |
| All five fixture | [PNG](design/screens/g6-factory-all-1920.png) | [PNG](design/screens/g6-factory-all-390.png) |
| Contextual Help | [PNG](design/screens/g6-help-1920.png) | [PNG](design/screens/g6-help-390.png) |
| Sound popover | [PNG](design/screens/g6-sound-1920.png) | [PNG](design/screens/g6-sound-390.png) |

Top bar: [360](design/screens/g6-topbar-360.png), [390](design/screens/g6-topbar-390.png), [1366](design/screens/g6-topbar-1366.png). [Phone title](design/screens/g6-title-390.png). Fallback examples: [1920 all-five](design/screens/g6-factory-all-1920-2d.png), [390 all-five](design/screens/g6-factory-all-390-2d.png).
