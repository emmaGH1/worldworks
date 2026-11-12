# G1-fix implementation evidence

All requested acceptance checks pass. No commit, push, testnet transaction or external-chain transaction was made. Integration transactions ran only in the local NEAR sandbox.

## Files changed

- engine/Cargo.toml, engine/Cargo.lock: no-std-friendly SHA-256 dependency.
- engine/src/lib.rs: validation, strict parsing, immutable validated-machine token, binding, staging, serialization and error handling.
- engine/tests/engine.rs: 13 new tests, extended conservation generator, existing tests adapted to new limits.
- engine/tests/cost.rs: allocation regression test (14th new test).
- engine/examples/vending.json: conservative aggregate cap; actual allocation/payout unchanged.
- engine/MACHINE_FORMAT.md: full updated rules and API/persistence contract.
- contract/src/lib.rs, contract/Cargo.lock: persist and use validated machine, preserve raw graph view, support multi-role approval after NotPending change.
- contract/tests/sandbox.rs: assert unchanged raw graph view and multi-role-account approvals.
- contract/USAGE.md: persistence and migration notes.
- engine/G1_FIX_REPORT.md: this report.

No files outside engine/ and contract/ were edited. Concurrent workspace changes were left alone.

## Finding -> test

| Finding | Regression tests / verification |
|---|---|
| 1 locked orders | recipient_checked_before_hold_and_identical_approval_targets_rejected |
| 2 path explosion | rejects_path_explosion_and_counts_parallel_ports; iterative_chain_accepts_32_rejects_33_nodes |
| 3 Portal limits | rejects_zero_price_zero_share_and_aggregate_portal_cap; zero_fee_never_emits_external_payout |
| 4 recursion | iterative_chain_accepts_32_rejects_33_nodes; rejects_cycle; iterative Kahn implementation |
| 5 binding | binds_machine_and_persists_held_targets |
| 6 names | near_accounts_and_vault_names_validated |
| 7 parsing | strict_amounts_and_duplicate_node_keys |
| 8 serialization | all_amounts_serialize_as_strings_and_state_roundtrips |
| 9 repeat approval | repeated_worker_with_other_pending_role_returns_not_pending; rejects_double_approval; acceptance_sandbox PASS e |
| 10 cost / atomicity | runtime_allocations_do_not_scale_with_state_history; validated_machine_persistence_and_staged_resolution_failure; missing_recipient_and_overflow_are_atomic |
| 11 vending | vending_exact_amended_allocation |
| 12 conservation | splitter_tree_conserves_every_yocto (extended generated trees); splitter_gates_portals_conserve |
| 13 documentation | MACHINE_FORMAT.md reconciled against the above tests and public API |

The regression tests target behaviors previously missing (including 33-node rejection, zero-fee suppression and strict JSON). Finding 11's allocation already matched the Amendment before this task; its new test asserts the exact existing behavior. Findings 12/13 extend coverage/documentation rather than correct an independent runtime behavior.

Existing tests changed: the tree generator is bounded to valid node/flow limits, gives every share positive bps, uses positive prices, and includes Gate/Portal/Payout leaves. The old zero-price success case in max_amount_and_first_output_remainder was removed because zero prices are now forbidden (covered by explicit rejection). Tests using validate now expect a validated token instead of unit. All other existing behavioral assertions remain.

## Not done

- No remaining G1-fix item or failed acceptance check.
- No deployment-state migration (not requested); trusted persisted token/Order JSON format changed and requires a fresh deployment or migration.
- No commit/push or public-network transactions, as instructed.
- No changes to app/, probes/, research/, HACKATHON.md or root README.md.
- No Chain Signatures implementation or actual external payout; outside G1-fix scope.

## Acceptance output

Environment for all checks: PATH="$HOME/.cargo/bin:$PATH", CARGO_HOME=/opt/ww-cargo-home, CARGO_TARGET_DIR=/opt/ww-target.
Commands were run from the repository with the corresponding --manifest-path, equivalent to the specified crate working directories. Check 3 adds -- --nocapture to retain sandbox evidence. Contract Wasm was rebuilt with cargo near build non-reproducible-wasm before sandbox testing (340235 bytes).

### Check 1: `cd engine && cargo test`

