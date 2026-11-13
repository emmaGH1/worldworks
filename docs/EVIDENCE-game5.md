# GAME-5 Lane A evidence

Implemented in the shared main checkout; no commit or push. Existing Lane B edits were left in place. No contract/engine changes, live orders, sponsored sessions, or secret reads. This evidence describes code and mocked verification, not a successful new chain payment.

## Finding → fix → file:line → test

Paths below are relative to the repository. Tests run with `cd app && npx tsx --test scripts/*.test.ts`.

| Finding | Fix | File:line | Verification |
|---|---|---|---|
| 1: standalone gas/admission | Checkout refreshes limits, obtains the Portal address, verifies cap, fee, epoch budget including gas, and estimates the actual durable recipient before a new submission or explicit resend. Both approval and expiry routes are included; RPC errors fail closed. | app/src/game/AppPage.tsx:93; app/src/game/jobs/portalPreflight.ts:5,17,29 | game5: gas >21000, error/missing RPC result, valid estimate, fee/cap/budget rejection, Portal behind Gate |
| 2: NEAR settlement | Optional payout `settled` requires matched descendant Transfer action/outcome. Failure additionally needs a successful on_transfer callback linked by output/input data ids. Missing evidence stays unknown. Checkout and NEAR ledger use sent / transfer requested / failed-held language. Mock payouts explicitly settle true. | app/api/_near.ts:131; app/src/api/types.ts:23; app/src/api/mock.ts:90; app/src/lib/store.ts:140; app/src/game/AppPage.tsx:282 | game5: true/false/unknown, unrelated receipt, missing recovery callback; all existing receipt tests |
| 3: lost ordinary order response | Persist known hash as soon as send returns; authoritative reads reconstruct all NEAR sinks using published node definitions and persisted trace amounts, including release/refund routes. Return recovered:true. Known transaction evidence applies only to that transaction's effects. | app/api/_near.ts:45,80,110,120; app/src/api/live.ts:84 | game5: ordinary NEAR-only getOrder without hash; sink reconstruction; existing unknown-response/reload tests |
| 4: durable intent blocks forever | Safe structured errors retained; definitive rejection clears intent. Ambiguous observations poll for 90s, then retain id and expose Check again / Send again with same id. HTTP requests time out at 20s, NEAR RPC at 60s, gas estimate at 15s. An in-flight read can extend the polling window by its request timeout. | app/src/lib/orders.ts:12,26,31; app/src/api/live.ts:14; app/api/_server-common.ts:54; app/src/game/AppPage.tsx:242 | game5: definitive vs ambiguous, bounded loop, explicit same-id resend, safe message and signal; existing 504 tests |
| 5: approval recovery | Persist action intent before sending, then hash if returned. API resolution comes from engine's approved/expired marker, never merely !pending. Reload polls unresolved intent; expired is labeled refund, not approval. | app/src/lib/approvals.ts:1; app/api/_near.ts:114; app/src/api/live.ts:109; app/src/game/AppPage.tsx:129,155 | game5: approved/expired/pending/completed distinction; lost approval transport keeps intent and prevents repeat send |
| 6: permissionless expiry | Retain live/mock expiry and expire implementations already present in this checkout; finalized block height >= deadline and pending determine eligibility. Standalone polls eligibility and offers refund, using full-access session account. | app/src/api/live.ts:91,99; app/src/api/mock.ts:224; app/src/game/AppPage.tsx:179,287 | existing game4: height boundary, resolved rejection, premature refusal sends no transaction; game5: expired resolution |
| 9: recipient binding | Only named Chi abroad demo jobs default to Chi. Other shops require a valid suggested or payer-entered wallet. Copy states payer choice, exact link suggestion and divergence. Resend preflights the durable recipient, not a newly edited field. | app/src/game/jobs/portalPreflight.ts:23; app/src/game/AppPage.tsx:35,91,233 | game5: unrelated/shop missing recipient, invalid suggestion, Chi default, explicit suggestion |
| 10: opaque errors | Preserve safe server message/definitive flag; sanitize arbitrary provider errors. Retry machine, limits, account, and contract reads visibly. | app/api/_server-common.ts:54; app/src/api/live.ts:14; app/src/game/AppPage.tsx:210,241 | game5: safe sponsor error and timeout signal; existing validation/service tests |
| 8: HUD truthfulness | Remove unconditional automatic-retry claim, name waitingPayoutId, say will pay while queued; show stalled/read failure and Retry. | app/src/game/hud.tsx:44,72,74,76 | Typecheck/build; existing queued-predecessor and bounded signature tests. Browser copy not exercised. |
| 7: tracking state | Expose stalled after 90s and readFailed after 5 consecutive failures. Keep slower background checks after read failure while allowing manual restart. | app/src/lib/store.ts:27,101,108 | Existing tracker test verifies five failures/unknown/manual recovery; typecheck verifies additive fields |

