# GAME-4 polish + GAME-5 Lane B evidence

Shared main checkout based on `3834c4c`. No commit, push, deploy, contract change, or engine change. Testnet only. MOCK and simulated flows remain labeled. No secret values printed or copied into the repository.

## Implementation

- First-load title over the island: exact requested one-sentence point, one Start button, immediate skip into play, and `?` replay. Slow camera drift is disabled by lowfx. Existing progress remains intact.
- Portal: the entire top bar hides, text occupies its own band, progress stacks at 390px, swirl accelerates during signing, beam pulses on broadcast, gem burst and camera nudge follow confirmation, with a confirmed stamp. API status alone advances the live moment. Pre-confirmation copy says “will pay”; queued payouts name their earlier payout blocker.
- Juice: retained placement springs/particles, added coin landing bursts, pass-star reveal and offending-socket shake. Code-generated WebAudio coin/place/pass/fail/hum/gem feedback unlocks on the first gesture, with a persisted mute control; lowfx disables audio and the added camera/pulse effects. No audio assets.
- Look: PCF soft shadows, existing warm sun/hemisphere lighting retained, slight water-distance fog outside lowfx. No postprocessing pass added.
- Camera: Test frames the stand, sockets and local recipients, excluding the distant Ethereum island. Only the Portal framing includes both islands.
- Job 4: finalized expiry eligibility controls the refund button; durable approval/expiry intents prevent repeat sends after ambiguous responses. Live copy states that the shop-building player holds the demo Key.
- Cleanup: removed four obsolete `ui-tests/game2-*.mjs`. Friend names are stored in owner-local progress only; setup explicitly says shared shops show addresses.

## Lane B audit findings

Line references refer to `app/src/game/jobs/JobsGame.tsx` unless otherwise stated.

| Finding | Fix | File:line | Verification |
|---|---|---|---|
| 5: approval ambiguity / empty effects | Durable submitApproval intent; reload reads resolution; only approved/expired completes, without requiring effects.length; no repeat Delivered after transport ambiguity | app/src/game/jobs/JobsGame.tsx:455 | game4-audit: empty-effects expired recovery, no Delivered; GAME-5 helper unit tests |
| 6: expiry and actual Key holder | api.expiry eligibility; submitApproval(...,'expire'); explicit player-held demo Key copy | app/src/game/jobs/JobsGame.tsx:446 | game4 expiry boundary unit test; ONE live expiry below |
| 7: stalled Portal inaccessible retry | Portal displays readFailed/stalled/relayError with Retry directly in its own panel | app/src/game/jobs/JobsGame.tsx:956 | game4-audit: missing MOCK payout, read failure, retry, no false confirmation |
| 8: nonce wait / premature paid claim | waitingPayoutId in headline; will-pay before confirmation; confirmation is still API-gated | app/src/game/jobs/JobsGame.tsx:966 | GAME-3 mock Portal assertions; GAME-5 nonce tracker tests |
| 2: settlement proof | nearTransferText + recordNearEffects; +amount only when settled true; per-effect ledger tx points to order or release | app/src/game/jobs/JobsGame.tsx:57 | game4-audit: unknown and failed-held rows; GAME-5 settlement tests |
| 11: overlapping panels | Card and ship panel mutually exclusive; running state uses compact status; receipts require opt-in | app/src/game/jobs/JobsGame.tsx:856 | game4-audit + GAME-3 receipt regressions |
| 12: balance | Resume balance polling on reload, Refresh button, explicit signed delta without + on decreases | app/src/game/jobs/JobsGame.tsx:1014 | game4-audit: decrease, Refresh; GAME-3 +0.07 regression |
| one next action | Expanded job chip no longer duplicates card action; status phases allow none | app/src/game/jobs/JobsGame.tsx:694 | game4-audit expanded card and stalled Portal; GAME-3 highlighted-action assertions |

## Fresh playtest priorities P1–P4

