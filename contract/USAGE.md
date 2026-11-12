# WORLDWORKS contract and Sepolia Portal

NEAR testnet and Ethereum Sepolia only (chain 11155111). Shared treasury:
`0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7`, contract
`ww-portal-261112.testnet`, signer `v1.signer-prod.testnet`, domain 0,
path `worldworks/portal/sepolia/v1`. No EVM private key exists in the relayer.

## Interface changes for the app

- `new(owner_id, min_fee_yocto_per_wei, epoch_blocks, epoch_budget_wei,
  max_wei_per_payout, signature_timeout_blocks, portal_config?)` replaces G3 init.
  Owner MUST differ from the contract. All limits are positive decimal strings.
  Only owner power is `set_portal_fees(max_fee_per_gas, max_priority_fee_per_gas)`;
  it affects future payouts only, within immutable init bounds (hard max 100 gwei).
  Default max fee is now **100 gwei**, priority 1 gwei. Explicit PortalConfig retains
  G3 fields including `cap_wei`; `max_wei_per_payout` overrides that cap. Initial
  `next_nonce` can be set explicitly for address continuity; never reuse a previously
  reserved nonce, even if not yet mined. There is no runtime nonce-reset method.
- `publish_machine(machine_id, machine_json, workers, expiry_blocks)` is now
  **payable**: attach at least measured storage growth times NEAR storage byte cost.
  Excess is returned asynchronously with transfer recovery. The app attaches the `get_limits().publish_storage_deposit` recommendation
  of 0.40 NEAR; actual unused storage deposit is refunded. Machine IDs: 1–32 bytes; node IDs: 1–32 bytes;
  order IDs: 1–64 bytes; accounts must satisfy NEAR rules. Existing IDs are immutable.
  Machine cap cannot exceed contract max; zero-wei Portal, multiple Portal nodes,
  more than four transfer effects or one Portal effect per resolution are rejected.
  Split branches add; gate alternatives take the maximum, including parallel paths.
- `submit_order(machine_id, order_id, external_recipient?)` must attach exactly
  **CoinSlot price + ORDER_STORAGE_FEE**, where fee is
  `1320000000000000000000000` yoctoNEAR (**1.32 test NEAR**). This fee is retained,
  including on expiry; only the price goes through the graph. Example price 1 NEAR
  therefore requires **2.32 NEAR**. Read `get_limits().order_storage_fee` in the app.
  See [G6 storage sizing](../docs/STORAGE-g6.md) for the conservative lifecycle bound.
- Portal admission requires NEAR inflow to the Portal >= `wei *
  min_fee_yocto_per_wei`; overflow, per-payout cap and current epoch exhaustion panic
  atomically. Receipt deposits return on failure; gas is still charged. For held
  orders the check runs on release: a failed approval/expiry leaves escrow intact
  for retry. Epoch uses floor(block_height / epoch_blocks), contract-wide.
- `expire(machine_id, order_id)` is callable by anyone **only at/after expires_at**;
  publisher no longer has early expiry. `approve` retains worker authorization.
- `withdraw_vault(machine_id, vault_name, amount)` is machine-owner only;
  a Vault is the machine owner's retained balance. Positive decimal-string amount
  is deducted before transfer; failure credits the owner's unclaimed balance.
- `get_unclaimed(account)` returns a decimal amount; `withdraw_unclaimed()` pulls
  the caller's credit once, clearing it before transfer. A failed withdrawal credits
  it back through the same callback. No caller can withdraw another account's credit.
- `get_limits()` exposes owner, rate, epoch size, budget, remaining budget,
  max payout, signature timeout and order fee. `get_liabilities()` exposes decimal
  `escrow`, `vaults`, `unclaimed`, `in_flight`, and total account `balance`.
  Account balance also backs storage and gas; it is not freely withdrawable surplus.
- `get_payout(payout_id)` retains G3 fields and adds decimal `attempt_id` and
  `requested_at` block height. Payouts have their own records; machines contain no
  payout history. `get_machine()` no longer includes `external_payouts`.
  Use `get_pending_external_payouts(machine_id, from_index?, limit?)` for historical
  records with current statuses, recipient, machine_id, order_id, payout_id, wei and
  fee. Since G6 it scans one page of at most 200 nonces (default 100) starting at
  `from_index`; see "G6 current rules" below.
- `retry_signature(payout_id)` accepts `signature_failed`, or `awaiting_signature`
  older than `signature_timeout_blocks`. It updates attempt/time only: stored
  payload, unsigned bytes, nonce, recipient, wei and fee snapshot never change.
  Callback `on_signature(payout_id, attempt_id)` is private; stale attempts are
  ignored. App must never call callbacks (`on_transfer`, `on_portal_address` either).
