# INT-1 — The real UI on the real chain

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Goal
The Toy Works UI (built against the mock) runs in live mode against `ww-portal-261112.testnet` with the local API server, and the first-60-seconds flow passes for real: session created, machine published, Splitter inserted, seeded customer order on chain, Portal payout signed, broadcast and confirmed on Sepolia by two RPCs, `/m/:id` payment page paying for real.

## Requirements
1. Run the app with `VITE_CONTRACT_ID=ww-portal-261112.testnet` and `VITE_RELAYER_URL` pointing at the local API server (`app/scripts/dev-api.ts`). Fix every mismatch between UI and live adapter (field names, statuses, timings, fees from `limits()`, id length bounds, `waiting_for_earlier_nonce` -> show as a calm "queued behind an earlier payout" state, retry when a payout is stuck).
2. Templates must satisfy the live contract: Portal fee >= `min_fee_yocto_per_wei` x wei, wei <= `max_wei_per_payout`, one Portal, price small (0.1 NEAR where the rate allows; otherwise the smallest valid price — state it). If the fee rule makes 0.1 NEAR impossible for a 0.001 ETH payout, lower the template's wei instead.
3. The workshop's first load in live mode: each browser session publishes its own copy of the Lemonade machine under a unique short id (<= 32 bytes) the first time it needs to go on chain (Serve or Publish), paying the publish deposit from the sponsored session; show this honestly in the ledger.
4. `/m/:id` works for any published machine id, including the one the player just published; pay button does a real order.
5. Add minimal UI for `withdrawVault` (owner, from the reserve card) and `withdrawUnclaimed` (only shown when non-zero).
6. Playwright scripts `app/ui-tests/flow-live.mjs` (first-60-seconds in live mode, asserting real explorer links in the ledger and Portal `confirmed` only after the API says so) and `app/ui-tests/app-live.mjs` (/m/:id pays for real). Use Chromium at /data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome and playwright-core at /opt/ww-shot/node_modules/playwright-core.
7. Live screenshots to `docs/design/screens/live-*.png`.

## Acceptance (write to docs/EVIDENCE-ui-live.md)
1. typecheck + build; mock flow test (`node ui-tests/flow.mjs`) still passes.
2. `flow-live.mjs` and `app-live.mjs` pass; paste output including NEAR + Sepolia links.
3. 0 console errors in both live runs.

## Constraints
Testnet only. Secrets stay in /opt/ww-secrets. You may edit anything under app/ (keep the visual design; Opus designed it — no restyling beyond what new states need) and docs/. Do not touch contract/ or engine/; if the contract blocks the flow, stop and report. Do not commit or push.
