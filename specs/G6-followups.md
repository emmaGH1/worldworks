# G6 — Follow-ups queued from the completeness check (commit 227a561)

Start after INT-1 (app/) and the Astra fix-verification review (contract/) finish; merge Astra's findings into this task.

1. Storage fee bound: restrict machine, order and node ids to `[a-z0-9_-]` (no JSON escaping possible), re-measure the worst case under those bounds, set fees to worst case x 2 rounded up to 0.01 NEAR (>= 0.78 NEAR), preserving migration and Portal address 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7.
2. Structured effects: `submit_order` / `approve` / `expire` return the engine effects and payout ids as structured JSON; `app/api/near.ts` consumes the receipt return value instead of parsing trace strings. Regression test with a node id that previously broke the parser.
3. `app/package-lock.json` must include `tsx`; fresh `npm ci` + all checks pass.
4. Restore explicit sandbox regressions: zero-fee path never calls the signer; nonce counter increments exactly once per payout and not on retry; Portal releases through approve and through expire.
5. Evidence docs: mark superseded sections (zero-balance, 1 NEAR fee) with pointers to current state.

## Added from Astra's fix-verification review (2026-11-13)
6. **Trapped escrow (high).** At publish, simulate every resolution path (immediate, approve, expire) for an order at the CoinSlot price and reject the machine unless every reachable Portal effect satisfies fee >= rate x wei, wei <= max_wei_per_payout and wei + gas reservation <= epoch_budget. Regression: Astra's counterexample (price 2 yocto, approval gate, pass -> Portal 1 wei, fail -> Splitter 50% Portal / 50% Vault) must be rejected at publish.
7. **Treasury spend (high).** The epoch budget debits value + 21000 x max_fee_per_gas per payout; add a per-epoch payout count cap. Sandbox test: many 1-wei payouts exhaust the budget by gas reservation.
8. **Session/customer limits (high for public deploy).** Validate input before counting quota; derive client identity from Vercel's trusted `x-vercel-forwarded-for` / `x-real-ip` header; add an aggregate per-hour sponsor and customer spend cap read from the account balance delta; idempotency key on session creation. Document as best-effort testnet limits.
9. **Order observation (medium).** Covered by item 2 (structured return with payout ids); also paginate `get_pending_external_payouts`, and if post-order observation fails, return the submitted tx and order id instead of an error.
10. **Relay of unsigned target (low).** Return structured `waiting_for_signature` vs `waiting_for_earlier_nonce`; still advance signed predecessors.
11. **Confirmation depth.** `confirmed` additionally requires >= 3 blocks on top of the receipt block on both RPCs; UI copy says "included on Sepolia, seen by two RPCs", never "final".
12. Update docs/CLAIMS.md to match the code after these changes (start from Astra's may/may-not list in STATUS or the review transcript).

## Constraints
Testnet only; preserve state and Portal address 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7 on redeploy. You own contract/, engine/ (keep tests), app/api/, app/src/api/, app/scripts/, app/package*.json, docs/. Keep the UI working: run app/ui-tests/flow.mjs (mock) and flow-live.mjs (live) after. Do not touch README.md or docs/README-draft.md. Do not run scripts/lock-contract.sh. Do not commit or push.

## Acceptance (write to docs/EVIDENCE-g6.md)
engine + contract tests (list new ones), wasm build, migration deploy link, address unchanged, fresh `npm ci` then typecheck/build/unit tests, mock + live UI flows pass with links, CLAIMS.md updated.