| Finding | Fix | File:line | Test |
|---|---|---|---|
| P1: mobile teaching lacks focus | Job-1 spotlight with a real input hole, short bubble, arrow, outside-tap shields, and Skip. Derived action steps cover Ada's goal, Splitter, socket, shares, Payouts, Test, failure reason, correction and Ship. Replays from `?` without removing real receipts. Jobs 2+ receive one new-part hint. | app/src/game/jobs/Spotlight.tsx:3; JobsGame.tsx:570; jobs.css:287 | game4-tutorial, all four combinations of 390/1366 and WebGL/fallback; wrong build → reason → fix → pass → Ship; outside taps inert, replay/skip |
| P2: transaction time is dead time | Inside-machine observed stages, actual routing/settlement rows, tx hashes, signer elapsed seconds, nonce blocker, NEAR height and validated Ethereum depth. Default Portal copy explains why it matters; expandable history shows the full sequence. Continue-building starts the next job while tracking persists in a status chip that changes/pulses on completion. | JobsGame.tsx:839,955,999; app/api/payout.ts:16,38 | game4-audit: queued blocker, next-job transition, background confirmation; existing live.test shallow receipt case asserts depth 2 stays broadcast; read-only payout #32 below |
| P3: machine lacks factory life | After a passing Test or completed Ship, a slow customer loop uses the existing scene and split math. Counters show per-person NEAR/ETH totals under **SIMULATED factory**. Editing, Test, Ship, opening receipts or changing jobs stops the loop. No API order or ledger entry is created by it. | JobsGame.tsx:549,841; scene.ts (SalePlan cancellation and stopSim) | game4-tutorial waits for the actual simulated counter to accumulate Ada 0.06; full job regression checks real/mock balances separately |
| P4: desktop readability | Larger desktop tray controls and requirement pills at 1366; larger tray at 1920; centered orthographic machine framing. | jobs.css:308 | 1366 full regression/stills; 1920 factory still from game4-tutorial |

The job-select running miniature machines were explicitly deferred. The existing job list remains.

### Depth is measured, never timed

`confirmationProgress` exposes only validated receipt/transaction reads from the existing two Sepolia RPCs. A depth below 3 is progress, never confirmation. Both receipts must still be at least 3 blocks deep and agree on their block before confirmed. Missing reads show waiting, not a made-up 1/3. MOCK explicitly says it has no real block-depth data.

Read-only `confirm('32')` against the existing GAME-3 payout returned confirmed, two matching receipts, each at depth 1281 at the time of this check. [Public read-only data](game4-portal-readonly.json). This did not broadcast, fund a session, or create another order.

## Verification status

Commands ran in `app/`; the final UI results and stills follow below.

