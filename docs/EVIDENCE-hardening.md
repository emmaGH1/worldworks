> Historical evidence: fee, balance and confirmation descriptions below may be superseded. See [G6 current state and acceptance](EVIDENCE-g6.md); zero treasury balance and 1 NEAR fee observations are historical, not current configuration.

# G5 hardening evidence — required acceptance checks pass

Testnet only. No commits or pushes. No app or engine files edited by this task.
Build environment: `PATH=$HOME/.cargo/bin:$PATH`, `CARGO_HOME=/opt/ww-cargo-home`,
`CARGO_TARGET_DIR=/opt/ww-target`.

Portal address, independently re-derived from the live signer's key and recovered
from the new signature: **0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7**.
Same account, signer, domain and path. Pre-deployment cache verification appears
first in the live transcript. Deployed artifact matches the local SHA-256/code hash.

All 40 engine tests and both sandbox integration tests pass. Sandbox covers every
G5 acceptance scenario; additionally checks a complete G3 snapshot migration,
failed-signature retry and private callbacks. Stale attempt callbacks are invoked
from the contract account in sandbox and asserted to leave the record unchanged.
200 historical payout entries and a lost callback are injected via sandbox-only
state patching; no test hooks exist in deployed production code. The callback is
record-local and the machine JSON is unchanged.

Storage measured in the final sandbox run: publish vending **1022 bytes**, signed
vending order **2183 bytes**. *(Superseded fee: G4b used 0.77 NEAR, G6 uses 1.32 NEAR; see [EVIDENCE-g6.md](EVIDENCE-g6.md).)* Order fee is a conservative fixed **1 test NEAR**
(100,000 bytes at current byte price); example orders now attach **2 NEAR**.
Publication measures actual bytes and refunds excess. The example 0.1 NEAR publish
deposit is sufficient. Signature records, future traces and recovery credits have
headroom rather than relying on free treasury storage.

## Live transactions

