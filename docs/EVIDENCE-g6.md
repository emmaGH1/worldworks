# G6 follow-ups — acceptance evidence (2026-11-13)

Testnet only. No commit or push. `scripts/lock-contract.sh` not run. Raw logs: `/opt/ww-target/g6-final/` (outside the repo).
Contract `ww-portal-261112.testnet`; Portal treasury `0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7` (unchanged).

## Current configuration (after G6 migration)

| Value | Before G6 | After G6 |
|---|---|---|
| Retained order storage fee | 0.77 NEAR | **1.32 NEAR** (2 × 65,536-byte bound × 10^19 yocto/byte, rounded up to 0.01) |
| Publish deposit (refundable excess) | 0.40 NEAR | 0.40 NEAR |
| Sponsored session funding | 7 NEAR | **9 NEAR** |
| New machine/node IDs | 1–32 bytes, any | 1–32 chars `[a-z0-9_-]` |
| New order IDs | 1–64 bytes, any | 1–64 chars `[a-z0-9_-]` |
| Epoch budget | 0.01 ETH / 1,000 blocks, value only | 0.01 ETH / 1,000 blocks, **value + 21,000 × max_fee_per_gas** per payout |
| Epoch payout count cap | none | **20** |
| Per-payout cap / min rate | 0.002 ETH / 10^6 yocto per wei | unchanged |
| Snapshot max fee per gas | 100 gwei | unchanged (owner can lower with `set_portal_fees`) |
| Sepolia "confirmed" | 2 RPCs, matching receipts | 2 RPCs, matching receipts **and ≥ 3 blocks on top on both** |
| Server hourly caps (per process) | none | sponsor 35 NEAR/h, customer 20 NEAR/h (balance delta) |

At the deployed values one 0.001 ETH payout reserves 0.0031 ETH, so about three such payouts fit in one 1,000-block epoch. Over-budget submits revert atomically; held approvals can be retried in a later epoch.

## Items

1. Storage bound — IDs restricted (`valid_id` in `contract/src/lib.rs`); bound derivation in [STORAGE-g6.md](STORAGE-g6.md); `storage_bound.rs` width checks; sandbox adversarial order measured 13,041 bytes (< 63,360 derived bound ≤ 65,536 envelope). Fee 1.32 NEAR (≥ 0.78 NEAR).
2. Structured effects — `submit_order`/`approve`/`expire` return `{pending,effects,trace}` with `payoutId`; `app/api/near.ts` `receiptResult` decodes the function's own receipt. Regressions: unit test with a `a: "vault"` name and a `bad:node` legacy machine; sandbox rejects `bad:node`, `bad"node`, `bad\nnode`. Live receipts decoded below.
3. `tsx` is in `app/package-lock.json`; fresh `npm ci` then all app checks pass.
4. Sandbox regressions restored: zero-fee path creates no signer receipt and no nonce; nonce +1 per payout, unchanged on retry; Portal released through approve and through expire.
5. Superseded markers added to every EVIDENCE-*.md header plus inline at the zero-balance and 1 NEAR / 0.77 NEAR fee statements.
6. Trapped escrow — `check_portal_paths` simulates exact splitter rounding over immediate, approve and expiry branches at the CoinSlot price; every nonzero Portal flow must satisfy rate, per-payout cap and wei + 21,000 × fee_upper_bound ≤ epoch budget. Astra's counterexample is rejected at publish.
7. Treasury spend — gas-inclusive epoch debit and 20-payout count cap; sandbox shows two 1-wei payouts exhaust a 4.2e15+2 wei budget, and the 21st payout in an epoch is rejected by the count cap.
8. Session/customer limits — validation before quota; `x-vercel-forwarded-for`/`x-real-ip` trusted only when `VERCEL=1`; per-process hourly balance-delta caps; session `idempotencyKey` (= publicKey) with deterministic account. Best-effort testnet controls (see CLAIMS.md).
9. Observation — no post-order history scan; `get_pending_external_payouts(machine_id, from_index?, limit?)` scans ≤ 200 nonces (default 100); undecodable receipt returns tx + orderId.
10. Relay — `waiting_for_signature` (target unsigned, signed predecessors advanced) vs `waiting_for_earlier_nonce`.
11. Confirmation depth — `head ≥ receipt block + 3` on both RPCs; UI copy “included on Sepolia, seen by two RPCs”.
12. CLAIMS.md rewritten for G6.

