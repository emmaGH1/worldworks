use anyhow::Result;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract};
use serde_json::{json, Value};
const PRICE: u128 = 1_000_000_000_000_000_000_000_000;
const FEE: u128 = worldworks_contract::ORDER_STORAGE_FEE;
async fn call(a: &Account, c: &Contract, m: &str, v: Value, d: u128) -> Result<()> {
    let r = a
        .call(c.id(), m)
        .args_json(v)
        .deposit(NearToken::from_yoctonear(d))
        .max_gas()
        .transact()
        .await?;
    assert!(r.failures().is_empty(), "{m}: {r:#?}");
    r.into_result()?;
    Ok(())
}
async fn reject(a: &Account, c: &Contract, m: &str, v: Value, d: u128, error: &str) -> Result<()> {
    let r = a
        .call(c.id(), m)
        .args_json(v)
        .deposit(NearToken::from_yoctonear(d))
        .max_gas()
        .transact()
        .await?;
    assert!(
        r.is_failure() && format!("{r:?}").contains(error),
        "expected {error}: {r:#?}"
    );
    Ok(())
}
async fn view(c: &Contract, m: &str, v: Value) -> Result<Value> {
    Ok(c.view(m).args_json(v).await?.json()?)
}
fn publish(id: &str, m: &Value) -> Value {
    json!({"machine_id":id,"machine_json":m.to_string(),"workers":{},"expiry_blocks":"100"})
}
fn order(id: &str, o: &str) -> Value {
    json!({"machine_id":id,"order_id":o,"external_recipient":"0x1111111111111111111111111111111111111111"})
}
fn borsh_string(s: &str) -> Vec<u8> {
    let mut b = (s.len() as u32).to_le_bytes().to_vec();
    b.extend(s.as_bytes());
    b
}
#[tokio::test]
async fn hardening_sandbox() -> Result<()> {
    let w = near_workspaces::sandbox().await?;
    let c = w
        .dev_deploy(&std::fs::read(
            "/opt/ww-target/near/worldworks_contract.wasm",
        )?)
        .await?;
    let mock = w
        .dev_deploy(&std::fs::read(
            "/opt/ww-target/portal-mock/portal_mock_signer.wasm",
        )?)
        .await?;
    let owner = w.dev_create_account().await?;
    let buyer = w.dev_create_account().await?;
    call(mock.as_account(), &mock, "new", json!({}), 0).await?;
    let init = json!({"owner_id":owner.id(),"min_fee_yocto_per_wei":"1000000","epoch_blocks":"100000","epoch_budget_wei":"6200000000000000","max_wei_per_payout":"2000000000000000","signature_timeout_blocks":"100","portal_config":{"signer":mock.id(),"cap_wei":"2000000000000000","max_fee_per_gas":"100000000000","max_priority_fee_per_gas":"1000000000","fee_upper_bound":"100000000000","priority_upper_bound":"10000000000"}});
    call(c.as_account(), &c, "new", init, 0).await?;
    let mut vending: Value =
        serde_json::from_str(include_str!("../../engine/examples/vending.json"))?;
    vending["nodes"]["creator"]["account"] = json!(owner.id());
    reject(
        &owner,
        &c,
        "publish_machine",
        publish("vending", &vending),
        0,
        "insufficient publish storage deposit",
    )
    .await?;
    let base = c.view_account().await?.storage_usage;
    call(
        &owner,
        &c,
        "publish_machine",
        publish("vending", &vending),
        PRICE,
    )
    .await?;
    println!(
        "STORAGE publish vending: {} bytes",
        c.view_account().await?.storage_usage - base
    );
    reject(
        &buyer,
        &c,
        "submit_order",
        order("vending", "no-fee"),
        PRICE,
        "order storage fee required",
    )
    .await?;
    reject(
        &buyer,
        &c,
        "submit_order",
        order("vending", "wrong-price"),
        PRICE + FEE - 1,
        "WrongAmount",
    )
    .await?;
    let mut drain = json!({"portal_cap_wei":"1000000000000000","nodes":{"slot":{"type":"CoinSlot","price":"1","output":"portal"},"portal":{"type":"Portal","chain":"sepolia","wei":"1000000000000000"}}});
    reject(
        &owner,
        &c,
        "publish_machine",
        publish("drain", &drain),
        PRICE,
        "Portal rate rule",
    )
    .await?;
    assert_eq!(view(&c, "get_portal_nonce", json!({})).await?, "0");
    println!("PASS drain rejected atomically; publish deposit and order fee required");
    let before = c.view_account().await?.storage_usage;
    call(
        &buyer,
        &c,
        "submit_order",
        order("vending", "1"),
        PRICE + FEE,
    )
    .await?;
    println!(
        "STORAGE signed vending order: {} bytes (G4b fee)",
        c.view_account().await?.storage_usage - before
    );
    let p = view(&c, "get_payout", json!({"payout_id":"0"})).await?;
    assert_eq!(p["status"], "signed");
    let records = view(
        &c,
        "get_pending_external_payouts",
        json!({"machine_id":"vending"}),
    )
    .await?;
    for field in ["recipient", "machine_id", "order_id"] {
        assert_eq!(records[0][field], p[field]);
    }
    assert_eq!(records[0]["machine_id"], "vending");
    assert_eq!(records[0]["order_id"], "1");
    assert_eq!(
        records[0]["recipient"],
        "0x1111111111111111111111111111111111111111"
    );
    // Sandbox-only state patch: 200 historical records, then simulate a lost callback.
    // No test hooks are exported by the production contract.
    for i in 1..=200 {
        let mut history = p.clone();
        history["payout_id"] = json!(i.to_string());
        let mut k = b"p".to_vec();
        k.extend(borsh_string(&i.to_string()));
        w.patch_state(c.id(), &k, &borsh_string(&history.to_string()))
            .await?;
    }
    let machine_before = view(&c, "get_machine", json!({"machine_id":"vending"})).await?;
    let mut stuck = p.clone();
    stuck["status"] = json!("awaiting_signature");
    stuck["signature_json"] = Value::Null;
    stuck["requested_at"] = json!("0");
    let mut key = b"p".to_vec();
    key.extend(borsh_string("0"));
    w.patch_state(c.id(), &key, &borsh_string(&stuck.to_string()))
        .await?;
    w.fast_forward(101).await?;
    reject(
        &buyer,
        &c,
        "on_signature",
        json!({"payout_id":"0","attempt_id":"0"}),
        0,
        "private",
    )
    .await?;
    let counter_before = view(&c, "get_portal_nonce", json!({})).await?;
    call(&buyer, &c, "retry_signature", json!({"payout_id":"0"}), 0).await?;
    assert_eq!(
        view(&c, "get_portal_nonce", json!({})).await?,
        counter_before
    );
    let retried = view(&c, "get_payout", json!({"payout_id":"0"})).await?;
    assert_eq!(retried["status"], "signed");
    assert_eq!(retried["attempt_id"], "1");
    call(
        c.as_account(),
        &c,
        "on_signature",
        json!({"payout_id":"0","attempt_id":"0"}),
        0,
    )
    .await?;
    assert_eq!(
        view(&c, "get_payout", json!({"payout_id":"0"})).await?,
        retried
    );
    for f in ["payload", "unsigned_tx", "nonce"] {
        assert_eq!(p[f], retried[f]);
    }
    assert_eq!(
        view(&c, "get_machine", json!({"machine_id":"vending"})).await?,
        machine_before
    );
    println!("PASS callback with 200 historical payouts; machine unchanged; stuck retry identical bytes and nonce; private callback rejected");
    call(
        mock.as_account(),
        &mock,
        "configure",
        json!({"fail":true,"id":"1"}),
        0,
    )
    .await?;
    let failed = buyer
        .call(c.id(), "submit_order")
        .args_json(order("vending", "2"))
        .deposit(NearToken::from_yoctonear(PRICE + FEE))
        .max_gas()
        .transact()
        .await?;
    failed.into_result()?;
    let failed_before = view(&c, "get_payout", json!({"payout_id":"1"})).await?;
    assert_eq!(failed_before["status"], "signature_failed");
    call(
        mock.as_account(),
        &mock,
        "configure",
        json!({"fail":false,"id":"1"}),
        0,
    )
    .await?;
    call(&buyer, &c, "retry_signature", json!({"payout_id":"1"}), 0).await?;
    let failed_after = view(&c, "get_payout", json!({"payout_id":"1"})).await?;
    assert_eq!(failed_after["status"], "signed");
    for field in ["payload", "unsigned_tx", "nonce"] {
        assert_eq!(failed_before[field], failed_after[field]);
    }
    println!(
        "PASS signer failure -> signature_failed -> retry -> signed, identical payload/nonce/bytes"
    );
    reject(
        &buyer,
        &c,
        "submit_order",
        order("vending", "3"),
        PRICE + FEE,
        "epoch budget exhausted",
    )
    .await?;
    println!("PASS epoch budget exhaustion rejected");
    drain["nodes"]["portal"]["wei"] = json!("0");
    reject(
        &owner,
        &c,
        "publish_machine",
        publish("zero", &drain),
        PRICE,
        "zero wei Portal",
    )
    .await?;
    let multiple = json!({"portal_cap_wei":"2000000000000000","nodes":{"slot":{"type":"CoinSlot","price":"1","output":"gate"},"gate":{"type":"Gate","condition":{"type":"MinAmount","amount":"1"},"pass":"a","fail":"b"},"a":{"type":"Portal","chain":"sepolia","wei":"1"},"b":{"type":"Portal","chain":"sepolia","wei":"1"}}});
    reject(
        &owner,
        &c,
        "publish_machine",
        publish("multiple", &multiple),
        PRICE,
        "one Portal node maximum",
    )
    .await?;
    let many = json!({"portal_cap_wei":"0","nodes":{"slot":{"type":"CoinSlot","price":"100","output":"a"},"a":{"type":"Splitter","outputs":[{"bps":5000,"target":"b"},{"bps":5000,"target":"b"}]},"b":{"type":"Splitter","outputs":[{"bps":5000,"target":"c"},{"bps":5000,"target":"c"}]},"c":{"type":"Splitter","outputs":[{"bps":5000,"target":"p"},{"bps":5000,"target":"p"}]},"p":{"type":"Payout","account":"$payer"}}});
    reject(
        &owner,
        &c,
        "publish_machine",
        publish("many", &many),
        PRICE,
        "resolution effect limit",
    )
    .await?;
    let mut over = vending.clone();
    over["portal_cap_wei"] = json!("3000000000000000");
    reject(
        &owner,
        &c,
        "publish_machine",
        publish("over", &over),
        PRICE,
        "portal cap exceeded",
    )
    .await?;
    println!("PASS multiple Portal / zero wei / >4 transfers / cap rejected at publish");
    reject(
        &buyer,
        &c,
        "withdraw_vault",
        json!({"machine_id":"vending","vault_name":"reserve","amount":"1"}),
        0,
        "machine owner only",
    )
    .await?;
    call(
        &owner,
        &c,
        "withdraw_vault",
        json!({"machine_id":"vending","vault_name":"reserve","amount":"1"}),
        0,
    )
    .await?;
    let mut escrow: Value =
        serde_json::from_str(include_str!("../../engine/examples/escrow.json"))?;
    escrow["nodes"]["seller"]["account"] = json!(owner.id());
    let mut ea = publish("escrow", &escrow);
    ea["workers"] = json!({"inspector":owner.id()});
    call(&owner, &c, "publish_machine", ea, PRICE).await?;
    call(
        &buyer,
        &c,
        "submit_order",
        order("escrow", "1"),
        PRICE + FEE,
    )
    .await?;
    assert_eq!(
        view(&c, "get_liabilities", json!({})).await?["escrow"],
        PRICE.to_string()
    );
    reject(
        &owner,
        &c,
        "expire",
        order("escrow", "1"),
        0,
        "order has not expired",
    )
    .await?;
    w.fast_forward(101).await?;
    call(&buyer, &c, "expire", order("escrow", "1"), 0).await?;
    assert_eq!(view(&c, "get_liabilities", json!({})).await?["escrow"], "0");
    println!(
        "PASS vault owner only; early expiry rejected even owner; timed expiry; escrow liabilities"
    );
    // A deleted implicit account cannot receive a small transfer (< creation minimum),
    // then recreate it to exercise real failed transfer recovery and a successful withdrawal.
    let missing = w.dev_create_account().await?;
    let missing_id = missing.id().clone();
    missing
        .clone()
        .delete_account(owner.id())
        .await?
        .into_result()?;
    let fail = json!({"portal_cap_wei":"0","nodes":{"slot":{"type":"CoinSlot","price":"1","output":"p"},"p":{"type":"Payout","account":missing_id}}});
    call(
        &owner,
        &c,
        "publish_machine",
        publish("failed", &fail),
        PRICE,
    )
    .await?;
    let r = buyer
        .call(c.id(), "submit_order")
        .args_json(order("failed", "1"))
        .deposit(NearToken::from_yoctonear(FEE + 1))
        .max_gas()
        .transact()
        .await?;
    r.into_result()?;
    assert_eq!(
        view(&c, "get_unclaimed", json!({"account":missing_id})).await?,
        "1"
    );
    // Recreate original sandbox subaccount using its parent root and original key.
    let root = w.root_account()?;
    let name = missing_id.as_str().split('.').next().unwrap();
    let recreated = root
        .create_subaccount(name)
        .initial_balance(NearToken::from_near(2))
        .keys(missing.secret_key().clone())
        .transact()
        .await?
        .into_result()?;
    call(&recreated, &c, "withdraw_unclaimed", json!({}), 0).await?;
    assert_eq!(
        view(&c, "get_unclaimed", json!({"account":missing_id})).await?,
        "0"
    );
    reject(
        &recreated,
        &c,
        "withdraw_unclaimed",
        json!({}),
        0,
        "nothing unclaimed",
    )
    .await?;
    println!("PASS failed transfer -> unclaimed -> withdraw exactly once");
    reject(
        c.as_account(),
        &c,
        "set_portal_fees",
        json!({"max_fee_per_gas":"1","max_priority_fee_per_gas":"0"}),
        0,
        "owner only",
    )
    .await?;
    call(
        &owner,
        &c,
        "set_portal_fees",
        json!({"max_fee_per_gas":"50000000000","max_priority_fee_per_gas":"1000000000"}),
        0,
    )
    .await?;
    let nonce_before = view(&c, "get_portal_nonce", json!({})).await?;
    let liabilities_before = view(&c, "get_liabilities", json!({})).await?;
    let payout_before = view(&c, "get_payout", json!({"payout_id":"0"})).await?;
    reject(&buyer, &c, "migrate_g4b", json!({}), 0, "private").await?;
    call(c.as_account(), &c, "migrate_g4b", json!({}), 0).await?;
    assert_eq!(view(&c, "get_portal_nonce", json!({})).await?, nonce_before);
    assert_eq!(
        view(&c, "get_payout", json!({"payout_id":"0"})).await?,
        payout_before
    );
    let liabilities_after = view(&c, "get_liabilities", json!({})).await?;
    for field in ["escrow", "vaults", "unclaimed", "in_flight"] {
        assert_eq!(liabilities_before[field], liabilities_after[field]);
    }
    reject(
        c.as_account(),
        &c,
        "migrate_g4b",
        json!({}),
        0,
        "already migrated",
    )
    .await?;
    println!("PASS G4b same-layout migration preserves nonce, signed payout and liabilities; private and one-time");
    println!("PASS separate fee owner; finished hardening sandbox");
    Ok(())
}

