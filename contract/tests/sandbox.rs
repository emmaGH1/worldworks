use anyhow::Result;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract};
use serde_json::{json, Value};
const PRICE: u128 = 1_000_000_000_000_000_000_000_000;
const BYTE_COST: u128 = 10_000_000_000_000_000_000;
async fn call(who: &Account, c: &Contract, method: &str, args: Value, deposit: u128) -> Result<()> {
    let result = who
        .call(c.id(), method)
        .args_json(args)
        .deposit(NearToken::from_yoctonear(deposit))
        .max_gas()
        .transact()
        .await?;
    assert!(result.failures().is_empty(), "{method}: {result:#?}");
    result.into_result()?;
    Ok(())
}
async fn rejected(
    who: &Account,
    c: &Contract,
    method: &str,
    args: Value,
    deposit: u128,
    error: &str,
) -> Result<()> {
    let result = who
        .call(c.id(), method)
        .args_json(args)
        .deposit(NearToken::from_yoctonear(deposit))
        .max_gas()
        .transact()
        .await?;
    assert!(result.is_failure(), "unexpected success: {method}");
    assert!(
        format!("{result:?}").contains(error),
        "expected {error}: {result:?}"
    );
    Ok(())
}
async fn view(c: &Contract, method: &str, args: Value) -> Result<Value> {
    Ok(c.view(method).args_json(args).await?.json()?)
}
async fn measure(c: &Contract, label: &str, before: u64) -> Result<u64> {
    let after = c.view_account().await?.storage_usage;
    let bytes = i128::from(after) - i128::from(before);
    println!(
        "STORAGE {label}: {bytes} bytes, {} yoctoNEAR ({:.8} NEAR)",
        bytes * BYTE_COST as i128,
        bytes as f64 * 0.00001
    );
    Ok(after)
}
#[tokio::test]
async fn acceptance_sandbox() -> Result<()> {
    let worker = near_workspaces::sandbox().await?;
    let wasm_path = std::env::var("WORLDWORKS_WASM")
        .unwrap_or_else(|_| "/opt/ww-target/near/worldworks_contract.wasm".into());
    let c = worker.dev_deploy(&std::fs::read(wasm_path)?).await?;
    call(c.as_account(), &c, "new", json!({}), 0).await?;
    let owner = worker.dev_create_account().await?;
    let buyer = worker.dev_create_account().await?;
    let creator = worker.dev_create_account().await?;
    let seller = worker.dev_create_account().await?;
    let inspector = worker.dev_create_account().await?;
    let mut vending: Value =
        serde_json::from_str(include_str!("../../engine/examples/vending.json"))?;
    let mut escrow: Value =
        serde_json::from_str(include_str!("../../engine/examples/escrow.json"))?;
    // Only substitute payout accounts with funded sandbox accounts; rules stay identical.
    vending["nodes"]["creator"]["account"] = json!(creator.id());
    escrow["nodes"]["seller"]["account"] = json!(seller.id());
    let v_args = json!({"machine_id":"vending", "machine_json": vending.to_string(), "workers":{}, "expiry_blocks":"100"});
    let e_args = json!({"machine_id":"escrow", "machine_json": escrow.to_string(),
        "workers":{"inspector":inspector.id()}, "expiry_blocks":"100"});
    let base = c.view_account().await?.storage_usage;
    println!(
        "STORAGE deployed initialized contract: {base} bytes, {} yoctoNEAR",
        u128::from(base) * BYTE_COST
    );
    call(&owner, &c, "publish_machine", v_args.clone(), 0).await?;
    let before = measure(&c, "vending machine", base).await?;
    call(&owner, &c, "publish_machine", e_args.clone(), 0).await?;
    let before_order = measure(&c, "escrow machine", before).await?;
    println!("PASS a: example machines published with sandbox accounts and bound worker");
    let v_order = json!({"machine_id":"vending", "order_id":"v1", "external_recipient":"0x1111111111111111111111111111111111111111"});
    let balance = creator.view_account().await?.balance.as_yoctonear();
    call(&buyer, &c, "submit_order", v_order.clone(), PRICE).await?;
    assert_eq!(
        creator.view_account().await?.balance.as_yoctonear() - balance,
        PRICE * 30 / 100
    );
    assert_eq!(
        view(&c, "get_vaults", json!({"machine_id":"vending"})).await?["reserve"],
        json!((PRICE * 63 / 100).to_string())
    );
    let payouts = view(
        &c,
        "get_pending_external_payouts",
        json!({"machine_id":"vending"}),
    )
    .await?;
    assert_eq!(payouts.as_array().unwrap().len(), 1);
    assert_eq!(payouts[0]["status"], "awaiting_signature");
    assert_eq!(payouts[0]["wei"], "1000000000000000");
    assert_eq!(payouts[0]["fee"], (PRICE * 7 / 100).to_string());
    assert_eq!(
        view(
            &c,
            "get_order",
            json!({"machine_id":"vending","order_id":"v1"})
        )
        .await?["pending"],
        false
    );
    let before_escrow = measure(
        &c,
        "vending order including external record and vault growth",
        before_order,
    )
    .await?;
    println!("PASS b: exact creator +0.30 NEAR, vault 0.63 NEAR, pending portal fee 0.07 NEAR");
    let order = json!({"machine_id":"escrow", "order_id":"e1"});
    call(&buyer, &c, "submit_order", order.clone(), PRICE).await?;
    let after_pending = measure(&c, "pending escrow order", before_escrow).await?;
    assert_eq!(view(&c, "get_order", order.clone()).await?["pending"], true);
    let held_balance = c.view_account().await?.balance.as_yoctonear();
    rejected(
        &buyer,
        &c,
        "approve",
        order.clone(),
        0,
        "unauthorized worker",
    )
    .await?;
    rejected(
        &owner,
        &c,
        "approve",
        order.clone(),
        0,
        "unauthorized worker",
    )
    .await?;
    rejected(
        &buyer,
        &c,
        "expire",
        order.clone(),
        0,
        "order has not expired",
    )
    .await?;
    assert_eq!(view(&c, "get_order", order.clone()).await?["pending"], true);
    let seller_balance = seller.view_account().await?.balance.as_yoctonear();
    call(&inspector, &c, "approve", order.clone(), 0).await?;
    assert_eq!(
        seller.view_account().await?.balance.as_yoctonear() - seller_balance,
        PRICE
    );
    assert!(c.view_account().await?.balance.as_yoctonear() < held_balance);
    assert_eq!(
        view(&c, "get_order", order.clone()).await?["pending"],
        false
    );
    measure(&c, "escrow approval growth", after_pending).await?;
    rejected(&inspector, &c, "approve", order.clone(), 0, "NotPending").await?;
    rejected(&owner, &c, "expire", order.clone(), 0, "NotPending").await?;
    let second = json!({"machine_id":"escrow", "order_id":"e2"});
    call(&buyer, &c, "submit_order", second.clone(), PRICE).await?;
    // Transactions finish before their system gas-refund receipts necessarily settle.
    // Advance real sandbox blocks using an unrelated signer before sampling payer.
    for _ in 0..3 {
        owner
            .transfer_near(creator.id(), NearToken::from_yoctonear(1))
            .await?
            .into_result()?;
    }
    let payer_balance = buyer.view_account().await?.balance.as_yoctonear();
    // Owner submits expiry, so payer's balance delta contains no transaction gas.
    call(&owner, &c, "expire", second.clone(), 0).await?;
    assert_eq!(
        buyer.view_account().await?.balance.as_yoctonear() - payer_balance,
        PRICE
    );
    rejected(&inspector, &c, "approve", second.clone(), 0, "NotPending").await?;
    let third = json!({"machine_id":"escrow", "order_id":"e3"});
    call(&buyer, &c, "submit_order", third.clone(), PRICE).await?;
    worker.fast_forward(101).await?;
    // Transactions finish before their system gas-refund receipts necessarily settle.
    // Advance real sandbox blocks using an unrelated signer before sampling payer.
    for _ in 0..3 {
        owner
            .transfer_near(creator.id(), NearToken::from_yoctonear(1))
            .await?
            .into_result()?;
    }
    let payer_balance = buyer.view_account().await?.balance.as_yoctonear();
    call(&creator, &c, "expire", third.clone(), 0).await?;
    assert_eq!(
        buyer.view_account().await?.balance.as_yoctonear() - payer_balance,
        PRICE
    );
    println!("PASS c: held order, wrong/owner approvals rejected, worker paid seller exactly 1 NEAR, repeat rejected; owner and timed expiry refunded exactly 1 NEAR");
    rejected(
        &buyer,
        &c,
        "submit_order",
        json!({"machine_id":"vending","order_id":"wrong"}),
        PRICE - 1,
        "WrongAmount",
    )
    .await?;
    assert!(view(
        &c,
        "get_order",
        json!({"machine_id":"vending","order_id":"wrong"})
    )
    .await?
    .is_null());
    rejected(&buyer, &c, "submit_order", v_order, PRICE, "DuplicateOrder").await?;
    rejected(&buyer, &c, "submit_order", second, PRICE, "DuplicateOrder").await?;
    rejected(&owner, &c, "publish_machine", json!({"machine_id":"invalid","machine_json":"{\"portal_cap_wei\":\"0\",\"nodes\":{}}","workers":{},"expiry_blocks":"100"}), 0, "CoinSlotCount").await?;
    let original = view(&c, "get_machine", json!({"machine_id":"vending"})).await?;
    let mut changed = v_args;
    changed["machine_json"] = json!(escrow.to_string());
    rejected(
        &owner,
        &c,
        "publish_machine",
        changed,
        0,
        "machine already published",
    )
    .await?;
    assert_eq!(
        view(&c, "get_machine", json!({"machine_id":"vending"})).await?,
        original
    );
    let trace = view(&c, "explain_order", order).await?;
    assert!(trace
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s.as_str().unwrap().contains("approved")));
    println!("PASS d: wrong deposit, duplicate IDs (completed and expired), invalid graph, owner overwrite rejected; views and engine trace verified");
    Ok(())
}
