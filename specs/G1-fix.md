# G1-fix — Engine hardening (from Astra audit + Claude review)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Context
G1 engine passes its tests but a review found bugs that can lock funds or allow unlimited external payouts. Fix all of the items below in `engine/`, then make sure `contract/` (built in G2a) still compiles and its tests pass, adapting it if engine signatures changed. Keep every existing test passing unless a test encoded a behaviour this spec now forbids (say which).

## Required fixes (each needs at least one test that fails before the fix)
1. **Locked orders.** If any Portal is reachable from the CoinSlot, `submit_order` must require a non-empty, well-formed EVM recipient (`0x` + 40 hex) up front. Validation must reject a NeedsApproval Gate whose pass and fail point to the same node.
2. **Path explosion.** Validation computes path counts per node over a topological order (saturating) and rejects machines whose total number of flows exceeds `MAX_FLOWS = 64`; also `MAX_NODES = 32`. Document both limits.
3. **Portal limits.** Reject CoinSlot `price == 0` and any Splitter output with `bps == 0`. Enforce the machine-level cap: sum over Portals of (path count x wei) <= `portal_cap_wei`. A Portal only emits a payout when its fee inflow is > 0.
4. **No recursion.** Replace the recursive cycle DFS with Kahn's algorithm (iterative). Add a test with a 32-node chain and one with 33 nodes (rejected by MAX_NODES).
5. **Machine binding.** `Order` stores a hash of the machine it was submitted against (stable hash of the canonical JSON, e.g. sha256 via a no-std-friendly crate); `approve`/`expire` reject a different machine. Also store the gate's pass and fail targets in `Held` at hold time.
6. **Name validation.** Payout accounts must be valid NEAR account IDs (2-64 chars, NEAR rules) or exactly `$payer`; vault names non-empty, <= 32 chars.
7. **Strict parsing.** Amounts accept only ASCII digits, no leading zeros (except "0" where allowed). Duplicate node keys in JSON are rejected.
8. **Serialization.** All u128 fields serialize as decimal strings everywhere (State, Held, Order, vaults, Effect, Outcome). Derive `Serialize` on Outcome, Effect, EngineError, ValidationError.
9. **Errors.** Second approval returns `NotPending`, not `WrongWorker`.
10. **Cost.** Validate once at publish (expose `validate` result type the contract can store); `submit_order`/`approve`/`expire` must not clone the whole State. Stage changes and commit only on success.
11. **Vending example.** Accepted allocation is 63% reserve / 30% creator / 7% Portal fee (spec amended). Add a test asserting these exact amounts, the external wei and recipient.
12. Extend the conservation property test to include Gates (MinAmount) and Portals.
13. Update `MACHINE_FORMAT.md` so every statement matches the code (limits, machine-level cap, strict parsing, recipient rule).

## Acceptance checks (paste output)
1. `cd engine && cargo test` — all pass; list the new tests.
2. `cargo build --target wasm32-unknown-unknown --release` in engine/.
3. `cd contract && cargo test` — all pass (sandbox tests).
4. A table: finding number -> test name that covers it.

## Environment
CARGO_TARGET_DIR=/opt/ww-target, CARGO_HOME=/opt/ww-cargo-home, PATH includes ~/.cargo/bin. Do not touch probes/, research/, HACKATHON.md, README.md. Do not commit or push. No network transactions.

## Amendment (orchestrator, after Sol completeness check)
- VecDeque in Kahn's algorithm is accepted: it is deterministic; the G1 "BTreeMap/Vec only" rule was about hash-order nondeterminism.
- Finding 11 (vending allocation) and 13 (documentation) are exempt from the red-before-fix rule: 11 was already correct behaviour, 13 is documentation verified manually.
- Follow-up folded into a later task: assert external record recipient/machine_id/order_id in the sandbox test; label contract/REPORT.md measurements as historical.
