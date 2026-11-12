# G2a local contract

No testnet deployment or external signing is implemented here. All integration
transactions use near-workspaces' local nearcore sandbox.

## Reproduce

```sh
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_HOME=/opt/ww-cargo-home
export CARGO_TARGET_DIR=/opt/ww-target
cd contract
cargo near build non-reproducible-wasm
stat -c '%n: %s bytes' /opt/ww-target/near/worldworks_contract.wasm
cargo test -- --nocapture
cd ../engine
cargo test
```

Cargo.lock pins near-sdk 5.28.3 and near-workspaces 0.22.4. Rust 1.99 works
without a toolchain change or custom Wasm flags; cargo-near's default wasm-opt
postprocessing is retained. ABI generation and embedding are enabled.
The test uses the built Wasm above, or `WORLDWORKS_WASM` if explicitly supplied.
Build before testing after changes to the contract or engine.

## Calls

Initialize once with `new({})`. The sandbox dev deployment is pre-funded; in a
future deployment the contract account must be funded for code and growing
storage before accepting publications/orders. Callers pay transaction gas but
no extra storage deposit. Only submit_order is payable, and it requires the
engine's exact CoinSlot price.

`publish_machine` accepts `machine_id`, `machine_json` (a JSON string in engine
format), `workers` (Worker node ID -> NEAR account ID), and `expiry_blocks` (a
positive u64 decimal string). Worker bindings must match all Worker nodes
exactly. Payout targets must be valid NEAR account IDs or `$payer`. Published
rules, worker bindings, owner, and expiry duration are immutable. No upgrade,
withdrawal, vault-spending, or admin bypass method is exported.

`submit_order` accepts `machine_id`, `order_id`, and optional
`external_recipient` (0x + 40 hexadecimal digits). Payer is always predecessor,
not transaction signer. Duplicate IDs remain reserved permanently within a
machine, including after approval/expiry. A failed call rolls back storage and
scheduled effects. Gated deposits stay on the contract. Portal fees stay on the
contract; no ETH is transferred and no signature is requested.

`approve(machine_id, order_id)` identifies the authorized Worker from the
predecessor. If the account holds multiple roles, one pending role is released
per call. The engine decides which flows may pass. `expire(machine_id, order_id)`
is available to anyone at submitted block + expiry_blocks, or to the machine
owner earlier; it routes the engine's fail ports (which the supplied escrow
example wires to `$payer`). Expiry is manual, not a scheduler. Downstream gates
can leave an order pending; its original deadline remains in force.

Views: `get_machine(machine_id)` returns the published rules, owner, bindings,
expiry duration, accumulated vaults and external records (or null).
`get_order(machine_id, order_id)` returns payer, submitted_at, expires_at,
pending and trace (or null); interpreter state stays private to persistence.
`get_vaults(machine_id)`, `get_pending_external_payouts(machine_id)` and
`explain_order(machine_id, order_id)` return vault amounts, all external records
and the cumulative engine trace respectively. Amounts and block heights in
public views are decimal strings.

## Storage and limits

Tests measure account storage_usage deltas. Costs are storage stake, computed at
NEAR's SDK storage byte cost of 10^19 yoctoNEAR/byte (0.00001 NEAR/byte),
not gas or a fee charged to a payer. Exact deltas vary with IDs, account names,
traces and graph size. See REPORT.md for the measured run.

Each order persists a serialized engine State containing just that order;
the contract accumulates VaultCredit effects per machine, checking overflow.
The only engine change adds serde serialization/deserialization to State and
its private Order/Held types so pending state survives calls. Rules and all
existing tests are unchanged.

This v1 stores each machine's external list together and returns unpaginated
views. Storage and gas grow with use, and there is no pruning. Prefunding is
required; no production resource quotas are implemented. NEAR transfers are
asynchronous: tests assert success of every receipt against funded sandbox
accounts. A destination deleted before execution can fail its transfer;
there is no retry/recovery callback in this task. No delivered status is
claimed by the contract. External payouts remain `awaiting_signature`;
`request_external_signature` is a private, unreachable G2b TODO that panics
if ever wired without implementation.