#[tokio::test]
async fn migrates_full_g3_snapshot_without_nonce_or_liability_loss() -> Result<()> {
    use near_sdk::base64::{engine::general_purpose::STANDARD, Engine};
    let w = near_workspaces::sandbox().await?;
    let c = w
        .dev_deploy(&std::fs::read(
            "/opt/ww-target/near/worldworks_contract.wasm",
        )?)
        .await?;
    let snapshot: Value =
        serde_json::from_str(include_str!("../evidence/hardening-legacy-state.json"))?;
    let mut machines = vec![];
    let mut orders = vec![];
    let mut vaults = 0u128;
    let mut held = 0u128;
    for entry in snapshot["result"]["values"].as_array().unwrap() {
        let k = STANDARD.decode(entry["key"].as_str().unwrap())?;
        let v = STANDARD.decode(entry["value"].as_str().unwrap())?;
        w.patch_state(c.id(), &k, &v).await?;
        if k[0] == b'm' {
            let id = String::from_utf8(k[5..].to_vec())?;
            machines.push(id);
            let m: Value = serde_json::from_slice(&v[4..])?;
            for a in m["vaults"].as_object().unwrap().values() {
                vaults += a.as_str().unwrap().parse::<u128>()?;
            }
        }
        if k[0] == b'o' {
            let n = u32::from_le_bytes(k[1..5].try_into()?) as usize;
            orders.push((
                String::from_utf8(k[5..5 + n].to_vec())?,
                String::from_utf8(k[9 + n..].to_vec())?,
            ));
            let o: Value = serde_json::from_slice(&v[4..])?;
            for order in o["engine_state"]["orders"].as_object().unwrap().values() {
                for flow in order["held"].as_array().unwrap() {
                    held += flow["amount"].as_str().unwrap().parse::<u128>()?;
                }
            }
        }
    }
    let old: Value = snapshot["result"]["values"]
        .as_array()
        .unwrap()
        .iter()
        .find_map(|e| {
            let k = STANDARD.decode(e["key"].as_str().unwrap()).unwrap();
            if k == [b'p', 1, 0, 0, 0, b'0'] {
                let v = STANDARD.decode(e["value"].as_str().unwrap()).unwrap();
                Some(serde_json::from_slice(&v[4..]).unwrap())
            } else {
                None
            }
        })
        .unwrap();
    let args = json!({"owner_id":w.root_account()?.id(),"min_fee_yocto_per_wei":"1000000","epoch_blocks":"1000","epoch_budget_wei":"10000000000000000","max_wei_per_payout":"2000000000000000","signature_timeout_blocks":"200","machine_ids":machines,"order_keys":orders});
    // Live signer is absent in sandbox: detached address refresh may fail; stored cache remains.
    let r = c
        .call("migrate_g3")
        .args_json(args.clone())
        .max_gas()
        .transact()
        .await?;
    r.into_result()?;
    let after = view(&c, "get_payout", json!({"payout_id":"0"})).await?;
    for f in ["payload", "unsigned_tx", "nonce", "signature_json"] {
        assert_eq!(old[f], after[f]);
    }
    assert_eq!(view(&c, "get_portal_nonce", json!({})).await?, "4");
    let liabilities = view(&c, "get_liabilities", json!({})).await?;
    assert_eq!(liabilities["escrow"], held.to_string());
    assert_eq!(liabilities["vaults"], vaults.to_string());
    reject(
        c.as_account(),
        &c,
        "migrate_g3",
        args,
        0,
        "already migrated",
    )
    .await?;
    println!("PASS full G3 snapshot migration: nonce 4 preserved, payout bytes/signature unchanged, vaults {vaults}, held {held}, repeated migration rejected");
    Ok(())
}

