# Machine format v1

This crate is a local deterministic interpreter. Effects are intentions, not real
transactions. It uses no network, NEAR SDK, clock, randomness, or floating point.

A machine is `{ "portal_cap_wei": "1000", "nodes": { "id": { ...part } } }`.
All monetary values are canonical unsigned ASCII decimal **strings** fitting u128 (yoctoNEAR
unless named `wei`). Basis points are JSON u16 integers; 10000 means 100%.
Node IDs are keys in a BTreeMap. Parts and conditions use a `type` discriminator.
Unknown fields and duplicate node keys are rejected. Signs, whitespace, non-ASCII digits and leading zeros (except the string "0") are rejected. Examples are in `examples/`.

| Part type | Fields | Behavior |
|---|---|---|
| CoinSlot | price, output | Exactly one source; positive price; payment must equal price |
| Splitter | outputs: [{bps, target}, ...] | 2–4 ports, each bps positive, total 10000 bps |
| Vault | name | Name is 1–32 Unicode characters; adds inflow to State.vaults[name] |
| Gate | condition, pass, fail | Routes the whole inflow on one port |
| Worker | gates: [gate_id, ...] | Node ID is role name; may approve only listed gates |
| Payout | account | Valid NEAR account ID (2–64 ASCII bytes, lowercase letters/digits with single internal `.`, `-`, `_` separators), or exactly `$payer` resolving to the payer |
| Portal | chain, wei | chain must be `sepolia`; records fixed wei payout to order recipient only for positive fee inflow |

Gate conditions: `{"type":"MinAmount","amount":"100"}` passes if the
current inflow is at least amount; `{"type":"NeedsApproval","worker":"inspector"}`
holds this inflow. Approval Gates must have distinct pass and fail targets. Both pass/fail ports must be connected, even if a condition
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
reserve Vault redirects the fee while preserving graph reachability. The Portal's wei is a separate unit. The machine-level cap conservatively bounds
sum(path_count × wei) over all Portals, rejecting arithmetic overflow. Both
Gate ports count as structural paths even though only one executes; vending
therefore has a 2000000000000000 wei cap and a 1000000000000000 wei payout.
This is a per-order bound, not a lifetime cap.

Machines have at most MAX_NODES = 32 nodes, including Workers. Kahn's iterative
topological traversal rejects cycles and computes saturating source-to-node path
counts. Their sum over all nodes (source included) must be <= MAX_FLOWS = 64.
Parallel ports count separately; both Gate alternatives count. These deliberately
conservative limits bound traversal and held flows even in graphs with merges.

## Calling the engine

`validate(&Machine)` returns a `ValidatedMachine` or named structured errors.
Runtime entry points accept either a raw Machine (validated per call) or a
ValidatedMachine (borrowed without revalidation). Publish once and persist the
validated token in trusted host storage. Its serde representation includes the
machine, canonical JSON SHA-256 hash, source, decimal-string price, and Portal
flag; never accept a serialized token from an untrusted caller. The contract
stores this token at publish and uses it for all order calls. `submit_order(&mut State, &Machine, String, String, u128, Option<String>)`
reserves a unique order ID permanently, routes money, and returns Outcome.
`approve(&mut State, &Machine, String, &str)` releases all currently held flows
for that Worker through their pass ports. Other Workers' flows stay pending.
`expire(&mut State, &Machine, String)` releases all currently held flows through
fail ports. New downstream approval Gates may hold again. There is no expiry
clock: the host must authorize when expiry is permitted. Each Order stores the SHA-256 of canonical machine JSON (sorted node keys,
fixed serde field order, canonical decimal strings). Approve/expire reject a
different machine with MachineMismatch, including valid rewiring. Held records
persist pass and fail targets at hold time. Machine publishing/versioning is
host work.

Outcome includes `effects`, human-readable `trace`, and `pending`. Effects are
VaultCredit{name, amount}, Payout{account, amount}, and
ExternalPayout{recipient, wei, fee}. `Effect::inflow()` reports NEAR consumed;
external wei must never be summed with NEAR. A completed order's inflows sum to
its payment; while pending, the difference is held in State. Vault credits are
also persisted in State; payouts and Portal requests are only effects. Hosts
must persist state and effects atomically and execute effects exactly once.

If any Portal is structurally reachable, submission requires a nonempty `0x`
plus 40 ASCII hex-digit recipient before holding or routing any funds. This
applies even when the current path will not execute a Portal. Payment sender
authentication, worker authentication, chain execution, fee sufficiency,
and expiry scheduling belong to the host. Passing a worker name alone does not
authenticate an on-chain caller. All errors leave State unchanged, including
partial traversal overflow or missing recipients. Calls stage only the active
order and touched vault balances; they never clone the entire State. All u128
values in State, Held, effects and outcomes serialize as decimal strings.
Outcome, Effect, EngineError and ValidationError implement Serialize. Repeating
approval for a role already released returns NotPending even while another
role's flows remain pending; a role never pending returns WrongWorker. Duplicate IDs, wrong prices,
wrong workers, absent/completed pending orders, and repeated approval are errors.

## Local checks

From engine/: `CARGO_TARGET_DIR=/opt/ww-target cargo test` and
`CARGO_TARGET_DIR=/opt/ww-target cargo build --target wasm32-unknown-unknown --release`.
`CARGO_TARGET_DIR=/opt/ww-target cargo run --example run -- engine/examples/vending.json`
prints a local example (both repo-relative and crate-relative file paths work).
