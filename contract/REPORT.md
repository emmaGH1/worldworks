# G2a implementation report

**NOT fully accepted:** checks 1–3 pass; check 4's literal clean-scope condition
is not satisfied by the shared workspace. Unrelated changes were present at
entry and additional files changed concurrently. They were not edited or
cleaned up by this implementation task. No secrets were added; a scan of
contract files for NEAR private keys, PEM private keys and GitHub tokens found
no matches. This is a scoped scan, not an audit of unrelated files.

## Files

Created: `contract/Cargo.toml`, `contract/Cargo.lock`, `contract/src/lib.rs`,
`contract/tests/sandbox.rs`, `contract/USAGE.md`, `contract/REPORT.md`, and
`contract/evidence/check1.txt` through `check4.txt`.

Changed: `engine/src/lib.rs`, only adding `Serialize, Deserialize` derives to
`State` and its private `Order` and `Held` types. This allows the host to persist
pending engine state between transactions. No engine rule or existing test was
changed by this task. All 26 existing engine tests pass.

Wasm: `/opt/ww-target/near/worldworks_contract.wasm`, **291140 bytes**.
Rust 1.99 and the default cargo-near Wasm flags work; no toolchain override.
The lockfile resolves near-sdk 5.28.3, near-workspaces 0.22.4.

## Measured storage

At 10^19 yoctoNEAR per byte, the measured sandbox account storage_usage deltas
are:

- Vending machine: 838 bytes = 0.00838 NEAR.
- Escrow machine: 653 bytes = 0.00653 NEAR.
- Vending order, including pending external record and vault growth: 1275 bytes
  = 0.01275 NEAR.
- Pending escrow order: 518 bytes = 0.00518 NEAR.
- Approval delta: -3 bytes = -0.00003 NEAR (storage shrinks).
- Shared initialized deployed contract: 291377 bytes = 2.91377 NEAR.

These are storage stakes, separate from gas. Actual sizes depend on graph,
identifier and trace lengths. No extra storage deposit is charged to callers.

A sub-account deploying this same interpreter would need roughly the measured
2.91 NEAR code/account base plus machine state: about 2.92 NEAR per vending
machine versus 0.00838 NEAR incremental storage on the shared contract. That is
reasonable for a few funded testnet demonstrations but too expensive for many
sponsored machines compared with shared state. This is an estimate from measured
shared-deployment storage, not a measured per-machine sub-account deployment;
no per-machine sub-account factory was implemented.

## Not done / limitations

- Check 4 does not meet its literal overall-workspace condition; unrelated
  files remain outside allowed paths. No unrelated work was removed.
- No testnet accounts, deployment or network transactions. Only local sandbox
  transactions were sent; Cargo downloaded build dependencies.
- No Chain Signatures call, ETH payout, relayer, UI, or per-machine sub-account.
  The private `request_external_signature` seam is unreachable and explicitly
  unimplemented; external records honestly remain `awaiting_signature`.
- No commit or push. Excluded research/, HACKATHON.md and root README.md untouched.
- No production quotas, pagination or pruning. Storage needs prefunding;
  external record lists grow with use.
- No callback retry/recovery for failed asynchronous NEAR transfers. Sandbox
  payout destinations exist and every receipt is checked for success. A deleted
  payout destination can still cause an asynchronous failure in future use.
- Expiry requires an explicit call; no background scheduling.

## Acceptance checks: complete stdout/stderr

Environment for checks 1–3:
`PATH=$HOME/.cargo/bin:$PATH CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target`.

### Check 1

`cd contract && cargo near build non-reproducible-wasm; stat -c '%n: %s bytes' /opt/ww-target/near/worldworks_contract.wasm`