Additional fixes in this run: `app/src/lib/store.ts` resets the relay latch on `waiting_for_signature`; `checkLegacyId` lets the live adapter read, order from, approve on and withdraw from machines published before G6 (new publishes still use the strict `checkId`).

## Engine tests

`PATH=/data/home/.cargo/bin:$PATH CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target cargo test --manifest-path engine/Cargo.toml`

```text
test result: ok. 1 passed; 0 failed   (tests/cost.rs)
test result: ok. 39 passed; 0 failed  (tests/engine.rs)
```

## Contract WASM build

`cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml` (same env)

```text
Binary: /opt/ww-target/near/worldworks_contract.wasm
Size: 435.3 KB (435257 bytes)
SHA-256 checksum hex : 17895587524557518dcec9186e4bcaf1f76086a5ff56c1afd62bde7623eb4b7d
```

## Contract tests

`cargo test --manifest-path contract/Cargo.toml -- --nocapture` (same env). New in G6: `g6_portal_resolution_and_gas_budget`, `g6_storage_component_widths_and_fee_rounding`; `storage_envelope` and `hardening_sandbox` updated.

```text
PASS Astra trapped escrow counterexample rejected at publish (expiry branch)
G6 ADVERSARIAL STORAGE publish=6180 bytes order=13041 bytes (32 nodes, bounded IDs, max order ID, four transfers, Portal/signature, Vault)
test storage_envelope ... ok
PASS full G3 snapshot migration: nonce 4 preserved, payout bytes/signature unchanged, vaults 2520000000000000000000000, held 1000000000000000000000000, repeated migration rejected
test migrates_full_g3_snapshot_without_nonce_or_liability_loss ... ok
PASS Portal approve and expire structured effects; exactly one nonce each; 1-wei payouts exhaust gas-inclusive budget
PASS zero-fee Portal path never calls signer or consumes nonce
PASS parser-breaking node IDs rejected
PASS G6 one-time migration preserves liabilities and nonce
PASS twenty payouts accepted; twenty-first rejected by independent epoch count cap; bounded history pages
test g6_portal_resolution_and_gas_budget ... ok
PASS drain rejected atomically; publish deposit and order fee required
PASS callback with 200 historical payouts; machine unchanged; stuck retry identical bytes and nonce; private callback rejected
PASS signer failure -> signature_failed -> retry -> signed, identical payload/nonce/bytes
PASS epoch budget exhaustion rejected
PASS multiple Portal / zero wei / >4 transfers / cap rejected at publish
PASS vault owner only; early expiry rejected even owner; timed expiry; escrow liabilities
PASS failed transfer -> unclaimed -> withdraw exactly once
PASS G4b same-layout migration preserves nonce, signed payout and liabilities; private and one-time
PASS separate fee owner; finished hardening sandbox
test hardening_sandbox ... ok
test result: ok. 4 passed; 0 failed
G6 storage: width-checked lifecycle <= 63360 bytes, envelope 65536 bytes; retained fee 1320000000000000000000000 yoctoNEAR
test g6_storage_component_widths_and_fee_rounding ... ok
test result: ok. 1 passed; 0 failed
```

## Migration deploy (testnet)

`cd app && node --import tsx scripts/deploy-g6.ts` — deploy + `migrate_g6` in one transaction, signed with the contract account's existing key.