- `cd app && npm run typecheck`: PASS.
- `cd app && npx tsc --noEmit -p api/tsconfig.json`: PASS.
- `cd app && npm run build`: PASS; existing >500kB bundle advisory remains.
- `cd app && node --import tsx --test scripts/*.test.ts`: PASS, 56/56 (includes Lane A's audit tests and the expiry boundary test added before the file boundary).
- `cd app && node --import tsx scripts/check-secrets.ts`: PASS, 420 repository files, no matches; secret values not printed.
- Impeccable detector: two warnings on pre-existing colored Gate-exit socket stripes. Kept: they distinguish delivered/refund ports, not decorative card accents. No new warning was introduced.

## ONE live run — completed

Production-style local live-pinned build + dev API with private environment file. `UI_BASE=http://127.0.0.1:4263 UI_ADVANCE=1 node ui-tests/game4-live.mjs` → **PASS, exactly one seeded-customer order, zero console errors, no new sponsored session**. Reused `p83ed05965fc83a2d2141.ww-sponsor-g4-261112.testnet` from GAME-3 evidence.

Machine `rider3-1c132b47-c83a2d2141`; order `93edced3-0a19-4625-b48a-e2f27db3bbdb`. The refund button was absent before finalized expiry height, appeared after expiry, then the existing contract returned a 0.02 NEAR payout effect to the seeded customer, with no rider payout. Ada's initial effect was 0.08 NEAR. Public structured evidence: [game4-live.json](game4-live.json).

- [Publish](https://testnet.near.rocks/tx/EpnPLJhsFkfHtMYLhRhZ9dVBBg8qA2orUKSgs6CBMTig)
- [Seeded-customer order](https://testnet.near.rocks/tx/BWqtXfRJhrDP8tCVc1ysB2o8zLPzhXwewdgKpCATdVB7)
- [Expire / refund routing](https://testnet.near.rocks/tx/5oXXGB6oZceCMRjcuZpKxTaTaDWneNNN8pHMyk63LDmp)

The live browser run preceded the final settlement/recovery integration. A subsequent **read-only** finalized order/transaction query verified pending=false and matched the refund’s descendant Transfer receipt with settled=true using Lane A’s proof checker; see `refundReadback` in the public JSON. No additional order was spent. Final integration and wait-depth changes are covered by fixtures, read-only RPC checks and UI tests.

## Ownership / handoff

Before receiving the file boundary, this agent edited `app/src/api/types.ts`, `index.ts`, `live.ts`, and `mock.ts` to add expiry/expire, plus `specs/API-interface.md` and `app/scripts/game4.test.ts`. Lane A retained/reconciled that work. After Lane A finished, one minimal boundary exception was made in `app/src/api/mock.ts`: `$payer` on the refund branch maps to the held order's real mock payer as well as `buyer.testnet`. For the later P2 request, minimal additional changes were made to `app/api/payout.ts` and `app/src/api/types.ts` to expose validated sub-threshold receipt depth and the already-read NEAR height; `app/scripts/live.test.ts` now asserts that depth 2 remains broadcast. No other Lane A files were edited after the boundary.

The JobsGame integration consumes Lane A's `submitApproval`, `approvalIntent`, `finishApproval`, `api.expiry`, `nearTransferText`, `recordNearEffects`, `OrderResult.resolution/recovered`, payout-effect settled, and store stalled/readFailed. Optional standalone preflight deduplication was not required; JobsGame retains its existing limits and gas preflight.

## Honest limits / unfinished

- No deployment or real-phone frame-rate/audio listening test. Chromium uses software rendering and deterministic stepping. Lowfx coverage does not establish real-device fps.
- Live expiry was desktop local only; no second live delivery, Portal, or phone payment was spent. GAME-3's prior Portal receipt remains the live Portal evidence.
- An ambiguous approval request that never reached chain remains under checking until an authoritative resolution exists; no approval resend is exposed. This deliberately prevents repeat Worker actions.
- Available-balance deltas can include unrelated account activity during the observation window.
- Names are owner-local only; shared standalone shops show addresses, as disclosed in setup.
- Running miniature machines on job select were skipped; the existing list remains.
- Partial block-depth UI was verified with validated RPC fixtures and a read-only previously confirmed payout, not a second new live Portal order.
- Bundle-size advisory remains. Existing GAME-2 saved progress is not migrated.

## Final UI results and stills

- `UI_BASE=http://127.0.0.1:4261 UI_ADVANCE=1 UI_SHOTS=1 node ui-tests/game3-mock.mjs`: **PASS at 1366×800 and 390×844, 0 console errors**, 789.1 seconds. Real drag on desktop, taps on phone, all four jobs and Your shop, wrong builds, correct stars, simulated/real distinction, Portal signing/broadcast/confirmed, delivery, +0.07 mock balance and standalone link all exercised. Capture mode uses `?step=1` with the deterministic scene hook; normal play keeps requestAnimationFrame.
- Same command with `UI_2D=1` (without UI_SHOTS): **PASS both sizes, 0 console errors**, 357.9 seconds.
- `UI_BASE=http://127.0.0.1:4261 node ui-tests/game4-tutorial.mjs`: **PASS**, both viewports in WebGL and fallback, 0 console errors. First-run guide, outside shields, dials, all Payouts, wrong Test, reason spotlight, correction, passing Test, accumulating factory counter, Ship, replay and Skip. Includes 1920 factory still.
- `UI_BASE=http://127.0.0.1:4261 node ui-tests/game4-audit.mjs`: **PASS**, 0 console errors. Unknown/failed settlement wording, custom names, signed negative delta, refresh, mutually exclusive cards, one highlight, legacy approval recovery into an explicitly expired resolution with empty effects, next-job factory reset, read-failed Portal Retry, earlier nonce, building during tracking and background confirmation.
- `UI_BASE=http://127.0.0.1:4261 node ui-tests/game4-fx-smoke.mjs`: **PASS desktop + phone, 0 console errors**. Lit title, title camera, gesture-unlocked running AudioContext, persisted mute/unmute, and title replay. Audio audibility was not assessed.
- `UI_BASE=http://127.0.0.1:4261 node ui-tests/game4-portal-stills.mjs`: **PASS both sizes, 0 console errors**, final **MOCK-only** Portal capture refresh after the opaque-band visual fix. The script ships mock job 3 through the adapter rather than inventing live states; captures signing/wait, broadcast, confirmed gem and receipts at both sizes.
- `git diff --check`: **PASS**. HEAD remains `3834c4c`; no commit/push. No diff in contract/ or engine/.

Earlier verification attempts found and corrected duplicate highlights, receipt tests that needed to opt in, a background chip covering an editor, tutorial replay after shipping, and the factory carrying a prior receipts-open state. Initial slow continuous software-render captures were stopped and replaced by deterministic stepping. The successful results above are the reruns; initial failed attempts are not represented as passes.

All stills below are MOCK except the explicitly named live expiry stills. Lit title stills use normal effects; exhaustive gameplay captures use lowfx for the VM.

| State | Desktop 1366 | Phone 390 |
|---|---|---|
| Title | [PNG](design/screens/g4-title-desktop.png) | [PNG](design/screens/g4-title-phone.png) |
| Lit title | [PNG](design/screens/g4-title-lit-desktop.png) | [PNG](design/screens/g4-title-lit-phone.png) |
| Build | [PNG](design/screens/g4-build-desktop.png) | [PNG](design/screens/g4-build-phone.png) |
| Test running | [PNG](design/screens/g4-test-running-desktop.png) | [PNG](design/screens/g4-test-running-phone.png) |
| Tutorial spotlight | [PNG](design/screens/g4-tutorial-spotlight-desktop.png) | [PNG](design/screens/g4-tutorial-spotlight-phone.png) |
| Tutorial failure / correction | [PNG](design/screens/g4-tutorial-fail-desktop.png) | [PNG](design/screens/g4-tutorial-fail-phone.png) |
| Inside-machine order wait | [PNG](design/screens/g4-wait-order-desktop.png) | [PNG](design/screens/g4-wait-order-phone.png) |
| Inside-machine signing history | [PNG](design/screens/g4-wait-signing-desktop.png) | [PNG](design/screens/g4-wait-signing-phone.png) |
| Portal signing | [PNG](design/screens/g4-portal-moment-desktop.png) | [PNG](design/screens/g4-portal-moment-phone.png) |
| Portal beam | [PNG](design/screens/g4-portal-beam-desktop.png) | [PNG](design/screens/g4-portal-beam-phone.png) |
| Portal confirmed gem | [PNG](design/screens/g4-portal-gem-desktop.png) | [PNG](design/screens/g4-portal-gem-phone.png) |
| Receipts | [PNG](design/screens/g4-receipts-desktop.png) | [PNG](design/screens/g4-receipts-phone.png) |
| Portal receipts | [PNG](design/screens/g4-portal-receipts-desktop.png) | [PNG](design/screens/g4-portal-receipts-phone.png) |

[1920×1080 simulated factory](design/screens/g4-factory-1920-desktop.png). Live desktop expiry: [waiting](design/screens/g4-live-gate-wait-desktop.png), [eligible](design/screens/g4-live-refund-eligible-desktop.png), [receipt](design/screens/g4-live-refund-receipts-desktop.png).
