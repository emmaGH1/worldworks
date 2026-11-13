# GAME-5 — Fix the Sol audit findings (audit of commit 3834c4c)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Ownership (two agents work in the same checkout; stay in your lane)
- **Lane A (GAME-5 agent):** `app/api/*`, `app/src/api/*`, `app/src/lib/*` (orders.ts, store.ts), `app/src/game/AppPage.tsx`, `app/src/game/hud.tsx`, `app/src/game/jobs/portalPreflight.ts`, `app/scripts/*.test.ts` (new test files; do not edit game3.test.ts), `README.md` is NOT yours.
- **Lane B (GAME-4 polish agent):** `app/src/game/jobs/JobsGame.tsx`, `jobs.css`, `jobs.ts`, `scene.ts`, `app/ui-tests/*`.
- If a fix needs a file in the other lane, export a helper from your lane and describe the exact call the other agent must add in your final message / in `docs/EVIDENCE-game5.md` under "Needed in the other lane". Do not edit the other lane's files.

## Lane A findings
1. **HIGH — Standalone checkout skips the Portal gas preflight.** `AppPage.tsx:80–89` vs `JobsGame.tsx:351–357`, `portalPreflight.ts:5–13`. `/m/:id?to=<fresh address>` or an edited wallet field spends NEAR on a payout the contract signs with only 21,000 gas (`app/api/_portal.ts:36`), which can block later nonces. Fix: run the same recipient/gas preflight (fail closed on RPC errors) and the Portal admission limits before submit on `/m/:id`.
2. **HIGH — NEAR payout rows say "paid" without transfer-success proof.** `contract/src/lib.rs:405–407,490–522`; `app/api/_near.ts:61–71`; `AppPage.tsx:250`. If a transfer fails the contract credits `unclaimed` in a detached callback but the UI shows `+amount`. Fix: in the API, inspect the descendant transfer receipt outcomes of the order tx (tx status with receipts) and return per-effect `settled: true | false | 'unknown'`; AppPage/ledger say "sent" only when settled, "transfer requested" when unknown, "failed — held for the recipient to claim" when false. Add the field to `OrderResult['effects']` (optional, mock sets true). (Lane B must use it in JobsGame — list the call.)
3. **HIGH — Lost response on an ordinary (non-Portal) order strands the run.** `app/api/_near.ts:76–86`; `app/src/lib/orders.ts:33–38`. Recovery by orderId reconstructs only external effects, so NEAR-only orders recover with empty effects and enter `unknown` forever. Fix: persist the order tx hash where possible and/or reconstruct all effects for a found order (from the tx receipt if the hash is known, else from the machine definition + order amount, marked `settled:'unknown'`); return an explicit `recovered: true` state the UI can finish from.
4. **HIGH — A request that never reached the server blocks every later payment.** `orders.ts:14–16,24–41`; `live.ts:14–18`. `post()` drops JSON error bodies so a definitive `submit_order failed` becomes `API 503` and the durable intent polls a nonexistent order forever. Fix: keep safe structured server errors (`{error, definitive:boolean}`); definitive rejection clears the intent with the message; ambiguous cases poll for a bounded time (e.g. 90 s) and then offer "Check again" and "Send again with the same order id" (safe: the contract rejects duplicate ids, `lib.rs:205–210`); per-request timeouts.
5. **HIGH (AppPage part) — Approval recovery.** `AppPage.tsx:137–151`; `_near.ts:80–86`. `!found.pending` is treated as proof the approval succeeded; it could be an expiry refund. Fix: return the order's resolution (`approved` / `expired` / `pending`) from the API read and label accordingly; persist approval intent (tx hash) so it resolves after reload. Export what JobsGame needs.
6. **(API part of job-4 expiry)** Add `expire(orderId)` to `WorldworksApi` (types, live, mock, server route if needed) calling the contract's permissionless `expire` (`contract/src/lib.rs:296–308`), plus a read that says whether expiry is allowed yet (block height vs deadline). Show a "Refund the customer (time is up)" action on `/m/:id` when allowed. The GAME-4 agent wires the same call into JobsGame.
9. **MEDIUM — `?to=` recipient is not bound.** `AppPage.tsx:33,87,203–205`. Removing `?to=` silently falls back to Chi's demo wallet for any shop. Fix: only job machines for Chi default to Chi's wallet; for other machines with a Portal and no valid `?to=`, require the payer to enter a wallet and say plainly "The payer chooses the Ethereum wallet; this link suggested 0x…". Show when the field differs from the link's suggestion.
10. **MEDIUM — Opaque service errors.** `live.ts:16`; `app/api/session.ts:23`; `AppPage.tsx:52,198,208`; `limits.ts:21–24`. Surface the API's safe message (e.g. sponsor out of test NEAR), put a visible Retry next to Pay for limits/machine/account read failures.
8. **(hud.tsx part)** `hud.tsx:44,62–63`: "retrying automatically" is shown after retries are exhausted or tracking stopped; "paid" wording before confirmation. Use the real phase and `waitingPayoutId`; "will pay" before confirmed.
7. **(store part)** `store.ts:99–109`: expose an explicit `stalled` / `readFailed` state (after bounded automatic work) so the Portal moment can show it; keep background tracking.

## Lane B findings (GAME-4 agent, in JobsGame/css/scene)
- 5 (JobsGame part, `JobsGame.tsx:419–444`): job-4 approval with an undecodable result never finishes for NEAR-only orders (requires `found.effects.length`); a transport error returns to an actionable "Delivered" button allowing repeated approvals. Use Lane A's resolution read.
- 6: expiry/refund button in job 4 (spec GAME-4 item 6) using Lane A's `expire`; describe the Key holder truthfully (the published Worker is the shop-building player, `jobs.ts:352`: say "You hold the Key for this demo" in live copy, or equivalent).
- 7: Portal moment must show read failure / stalled + Retry itself (`JobsGame.tsx:494,741–758,850–883`).
- 8: Portal moment says "Signed by NEAR. Sending…" while waiting behind an earlier nonce (`:862,872`); name the blocker. "paid" only after confirmed.
- 2: use `settled` for "Everyone got paid" (`:384,400–406,845,906–908`).
- 11: job card and ship panel mutually exclusive (`:597,632,744`; `jobs.css:167`); running state = compact chip, receipts opt-in.
- 12: balance line: resume after reload, refresh button, signed delta, no `+` on a decrease (`:398,408–413,893`).
- GAME-2 rule: exactly one highlighted next action; during running/signing states the "action" may be none but then show a clear status chip (`:497–519`).

## Acceptance (Lane A: docs/EVIDENCE-game5.md)
- typecheck, api typecheck, build, all unit tests pass; new unit tests for 1, 2 (settled true/false/unknown), 3, 4 (definitive vs ambiguous), 5 (approved vs expired), 9.
- No live orders or new sessions (funds are scarce). Read-only RPC calls are fine. If a fix cannot be verified without a live order, say so plainly and give the exact one-order test the orchestrator should run.
- Table: finding → fix → file:line → test. "Needed in the other lane" list. Honest unfinished list.

## Constraints
Testnet only. Never print/commit secrets (/opt/ww-secrets). No contract/engine changes. Do not commit or push. Disk tight: npm cache /opt/ww-npm-cache.