- Deploy/migration tx: [8oq6PwTecJNV8NzEMH4nEWjsiARzhUQzejH3BGj1w9GN](https://explorer.testnet.near.org/transactions/8oq6PwTecJNV8NzEMH4nEWjsiARzhUQzejH3BGj1w9GN)
- Script assertions passed: 50 preexisting records read; every non-root record byte-identical (root rewritten with recomputed epoch spend); exactly two new keys (`g6-count`, `g6-migrated`); derived and stored Portal address equal `0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7`; nonce unchanged (13); owner, rate, epoch, budget, cap and signature timeout unchanged; escrow/vaults/unclaimed/in_flight unchanged; deployed code SHA-256 equals the local build.

```json
{"address":"0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7","wasmBytes":435257,
 "sha256":"17895587524557518dcec9186e4bcaf1f76086a5ff56c1afd62bde7623eb4b7d","preservedRecords":50,
 "limits":{"owner_id":"ww-chainsig-261112.testnet","min_fee_yocto_per_wei":"1000000","epoch_blocks":"1000",
  "epoch_budget_wei":"10000000000000000","epoch_payout_count_cap":20,"epoch_payout_count":0,
  "remaining_budget_wei":"10000000000000000","max_wei_per_payout":"2000000000000000","signature_timeout_blocks":"200",
  "order_storage_fee":"1320000000000000000000000","publish_storage_deposit":"400000000000000000000000"},
 "liabilities":{"escrow":"1000000000000000000000000","vaults":"5950000000000000000000000","unclaimed":"0","in_flight":"0"}}
```

Funding before the live runs (testnet faucet → existing accounts): sponsor top-ups [GS7XQxCS…](https://explorer.testnet.near.org/transactions/GS7XQxCSViYje2QBnVW2o9R6L1YrewFqmQAxHhCQcAh1), [41iR4n8q…](https://explorer.testnet.near.org/transactions/41iR4n8qUEdoZEDhAx2Dn9y1MHFG2FbxyScEbWSyTVSh); customer top-up [XnK3JtQY…](https://explorer.testnet.near.org/transactions/XnK3JtQYS2SxYxFJJ828c2GuytzRbV2rAvkz557Eo1V).

## App: fresh install and checks

```text
$ cd app && npm ci --cache /opt/ww-npm-cache --prefer-offline
added 149 packages, and audited 150 packages in 8s; found 0 vulnerabilities   (node_modules/.bin/tsx present)
$ npm run typecheck                     -> exit 0
$ npx tsc -p api/tsconfig.json          -> exit 0
$ npm run build                         -> ✓ built, exit 0
$ node --import tsx --test scripts/live.test.ts scripts/relay.test.ts
# tests 22  # pass 22  # fail 0
$ node --import tsx scripts/check-secrets.ts
PASS: 234 repository files scanned against 16 private keys/seed phrases; no matches.
$ git diff --check                      -> clean
```

New/changed unit tests: confirmation `shallow`/`one-shallow` depth cases; structured receipt effects with a parser-breaking name; `waiting_for_signature` after signed predecessors; Vercel client identity and malformed JSON not consuming quota; session validation-before-quota and idempotency; `placeOrder` returns tx/orderId without history RPC; aggregate spend cap.

## UI flows

Servers: mock production preview on 4203; live preview (built with `VITE_CONTRACT_ID=ww-portal-261112.testnet VITE_RELAYER_URL=http://127.0.0.1:3019`) on 4202; `API_PORT=3019 node --env-file=/opt/ww-secrets/live.env --import tsx scripts/dev-api.ts`. Screenshots in `/opt/ww-target/g6-final/screens/`.

Mock — `UI_BASE=http://127.0.0.1:4203 node ui-tests/flow.mjs`:

```text
[ 38.0s] ok   Portal went through its states in order (awaiting_signature > signed > broadcast > confirmed)
[ 38.0s] ok   two receipts shown once confirmed
console errors: 0
RESULT: PASS
```

Live, fresh sponsored session (`p83ed05965fc83a2d2141.ww-sponsor-g4-261112.testnet`, funded 9 NEAR) — `UI_BASE=http://127.0.0.1:4202 node ui-tests/flow-live.mjs`:

```text
ok: live mode / broken Lemonade opens / Splitter validates / real reserve after sale
Portal: awaiting_signature -> signed -> broadcast -> confirmed
ok: UI confirmed only after API confirmed
ok: two independent Sepolia RPC proofs
ok: matching successful receipts
ok: at least three additional blocks on both RPCs
ok: honest Sepolia inclusion copy
ok: real Sepolia link
workshop elapsed seconds: 87.6
publish links: https://explorer.testnet.near.org/transactions/7FbfhFcpdCP4KYzJECXCnHYZx6H1fLGHyhKAZnXe8v6Z
order links: https://explorer.testnet.near.org/transactions/8fenUDQhqDSP3nj5tm1QMP1o2zQE4L4jpWecrrDNMmfv
payout links: https://explorer.testnet.near.org/transactions/8fenUDQhqDSP3nj5tm1QMP1o2zQE4L4jpWecrrDNMmfv https://sepolia.etherscan.io/tx/0x0774069a6dc5de2e07954679d84b661f1b2903b73022827a3228f52e9cf6f69a
app URL: http://127.0.0.1:4202/m/lemonade-b49a4e8f-5fc83a2d2141
console errors: 0
RESULT: PASS
```

Payout 13 confirmation (both RPCs, block 12122226, head 12122229, depth 3): ethpandaops and tenderly, same block hash `0xc85a79c6…bf75`.

Live standalone app, same session — `UI_STORAGE_STATE=/opt/ww-secrets/int1-ui-state.json node ui-tests/app-live.mjs`:

```text
machine: lemonade-b49a4e8f-5fc83a2d2141 total: 1.42 NEAR
NEAR: https://explorer.testnet.near.org/transactions/EPRjxQrkWcFVPvkTkMgwHhvdppRDSUr6spNCxr2wvuoe
Portal: awaiting_signature -> signed -> broadcast -> confirmed   (payout 14, block 12122232, depth 3 on both RPCs)
ok: at least three additional blocks on both RPCs / honest Sepolia inclusion copy / real Sepolia link
console errors: 0
RESULT: PASS
```

Sepolia: [0x1939226a…358a](https://sepolia.etherscan.io/tx/0x1939226aaa336cd2eec0963f92b6e521ebd71e038240be9666f67c2f3d67358a).

### On-chain structured receipt values (decoded with `receiptResult`)

```text
8fenUDQh… signer ww-customer-g4-261112.testnet submit_order deposit 1420000000000000000000000
 {"pending":false,"effects":[{"kind":"external","payoutId":"13","recipient":"0x…dEaD","wei":"1000000000000000","fee":"30000000000000000000000"},
  {"kind":"vault","name":"reserve","amount":"70000000000000000000000"}],"trace":[…6 lines…]}
EPRjxQrk… signer p83ed05965fc83a2d2141.ww-sponsor-g4-261112.testnet submit_order deposit 1420000000000000000000000
 {"pending":false,"effects":[{"kind":"external","payoutId":"14",…},{"kind":"vault","name":"reserve","amount":"70000000000000000000000"}],…}
get_limits after: epoch_payout_count 2, remaining_budget_wei 3800000000000000 (= 1e16 − 2 × (1e15 + 21000 × 1e11))
get_portal_nonce 15; get_portal_address 0x694ad57416073b1e1f3bc6e13b26bde28015a8b7
get_pending_external_payouts(from_index 13, limit 2) -> payouts 13 and 14
```

## Not covered

- `scripts/e2e-live.ts` (the G4b end-to-end script) was not re-run; the live UI flows above cover session, publish, customer order, player order, relay and confirmation.
- Approve/expire on the live testnet contract were not exercised (sandbox only).
- Legacy machines/orders are preserved but not revalidated against the G6 rules or storage bound.

## Orchestrator follow-up (2026-11-13 ~00:10 UTC): Portal throughput
Measured Sepolia gas price at the time: 17 wei (eth_gasPrice). Owner call `set_portal_fees(max_fee_per_gas = 3 gwei, priority = 1 gwei)`: https://explorer.testnet.near.org/transactions/HCVpGfesqzDKvpFn5aAoc74RZGYR7ck3sin5fpBT5pa7 (affects future payouts only). Template payout lowered from 0.001 to 0.0001 Sepolia ETH (`app/src/lib/machine.ts` DEMO_WEI). Per-payout reservation is now 0.0001 + 21,000 x 3 gwei = 0.000163 ETH, so the 0.01 ETH epoch budget allows the full 20-payout count cap per epoch. Mock UI flow re-run: PASS, 0 console errors. Risk: if Sepolia base fee rises above 3 gwei, payouts signed with this cap wait in the mempool; the owner can raise the cap for future payouts.
