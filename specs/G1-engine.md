# G1 — Machine engine (gate 1: is it really a construction system?)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Goal
A pure Rust crate `engine/` that defines the machine format and runs machines deterministically. The same crate will later run inside the NEAR contract and, compiled to wasm, in the browser. No NEAR SDK, no network, no UI in this task.

## Constraints
- No floats. Amounts are `u128` (yoctoNEAR); percentages are basis points (`u16`, 10000 = 100%).
- Deterministic: `BTreeMap`/`Vec` only, no hash-order iteration, no time, no randomness.
- Must compile for `wasm32-unknown-unknown` (`cargo build --target wasm32-unknown-unknown`).
- serde JSON for the machine format; schema documented in `engine/MACHINE_FORMAT.md`.
- Build with `CARGO_TARGET_DIR=/opt/ww-target` (the /data disk is nearly full).

## Parts (v1 vocabulary; nothing else)
- **CoinSlot** (exactly one, the source): price in yocto; an order pays exactly the price.
- **Splitter**: 2-4 outputs with basis points summing to exactly 10000; rounding remainder goes to the first output; conservation must hold to the yocto.
- **Vault**: sink that accumulates a named balance.
- **Gate**: two outputs `pass` / `fail`. Condition is one of: `MinAmount(u128)` or `NeedsApproval{worker}`. An approval-gated order is held as pending until `approve(order_id)` by that worker (pass) or `expire(order_id)` (fail).
- **Worker**: a named role allowed exactly one action (`approve` on specific gates). (On chain this becomes a scoped function-call key.)
- **Payout**: sink that pays a NEAR account (recorded as an effect).
- **Portal**: sink that requests a fixed external payout `{chain: "sepolia", wei: u128}` capped by a machine-level `portal_cap_wei`; records an effect `ExternalPayout{recipient, wei}`. Inflow to a Portal is its fee.

## API (shape, adjust names if needed)
- `validate(&Machine) -> Result<(), Vec<ValidationError>>`
- `submit_order(&mut State, &Machine, OrderId, payer, amount, external_recipient: Option<String>) -> Result<Outcome, EngineError>`
- `approve(&mut State, &Machine, OrderId, worker) -> Result<Outcome, EngineError>`, `expire(...)`
- `Outcome` contains the list of effects (vault credits, payouts, external payouts) and a human-readable `trace: Vec<String>` explaining each step ("Splitter 'fees': 7000 bps -> reserve vault (0.7 NEAR)").

## Validation must reject (each with a named error and a test)
cycle; more or fewer than one CoinSlot; unconnected output port; unreachable node; Splitter bps != 10000 or outside 2-4 outputs; Portal payout above cap; Gate NeedsApproval naming a worker that does not exist; edge to a missing node.
Runtime must reject: duplicate order id; wrong amount; approval by the wrong worker; approving a non-pending order; approving twice.

## Acceptance checks (run all; paste output in your report)
1. `cd engine && CARGO_TARGET_DIR=/opt/ww-target cargo test` — all pass.
2. `CARGO_TARGET_DIR=/opt/ww-target cargo build --target wasm32-unknown-unknown --release` — succeeds.
3. Property test (proptest or quickcheck): for random valid splitter trees and amounts, sum of all effects == amount paid, exactly.
4. Two example machines in `engine/examples/` as JSON, both using only the parts above:
   - `vending.json`: CoinSlot -> Splitter(70% reserve Vault, 30% creator Payout) ... with a Portal paying the customer on Sepolia.
   - `escrow.json`: CoinSlot -> Gate(NeedsApproval worker "inspector") -> pass: Payout seller / fail: Payout refund buyer.
   A test runs the same order through both and asserts materially different outcomes (immediate external payout vs pending-then-approved release).
5. "Rewire" test: take `vending.json`, move one edge (e.g. put a Gate before the Portal), and assert the outcome changes as expected.
6. A small CLI `cargo run --example run -- engine/examples/vending.json` prints the trace for one order.

## Amendment (orchestrator, after Astra audit)
The vending example's "70% reserve / 30% creator plus a Portal fee" was impossible as written (the shares already total 100%). Accepted allocation: 63% reserve Vault, 30% creator Payout, 7% Portal fee. Required follow-up: a test asserting these exact amounts, the external wei and recipient; and validation that rejects a CoinSlot price of 0 (Astra found a zero-price order still triggers an external payout).

## Out of scope
NEAR SDK, contract, Chain Signatures calls, UI, wasm-bindgen glue. Do not add parts beyond the list.

## Report
List files created, paste the output of checks 1-6, and list anything not done. Do not say done if any check fails.