- [deploy-migrate](https://explorer.testnet.near.org/transactions/2A3aCVdCejYXiwyV4BHB1c9UkGKnFiMyEB63G5s6WKL1)
- [publish-vending](https://explorer.testnet.near.org/transactions/6VXbwjjJDY5VSkrmHZWkGdw4ngEAHuFYn1XxZjxWqrz7)
- [publish-escrow](https://explorer.testnet.near.org/transactions/GXbzjAMd3uWiCPLGFwQ4vPagb2uzHARk2AisDKhgJhfp)
- [live-order](https://explorer.testnet.near.org/transactions/EinsGGeGAnaMEYhdGLodeNU7fv8jkWptTQbA64PvVhBn)

Deployment used atomic `deploy + migrate_g3`, not delete/recreate. Complete public
snapshots and migration arguments are in `contract/evidence/hardening-*.json`.
Seven original machines, six orders, all four prior reserved nonces/signatures,
2.52 NEAR in vaults and 1 NEAR held escrow were preserved at migration. All prior
payout values consume the first epoch budget conservatively. Existing immutable
IDs remain intact; exact vending.json and escrow.json are republished under
`vending-g5` and `escrow-g5`, with separate publisher/owner and escrow worker
`ww-chainsig-261112.testnet`. New order `g5-live-1`, payout/nonce **4**, is **signed**;
recipient `0x000000000000000000000000000000000000dEaD`, value 1000000000000000 wei.
The recovered sender matches the unchanged derived address. The creator received
0.30 NEAR, Vault received 0.63 NEAR and Portal inflow was 0.07 NEAR.

Init/migration policy: separate fee owner `ww-chainsig-261112.testnet`, rate
1000000 yoctoNEAR/wei, 1000-block epochs, budget 10000000000000000 wei, max payout
2000000000000000 wei, signature timeout 200 blocks; new payouts snapshot 100 gwei
max / 1 gwei priority, bounded by 100/10 gwei. Other than snapshot fees, admission
parameters are immutable. `get_limits` is authoritative for current epoch budget.

## Interface changes for the app

See the complete [interface section](../contract/USAGE.md#interface-changes-for-the-app).
Required adapter changes: attach measured publish storage deposit (0.1 NEAR for
examples), attach price + 1 NEAR order fee (superseded: 1.32 NEAR since G6), enforce ID/node bounds, replace owner
immediate expiry with block-height eligibility, read payout records via payout
views rather than `get_machine.external_payouts`, and support timed awaiting retry.
Add `get_limits`, `get_liabilities`, `get_unclaimed(account)`,
`withdraw_unclaimed()`, `withdraw_vault(machine_id,vault_name,amount)` and
`get_portal_queue(evm_next_nonce?)`. Queue status is unknown on NEAR: consult
Sepolia nonce/receipts. Init now requires separate owner and five safety parameters
(the fee config remains optional). All numeric new arguments use decimal strings.
Private callback signature now includes attempt_id; the app must not invoke it.
The separate admin calls bounded `set_portal_fees`; publisher controls its Vault.

## Explicitly not done / remaining limitations

- `scripts/lock-contract.sh` was **NOT run**, as instructed. Syntax check passes.
  The full-access key remains; deployment is **NOT immutable**. Only after manual
  final locking and an empty `view_access_key_list` may immutability be claimed.
- `app/` integration, app tests/build, UI changes and hosting were not performed
  by this task. Another agent's changes in app/ and STATUS.md were left alone.
- No Sepolia broadcast, receipt or confirmed payment is claimed by this task;
  G5 requires live signing, which passed. No mainnet operation occurred.
- Legacy pending escrow and contract-owned vaults were preserved, not drained or
  resolved. Resolve/withdraw contract-owned legacy funds before eventual key lock
  if desired; separate-owner G5 machines can still withdraw after lock.
- No per-machine EVM treasury, nonce replacement/cancellation, storage pruning,
  automatic ETH refilling or trustworthy on-NEAR broadcast tracking. An early
  stuck nonce or exhausted ETH can block later payouts despite high fee snapshots.
- NEAR transfer recovery requires its callback to execute; no timeout recovery for
  a lost transfer callback. Signature callbacks do have timeout retries.
- No commit, push or account deletion/recreation. The original machine IDs were
  retained; republished examples use -g5 IDs to preserve existing immutable data.

## Full, unabridged acceptance output

ANSI terminal color escapes removed for readability. Raw files are retained under
`contract/evidence/`. Every final required check below exited 0.

### 1a. cd engine && cargo test

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.04s
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
test binds_machine_and_persists_held_targets ... ok
test iterative_chain_accepts_32_rejects_33_nodes ... ok
test all_amounts_serialize_as_strings_and_state_roundtrips ... ok
test json_roundtrip_full_u128 ... ok
test minimum_amount_fail_branch ... ok
test missing_recipient_and_overflow_are_atomic ... ok
test max_amount_and_first_output_remainder ... ok
test rejects_cycle ... ok
test rejects_double_approval ... ok
test recipient_checked_before_hold_and_identical_approval_targets_rejected ... ok
test rejects_invalid_worker_scope ... ok
test near_accounts_and_vault_names_validated ... ok
test rejects_missing_worker ... ok
test rejects_duplicate_order ... ok
test rejects_multiple_coin_slots ... ok
test rejects_missing_edge_target ... ok
test rejects_no_coin_slot ... ok
test rejects_non_pending_approval ... ok
test rejects_portal_above_cap ... ok
test rejects_splitter_output_count ... ok
test rejects_path_explosion_and_counts_parallel_ports ... ok
test rejects_splitter_sum ... ok
test rejects_unconnected_output ... ok
test rejects_unreachable_node ... ok
test rejects_unsupported_chain ... ok
test rejects_worker_as_flow_target ... ok
test rejects_wrong_amount ... ok
test rejects_wrong_worker ... ok
test rejects_zero_price_zero_share_and_aggregate_portal_cap ... ok
test rewire_changes_outcome ... ok
test strict_amounts_and_duplicate_node_keys ... ok
test repeated_worker_with_other_pending_role_returns_not_pending ... ok
test two_machines_different_outcomes ... ok
test validated_machine_persistence_and_staged_resolution_failure ... ok
test zero_fee_never_emits_external_payout ... ok
test vending_exact_amended_allocation ... ok
test splitter_gates_portals_conserve ... ok
test splitter_tree_conserves_every_yocto ... ok

test result: ok. 39 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s

   Doc-tests worldworks_engine

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
```

### 1b. cd contract && cargo test -- --nocapture

```text
   Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.18s
     Running unittests src/lib.rs (/opt/ww-target/debug/deps/worldworks_contract-0565a401b3e6f795)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/sandbox.rs (/opt/ww-target/debug/deps/sandbox-2e014510b8a61cf3)

running 2 tests
STORAGE publish vending: 1022 bytes
PASS drain rejected atomically; publish deposit and order fee required
PASS full G3 snapshot migration: nonce 4 preserved, payout bytes/signature unchanged, vaults 2520000000000000000000000, held 1000000000000000000000000, repeated migration rejected
test migrates_full_g3_snapshot_without_nonce_or_liability_loss ... ok
STORAGE signed vending order: 2183 bytes (fee covers 100000 bytes)
PASS callback with 200 historical payouts; machine unchanged; stuck retry identical bytes and nonce; private callback rejected
PASS signer failure -> signature_failed -> retry -> signed, identical payload/nonce/bytes
PASS epoch budget exhaustion rejected
PASS multiple Portal / zero wei / >4 transfers / cap rejected at publish
PASS vault owner only; early expiry rejected even owner; timed expiry; escrow liabilities
test hardening_sandbox has been running for over 60 seconds
PASS failed transfer -> unclaimed -> withdraw exactly once
PASS separate fee owner; finished hardening sandbox
test hardening_sandbox ... ok

test result: ok. 2 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 61.51s

   Doc-tests worldworks_contract

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
 │     Finished `dev` profile [unoptimized] target(s) in 0.43s
• Extracting ABI...
• done

• Compressing ABI to be embedded..
• done

• Building contract
 │    Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
 │     Finished `release` profile [optimized] target(s) in 2.62s

Modification timestamps of:
 |    "/opt/ww-target/wasm32-unknown-unknown/release/worldworks_contract.wasm" = SystemTime { tv_sec: 1794522522, tv_nsec: 676453195 }
 |    "/opt/ww-target/near/worldworks_contract.wasm" = SystemTime { tv_sec: 1794522491, tv_nsec: 762568778 }

• Running an optimize for size post-step with wasm-opt --enable-nontrapping-float-to-int --enable-bulk-memory...
    Finished wasm-opt -O in 1s 190ms
• done

✓ Contract successfully built! (in CARGO_NEAR_BUILD_ENVIRONMENT=host)
     -                Binary: /opt/ww-target/near/worldworks_contract.wasm
     -                  Size: 424.9 KB (424933 bytes)
     - SHA-256 checksum hex : 997fb3007ff358829be173486048e2d0889b6fc89dc90ca5b0f59f2b44249219
     - SHA-256 checksum bs58: BLCKJgUKF1aawUcWVW2DjFVgAZzQZpkdr3i6xxZ9RDua
     -                   ABI: /opt/ww-target/near/worldworks_contract_abi.json
     -          Embedded ABI: /opt/ww-target/near/worldworks_contract_abi.zst
    Finished cargo near build in 4s
Here is the console command if you ever need to re-run it again:
cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml
```

### 3. Address check, atomic deploy/migrate, publish both examples, live signed order and state views

```text
PRE-DEPLOY ADDRESS: 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7
deploy-migrate 0 ├  Unsigned transaction:
│    signer_id:    ww-portal-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- deploy code <BLCKJgUKF1aawUcWVW2DjFVgAZzQZpkdr3i6xxZ9RDua> to a account <ww-portal-261112.testnet>
│       -- function call:      
│                       method name:  migrate_g3
│                       args:         {
│                                       "epoch_blocks": "1000",
│                                       "epoch_budget_wei": "10000000000000000",
│                                       "machine_ids": [
│                                         "escrow",
│                                         "vending",
│                                         "g4-escrow-mwe405yi",
│                                         "g4-escrow-mwe439jt",
│                                         "g4-vending-mwe3z7oy",
│                                         "g4-vending-mwe405yi",
│                                         "g4-vending-mwe439jt"
│                                       ],
│                                       "max_wei_per_payout": "2000000000000000",
│                                       "min_fee_yocto_per_wei": "1000000",
│                                       "order_keys": [
│                                         [
│                                           "vending",
│                                           "portal-live-1"
│                                         ],
│                                         [
│                                           "g4-escrow-mwe405yi",
│                                           "4cc78832-1108-40fb-92c6-2346352f61b8"
│                                         ],
│                                         [
│                                           "g4-escrow-mwe439jt",
│                                           "fb020c26-45f3-441b-b875-d66ff66d1fb7"
│                                         ],
│                                         [
│                                           "g4-vending-mwe405yi",
│                                           "2d1cb4d4-2c97-44db-801b-bd085ccf91b0"
│                                         ],
│                                         [
│                                           "g4-vending-mwe439jt",
│                                           "2e692aba-6804-49d5-8deb-3778b53dffac"
│                                         ],
│                                         [
│                                           "g4-vending-mwe439jt",
│                                           "939fb9b8-c8a6-43a5-90fc-7fb0cb48878b"
│                                         ]
│                                       ],
│                                       "owner_id": "ww-chainsig-261112.testnet",
│                                       "signature_timeout_blocks": "200"
│                                     }
│                       gas:          300.0 Tgas
│                       deposit:      0 NEAR
│     
├  Your transaction was signed successfully.
│    Public key: ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV
│    Signature:  ed25519:2nbX4GSoar9Lx3drAGbyZQhneqE8i9PCdfFtsgankd5BBjVW4stYmDhxf2VYqRifRU2Rmq6wVL28EGzTZBfLAeJT
│     
├  Transaction Execution Info:
│    Gas used: 48.8 Tgas
│    Transaction fee: 0.0048038676180177 NEAR
│    Transaction ID: 2A3aCVdCejYXiwyV4BHB1c9UkGKnFiMyEB63G5s6WKL1
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/2A3aCVdCejYXiwyV4BHB1c9UkGKnFiMyEB63G5s6WKL1
│     
├  Function execution logs:
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [v1.signer-prod.testnet]:   No logs
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-portal-261112.testnet]:   No logs
│     
├  Function execution return value:
│    Empty return value
│     

Contract code has been successfully deployed.
The "migrate_g3" call to <ww-portal-261112.testnet> on behalf of <ww-portal-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    near contract deploy ww-portal-261112.testnet use-file /opt/ww-target/near/worldworks_contract.wasm with-init-call migrate_g3 json-args '{"owner_id": "ww-chainsig-261112.testnet", "min_fee_yocto_per_wei": "1000000", "epoch_blocks": "1000", "epoch_budget_wei": "10000000000000000", "max_wei_per_payout": "2000000000000000", "signature_timeout_blocks": "200", "machine_ids": ["escrow", "vending", "g4-escrow-mwe405yi", "g4-escrow-mwe439jt", "g4-vending-mwe3z7oy", "g4-vending-mwe405yi", "g4-vending-mwe439jt"], "order_keys": [["vending", "portal-live-1"], ["g4-escrow-mwe405yi", "4cc78832-1108-40fb-92c6-2346352f61b8"], ["g4-escrow-mwe439jt", "fb020c26-45f3-441b-b875-d66ff66d1fb7"], ["g4-vending-mwe405yi", "2d1cb4d4-2c97-44db-801b-bd085ccf91b0"], ["g4-vending-mwe439jt", "2e692aba-6804-49d5-8deb-3778b53dffac"], ["g4-vending-mwe439jt", "939fb9b8-c8a6-43a5-90fc-7fb0cb48878b"]]}' prepaid-gas '300.0 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send


POST-MIGRATION ADDRESS: 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7
publish-vending 0 ├  Unsigned transaction:
│    signer_id:    ww-chainsig-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- function call:      
│                       method name:  publish_machine
│                       args:         {
│                                       "expiry_blocks": "100",
│                                       "machine_id": "vending-g5",
│                                       "machine_json": "{\n  \"portal_cap_wei\": \"2000000000000000\",\n  \"nodes\": {\n    \"slot\": {\n      \"type\": \"CoinSlot\",\n      \"price\": \"1000000000000000000000000\",\n      \"output\": \"fees\"\n    },\n    \"fees\": {\n      \"type\": \"Splitter\",\n      \"outputs\": [\n        {\n          \"bps\": 7000,\n          \"target\": \"reserve_fee\"\n        },\n        {\n          \"bps\": 3000,\n          \"target\": \"creator\"\n        }\n      ]\n    },\n    \"reserve_fee\": {\n      \"type\": \"Splitter\",\n      \"outputs\": [\n        {\n          \"bps\": 9000,\n          \"target\": \"reserve\"\n        },\n        {\n          \"bps\": 1000,\n          \"target\": \"delivery\"\n        }\n      ]\n    },\n    \"reserve\": {\n      \"type\": \"Vault\",\n      \"name\": \"reserve\"\n    },\n    \"creator\": {\n      \"type\": \"Payout\",\n      \"account\": \"creator.testnet\"\n    },\n    \"portal\": {\n      \"type\": \"Portal\",\n      \"chain\": \"sepolia\",\n      \"wei\": \"1000000000000000\"\n    },\n    \"delivery\": {\n      \"type\": \"Gate\",\n      \"condition\": {\n        \"type\": \"MinAmount\",\n        \"amount\": \"0\"\n      },\n      \"pass\": \"portal\",\n      \"fail\": \"portal\"\n    }\n  }\n}\n",
│                                       "workers": {}
│                                     }
│                       gas:          300.0 Tgas
│                       deposit:      0.1 NEAR
│     
├  Your transaction was signed successfully.
│    Public key: ed25519:BrGDitH2mh1VGDezr5NZV2FDG7dtwW6Xpua8CKT5BLMX
│    Signature:  ed25519:4rrz7k59CizsJg4o6cBRb9Lb3mKgiZSzQT7amhMJ2Y8KVzbeLBKgN8KadPWC7XH9NyfaozZH2pkvGzbC3xJZ3mmo
│     
├  Transaction Execution Info:
│    Gas used: 6.0 Tgas
│    Transaction fee: 0.0005311430859312 NEAR
│    Transaction ID: 6VXbwjjJDY5VSkrmHZWkGdw4ngEAHuFYn1XxZjxWqrz7
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/6VXbwjjJDY5VSkrmHZWkGdw4ngEAHuFYn1XxZjxWqrz7
│     
├  Function execution logs:
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│     
├  Function execution return value:
│    Empty return value
│     


The "publish_machine" call to <ww-portal-261112.testnet> on behalf of <ww-chainsig-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    near contract call-function as-transaction ww-portal-261112.testnet publish_machine json-args '{"machine_id": "vending-g5", "machine_json": "{\n  \"portal_cap_wei\": \"2000000000000000\",\n  \"nodes\": {\n    \"slot\": {\n      \"type\": \"CoinSlot\",\n      \"price\": \"1000000000000000000000000\",\n      \"output\": \"fees\"\n    },\n    \"fees\": {\n      \"type\": \"Splitter\",\n      \"outputs\": [\n        {\n          \"bps\": 7000,\n          \"target\": \"reserve_fee\"\n        },\n        {\n          \"bps\": 3000,\n          \"target\": \"creator\"\n        }\n      ]\n    },\n    \"reserve_fee\": {\n      \"type\": \"Splitter\",\n      \"outputs\": [\n        {\n          \"bps\": 9000,\n          \"target\": \"reserve\"\n        },\n        {\n          \"bps\": 1000,\n          \"target\": \"delivery\"\n        }\n      ]\n    },\n    \"reserve\": {\n      \"type\": \"Vault\",\n      \"name\": \"reserve\"\n    },\n    \"creator\": {\n      \"type\": \"Payout\",\n      \"account\": \"creator.testnet\"\n    },\n    \"portal\": {\n      \"type\": \"Portal\",\n      \"chain\": \"sepolia\",\n      \"wei\": \"1000000000000000\"\n    },\n    \"delivery\": {\n      \"type\": \"Gate\",\n      \"condition\": {\n        \"type\": \"MinAmount\",\n        \"amount\": \"0\"\n      },\n      \"pass\": \"portal\",\n      \"fail\": \"portal\"\n    }\n  }\n}\n", "workers": {}, "expiry_blocks": "100"}' prepaid-gas '300.0 Tgas' attached-deposit '0.1 NEAR' sign-as ww-chainsig-261112.testnet network-config testnet sign-with-legacy-keychain send


publish-escrow 0 ├  Unsigned transaction:
│    signer_id:    ww-chainsig-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- function call:      
│                       method name:  publish_machine
│                       args:         {
│                                       "expiry_blocks": "100",
│                                       "machine_id": "escrow-g5",
│                                       "machine_json": "{\n  \"portal_cap_wei\":\"0\",\n  \"nodes\": {\n    \"slot\":{\"type\":\"CoinSlot\",\"price\":\"1000000000000000000000000\",\"output\":\"review\"},\n    \"review\":{\"type\":\"Gate\",\"condition\":{\"type\":\"NeedsApproval\",\"worker\":\"inspector\"},\"pass\":\"seller\",\"fail\":\"refund\"},\n    \"inspector\":{\"type\":\"Worker\",\"gates\":[\"review\"]},\n    \"seller\":{\"type\":\"Payout\",\"account\":\"seller.testnet\"},\n    \"refund\":{\"type\":\"Payout\",\"account\":\"$payer\"}\n  }\n}\n",
│                                       "workers": {
│                                         "inspector": "ww-chainsig-261112.testnet"
│                                       }
│                                     }
│                       gas:          300.0 Tgas
│                       deposit:      0.1 NEAR
│     
├  Your transaction was signed successfully.
│    Public key: ed25519:BrGDitH2mh1VGDezr5NZV2FDG7dtwW6Xpua8CKT5BLMX
│    Signature:  ed25519:7GgM8gUouXwyFnP6wMGMCXvtDqKJbE7PiyP4od7tmMtZxB78qSRZLTHG5UBeHK9os3pBQfzAJv3YDpbmrBKCwh3
│     
├  Transaction Execution Info:
│    Gas used: 5.8 Tgas
│    Transaction fee: 0.0005033744301987 NEAR
│    Transaction ID: GXbzjAMd3uWiCPLGFwQ4vPagb2uzHARk2AisDKhgJhfp
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/GXbzjAMd3uWiCPLGFwQ4vPagb2uzHARk2AisDKhgJhfp
│     
├  Function execution logs:
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│     
├  Function execution return value:
│    Empty return value
│     


The "publish_machine" call to <ww-portal-261112.testnet> on behalf of <ww-chainsig-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    near contract call-function as-transaction ww-portal-261112.testnet publish_machine json-args '{"machine_id": "escrow-g5", "machine_json": "{\n  \"portal_cap_wei\":\"0\",\n  \"nodes\": {\n    \"slot\":{\"type\":\"CoinSlot\",\"price\":\"1000000000000000000000000\",\"output\":\"review\"},\n    \"review\":{\"type\":\"Gate\",\"condition\":{\"type\":\"NeedsApproval\",\"worker\":\"inspector\"},\"pass\":\"seller\",\"fail\":\"refund\"},\n    \"inspector\":{\"type\":\"Worker\",\"gates\":[\"review\"]},\n    \"seller\":{\"type\":\"Payout\",\"account\":\"seller.testnet\"},\n    \"refund\":{\"type\":\"Payout\",\"account\":\"$payer\"}\n  }\n}\n", "workers": {"inspector": "ww-chainsig-261112.testnet"}, "expiry_blocks": "100"}' prepaid-gas '300.0 Tgas' attached-deposit '0.1 NEAR' sign-as ww-chainsig-261112.testnet network-config testnet sign-with-legacy-keychain send


live-order 0 ├  Unsigned transaction:
│    signer_id:    ww-chainsig-261112.testnet
│    receiver_id:  ww-portal-261112.testnet
│    actions:
│       -- function call:      
│                       method name:  submit_order
│                       args:         {
│                                       "external_recipient": "0x000000000000000000000000000000000000dEaD",
│                                       "machine_id": "vending-g5",
│                                       "order_id": "g5-live-1"
│                                     }
│                       gas:          300.0 Tgas
│                       deposit:      2 NEAR
│     
├  Your transaction was signed successfully.
│    Public key: ed25519:BrGDitH2mh1VGDezr5NZV2FDG7dtwW6Xpua8CKT5BLMX
│    Signature:  ed25519:sqjFu4kViYNNKWVW4GsDGNr6DfHGUBrbvRq1kRCgb4GfmZtWykrrocb3Lr91MMPyMg1DhuBfEnb927ittrJ8ufQ
│     
├  Transaction Execution Info:
│    Gas used: 18.4 Tgas
│    Transaction fee: 0.0017060901233677 NEAR
│    Transaction ID: EinsGGeGAnaMEYhdGLodeNU7fv8jkWptTQbA64PvVhBn
│    To see the transaction in the transaction explorer, please open this url in your browser:
│    https://explorer.testnet.near.org/transactions/EinsGGeGAnaMEYhdGLodeNU7fv8jkWptTQbA64PvVhBn
│     
├  Function execution logs:
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [v1.signer-prod.testnet]:
│      sign: predecessor=AccountId("ww-portal-261112.testnet"), request=SignRequestArgs { path: "worldworks/portal/sepolia/v1", payload: Ecdsa(BoundedVec { inner: [212, 230, 205, 82, 126, 114, 15, 239, 123, 205, 82, 85, 1, 184, 11, 37, 55, 135, 160, 14, 185, 160, 199, 79, 50, 221, 160, 64, 162, 164, 94, 245], witness: NonEmpty(()) }), domain_id: DomainId(0) }
│    Logs [v1.signer-prod.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [creator.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-portal-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│    Logs [ww-chainsig-261112.testnet]:   No logs
│     
├  Function execution return value:
│    Empty return value
│     


The "submit_order" call to <ww-portal-261112.testnet> on behalf of <ww-chainsig-261112.testnet> succeeded.




Here is your console command if you need to script it or re-run:
    near contract call-function as-transaction ww-portal-261112.testnet submit_order json-args '{"machine_id": "vending-g5", "order_id": "g5-live-1", "external_recipient": "0x000000000000000000000000000000000000dEaD"}' prepaid-gas '300.0 Tgas' attached-deposit '2 NEAR' sign-as ww-chainsig-261112.testnet network-config testnet sign-with-legacy-keychain send


{
  "address": "0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7",
  "payout": {
    "attempt_id": "0",
    "requested_at": "277424931",
    "payout_id": "4",
    "machine_id": "vending-g5",
    "order_id": "g5-live-1",
    "recipient": "0x000000000000000000000000000000000000dEaD",
    "wei": "1000000000000000",
    "fee": "70000000000000000000000",
    "nonce": 4,
    "chain_id": 11155111,
    "max_fee_per_gas": "100000000000",
    "max_priority_fee_per_gas": "1000000000",
    "gas_limit": 21000,
    "unsigned_tx": [
      2,
      242,
      131,
      170,
      54,
      167,
      4,
      132,
      59,
      154,
      202,
      0,
      133,
      23,
      72,
      118,
      232,
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
      212,
      230,
      205,
      82,
      126,
      114,
      15,
      239,
      123,
      205,
      82,
      85,
      1,
      184,
      11,
      37,
      55,
      135,
      160,
      14,
      185,
      160,
      199,
      79,
      50,
      221,
      160,
      64,
      162,
      164,
      94,
      245
    ],
    "signature_json": "{\"scheme\":\"Secp256k1\",\"big_r\":{\"affine_point\":\"032244767a2db45b2be1c246087e74053fc6d9127cc0cfc4ce9631e60e525c286a\"},\"s\":{\"scalar\":\"3870bab5a754ff83171dea31df8570109bf3a136293a99d7a4d92f7a2b7fdb69\"},\"recovery_id\":1}",
    "status": "signed"
  },
  "limits": {
    "owner_id": "ww-chainsig-261112.testnet",
    "min_fee_yocto_per_wei": "1000000",
    "epoch_blocks": "1000",
    "epoch_budget_wei": "10000000000000000",
    "remaining_budget_wei": "5000000000000000",
    "max_wei_per_payout": "2000000000000000",
    "signature_timeout_blocks": "200",
    "order_storage_fee": "1000000000000000000000000"
  },
  "liabilities": {
    "escrow": "1000000000000000000000000",
    "vaults": "3150000000000000000000000",
    "unclaimed": "0",
    "in_flight": "0",
    "balance": "14500922268891165699999995"
  },
  "queue": {
    "next_nonce": "5",
    "oldest_unbroadcast_payout": {
      "attempt_id": "0",
      "requested_at": "0",
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
    "broadcast_status": "unknown_on_near; compare with Sepolia transaction count"
  }
}
```

### 3b. Independent signer derivation and live signature recovery

```text
{
  "derived_address": "0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7",
  "recovered_signature_address": "0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7",
  "payout_id": "4",
  "status": "signed",
  "machine_id": "vending-g5",
  "order_id": "g5-live-1",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "nonce": 4
}
```

### 3c. Deployed artifact identity and remaining access keys

```text
{
  "wasm_bytes": 424933,
  "sha256": "997fb3007ff358829be173486048e2d0889b6fc89dc90ca5b0f59f2b44249219",
  "deployed_code_hash": "BLCKJgUKF1aawUcWVW2DjFVgAZzQZpkdr3i6xxZ9RDua",
  "hash_matches": true,
  "access_keys": [
    {
      "access_key": {
        "nonce": 277422209000008,
        "permission": "FullAccess"
      },
      "public_key": "ed25519:7veGHXKESDkzRC6xWKLcYvrqvMENntHVetR6Yu43egEV"
    }
  ],
  "immutable": false
}
```

### Additional. Lock script syntax only

```text
lock-contract.sh syntax check: exit 0; script NOT executed
```

### Additional. Whitespace check

```text
git diff --check: exit 0
```