## Needed in the other lane

The following calls are exported and ready; Lane A did not edit JobsGame or ui-tests. Confirm against concurrent Lane B work before applying.

1. NEAR payout wording: `nearTransferText(effect)` from `app/src/lib/store.ts` for each `kind === 'payout'`; call `recordNearEffects(result)` for the cumulative order result. Use `effect.settled === true` before saying everyone got paid. External effects require `getPayout(...).status === 'confirmed'` independently. `recovered:true` can finish an ordinary order even if there are no external effects.
2. Approval: `submitApproval(machineId, orderId)` from `app/src/lib/approvals.ts`; on reload inspect `approvalIntent(machineId, orderId)` and poll `api.getOrder(machineId, orderId)`. Resolve only when `found.resolution === 'approved'` or `'expired'`; use `finishApproval(machineId, orderId)` after persisting that result. Neither `!found.pending` alone nor `found.effects.length` is proof of approval. Keep ambiguous transport outcomes disabled for repeat approval.
3. Refund: `await api.expiry!(machineId, orderId)`; offer action only when `.eligible`; submit via `submitApproval(machineId, orderId, 'expire')` (wraps `api.expire!`). Label expiry as refund routing, with NEAR settlement language. State that the shop-building player holds the Key for this demo.
4. Portal moment: consume `getState().payouts[id].stalled` and `.readFailed` (also exposed through `useApp`), show status and `retryRelay(id)`. Name `.waitingPayoutId`; signed/queued is not paid. No unconditional retry claim after the two automatic signature attempts.
5. Bounded ordinary recovery: existing `submitOrder(...)` signature works. It now throws after its bounded unknown window and keeps `pendingOrder().stalled`. Offer `submitOrder(machineId, customer, recipient, onUnknown)` to check again; `submitOrder(machineId, customer, recipient, onUnknown, {resend:true})` to explicitly resend the durable id. Call `finishOrder(orderId)` only after run/receipt persistence.
6. Shared preflight helpers (optional deduplication): `checkoutPortalRoutes(machine)` and `portalAdmission(wei, fee, freshLimits)` from `portalPreflight.ts`; keep `checkPortalGas(portalAddress, actualRecipient, wei)` before a live submit.

## Verification

- `npm run typecheck`: PASS.
- `npx tsc --noEmit -p api/tsconfig.json`: PASS.
- `npm run build`: PASS; existing >500kB bundle warning remains.
- `npx tsx --test scripts/*.test.ts`: PASS, 56 tests including 9 new GAME-5 tests. Tests stub chain/service calls; no live sends/session funding.
- No browser/UI automation was run in this lane.

## One-order test for the orchestrator (not run here)

Use an existing funded session and an already-published Portal shop whose NEAR sink is a known existing account and whose Sepolia destination has been used before. Open `/m/<machineId>?to=<known-used-Sepolia-address>`. First edit to a known gas-incompatible fresh address and click Pay: expect an estimate rejection, no submit_order, no balance/order change. Restore the used address. For exactly one order, allow submit_order to reach NEAR and suppress its browser response (do not send another new id). Reload: the saved id must recover, show all NEAR sinks, and show sent only if receipt evidence proves it (unknown is legitimate when provider receipt metadata is missing). Follow its real payoutId through signing/nonce wait/broadcast and two-RPC Sepolia confirmation; verify actual recipient, wei, hash and ledger match. This spends one order fee, not a new sponsored session. Approval/expiry are covered separately by fixtures; this one Portal order does not prove those live paths.

## Honest limits / unfinished

- Live RPC receipt shapes and actual successful/failed transfer recovery have not been validated with a newly paid order. Missing metadata stays unknown. The implementation never claims transfer success from submit_order success alone.
- Lane B integration and browser verification remain the orchestrator/other lane's work. Shared checkout checks include whatever Lane B edits were present at test time.
- Portal admission across alternative Gate paths conservatively reserves the sum of potential route costs; a near-exhausted epoch may reject a machine that would use only one branch. It fails closed rather than spending on an unchecked route.
- Approval ambiguity deliberately retains intent until an authoritative approved/expired marker is found. A request that never reached chain has no approval resend action here; it remains visibly under checking, preventing duplicate Worker actions. Full multi-Gate orchestration is not verified by these tests.
- No contract fix, engine fix, commit, push, live funds operation, or assertion of live payout success was made.
