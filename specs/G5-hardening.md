# G5 — Contract and Portal hardening (from Astra security audit)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Context
Astra's audit (summary below) found 2 critical, 5 high, 2 medium issues in `contract/` + `engine/`. This is a 2-day testnet hackathon build: fix what makes the demo unsafe or dishonest, and document the rest honestly. Do NOT attempt per-machine EVM treasuries (roadmap).

## Required changes
1. **Treasury drain (critical).** Portal payouts must be paid for and rate-limited:
   - Init params: `min_fee_yocto_per_wei` (a Portal's NEAR fee inflow must be >= wei x this rate, else the whole order panics and the deposit returns), `epoch_blocks` and `epoch_budget_wei` (contract-wide Sepolia spending per epoch; an order whose Portal payout would exceed the remaining epoch budget panics), and `max_wei_per_payout`.
   - At most ONE Portal node per machine (validate at publish).
   - Views expose rate, budget, remaining budget this epoch.
2. **FullAccess key (critical).** Contract owner/admin must be a separate account (`owner_id` init param), never the contract account itself. The only owner power: update fee params within the hard bounds. Write `scripts/lock-contract.sh` (do NOT run it) that deletes every access key on the contract account after a final deploy and then prints `view_access_key_list` showing none; document in contract/USAGE.md that the immutability claim is only true after it runs.
3. **Storage (high).** `publish_machine` is payable: caller attaches storage deposit >= measured cost (refund the excess). `submit_order` requires attached = price + `ORDER_STORAGE_FEE` (constant, measured, documented); the fee is kept for storage. Bound lengths: machine id <= 32, order id <= 64, node names <= 32, account ids by NEAR rules. Escrow liabilities (held deposits) tracked in a separate counter; a view shows liabilities vs balance.
4. **Callback gas (high).** Payouts live in their own `LookupMap<payout_id, Payout>`; `on_signature` reads/writes only that record (no machine rewrite, no history vectors in machine state). `retry_signature` also accepts `awaiting_signature` older than `signature_timeout_blocks`, re-requesting the IDENTICAL stored payload; stale callbacks (attempt id mismatch) are ignored.
5. **Unresolvable orders (high).** At publish reject: Portal wei == 0; machine portal cap > contract `max_wei_per_payout`; more than 4 NEAR transfer effects or more than 1 Portal effect on any single resolution path (compute from the graph).
6. **Failed NEAR transfers (high).** Each Payout transfer gets a private callback; on failure, credit `unclaimed[account]`; `withdraw_unclaimed()` lets that account pull it (exactly once). View `get_unclaimed(account)`.
7. **Nonce queue (high).** Snapshot fees with a generous max fee (document), and require the Portal treasury admission rule from item 1. Add a view `get_portal_queue()` (next nonce, oldest unbroadcast payout). Document the remaining liveness risk honestly in USAGE.md.
8. **Vaults (medium).** Add `withdraw_vault(machine_id, vault_name, amount)` callable only by the machine owner, decrementing the vault balance, with transfer callback per item 6. Document: "a Vault is the machine owner's retained balance".
9. **Expiry.** Remove owner early expiry: `expire` only after the expiry height, callable by anyone.
10. **Account continuity.** The new code must be deployed so that the Portal derived address stays `0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7` (the user is funding it): same contract account `ww-portal-261112.testnet` and same derivation path. If the old state layout prevents a clean redeploy, delete and recreate that account (keys from the CLI keychain), then redeploy and re-init. Verify the derived address is unchanged before anything else. Republish vending.json and escrow.json.

## Acceptance checks (write to docs/EVIDENCE-hardening.md)
1. `cd engine && cargo test`; `cd contract && cargo test` with new sandbox tests: drain attempt (1-yocto Portal machine) rejected by rate rule; epoch budget exhaustion rejected; publish without storage deposit rejected; order without storage fee rejected; callback updates only payout record (test with 200 historical payouts); stuck awaiting_signature retried with identical bytes; >1 Portal / zero-wei / >4 transfers rejected at publish; failed transfer -> unclaimed -> withdraw once; vault withdraw by owner only; expire before height rejected even for owner. Also assert external record recipient/machine_id/order_id (completeness follow-up).
2. `cargo near build non-reproducible-wasm`; size.
3. Testnet: derived address check output equals 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7; deploy/init/publish links; one vending order signed live.
4. Updated contract/USAGE.md listing every interface change (publish deposit, order fee, new views/methods) in a section "Interface changes for the app".

## Constraints
You own contract/, engine/ (only if needed for item 5 analysis; keep its tests passing), scripts/lock-contract.sh, docs/EVIDENCE-hardening.md, docs/DEPLOYMENTS.md. Another agent (Sol, G4) is working in app/ against the current deployment: do not touch app/. Testnet only; keys only in the CLI keychain or /opt/ww-secrets. Build with CARGO_TARGET_DIR=/opt/ww-target, CARGO_HOME=/opt/ww-cargo-home, PATH incl. ~/.cargo/bin. Do not commit or push. Do NOT run lock-contract.sh.