- `get_portal_queue(evm_next_nonce?)` returns `next_nonce` and
  `oldest_unbroadcast_payout`. Supply Sepolia `eth_getTransactionCount(address,
  "latest")` converted to a decimal string to locate the oldest not-mined record;
  pending count can exclude broadcasts already in a mempool. Omitted nonce starts
  at zero. NEAR cannot observe EVM broadcasts: `broadcast_status` explicitly says
  unknown; this view alone is NOT proof that a record remains unbroadcast.
- `get_portal_address`, `get_portal_derivation`, `refresh_portal_address`,
  `get_portal_nonce`, `get_order`, `get_vaults`, `explain_order` retain G3 behavior.
  Recipient is a 20-byte `0x` EVM address. Signature JSON plus unsigned bytes suffice
  for the existing keyless relayer; recover the sender before broadcasting.

## Deployment and immutability

`migrate_g3(...)` is a one-time, private initializer for the exact G3 root layout.
It takes the new limit/owner params plus `machine_ids` and `[machine_id,order_id]`
`order_keys` enumerated from a **complete final view_state snapshot**. Deploy and
migrate atomically. It preserves nonce, signatures, machines, orders and address;
rebuilds escrow/vault liabilities and removes machine history vectors. Previously
reserved payouts conservatively consume the first epoch budget. Legacy orders
were paid under G3 pricing and keep their state. It preserves old signer and fee
bounds, setting future maximum fees to their upper bound. The snapshot must be
complete; validate liabilities against the snapshot before removing access keys.
Migration is guarded by a persistent marker, private authentication and exact G3
Borsh decoding. It cannot initialize or reset an already hardened root.

**Immutability is only true after `scripts/lock-contract.sh` runs successfully**
and `view_access_key_list` returns `keys: []`. The script deletes EVERY contract
access key in one transaction, then prints and checks the RPC list. It is provided
for manual final deployment only and has NOT been run. Until then a FullAccess
key can redeploy arbitrary code. Separate fee owner retains only bounded fee
updates after locking. Publishers still control their own Vault withdrawals.
Legacy machines published by the contract account itself lose that ability when
its keys are deleted: resolve their escrow and withdraw their vaults before lock,
or intentionally leave those testnet balances retained. Fresh G5 examples are
published by the separate owner account.

## Liveness and limits

Each Portal builds a native Sepolia transfer: gas 21000, empty data/access list,
fixed recipient/value, EIP-1559 fee snapshot. 300 Tgas is recommended on order,
approve/expire and retry. Each transfer has a 5 Tgas recovery callback. A successful
NEAR order or `signed` record does not prove EVM broadcast or payment.

High snapshot fees improve inclusion but cannot guarantee it. There is no EVM fee
replacement or cancellation, no per-machine EVM treasury and no on-chain proof
of broadcast. Insufficient ETH, recipient execution failure, RPC downtime,
underpricing, or a missing early nonce can stall every later payout. Relayer must
broadcast/retry oldest nonces in order and verify receipts on Sepolia. Treasury
admission prices/rate-limits value; it does not replenish ETH automatically or
replenish the treasury. G6 includes worst-case snapshot gas in the epoch budget.
Fund the shared treasury separately. Low configured
rates and high budgets are still risky policy choices; immutable admission params
must be chosen before locking.

Storage/history is not pruned. Recovery depends on its callback executing; a
callback infrastructure failure can strand in-flight liabilities. Lost signature
callbacks are recoverable by timeout retry. Fixed storage fee is conservative,
not a per-order refund scheme. 21000 gas supports ordinary EVM accounts, not
arbitrary EVM contracts. This is a bounded testnet hackathon deployment.

```sh
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target
cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml
cargo near build non-reproducible-wasm --manifest-path contract/tests/mock-signer/Cargo.toml --no-abi --out-dir /opt/ww-target/portal-mock
(cd engine && cargo test)
(cd contract && cargo test -- --nocapture)
```

Sandbox tests patch 200 historical payout records and a lost callback directly
using sandbox state patching; production exports no testing hooks. Migration test
uses the saved public G3 snapshot and checks nonce, signatures and liabilities.
See `../docs/EVIDENCE-hardening.md` for complete outputs and testnet links.

## G4b measurement and deployment (historical)

Superseded fee sizing: G6 now uses a topology-independent 65,536-byte lifecycle
upper bound and a **1.32 NEAR** retained order fee; see
[STORAGE-g6.md](../docs/STORAGE-g6.md). The historical fixture and its original
limitations below are retained for traceability, not current configuration.