#[tokio::test]
async fn storage_envelope() -> Result<()> {
    let w = near_workspaces::sandbox().await?;
    let c = w
        .dev_deploy(&std::fs::read(
            "/opt/ww-target/near/worldworks_contract.wasm",
        )?)
        .await?;
    let mock = w
        .dev_deploy(&std::fs::read(
            "/opt/ww-target/portal-mock/portal_mock_signer.wasm",
        )?)
        .await?;
    let owner = w.dev_create_account().await?;
    call(mock.as_account(), &mock, "new", json!({}), 0).await?;
    call(c.as_account(), &c, "new", json!({"owner_id":owner.id(),"min_fee_yocto_per_wei":"1","epoch_blocks":"100000","epoch_budget_wei":"10000000000000000","max_wei_per_payout":"2000000000000000","signature_timeout_blocks":"100","portal_config":{"signer":mock.id(),"cap_wei":"2000000000000000","max_fee_per_gas":"100000000000","max_priority_fee_per_gas":"1000000000","fee_upper_bound":"100000000000","priority_upper_bound":"10000000000"}}),0).await?;
    // Maximum permitted identifier widths; vault names still exercise escaping.
    let id = |n: usize| format!("{:02}{}", n, "x".repeat(30));
    let mut nodes = serde_json::Map::new();
    nodes.insert(
        id(0),
        json!({"type":"CoinSlot","price":u128::MAX.to_string(),"output":id(1)}),
    );
    for n in 1..25 {
        nodes.insert(id(n),json!({"type":"Splitter","outputs":[{"bps":9999,"target":id(n+1)},{"bps":1,"target":id(31)}]}));
    }
    nodes.insert(id(25),json!({"type":"Splitter","outputs":[{"bps":2500,"target":id(26)},{"bps":2500,"target":id(27)},{"bps":2500,"target":id(28)},{"bps":2500,"target":id(29)}]}));
    for n in 26..29 {
        nodes.insert(id(n), json!({"type":"Payout","account":"a".repeat(64)}));
    }
    nodes.insert(id(29),json!({"type":"Splitter","outputs":[{"bps":5000,"target":id(30)},{"bps":5000,"target":id(31)}]}));
    nodes.insert(
        id(30),
        json!({"type":"Portal","chain":"sepolia","wei":"2000000000000000"}),
    );
    nodes.insert(id(31), json!({"type":"Vault","name":"\u{0001}".repeat(32)}));
    // Fourth transfer shares an existing leaf, keeping all 32 nodes reachable.
    nodes.get_mut(&id(29)).unwrap()["outputs"] = json!([{"bps":4000,"target":id(30)},{"bps":3000,"target":id(31)},{"bps":3000,"target":id(26)}]);
    let m = json!({"nodes":nodes,"portal_cap_wei":"2000000000000000"});
    let machine = "m".repeat(32);
    let before = c.view_account().await?.storage_usage;
    call(&owner, &c, "publish_machine", publish(&machine, &m), PRICE).await?;
    let publish_bytes = c.view_account().await?.storage_usage - before;
    // Buyer requires a balance above u128 max attached amount; use a smaller 38-digit amount.
    let mut m = m;
    m["nodes"][id(0)]["price"] = json!(PRICE.to_string());
    // Measure the actual persisted execution with a funded sandbox account.
    let machine2 = "n".repeat(32);
    call(&owner, &c, "publish_machine", publish(&machine2, &m), PRICE).await?;
    let before = c.view_account().await?.storage_usage;
    call(
        &owner,
        &c,
        "submit_order",
        order(&machine2, &"o".repeat(64)),
        PRICE + FEE,
    )
    .await?;
    let order_bytes = c.view_account().await?.storage_usage - before;
    println!("G6 ADVERSARIAL STORAGE publish={publish_bytes} bytes order={order_bytes} bytes (32 nodes, bounded IDs, max order ID, four transfers, Portal/signature, Vault)");
    assert!(order_bytes <= worldworks_contract::ORDER_STORAGE_BOUND_BYTES);
    assert!(
        u128::from(worldworks_contract::ORDER_STORAGE_BOUND_BYTES)
            * 2
            * 10_000_000_000_000_000_000u128
            <= FEE
    );
    Ok(())
}

