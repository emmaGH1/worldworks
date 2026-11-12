# G2a — NEAR contract wrapping the engine (local only)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Goal
A NEAR smart contract in `contract/` (Rust, near-sdk 5.x, built with `cargo near build`) that uses the `engine/` crate as the single source of truth for machine rules. Tested locally with near-workspaces sandbox. No testnet transactions in this task.

## Environment
- `CARGO_TARGET_DIR=/opt/ww-target` and `CARGO_HOME=/opt/ww-cargo-home` (the /data disk has ~1.4 GB free; do not download crates into ~/.cargo). Binaries `cargo-near` 0.23 and `near` CLI 0.31 are in ~/.cargo/bin (add to PATH).
- Rust 1.99, wasm32-unknown-unknown installed. If near-sdk needs a different toolchain or wasm feature flags, pin it and say why.

## Contract behaviour
- `publish_machine(machine_id, machine_json)`: validates with the engine; stores machine + owner (caller). Rejects invalid machines with the engine's error. Machine ids are unique.
- `submit_order(machine_id, order_id, external_recipient: Option<String>)` `#[payable]`: attached deposit must equal the CoinSlot price; runs the engine; executes effects:
  - `Payout` -> `Promise::transfer` to the account (`$payer` = predecessor).
  - `VaultCredit` -> internal per-machine vault balances (view method returns them).
  - `ExternalPayout` -> recorded as a pending external payout `{machine_id, order_id, recipient, wei, status: "awaiting_signature"}`. The Chain Signatures call is G2b; leave a clearly named seam (`fn request_external_signature`) with a TODO that is not reachable in tests and does not pretend to sign.
  - Pending gated orders: deposit held by the contract until `approve` / `expire`.
- `approve(machine_id, order_id)`: predecessor must equal the worker account registered for that Worker node at publish time (add `workers: {name -> account_id}` to publish). `expire(machine_id, order_id)`: only after a configured number of blocks or by the machine owner; refunds per engine.
- Views: `get_machine`, `get_order`, `get_vaults`, `get_pending_external_payouts`, `explain_order` (the engine trace).
- Storage: payer pays nothing extra for v1; contract is pre-funded for storage. Document storage cost per machine and per order (measured in tests).
- No owner/admin method can move funds, change a published machine, or bypass the engine. No upgrade method in this task.

## Acceptance checks (paste output)
1. `cd contract && cargo near build non-reproducible-wasm` (or the documented 0.23 equivalent) produces a .wasm; print its size.
2. `cargo test` in `contract/` runs near-workspaces sandbox tests that:
   a. publish `engine/examples/vending.json` and `escrow.json` (with worker accounts);
   b. vending order: creator receives exactly 30% (check balances), vault shows 70% minus delivery fee, one pending external payout recorded;
   c. escrow: order pending; wrong account approve fails; worker approve pays seller; second approve fails; a second order expired -> refund to payer;
   d. wrong deposit rejected; duplicate order id rejected; invalid machine rejected; owner cannot alter a published machine.
3. Engine tests still pass: `cd engine && cargo test`.
4. `git status` shows no secrets and no files outside `contract/`, `engine/` (only if needed), and `Cargo` lockfiles.

## Out of scope
Testnet deployment, Chain Signatures, relayer, UI, sub-account per machine (note in report whether sub-accounts per machine look cheap enough, with measured storage numbers).

## Report
Files created, full output of checks 1-4, measured storage costs, anything not done. Do not say done if any check fails.
