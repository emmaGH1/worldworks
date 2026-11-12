# Machine format v1

This crate is a local deterministic interpreter. Effects are intentions, not real
transactions. It uses no network, NEAR SDK, clock, randomness, or floating point.

A machine is `{ "portal_cap_wei": "1000", "nodes": { "id": { ...part } } }`.
All monetary values are unsigned decimal **strings** fitting u128 (yoctoNEAR
unless named `wei`). Basis points are JSON u16 integers; 10000 means 100%.
Node IDs are keys in a BTreeMap. Parts and conditions use a `type` discriminator.
Unknown fields are rejected. Examples are in `examples/`.

| Part type | Fields | Behavior |
|---|---|---|
| CoinSlot | price, output | Exactly one source; payment must equal price |
| Splitter | outputs: [{bps, target}, ...] | 2–4 ports, total 10000 bps |
| Vault | name | Adds inflow to State.vaults[name] |
| Gate | condition, pass, fail | Routes the whole inflow on one port |
| Worker | gates: [gate_id, ...] | Node ID is role name; may approve only listed gates |
| Payout | account | Records a NEAR payout; `$payer` resolves to the order payer |
| Portal | chain, wei | chain must be `sepolia`; records fixed wei payout to order recipient |

Gate conditions: `{"type":"MinAmount","amount":"100"}` passes if the
current inflow is at least amount; `{"type":"NeedsApproval","worker":"inspector"}`
holds this inflow. Both pass/fail ports must be connected, even if a condition
will always pass. Empty output/target strings mean unconnected ports; nonempty
strings must name existing nodes. Edges cannot deliver money to Workers or CoinSlots.

Workers are reachable via Gate role references, not monetary wires. The Worker
must list every Gate that names it, and may list no other gates. Its only action
is approve. All other nodes must be reachable through flow edges. Flow cycles,
including disconnected ones, are rejected. There is no arbitrary action field.

Splitter allocation floors each share, then gives the entire remainder to port
zero. The calculation avoids multiplying a full u128 amount by basis points, so
u128::MAX works. Port order determines remainder ownership and execution order;
map insertion order does not affect execution. Splitting/merging paths each carry
their own inflow; a sink can receive multiple credits from one order.

The vending example routes 70% to the reserve branch and 30% to creator. The
reserve branch routes 90% to Vault and 10% as the Portal fee: net 63% Vault,
30% creator, 7% fee. A MinAmount(0) delivery Gate passes that fee to the
Portal (both ports initially lead there); rewiring just its pass port to the
reserve Vault redirects the fee while preserving graph reachability. The Portal's wei is a separate unit, bounded per Portal by
portal_cap_wei. The cap is not an aggregate per-order or lifetime cap.

## Calling the engine

`validate(&Machine)` returns named structured errors. Runtime entry points also
validate. `submit_order(&mut State, &Machine, String, String, u128, Option<String>)`
reserves a unique order ID permanently, routes money, and returns Outcome.
`approve(&mut State, &Machine, String, &str)` releases all currently held flows
for that Worker through their pass ports. Other Workers' flows stay pending.
`expire(&mut State, &Machine, String)` releases all currently held flows through
fail ports. New downstream approval Gates may hold again. There is no expiry
clock: the host must authorize when expiry is permitted. Keep each State bound
to one immutable validated Machine; machine publishing/versioning is host work.

Outcome includes `effects`, human-readable `trace`, and `pending`. Effects are
VaultCredit{name, amount}, Payout{account, amount}, and
ExternalPayout{recipient, wei, fee}. `Effect::inflow()` reports NEAR consumed;
external wei must never be summed with NEAR. A completed order's inflows sum to
its payment; while pending, the difference is held in State. Vault credits are
also persisted in State; payouts and Portal requests are only effects. Hosts
must persist state and effects atomically and execute effects exactly once.

Recipient is required only if a Portal executes. Address validation, payment
sender authentication, worker authentication, chain execution, fee sufficiency,
and expiry scheduling belong to the host. Passing a worker name alone does not
authenticate an on-chain caller. All errors leave State unchanged, including
partial traversal overflow or missing recipients. Duplicate IDs, wrong prices,
wrong workers, absent/completed pending orders, and repeated approval are errors.

## Local checks

From engine/: `CARGO_TARGET_DIR=/opt/ww-target cargo test` and
`CARGO_TARGET_DIR=/opt/ww-target cargo build --target wasm32-unknown-unknown --release`.
`CARGO_TARGET_DIR=/opt/ww-target cargo run --example run -- engine/examples/vending.json`
prints a local example (both repo-relative and crate-relative file paths work).
