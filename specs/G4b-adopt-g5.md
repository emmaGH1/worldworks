# G4b — Adopt the hardened contract in the app; honest confirmation

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Context
G5 hardened and redeployed `ww-portal-261112.testnet` (see contract/USAGE.md "Interface changes for the app", docs/EVIDENCE-hardening.md). Five Sepolia payouts are now confirmed (docs/EVIDENCE-sepolia.md); the treasury holds ~0.52 Sepolia ETH.

## Requirements
1. **Storage fee size.** `ORDER_STORAGE_FEE` is 1 NEAR (sized for 100,000 bytes), which makes every order cost price + 1 NEAR and will drain sponsored sessions. Measure the real worst-case order footprint under the G5 length bounds (max ids, max effects, external record, payout record), set the fee to that worst case x 2 rounded up to 0.01 NEAR, document the measurement in contract/USAGE.md, and redeploy with a state-preserving migration (Portal address must stay 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7). Do the same check for the publish deposit.
2. **App adopts G5**: `live.ts` and `app/api/*` read `get_limits()` and attach price + fee for orders and the storage deposit for publish; respect id length bounds; read payouts via the new views; support `retry_signature` when a payout is stuck past the timeout; expose `withdraw_vault` and `withdraw_unclaimed` in the API (add to `specs/API-interface.md` and `app/src/api/types.ts` as optional methods `withdrawVault?` and `withdrawUnclaimed?`; also add `limits(): Promise<{orderFee: Yocto; publishDeposit: Yocto; rate: string; epochBudgetWei: string; epochRemainingWei: string}>`). These are the ONLY type changes allowed; the UI agent will consume them.
3. **Honest confirmation (audit finding 9)**: relay returns `{status: 'broadcast', evm_tx_hash}`; a separate `confirm(payoutId)` path in `app/api/payout.ts` reads the receipt from TWO independent Sepolia RPCs (defaults `https://rpc.sepolia.ethpandaops.io` and `https://sepolia.gateway.tenderly.co`; both verified working today), checks hash, `from` = portal address, `to`, `value`, `status == 1`, and only then reports `confirmed`. `live.ts` must not show `confirmed` before that. Validate that the RPC-returned hash equals the locally computed hash.
4. **Relay ordering**: relaying a payout whose nonce is above the treasury's next nonce first relays any earlier signed-but-unbroadcast payouts (or returns a clear `waiting_for_earlier_nonce` status). Add `npm run relay -- <id>` and `npm run confirm -- <id>` scripts using `npx tsx` (tsx is not a dependency today; add it as a devDependency).
5. Session funding: make the sponsored amount enough for 5 orders of a 0.1 NEAR machine plus one publish with the new fee; state the number.
6. Re-run the full live e2e (`app/scripts/e2e-live.ts`) against the redeployed contract, now including relay + two-RPC confirmation of one new payout.

## Acceptance checks (write to docs/EVIDENCE-live.md, new section)
1. contract tests + engine tests pass; wasm size; deploy/migration link; derived address unchanged.
2. `cd app && npm run typecheck && npm run build`; api typecheck; unit tests.
3. e2e output with explorer links on NEAR and Sepolia, including `confirmed` from both RPCs.
4. No keys in the repo.

## Constraints
You own contract/, app/src/api/live.ts, app/src/api/types.ts (only the listed additions), specs/API-interface.md (same), app/api/, app/scripts/, app/package.json (scripts + tsx only), docs/. Claude Opus is building the UI in app/src (other than api/live.ts and types.ts) at the same time: do not touch app/src/components, app/src/pages, app/src/ui, app/src/lib, app/src/styles, app/src/api/mock.ts, app/src/api/index.ts. Testnet only. Do not commit or push.
