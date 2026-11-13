# GAME-1-fix — Close the review findings on the game (commit 976cee4)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Fix (review findings, see the review text pasted at the end)
1. **Stuck earlier nonce (HIGH).** On `waiting_for_earlier_nonce`, also poll/advance `waitingPayoutId` (getPayout → bounded retry_signature → relay). Bound automatic `retry_signature`: at most 2 per payout per page session, never from a status read loop without a timeout gate. After 5 consecutive read failures show "Can't read the payout status right now" with a manual Retry. Copy must be true ("waiting for an earlier payout #N" — not "retrying automatically" unless it actually is). Close and level switch must stay available during the portal phase; tracking continues in the background and the ledger updates.
2. **Non-idempotent customer order (MED-HIGH).** Client generates `orderId` (valid id chars, ≤64) and sends it to `/api/customer` (and `order()`); server uses it; a repeat with the same id returns the existing order/receipt instead of placing a new one (check contract state for that order id first). `post()` must check `response.ok`/content-type before JSON parsing. Network errors / 5xx after submit = "outcome unknown — checking…": poll by orderId; never offer "Try again" that spends a second order until the first is known to have failed.
3. **observation:'unknown' (MED).** Ledger row status `unknown` (neutral styling, explains it), `/m/:id` receipt says "Submitted — result not confirmed yet" with tx link, approve honours `observation`. Resolve unknowns by reading the order (by orderId) and then track any external payout it created.
4. **Crash-proofing (MED).** React error boundary per route; WebGL unavailable → 2D fallback (static illustration + all buttons work; `/m/:id` checkout fully usable without 3D); safe `decodeURIComponent`; lazy-chunk load failure → "new version available, reload" button.
5. **Balance (MED).** Before Pay on `/m/:id`, check session balance ≥ price + order fee + gas margin; otherwise explain plainly ("Your free test account is out of test NEAR — the demo gives each visitor 3 NEAR") instead of a raw RPC error. Raise FUNDING in `app/api/session.ts` to 4.5 NEAR (publish 0.40 + two 1.42 orders + gas) and update mock, tests, README mentions.
6. **No-payout claims (LOW).** If an order has no external effect, do not show "supplier got paid" or the ★; say what actually happened.
7. **l2done mode (LOW).** Key completion by mode + contract id.
8. **Reload mid-run (LOW).** Persist run (orderId, payoutIds, tx links) in localStorage; on load, resume tracking and restore ledger rows; never re-spend for a run already in flight.
9. **Dispose (LOW).** Dispose materials, textures, renderer + `forceContextLoss` on unmount.
10. **Helper files as endpoints.** Rename non-handler files in `app/api/` to `_`-prefixed (`_near.ts`, `_server-common.ts`, `_portal.ts`, etc.) and fix imports, or move them to `app/api/_lib/`; verify `vercel.json` still routes.
11. **Cleanup.** Delete unrouted `app/src/pages/Workshop.tsx`, `MachineApp.tsx` and components only they use; delete obsolete `ui-tests/flow*.mjs`, `screens.mjs`, `app-live.mjs`, `record-demo.mjs`, `escrow.mjs` if they drive the old UI (keep `live-common.mjs` if game-live uses it). Update references in README.md "Run locally" and docs that point at removed tests to the game tests.

## Acceptance (append to docs/EVIDENCE-game.md, section "GAME-1-fix")
- typecheck, api typecheck, build, `node --import tsx --test scripts/*.test.ts` all pass; new unit tests for 1, 2 (idempotent repeat), 3, 5.
- `ui-tests/game-mock.mjs` passes; add mock cases: stuck earlier nonce shows the right copy and Close works; customer 504 → unknown → resolves without a second order; WebGL disabled (`--disable-gpu --disable-webgl` or forced flag) still lets `/m/:id` pay in mock.
- ONE live run of `ui-tests/game-live.mjs` at the end (local dev-api, env from /opt/ww-secrets/live.env, never print secrets) with links. 0 console errors.
- Table: finding → fix → file:line → test.

## Constraints
Testnet only. Never print/commit secrets. Do not commit or push (orchestrator commits and deploys). No contract changes. Keep the game look; only add states. Disk is tight; npm cache /opt/ww-npm-cache.
