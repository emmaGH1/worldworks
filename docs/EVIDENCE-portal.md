> Historical evidence: fee, balance and confirmation descriptions below may be superseded. See [G6 current state and acceptance](EVIDENCE-g6.md); zero treasury balance and 1 NEAR fee observations are historical, not current configuration.

# G3 Portal evidence — live signing verified; EVM payout not confirmed

NEAR testnet and Ethereum Sepolia only. No commit or push. No keys in the repo.
Main contract: `ww-portal-261112.testnet`. Portal address:
[0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7](https://sepolia.etherscan.io/address/0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7).
Path `worldworks/portal/sepolia/v1`, signer `v1.signer-prod.testnet`, domain 0.

All local acceptance checks pass. A real 1 NEAR vending order caused the main
contract to build and obtain a genuine MPC signature for a 1000000000000000 wei
Sepolia transfer to `0x000000000000000000000000000000000000dEaD`. Independent
viem recovery matches the stored/derived treasury. Every receipt in the saved
NEAR transaction succeeded (including the NEAR creator payout).

The address has **0 Sepolia wei**. Conditional acceptance check 5 is unperformed,
as expressly permitted by the spec: no broadcast was attempted, no confirmed EVM
transaction/link is claimed. The computed EVM hash in the inspection JSON is
only the hash of the assembled bytes, not proof of broadcast.

Final Wasm: 394737 bytes; SHA-256 `b8b04a862ed87098ab2fac2a3c968d45bac594d091e09fb6a842bda04c3a181b`.
Final artifact deployed in `deploy-verified`; preceding deploy installed the same
behavior before the live order. The final rebuild changed an embedded ABI doc
comment, so it was redeployed and sandbox-tested again; stored signed bytes persist.
Initial deployment predates address-cache support; the public trusted-signer
refresh call filled the cache. Fresh deployments call it automatically at init.

## Explorer links

- [Contract](https://testnet.nearblocks.io/address/ww-portal-261112.testnet)
- [Signer](https://testnet.nearblocks.io/address/v1.signer-prod.testnet)
- [Portal](https://sepolia.etherscan.io/address/0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7)
- [Recipient](https://sepolia.etherscan.io/address/0x000000000000000000000000000000000000dEaD)
- [create-account](https://explorer.testnet.near.org/transactions/C1vcY95srkGZf5ixabVK5PBw6jwEew8TR5riv1M5a4Re)
- [deploy-init](https://explorer.testnet.near.org/transactions/AGvzQTwrbTnGqPjnty7D8S8nBinKdwYtMxreegdNSNxs)
- [deploy-final](https://explorer.testnet.near.org/transactions/C6WVX2FaaZ2TSmkhhJkSD5zvUpA6Z8kAC6Ggzru39Hi3)
- [deploy-verified](https://explorer.testnet.near.org/transactions/4Cq9KQNNu2MstK4CXfwa7u7nzisLWJEvvgoN7ZxZXTus)
- [derive-address](https://explorer.testnet.near.org/transactions/4CCqzaPV7XxB4KxhfE9GuaszDMABi2Y5PjaCsvq4AfU9)
- [publish-vending](https://explorer.testnet.near.org/transactions/6uueugq1ritQTscJjT1SmgTF8wLPmbey9audsxZfawX9)
- [publish-escrow](https://explorer.testnet.near.org/transactions/8aeXXZqMFSYK6mjcFD4xoGfHDopdEfWMdeZTBf1SyoG7)
- [vending-order](https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN)
- [Signer request receipt](https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN#8dWpU882uvedtXCGuYithLDutwja4ZBrZMBXmDQgc6yU)
- [Signer response receipt](https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN#5sJcGdhFremHZs8JRpEeY7Gcm8LiU39n37deMjbhdS43)

## New test coverage

Expanded `acceptance_sandbox` with a separate local mock signer contract:
awaiting state observed by signer; exact payload checked; signed lifecycle;
signer failure; public failure-only retry with identical bytes after fee change;
nonce exactly once; repeated retries/private callbacks rejected; owner/fee bounds;
over-cap rollback; zero-fee no signature; approve/expire each release to Portal;
address derivation/cache. Existing exact NEAR balances, escrow and graph tests
continue passing. Eleven relayer tests use this main contract's public live MPC
signature and cover byte-field tampering, recovered sender, duplicate broadcast,
RPC failures, and wrong-chain rejection. Their complete names/output appear below.

## Full acceptance output

Environment for all Rust commands: `PATH=$HOME/.cargo/bin:$PATH`,
`CARGO_HOME=/opt/ww-cargo-home`, `CARGO_TARGET_DIR=/opt/ww-target`.
No engine or engine-wasm/app/src/engine files were edited. App npm dependencies
were already installed; npm cache for reproduction is `/opt/ww-npm-cache`.
The app's existing typecheck covers src only; the API/scripts are additionally
checked using `tsc -p api/tsconfig.json`. No root app config/package edits needed.

### 1a. cd contract && cargo test -- --nocapture

```text
   Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 2.04s
     Running unittests src/lib.rs (/opt/ww-target/debug/deps/worldworks_contract-0565a401b3e6f795)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/sandbox.rs (/opt/ww-target/debug/deps/sandbox-2e014510b8a61cf3)

running 1 test
STORAGE deployed initialized contract: 395213 bytes, 3952130000000000000000000 yoctoNEAR
STORAGE vending machine: 1038 bytes, 10380000000000000000000 yoctoNEAR (0.01038000 NEAR)
STORAGE escrow machine: 856 bytes, 8560000000000000000000 yoctoNEAR (0.00856000 NEAR)
PASS a: example machines published with sandbox accounts and bound worker
STORAGE vending order including external record and vault growth: 2327 bytes, 23270000000000000000000 yoctoNEAR (0.02327000 NEAR)
PASS b: exact creator +0.30 NEAR, vault 0.63 NEAR, pending portal fee 0.07 NEAR
STORAGE pending escrow order: 702 bytes, 7020000000000000000000 yoctoNEAR (0.00702000 NEAR)
STORAGE escrow approval growth: -26 bytes, -260000000000000000000 yoctoNEAR (-0.00026000 NEAR)
PASS c: held order, wrong/owner approvals rejected, worker paid seller exactly 1 NEAR, repeat rejected; owner and timed expiry refunded exactly 1 NEAR
PASS d: wrong deposit, duplicate IDs (completed and expired), invalid graph, owner overwrite rejected; views and engine trace verified
PASS e: raw graph view preserved; same account can release two roles on separate calls
PASS portal: mock observes awaiting_signature and exact payload; signed; failed -> public retry -> signed with identical bytes despite fee update; nonce once; duplicate retry/private callback/fee authorization/fee bound/over-cap rejected; zero-fee never signs
PASS portal gates: approve and expire each trigger signing on release; derived address cached from signer public key
test acceptance_sandbox ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 27.03s

   Doc-tests worldworks_contract

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s


```

### 1b. cd engine && cargo test

```text
    Blocking waiting for file lock on build directory
    Finished `test` profile [unoptimized + debuginfo] target(s) in 3.56s
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
test iterative_chain_accepts_32_rejects_33_nodes ... ok
test binds_machine_and_persists_held_targets ... ok
test minimum_amount_fail_branch ... ok
test missing_recipient_and_overflow_are_atomic ... ok
test all_amounts_serialize_as_strings_and_state_roundtrips ... ok
test recipient_checked_before_hold_and_identical_approval_targets_rejected ... ok
test json_roundtrip_full_u128 ... ok
test max_amount_and_first_output_remainder ... ok
test near_accounts_and_vault_names_validated ... ok
test rejects_cycle ... ok
test rejects_double_approval ... ok
test rejects_missing_edge_target ... ok
test rejects_missing_worker ... ok
test rejects_multiple_coin_slots ... ok
test rejects_no_coin_slot ... ok
test rejects_non_pending_approval ... ok
test rejects_path_explosion_and_counts_parallel_ports ... ok
test rejects_splitter_output_count ... ok
test rejects_splitter_sum ... ok
test rejects_unconnected_output ... ok
test rejects_unreachable_node ... ok
test rejects_portal_above_cap ... ok
test rejects_unsupported_chain ... ok
test rejects_worker_as_flow_target ... ok
test rejects_wrong_amount ... ok
test rejects_wrong_worker ... ok
test rejects_zero_price_zero_share_and_aggregate_portal_cap ... ok
test rewire_changes_outcome ... ok
test rejects_invalid_worker_scope ... ok
test rejects_duplicate_order ... ok
test repeated_worker_with_other_pending_role_returns_not_pending ... ok
test strict_amounts_and_duplicate_node_keys ... ok
test two_machines_different_outcomes ... ok
test vending_exact_amended_allocation ... ok
test validated_machine_persistence_and_staged_resolution_failure ... ok
test zero_fee_never_emits_external_payout ... ok
test splitter_gates_portals_conserve ... ok
test splitter_tree_conserves_every_yocto ... ok

test result: ok. 39 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.10s

   Doc-tests worldworks_engine

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s


```

### 2. cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml

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
 │     Finished `dev` profile [unoptimized] target(s) in 0.50s
• Extracting ABI...
• done

• Compressing ABI to be embedded..
• done

• Building contract
 │    Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
 │     Finished `release` profile [optimized] target(s) in 2.35s

Modification timestamps of:
 |    "/opt/ww-target/wasm32-unknown-unknown/release/worldworks_contract.wasm" = SystemTime { tv_sec: 1794521327, tv_nsec: 423776743 }
 |    "/opt/ww-target/near/worldworks_contract.wasm" = SystemTime { tv_sec: 1794521171, tv_nsec: 810918463 }

• Running an optimize for size post-step with wasm-opt --enable-nontrapping-float-to-int --enable-bulk-memory...
    Finished wasm-opt -O in 1s 184ms
• done

✓ Contract successfully built! (in CARGO_NEAR_BUILD_ENVIRONMENT=host)
     -                Binary: /opt/ww-target/near/worldworks_contract.wasm
     -                  Size: 394.7 KB (394737 bytes)
     - SHA-256 checksum hex : b8b04a862ed87098ab2fac2a3c968d45bac594d091e09fb6a842bda04c3a181b
     - SHA-256 checksum bs58: DRwvtdFTbXxWyfxRvb3FuDywG9ALB3ni1K1uNLA9UPnz
     -                   ABI: /opt/ww-target/near/worldworks_contract_abi.json
     -          Embedded ABI: /opt/ww-target/near/worldworks_contract_abi.zst
    Finished cargo near build in 4s
Here is the console command if you ever need to re-run it again:
cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml

```

### Prerequisite mock build (command in USAGE.md)

```text
• Collecting cargo project metadata...
• done

• Checking rustc version...
INFO: contract's near-sdk targets protocol version 84; rustc 1.99.0 accepted (bulk-memory opcodes supported by nearcore VM)
• done

• Checking the host environment...
• done

• Building contract
 │    Compiling portal-mock-signer v0.1.0 (/data/home/.t3/projects/near-hackathon/contract/tests/mock-signer)
 │     Finished `release` profile [optimized] target(s) in 0.87s

Modification timestamps of:
 |    "/opt/ww-target/wasm32-unknown-unknown/release/portal_mock_signer.wasm" = SystemTime { tv_sec: 1794521172, tv_nsec: 807362494 }
 |    "/opt/ww-target/portal-mock/portal_mock_signer.wasm" = SystemTime { tv_sec: 1794521143, tv_nsec: 537306149 }

• Running an optimize for size post-step with wasm-opt --enable-nontrapping-float-to-int --enable-bulk-memory...
    Finished wasm-opt -O in 91ms
• done

✓ Contract successfully built! (in CARGO_NEAR_BUILD_ENVIRONMENT=host)
     -                Binary: /opt/ww-target/portal-mock/portal_mock_signer.wasm
     -                  Size: 88.9 KB (88902 bytes)
     - SHA-256 checksum hex : 4f819b6d178ce05eb2c4aedc041d930fe1d9b31fa2e1ee5990b56305eac7730a
     - SHA-256 checksum bs58: 6MMqLKUJ371qcnnp4LCrezj1QJFNVhmBgDcZ3b33Dx7s
    Finished cargo near build in 1s
Here is the console command if you ever need to re-run it again:
cargo near build non-reproducible-wasm --no-abi --out-dir /opt/ww-target/portal-mock --manifest-path contract/tests/mock-signer/Cargo.toml

```

### 3a. cd app && npm run typecheck

```text

> worldworks-app@0.0.0 typecheck
> tsc --noEmit


```

### 3b. cd app && npm run build

```text

> worldworks-app@0.0.0 build
> vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 16 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.71 kB │ gzip:  0.39 kB
dist/assets/index-DjlkXUMa.css    0.96 kB │ gzip:  0.49 kB
dist/assets/index-CZdShAw5.js   219.96 kB │ gzip: 68.85 kB

✓ built in 158ms

```

### 3c. cd app && ./node_modules/.bin/tsc -p api/tsconfig.json (exit 0; empty stdout)

```text

```

### Additional relayer check: tsx --test scripts/relay.test.ts

```text
TAP version 13
# Subtest: live signature recovers contract-derived address and fixes transaction fields
ok 1 - live signature recovers contract-derived address and fixes transaction fields
  ---
  duration_ms: 25.693248
  type: 'test'
  ...
# Subtest: relayer rejects altered recipient
ok 2 - relayer rejects altered recipient
  ---
  duration_ms: 0.30245
  type: 'test'
  ...
# Subtest: relayer rejects altered wei
ok 3 - relayer rejects altered wei
  ---
  duration_ms: 0.10638
  type: 'test'
  ...
# Subtest: relayer rejects altered nonce
ok 4 - relayer rejects altered nonce
  ---
  duration_ms: 0.08979
  type: 'test'
  ...
# Subtest: relayer rejects altered chain_id
ok 5 - relayer rejects altered chain_id
  ---
  duration_ms: 0.10624
  type: 'test'
  ...
# Subtest: relayer rejects altered max_fee_per_gas
ok 6 - relayer rejects altered max_fee_per_gas
  ---
  duration_ms: 0.39328
  type: 'test'
  ...
# Subtest: relayer rejects altered gas_limit
ok 7 - relayer rejects altered gas_limit
  ---
  duration_ms: 0.05819
  type: 'test'
  ...
# Subtest: relayer rejects unsigned payout
ok 8 - relayer rejects unsigned payout
  ---
  duration_ms: 0.07208
  type: 'test'
  ...
# Subtest: broadcast returns deterministic hash and known-transaction rebroadcast is idempotent
ok 9 - broadcast returns deterministic hash and known-transaction rebroadcast is idempotent
  ---
  duration_ms: 1.52662
  type: 'test'
  ...
# Subtest: unaccepted broadcast preserves RPC failure
ok 10 - unaccepted broadcast preserves RPC failure
  ---
  duration_ms: 1.05663
  type: 'test'
  ...
# Subtest: wrong RPC chain cannot broadcast
ok 11 - wrong RPC chain cannot broadcast
  ---
  duration_ms: 0.43241
  type: 'test'
  ...
1..11
# tests 11
# suites 0
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 533.920808

```

### 4. Testnet create-account

```text
├  Your transaction:
│    signer_id:    testnet
│    actions:
│       -- create account:      ww-portal-261112.testnet
│       -- add access key:     
│                       public key:   ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│                       permission:   FullAccess
│     [0m
├  Transaction Execution Info:
│    Transaction ID: C1vcY95srkGZf5ixabVK5PBw6jwEew8TR5riv1M5a4Re
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/C1vcY95srkGZf5ixabVK5PBw6jwEew8TR5riv1M5a4Re
[0m
New account <ww-portal-261112.testnet> created successfully.
The data for the access key is saved in a file /data/home/.near-credentials/testnet/ww-portal-261112.testnet/ed25519_7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV.json
The data for the access key is saved in a file /data/home/.near-credentials/testnet/ww-portal-261112.testnet.json


Here is your console command if you need to script it or re-run:
    [33mnear account create-account sponsor-by-faucet-service ww-portal-261112.testnet autogenerate-new-keypair --signature-scheme ed25519 save-to-legacy-keychain network-config testnet create[39m


```

### 4. Testnet deploy-init

```text
├  Unsigned transaction:
│    signer_id:    ww-portal-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- deploy code <6N4yba7kQNGiSNfvipL5uwVbeSu7NGZP8T7sNQbUaETM> to a account <ww-portal-261112.testnet>
│       -- function call:      
│                       method name:  new
│                       args:         {}
│                       gas:          50.0 Tgas
│                       deposit:      0 NEAR
│     [0m
├  Your transaction was signed successfully.
│    Public key: ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│    Signature:  ed25519:3EbM7p9bccHLeKyE5udrK6n7DivpUVkTuatTZebfgbPorLRd5KypNwLEeq3gwuEC74ordBipdP5zh1anZn76q6sx
│     [0m
├  Transaction Execution Info:
│    Gas used: 30.2 Tgas
│    Transaction fee: 0.0029957120860902 NEAR
│    Transaction ID: AGvzQTwrbTnGqPjnty7D8S8nBinKdwYtMxreegdNSNxs
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/AGvzQTwrbTnGqPjnty7D8S8nBinKdwYtMxreegdNSNxs
│     [0m
├  Function execution logs:
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│     [0m
├  Function execution return value:
│    Empty return value
│     [0m

Contract code has been successfully deployed.
The "new" call to <ww-portal-261112.testnet> on behalf of <ww-portal-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    [33mnear contract deploy ww-portal-261112.testnet use-file /opt/ww-target/near/worldworks_contract.wasm with-init-call new json-args {} prepaid-gas '50.0 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send[39m


```

### 4. Testnet deploy-final

```text
├  Unsigned transaction:
│    signer_id:    ww-portal-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- deploy code <YFKbyWKcTaL8PzTQVHNwH5v98mazmXrWHuAf9txjqx9> to a account <ww-portal-261112.testnet>
│     [0m
├  Your transaction was signed successfully.
│    Public key: ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│    Signature:  ed25519:rvYetDbMe8aaAf5tupxDQ4a4ajztkyjbV2v2sDLp9Wq1YzaDfzEonUvzW4WsS81Vxw7TLdGjRJqzEvW6X3bnuZP
│     [0m
├  Transaction Execution Info:
│    Gas used: 29.0 Tgas
│    Transaction fee: 0.0028767464463483 NEAR
│    Transaction ID: C6WVX2FaaZ2TSmkhhJkSD5zvUpA6Z8kAC6Ggzru39Hi3
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/C6WVX2FaaZ2TSmkhhJkSD5zvUpA6Z8kAC6Ggzru39Hi3
│     [0m

Contract code has been successfully deployed.




Here is your console command if you need to script it or re-run:
    [33mnear contract deploy ww-portal-261112.testnet use-file /opt/ww-target/near/worldworks_contract.wasm without-init-call network-config testnet sign-with-legacy-keychain send[39m


```

### 4. Testnet deploy-verified

```text
├  Unsigned transaction:
│    signer_id:    ww-portal-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- deploy code <DRwvtdFTbXxWyfxRvb3FuDywG9ALB3ni1K1uNLA9UPnz> to a account <ww-portal-261112.testnet>
│     [0m
├  Your transaction was signed successfully.
│    Public key: ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│    Signature:  ed25519:4uTVkecRXjUFa6VLejDjA338TaBLQTi9tXJfEwxSJwiamjuoFWMfRmz4oZWeMCFi1LH6aKPbm8tvw6aLFNJvVRTy
│     [0m
├  Transaction Execution Info:
│    Gas used: 29.0 Tgas
│    Transaction fee: 0.0028764323481991 NEAR
│    Transaction ID: 4Cq9KQNNu2MstK4CXfwa7u7nzisLWJEvvgoN7ZxZXTus
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/4Cq9KQNNu2MstK4CXfwa7u7nzisLWJEvvgoN7ZxZXTus
│     [0m

Contract code has been successfully deployed.




Here is your console command if you need to script it or re-run:
    [33mnear contract deploy ww-portal-261112.testnet use-file /opt/ww-target/near/worldworks_contract.wasm without-init-call network-config testnet sign-with-legacy-keychain send[39m


```

### 4. Testnet derive-address

```text
├  Unsigned transaction:
│    signer_id:    ww-portal-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- function call:      
│                       method name:  refresh_portal_address
│                       args:         {}
│                       gas:          300.0 Tgas
│                       deposit:      0 NEAR
│     [0m
├  Your transaction was signed successfully.
│    Public key: ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│    Signature:  ed25519:36KDL97EC4XtA7fDt7ga43BCeSTzqdTJh2JFRbynRo3t9nhPMcDpU5v1AZ1JqTYXGxLoebqcZ4WQHZxVoCcB5vSC
│     [0m
├  Transaction Execution Info:
│    Gas used: 10.6 Tgas
│    Transaction fee: 0.0009860891804708 NEAR
│    Transaction ID: 4CCqzaPV7XxB4KxhfE9GuaszDMABi2Y5PjaCsvq4AfU9
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/4CCqzaPV7XxB4KxhfE9GuaszDMABi2Y5PjaCsvq4AfU9
│     [0m
├  Function execution logs:
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [v1.signer-prod.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│     [0m
├  Function execution return value:
│    Empty return value
│     [0m


The "refresh_portal_address" call to <ww-portal-261112.testnet> on behalf of <ww-portal-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    [33mnear contract call-function as-transaction ww-portal-261112.testnet refresh_portal_address json-args {} prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as ww-portal-261112.testnet network-config testnet sign-with-legacy-keychain send[39m


```

### 4. Testnet publish-vending

```text
├  Unsigned transaction:
│    signer_id:    ww-portal-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- function call:      
│                       method name:  publish_machine
│                       args:         {
│                                       "expiry_blocks": "100",
│                                       "machine_id": "vending",
│                                       "machine_json": "{\n  \"portal_cap_wei\": \"2000000000000000\",\n  \"nodes\": {\n    \"slot\": {\n      \"type\": \"CoinSlot\",\n      \"price\": \"1000000000000000000000000\",\n      \"output\": \"fees\"\n    },\n    \"fees\": {\n      \"type\": \"Splitter\",\n      \"outputs\": [\n        {\n          \"bps\": 7000,\n          \"target\": \"reserve_fee\"\n        },\n        {\n          \"bps\": 3000,\n          \"target\": \"creator\"\n        }\n      ]\n    },\n    \"reserve_fee\": {\n      \"type\": \"Splitter\",\n      \"outputs\": [\n        {\n          \"bps\": 9000,\n          \"target\": \"reserve\"\n        },\n        {\n          \"bps\": 1000,\n          \"target\": \"delivery\"\n        }\n      ]\n    },\n    \"reserve\": {\n      \"type\": \"Vault\",\n      \"name\": \"reserve\"\n    },\n    \"creator\": {\n      \"type\": \"Payout\",\n      \"account\": \"creator.testnet\"\n    },\n    \"portal\": {\n      \"type\": \"Portal\",\n      \"chain\": \"sepolia\",\n      \"wei\": \"1000000000000000\"\n    },\n    \"delivery\": {\n      \"type\": \"Gate\",\n      \"condition\": {\n        \"type\": \"MinAmount\",\n        \"amount\": \"0\"\n      },\n      \"pass\": \"portal\",\n      \"fail\": \"portal\"\n    }\n  }\n}\n",
│                                       "workers": {}
│                                     }
│                       gas:          300.0 Tgas
│                       deposit:      0 NEAR
│     [0m
├  Your transaction was signed successfully.
│    Public key: ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│    Signature:  ed25519:63RQJz2emBjzwh6MergVwDGrM87s9pbQcc75Pk6H7Zh6Fe68W5CZ3McFeEqx6m4jXR6y8S9z3Ln6CkZyfBUAgY8L
│     [0m
├  Transaction Execution Info:
│    Gas used: 2.9 Tgas
│    Transaction fee: 0.0002658649630558 NEAR
│    Transaction ID: 6uueugq1ritQTscJjT1SmgTF8wLPmbey9audsxZfawX9
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/6uueugq1ritQTscJjT1SmgTF8wLPmbey9audsxZfawX9
│     [0m
├  Function execution logs:
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│     [0m
├  Function execution return value:
│    Empty return value
│     [0m


The "publish_machine" call to <ww-portal-261112.testnet> on behalf of <ww-portal-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    [33mnear contract call-function as-transaction ww-portal-261112.testnet publish_machine json-args '{"machine_id": "vending", "machine_json": "{\n  \"portal_cap_wei\": \"2000000000000000\",\n  \"nodes\": {\n    \"slot\": {\n      \"type\": \"CoinSlot\",\n      \"price\": \"1000000000000000000000000\",\n      \"output\": \"fees\"\n    },\n    \"fees\": {\n      \"type\": \"Splitter\",\n      \"outputs\": [\n        {\n          \"bps\": 7000,\n          \"target\": \"reserve_fee\"\n        },\n        {\n          \"bps\": 3000,\n          \"target\": \"creator\"\n        }\n      ]\n    },\n    \"reserve_fee\": {\n      \"type\": \"Splitter\",\n      \"outputs\": [\n        {\n          \"bps\": 9000,\n          \"target\": \"reserve\"\n        },\n        {\n          \"bps\": 1000,\n          \"target\": \"delivery\"\n        }\n      ]\n    },\n    \"reserve\": {\n      \"type\": \"Vault\",\n      \"name\": \"reserve\"\n    },\n    \"creator\": {\n      \"type\": \"Payout\",\n      \"account\": \"creator.testnet\"\n    },\n    \"portal\": {\n      \"type\": \"Portal\",\n      \"chain\": \"sepolia\",\n      \"wei\": \"1000000000000000\"\n    },\n    \"delivery\": {\n      \"type\": \"Gate\",\n      \"condition\": {\n        \"type\": \"MinAmount\",\n        \"amount\": \"0\"\n      },\n      \"pass\": \"portal\",\n      \"fail\": \"portal\"\n    }\n  }\n}\n", "workers": {}, "expiry_blocks": "100"}' prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as ww-portal-261112.testnet network-config testnet sign-with-legacy-keychain send[39m


```

### 4. Testnet publish-escrow

```text
├  Unsigned transaction:
│    signer_id:    ww-portal-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- function call:      
│                       method name:  publish_machine
│                       args:         {
│                                       "expiry_blocks": "100",
│                                       "machine_id": "escrow",
│                                       "machine_json": "{\n  \"portal_cap_wei\":\"0\",\n  \"nodes\": {\n    \"slot\":{\"type\":\"CoinSlot\",\"price\":\"1000000000000000000000000\",\"output\":\"review\"},\n    \"review\":{\"type\":\"Gate\",\"condition\":{\"type\":\"NeedsApproval\",\"worker\":\"inspector\"},\"pass\":\"seller\",\"fail\":\"refund\"},\n    \"inspector\":{\"type\":\"Worker\",\"gates\":[\"review\"]},\n    \"seller\":{\"type\":\"Payout\",\"account\":\"seller.testnet\"},\n    \"refund\":{\"type\":\"Payout\",\"account\":\"$payer\"}\n  }\n}\n",
│                                       "workers": {
│                                         "inspector": "ww-portal-261112.testnet"
│                                       }
│                                     }
│                       gas:          300.0 Tgas
│                       deposit:      0 NEAR
│     [0m
├  Your transaction was signed successfully.
│    Public key: ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│    Signature:  ed25519:5tM99rVkQaC4R6a5PRcEU8eTDwJ2oDbvn7EyY8Cd4hQx2TXqH8nzdPS7NuNvJ9Y9Hto4ej75sYdciNf8xLnBVdjH
│     [0m
├  Transaction Execution Info:
│    Gas used: 2.7 Tgas
│    Transaction fee: 0.000241980947051 NEAR
│    Transaction ID: 8aeXXZqMFSYK6mjcFD4xoGfHDopdEfWMdeZTBf1SyoG7
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/8aeXXZqMFSYK6mjcFD4xoGfHDopdEfWMdeZTBf1SyoG7
│     [0m
├  Function execution logs:
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│     [0m
├  Function execution return value:
│    Empty return value
│     [0m


The "publish_machine" call to <ww-portal-261112.testnet> on behalf of <ww-portal-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    [33mnear contract call-function as-transaction ww-portal-261112.testnet publish_machine json-args '{"machine_id": "escrow", "machine_json": "{\n  \"portal_cap_wei\":\"0\",\n  \"nodes\": {\n    \"slot\":{\"type\":\"CoinSlot\",\"price\":\"1000000000000000000000000\",\"output\":\"review\"},\n    \"review\":{\"type\":\"Gate\",\"condition\":{\"type\":\"NeedsApproval\",\"worker\":\"inspector\"},\"pass\":\"seller\",\"fail\":\"refund\"},\n    \"inspector\":{\"type\":\"Worker\",\"gates\":[\"review\"]},\n    \"seller\":{\"type\":\"Payout\",\"account\":\"seller.testnet\"},\n    \"refund\":{\"type\":\"Payout\",\"account\":\"$payer\"}\n  }\n}\n", "workers": {"inspector": "ww-portal-261112.testnet"}, "expiry_blocks": "100"}' prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' sign-as ww-portal-261112.testnet network-config testnet sign-with-legacy-keychain send[39m


```

### 4. Testnet vending-order

```text
├  Unsigned transaction:
│    signer_id:    ww-portal-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- function call:      
│                       method name:  submit_order
│                       args:         {
│                                       "external_recipient": "0x000000000000000000000000000000000000dEaD",
│                                       "machine_id": "vending",
│                                       "order_id": "portal-live-1"
│                                     }
│                       gas:          300.0 Tgas
│                       deposit:      1 NEAR
│     [0m
├  Your transaction was signed successfully.
│    Public key: ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│    Signature:  ed25519:4P8QZphozx2gue6fWu2ZehWg8shF8x8RRBnHNUVTfJhpYxikkqNzLihKsHYugFJqFr27LkRBtC81HyYe7MKDHDba
│     [0m
├  Transaction Execution Info:
│    Gas used: 16.7 Tgas
│    Transaction fee: 0.0015510375196014 NEAR
│    Transaction ID: 5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN
│     [0m
├  Function execution logs:
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [v1.signer-prod.testnet]:[39m
│      sign: predecessor=AccountId("ww-portal-261112.testnet"), request=SignRequestArgs { path: "worldworks/portal/sepolia/v1", payload: Ecdsa(BoundedVec { inner: [122, 73, 45, 72, 51, 34, 76, 10, 124, 234, 139, 112, 92, 174, 207, 118, 197, 83, 52, 149, 88, 81, 254, 153, 136, 233, 176, 59, 37, 84, 242, 111], witness: NonEmpty(()) }), domain_id: DomainId(0) }
│    [36mLogs [v1.signer-prod.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [creator.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│    [36mLogs [ww-portal-261112.testnet]:[39m   [2mNo logs[0m
│     [0m
├  Function execution return value:
│    Empty return value
│     [0m


The "submit_order" call to <ww-portal-261112.testnet> on behalf of <ww-portal-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    [33mnear contract call-function as-transaction ww-portal-261112.testnet submit_order json-args '{"machine_id": "vending", "order_id": "portal-live-1", "external_recipient": "0x000000000000000000000000000000000000dEaD"}' prepaid-gas '300.0 Tgas' attached-deposit '1 NEAR' sign-as ww-portal-261112.testnet network-config testnet sign-with-legacy-keychain send[39m


```

### 4–5. tsx scripts/inspect-portal.ts: get_payout, address, balance, signature recovery

```text
{
  "account": "ww-portal-261112.testnet",
  "address": "0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7",
  "stored_address": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "balance": "0",
  "chainId": 11155111,
  "payout": {
    "payout_id": "0",
    "machine_id": "vending",
    "order_id": "portal-live-1",
    "recipient": "0x000000000000000000000000000000000000dEaD",
    "wei": "1000000000000000",
    "fee": "70000000000000000000000",
    "nonce": 0,
    "chain_id": 11155111,
    "max_fee_per_gas": "20000000000",
    "max_priority_fee_per_gas": "1000000000",
    "gas_limit": 21000,
    "unsigned_tx": [
      2,
      242,
      131,
      170,
      54,
      167,
      128,
      132,
      59,
      154,
      202,
      0,
      133,
      4,
      168,
      23,
      200,
      0,
      130,
      82,
      8,
      148,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      222,
      173,
      135,
      3,
      141,
      126,
      164,
      198,
      128,
      0,
      128,
      192
    ],
    "payload": [
      122,
      73,
      45,
      72,
      51,
      34,
      76,
      10,
      124,
      234,
      139,
      112,
      92,
      174,
      207,
      118,
      197,
      83,
      52,
      149,
      88,
      81,
      254,
      153,
      136,
      233,
      176,
      59,
      37,
      84,
      242,
      111
    ],
    "signature_json": "{\"scheme\":\"Secp256k1\",\"big_r\":{\"affine_point\":\"028dc180aadd5471434efa688040e3e797bf6e8d569a2d924fd07c157528bdae34\"},\"s\":{\"scalar\":\"0dbd088b07a531ac21b388f9bda8fc93d0eb223e145e9b12f45a8337025c4070\"},\"recovery_id\":1}",
    "status": "signed"
  },
  "raw_signed_tx": "0x02f87583aa36a780843b9aca008504a817c80082520894000000000000000000000000000000000000dead87038d7ea4c6800080c001a08dc180aadd5471434efa688040e3e797bf6e8d569a2d924fd07c157528bdae34a00dbd088b07a531ac21b388f9bda8fc93d0eb223e145e9b12f45a8337025c4070",
  "recovered": "0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7",
  "evm_tx_hash": "0xbf2a7ae14ef28044ce775f9c18ed0c6294ffe916aac1f84653253b51f9d0a3e6"
}

```
## NEEDS USER / not done

1. Fund **Sepolia**, not mainnet: **0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7**.
   Approximately 0.003 test ETH is enough for the reserved 0.001 ETH transfer plus
   up to 0.00042 ETH gas at its signed fee cap. This is a different address from
   the isolated probe address the user was funding.
2. After funding, run the CLI relayer for payout `0`, capture its hash and successful
   Sepolia receipt/explorer link, and verify from/to/value. Live RPC acceptance,
   live duplicate rebroadcast and EVM confirmation remain unverified; mocked
   acceptance/idempotency tests pass. No failed check is represented as a pass.
3. Vercel source handler is implemented; hosting deployment was outside this spec.
4. Production limits remain: unpaginated histories/storage, no NEAR transfer recovery,
   no EVM fee replacement/cancellation, full-access NEAR deployment key can redeploy,
   and graph releases must fit the caller's gas. See contract/USAGE.md.

Resume (no keys needed):

```sh
cd app
PORTAL_CONTRACT=ww-portal-261112.testnet npm exec --cache /opt/ww-npm-cache --package=tsx -- tsx scripts/relay.ts 0
```