```text
   Compiling worldworks-engine v0.1.0 (/data/home/.t3/projects/near-hackathon/engine)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.63s
     Running unittests src/lib.rs (/opt/ww-target/debug/deps/worldworks_engine-f097ce4e51783f1c)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/cost.rs (/opt/ww-target/debug/deps/cost-9ca12ce46267e931)

running 1 test
test runtime_allocations_do_not_scale_with_state_history ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/engine.rs (/opt/ww-target/debug/deps/engine-a94f7189b893ab13)

running 39 tests
test expiry_refunds_payer_and_rejects_later_approval ... ok
test all_amounts_serialize_as_strings_and_state_roundtrips ... ok
test json_roundtrip_full_u128 ... ok
test minimum_amount_fail_branch ... ok
test max_amount_and_first_output_remainder ... ok
test binds_machine_and_persists_held_targets ... ok
test missing_recipient_and_overflow_are_atomic ... ok
test rejects_cycle ... ok
test iterative_chain_accepts_32_rejects_33_nodes ... ok
test rejects_double_approval ... ok
test near_accounts_and_vault_names_validated ... ok
test recipient_checked_before_hold_and_identical_approval_targets_rejected ... ok
test rejects_invalid_worker_scope ... ok
test rejects_missing_edge_target ... ok
test rejects_missing_worker ... ok
test rejects_duplicate_order ... ok
test rejects_no_coin_slot ... ok
test rejects_non_pending_approval ... ok
test rejects_portal_above_cap ... ok
test rejects_path_explosion_and_counts_parallel_ports ... ok
test rejects_multiple_coin_slots ... ok
test rejects_splitter_output_count ... ok
test rejects_splitter_sum ... ok
test rejects_unconnected_output ... ok
test rejects_unsupported_chain ... ok
test rejects_worker_as_flow_target ... ok
test rejects_wrong_worker ... ok
test rejects_wrong_amount ... ok
test rejects_zero_price_zero_share_and_aggregate_portal_cap ... ok
test rewire_changes_outcome ... ok
test rejects_unreachable_node ... ok
test strict_amounts_and_duplicate_node_keys ... ok
test repeated_worker_with_other_pending_role_returns_not_pending ... ok
test two_machines_different_outcomes ... ok
test validated_machine_persistence_and_staged_resolution_failure ... ok
test zero_fee_never_emits_external_payout ... ok
test vending_exact_amended_allocation ... ok
test splitter_gates_portals_conserve ... ok
test splitter_tree_conserves_every_yocto ... ok

test result: ok. 39 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s

   Doc-tests worldworks_engine

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

```

### Check 2: `cd engine && cargo build --target wasm32-unknown-unknown --release`

```text
   Compiling version_check v0.9.5
   Compiling proc-macro2 v1.0.107
   Compiling unicode-ident v1.0.27
   Compiling typenum v1.20.1
   Compiling quote v1.0.47
   Compiling generic-array v0.14.7
   Compiling serde_core v1.0.229
   Compiling zmij v1.0.23
   Compiling serde_json v1.0.154
   Compiling serde v1.0.229
   Compiling syn v3.0.10
   Compiling block-buffer v0.10.4
   Compiling crypto-common v0.1.7
   Compiling digest v0.10.7
   Compiling itoa v1.0.19
   Compiling memchr v2.8.3
   Compiling cfg-if v1.0.5
   Compiling sha2 v0.10.9
   Compiling serde_derive v1.0.229
   Compiling worldworks-engine v0.1.0 (/data/home/.t3/projects/near-hackathon/engine)
    Finished `release` profile [optimized] target(s) in 5.00s
```

### Check 3: `cd contract && cargo test -- --nocapture`

```text
   Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.80s
     Running unittests src/lib.rs (/opt/ww-target/debug/deps/worldworks_contract-555fe753efde38b6)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/sandbox.rs (/opt/ww-target/debug/deps/sandbox-cc65d5e344bbff8d)

running 1 test
STORAGE deployed initialized contract: 340472 bytes, 3404720000000000000000000 yoctoNEAR
STORAGE vending machine: 1039 bytes, 10390000000000000000000 yoctoNEAR (0.01039000 NEAR)
STORAGE escrow machine: 863 bytes, 8630000000000000000000 yoctoNEAR (0.00863000 NEAR)
PASS a: example machines published with sandbox accounts and bound worker
STORAGE vending order including external record and vault growth: 1426 bytes, 14260000000000000000000 yoctoNEAR (0.01426000 NEAR)
PASS b: exact creator +0.30 NEAR, vault 0.63 NEAR, pending portal fee 0.07 NEAR
STORAGE pending escrow order: 709 bytes, 7090000000000000000000 yoctoNEAR (0.00709000 NEAR)
STORAGE escrow approval growth: -26 bytes, -260000000000000000000 yoctoNEAR (-0.00026000 NEAR)
PASS c: held order, wrong/owner approvals rejected, worker paid seller exactly 1 NEAR, repeat rejected; owner and timed expiry refunded exactly 1 NEAR
PASS d: wrong deposit, duplicate IDs (completed and expired), invalid graph, owner overwrite rejected; views and engine trace verified
PASS e: raw graph view preserved; same account can release two roles on separate calls
test acceptance_sandbox ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 17.04s

   Doc-tests worldworks_contract

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

```