```text
• Collecting cargo project metadata...
• done

• Checking rustc version...
INFO: contract's near-sdk targets protocol version 84; rustc 1.99.0 accepted (bulk-memory opcodes supported by nearcore VM)
• done

• Checking the host environment...
• done

• Generating ABI
 │    Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
 │     Finished `dev` profile [unoptimized] target(s) in 0.53s
• Extracting ABI...
• done

• Compressing ABI to be embedded..
• done

• Building contract
 │    Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
 │     Finished `release` profile [optimized] target(s) in 1.84s

Modification timestamps of:
 |    "/opt/ww-target/wasm32-unknown-unknown/release/worldworks_contract.wasm" = SystemTime { tv_sec: 1794520112, tv_nsec: 683732345 }
 |    "/opt/ww-target/near/worldworks_contract.wasm" = SystemTime { tv_sec: 1794520067, tv_nsec: 262999550 }

• Running an optimize for size post-step with wasm-opt --enable-nontrapping-float-to-int --enable-bulk-memory...
    Finished wasm-opt -O in 854ms
• done

✓ Contract successfully built! (in CARGO_NEAR_BUILD_ENVIRONMENT=host)
     -                Binary: /opt/ww-target/near/worldworks_contract.wasm
     -                  Size: 291.1 KB (291140 bytes)
     - SHA-256 checksum hex : 1cdff7a5226bc8d5d0dd6c8df90ab26d3e1f730586b08e719e4e93b44a6e94ef
     - SHA-256 checksum bs58: 2wiVcq1evULxYPDKNhWW1UmQPesv7pC1shemShmdB67G
     -                   ABI: /opt/ww-target/near/worldworks_contract_abi.json
     -          Embedded ABI: /opt/ww-target/near/worldworks_contract_abi.zst
    Finished cargo near build in 4s
Here is the console command if you ever need to re-run it again:
cargo near build non-reproducible-wasm
/opt/ww-target/near/worldworks_contract.wasm: 291140 bytes
```

### Check 2

`cd contract && cargo test -- --nocapture`

```text
   Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.03s
     Running unittests src/lib.rs (/opt/ww-target/debug/deps/worldworks_contract-96bf954a080ee440)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/sandbox.rs (/opt/ww-target/debug/deps/sandbox-593f5a3e4d2b090b)

running 1 test
STORAGE deployed initialized contract: 291377 bytes, 2913770000000000000000000 yoctoNEAR
STORAGE vending machine: 838 bytes, 8380000000000000000000 yoctoNEAR (0.00838000 NEAR)
STORAGE escrow machine: 653 bytes, 6530000000000000000000 yoctoNEAR (0.00653000 NEAR)
PASS a: example machines published with sandbox accounts and bound worker
STORAGE vending order including external record and vault growth: 1275 bytes, 12750000000000000000000 yoctoNEAR (0.01275000 NEAR)
PASS b: exact creator +0.30 NEAR, vault 0.63 NEAR, pending portal fee 0.07 NEAR
STORAGE pending escrow order: 518 bytes, 5180000000000000000000 yoctoNEAR (0.00518000 NEAR)
STORAGE escrow approval growth: -3 bytes, -30000000000000000000 yoctoNEAR (-0.00003000 NEAR)
PASS c: held order, wrong/owner approvals rejected, worker paid seller exactly 1 NEAR, repeat rejected; owner and timed expiry refunded exactly 1 NEAR
PASS d: wrong deposit, duplicate IDs (completed and expired), invalid graph, owner overwrite rejected; views and engine trace verified
test acceptance_sandbox ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 14.83s

   Doc-tests worldworks_contract

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

```

### Check 3

`cd engine && cargo test`

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.02s
     Running unittests src/lib.rs (/opt/ww-target/debug/deps/worldworks_engine-3fbaf511104c2710)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/engine.rs (/opt/ww-target/debug/deps/engine-360102d516e9f20c)

running 26 tests
test expiry_refunds_payer_and_rejects_later_approval ... ok
test json_roundtrip_full_u128 ... ok
test max_amount_and_first_output_remainder ... ok
test rejects_cycle ... ok
test missing_recipient_and_overflow_are_atomic ... ok
test rejects_double_approval ... ok
test minimum_amount_fail_branch ... ok
test rejects_invalid_worker_scope ... ok
test rejects_missing_edge_target ... ok
test rejects_duplicate_order ... ok
test rejects_missing_worker ... ok
test rejects_no_coin_slot ... ok
test rejects_multiple_coin_slots ... ok
test rejects_portal_above_cap ... ok
test rejects_non_pending_approval ... ok
test rejects_splitter_sum ... ok
test rejects_unconnected_output ... ok
test rejects_unreachable_node ... ok
test rejects_splitter_output_count ... ok
test rejects_worker_as_flow_target ... ok
test rejects_wrong_amount ... ok
test rejects_wrong_worker ... ok
test rejects_unsupported_chain ... ok
test rewire_changes_outcome ... ok
test two_machines_different_outcomes ... ok
test splitter_tree_conserves_every_yocto ... ok

test result: ok. 26 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s

   Doc-tests worldworks_engine

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

```

### Check 4

`git status --short`

```text
 M STATUS.md
 M docs/OPERATING.md
?? contract/
?? docs/design/
?? probes/
?? specs/G1-fix.md
?? specs/G2b-chainsig-probe.md
?? specs/T1-app-scaffold.md
```