#[tokio::test]
async fn g6_portal_resolution_and_gas_budget() -> Result<()> {
    let w = near_workspaces::sandbox().await?;
    let c = w
        .dev_deploy(&std::fs::read(
            "/opt/ww-target/near/worldworks_contract.wasm",
        )?)
        .await?;
    let mock = w
        .dev_deploy(&std::fs::read(
            "/opt/ww-target/portal-mock/portal_mock_signer.wasm",
        )?)
        .await?;
    let owner = w.dev_create_account().await?;
    call(mock.as_account(), &mock, "new", json!({}), 0).await?;
    call(c.as_account(),&c,"new",json!({"owner_id":owner.id(),"min_fee_yocto_per_wei":"2","epoch_blocks":"1000","epoch_budget_wei":"4200000000000002","max_wei_per_payout":"2","signature_timeout_blocks":"100","portal_config":{"signer":mock.id(),"cap_wei":"2","max_fee_per_gas":"100000000000","max_priority_fee_per_gas":"1000000000","fee_upper_bound":"100000000000","priority_upper_bound":"10000000000"}}),0).await?;
    let mut m = json!({"portal_cap_wei":"2","nodes":{"slot":{"type":"CoinSlot","price":"2","output":"gate"},"gate":{"type":"Gate","condition":{"type":"NeedsApproval","worker":"worker"},"pass":"portal","fail":"split"},"worker":{"type":"Worker","gates":["gate"]},"split":{"type":"Splitter","outputs":[{"bps":5000,"target":"portal"},{"bps":5000,"target":"vault"}]},"portal":{"type":"Portal","chain":"sepolia","wei":"1"},"vault":{"type":"Vault","name":"reserve"}}});
    let mut args = publish("trap", &m);
    args["workers"] = json!({"worker":owner.id()});
    reject(
        &owner,
        &c,
        "publish_machine",
        args,
        PRICE,
        "Portal rate rule",
    )
    .await?;
    println!("PASS Astra trapped escrow counterexample rejected at publish (expiry branch)");
    m["nodes"]["slot"]["price"] = json!("4");
    let mut args = publish("release", &m);
    args["workers"] = json!({"worker":owner.id()});
    args["expiry_blocks"] = json!("1");
    call(&owner, &c, "publish_machine", args, PRICE).await?;
    for (i, method) in ["approve", "expire"].iter().enumerate() {
        let id = i.to_string();
        call(&owner, &c, "submit_order", order("release", &id), FEE + 4).await?;
        assert_eq!(
            view(&c, "get_portal_nonce", json!({})).await?,
            i.to_string()
        );
        call(
            mock.as_account(),
            &mock,
            "configure",
            json!({"fail":false,"id":id}),
            0,
        )
        .await?;
        w.fast_forward(2).await?;
        let r = owner
            .call(c.id(), method)
            .args_json(order("release", &id))
            .max_gas()
            .transact()
            .await?;
        let result: Value = r.json()?;
        assert_eq!(result["effects"][0]["kind"], "external");
        assert_eq!(result["effects"][0]["payoutId"], id);
        assert_eq!(
            view(&c, "get_portal_nonce", json!({})).await?,
            (i + 1).to_string()
        );
    }
    call(
        &owner,
        &c,
        "submit_order",
        order("release", "third"),
        FEE + 4,
    )
    .await?;
    reject(
        &owner,
        &c,
        "approve",
        order("release", "third"),
        0,
        "epoch budget exhausted",
    )
    .await?;
    assert_eq!(view(&c, "get_portal_nonce", json!({})).await?, "2");
    println!("PASS Portal approve and expire structured effects; exactly one nonce each; 1-wei payouts exhaust gas-inclusive budget");
    let zero = json!({"portal_cap_wei":"1","nodes":{"slot":{"type":"CoinSlot","price":"1","output":"split"},"split":{"type":"Splitter","outputs":[{"bps":9999,"target":"vault"},{"bps":1,"target":"portal"}]},"vault":{"type":"Vault","name":"reserve"},"portal":{"type":"Portal","chain":"sepolia","wei":"1"}}});
    call(
        &owner,
        &c,
        "publish_machine",
        publish("zero-flow", &zero),
        PRICE,
    )
    .await?;
    let r = owner
        .call(c.id(), "submit_order")
        .args_json(order("zero-flow", "zero"))
        .deposit(NearToken::from_yoctonear(FEE + 1))
        .max_gas()
        .transact()
        .await?;
    assert!(r.failures().is_empty());
    assert!(r.receipt_outcomes().iter().all(|o| &o.executor_id != mock.id()), "zero-flow order must create no signer receipts");
    assert_eq!(view(&c, "get_portal_nonce", json!({})).await?, "2");
    let result: Value = r.json()?;
    assert!(result["effects"]
        .as_array()
        .unwrap()
        .iter()
        .all(|e| e["kind"] != "external"));
    println!("PASS zero-fee Portal path never calls signer or consumes nonce");
    for id in ["bad:node", "bad\"node", "bad\nnode"] {
        let invalid = json!({"portal_cap_wei":"0","nodes":{"slot":{"type":"CoinSlot","price":"1","output":id},id:{"type":"Vault","name":"v"}}});
        reject(
            &owner,
            &c,
            "publish_machine",
            publish("invalid", &invalid),
            PRICE,
            "node name length",
        )
        .await?;
    }
    println!("PASS parser-breaking node IDs rejected");
    let nonce = view(&c, "get_portal_nonce", json!({})).await?;
    let liability = view(&c, "get_liabilities", json!({})).await?;
    call(c.as_account(), &c, "migrate_g6", json!({}), 0).await?;
    assert_eq!(view(&c, "get_portal_nonce", json!({})).await?, nonce);
    let after = view(&c, "get_liabilities", json!({})).await?;
    for f in ["escrow", "vaults", "unclaimed", "in_flight"] {
        assert_eq!(liability[f], after[f]);
    }
    reject(
        c.as_account(),
        &c,
        "migrate_g6",
        json!({}),
        0,
        "already migrated",
    )
    .await?;
    println!("PASS G6 one-time migration preserves liabilities and nonce");
    w.fast_forward(1001).await?;
    call(
        &owner,
        &c,
        "set_portal_fees",
        json!({"max_fee_per_gas":"1","max_priority_fee_per_gas":"0"}),
        0,
    )
    .await?;
    let direct = json!({"portal_cap_wei":"1","nodes":{"slot":{"type":"CoinSlot","price":"2","output":"portal"},"portal":{"type":"Portal","chain":"sepolia","wei":"1"}}});
    call(
        &owner,
        &c,
        "publish_machine",
        publish("count", &direct),
        PRICE,
    )
    .await?;
    for i in 0..20 {
        call(
            mock.as_account(),
            &mock,
            "configure",
            json!({"fail":false,"id":(i+2).to_string()}),
            0,
        )
        .await?;
        call(
            &owner,
            &c,
            "submit_order",
            order("count", &i.to_string()),
            FEE + 2,
        )
        .await?;
    }
    reject(
        &owner,
        &c,
        "submit_order",
        order("count", "over"),
        FEE + 2,
        "epoch payout count exhausted",
    )
    .await?;
    let page = view(
        &c,
        "get_pending_external_payouts",
        json!({"machine_id":"count","from_index":"2","limit":2}),
    )
    .await?;
    assert_eq!(page.as_array().unwrap().len(), 2);
    assert_eq!(page[0]["payout_id"], "2");
    assert_eq!(page[1]["payout_id"], "3");
    assert_eq!(
        view(
            &c,
            "get_pending_external_payouts",
            json!({"machine_id":"count","from_index":"0","limit":2})
        )
        .await?,
        json!([])
    );
    println!("PASS twenty payouts accepted; twenty-first rejected by independent epoch count cap; bounded history pages");
    Ok(())
}
