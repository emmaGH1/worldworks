# G6 — Follow-ups queued from the completeness check (commit 227a561)

Start after INT-1 (app/) and the Astra fix-verification review (contract/) finish; merge Astra's findings into this task.

1. Storage fee bound: restrict machine, order and node ids to `[a-z0-9_-]` (no JSON escaping possible), re-measure the worst case under those bounds, set fees to worst case x 2 rounded up to 0.01 NEAR (>= 0.78 NEAR), preserving migration and Portal address 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7.
2. Structured effects: `submit_order` / `approve` / `expire` return the engine effects and payout ids as structured JSON; `app/api/near.ts` consumes the receipt return value instead of parsing trace strings. Regression test with a node id that previously broke the parser.
3. `app/package-lock.json` must include `tsx`; fresh `npm ci` + all checks pass.
4. Restore explicit sandbox regressions: zero-fee path never calls the signer; nonce counter increments exactly once per payout and not on retry; Portal releases through approve and through expire.
5. Evidence docs: mark superseded sections (zero-balance, 1 NEAR fee) with pointers to current state.