Sandbox `storage_envelope` measures 32 nodes, 32-byte machine/node IDs (node IDs
contain control bytes expanding to six JSON bytes), a 64-byte order ID, four
transfer effects to a 64-character account, a Vault with a 32-character escaped
name, and an external payout including unsigned transaction, payload and mock
signature. Publish **19,528 bytes**, completed order **38,044 bytes**. At
10^19 yoctoNEAR per byte, twice the observed footprints rounded upward to 0.01
NEAR gave publish **0.40 NEAR** and order **0.77 NEAR** (historical). The order test uses a
1 NEAR price; maximum u128 decimal widths, every graph topology, all held-worker
combinations and all possible Unicode vault names were not exhaustively measured.
This is an adversarial measured fixture, **not a proven global worst-case bound**.
Requirement 1's exact worst-case sizing remains unverified; do not describe G4b
as fully complete on this evidence alone. Ordinary vending measured ~2,187 bytes
per signed order and ~1,026 bytes per publish (sandbox account widths vary).

The fixed recommendation is a refundable publish deposit, not a publish fee.
Publish still checks actual byte cost and rejects insufficient deposits; clients
may attach more for a larger machine. Order fee is retained, including on expiry.

`migrate_g4b()` is private and one-time. It reads/writes the same G5 root layout;
all records, handles, liabilities, nonce, signatures, policies and derivation stay
unchanged. It adds only a migration marker. Deploy and migration are atomic.
`app/scripts/deploy-g4b.ts` verifies all preexisting state records byte-for-byte
and the deployed WASM hash. `verify-g4b.ts` permits repeating verification against
the pre-migration public snapshot, before placing new orders. Neither script
contains keys; deployment credentials stay under `/opt/ww-secrets`.

New G6 sponsored sessions receive **9 NEAR**. Five orders of a 0.1 NEAR machine
require 5 × (0.1 + 1.32) = **7.10 NEAR**; one publish attaches **0.40 NEAR**,
leaving **1.50 NEAR** for account storage and gas (publish refunds increase headroom).
Existing sessions are not automatically refilled.
Relay returns broadcast only; payout confirmation checks transaction and successful
receipt independently at two Sepolia RPC hosts, including hash, sender, recipient,
value, nonce and matching block hash. `npm run relay -- <id>` relays earlier signed
nonces first; an unsigned predecessor returns `waiting_for_earlier_nonce`, and an
unsigned requested target (after signed predecessors were advanced) returns
`waiting_for_signature`. `npm run confirm -- <id>` reports both proofs only after
both agree and, since G6, only once both RPCs show at least three blocks on top.


## G6 current rules
The retained order fee is **1.32 NEAR**, twice the 65,536-byte conservative
worst-case lifecycle envelope rounded upward to 0.01 NEAR. Width checks and
actual sandbox measurements are recorded in [G6 storage sizing](../docs/STORAGE-g6.md).
New machine/node IDs are 1–32 bytes and order IDs 1–64 bytes of
`[a-z0-9_-]`. Existing state is retained, including legacy IDs.
Publish checks exact splitter rounding on every reachable immediate, approve
and expiry branch. Nonzero Portal flows must meet the rate, payout cap and
value plus worst permitted gas reservation within one epoch budget. Previously
published graphs are not retroactively validated.

Epoch spend reserves `wei + 21000 * snapshotted_max_fee_per_gas`, with a separate
20 payouts per epoch cap. Gas reservations are conservative and never refunded.
The existing epoch budget remains unchanged on migration; migrated current-epoch
records are charged their value and gas reservation, possibly leaving zero
remaining budget. The budget does not fund the treasury.

`submit_order`, `approve`, and `expire` return
`{pending,effects,trace}`; effects use kind vault/payout/external, with decimal
amounts and external payoutId. Read the function's own receipt, not detached
signature callback return values.
`get_pending_external_payouts(machine_id,from_index?,limit?)` scans at most
200 nonce records, default 100. Advance from_index by limit, even for empty
filtered pages. Historical entries include all statuses.

`migrate_g6()` is private, one-time, same-root-layout migration. It preserves
all existing maps, treasury derivation, nonce, signatures and liabilities.
See [G6 evidence](../docs/EVIDENCE-g6.md).

Server session/customer quotas are best-effort testnet controls, in process
memory, serialized per process. Vercel runtime forwarding headers identify
clients; local mode uses the peer address. Aggregate sponsor cap is 35 test NEAR
per hour and customer cap 20 test NEAR per hour, measured by account balance
delta (including gas/storage), with a conservative reservation before sending.
They reset on cold start and are not shared across instances; they are not a
production abuse-prevention boundary. Session idempotencyKey equals its publicKey;
the deterministic account is checked before quota/funding, so retries do not
create or fund another account. Input is validated before quota is counted.

Sepolia confirmed requires matching successful receipt and transaction from two
RPC hosts and at least three additional blocks on each. UI wording is
“included on Sepolia, seen by two RPCs”; this is not finality.
