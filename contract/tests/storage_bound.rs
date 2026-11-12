//! Width checks supporting the topology-independent lifecycle bound in docs/STORAGE-g6.md.
use serde_json::{json, Value};
use worldworks_contract::{ORDER_STORAGE_BOUND_BYTES, ORDER_STORAGE_FEE};
fn bytes(v: &Value) -> usize {
    serde_json::to_vec(v).unwrap().len()
}
#[test]
fn g6_storage_component_widths_and_fee_rounding() {
    let id = "x".repeat(32);
    let amount = u128::MAX.to_string();
    // Includes the surrounding array comma. All IDs are unescaped ASCII.
    let trace = |s: String| bytes(&json!(s)) + 1;
    assert!(trace(format!("{id}: {amount} yoctoNEAR")) <= 86);
    assert!(
        trace(format!(
            "Splitter '{id}': 10000 bps -> {id} ({amount} yoctoNEAR)"
        )) <= 150
    );
    assert!(trace(format!("Gate '{id}': pending approval by {id}")) <= 101);
    assert!(trace(format!("Gate '{id}': -> {id}")) <= 101);
    assert!(trace(format!("Order '{}': approved", "x".repeat(64))) <= 90);
    let held = json!({"gate":id,"pass":id,"fail":id,"amount":amount,"worker":id});
    assert!(bytes(&held) + 1 <= 256);
    assert!(bytes(&json!(id)) + 1 <= 35);
    // A vault name has <=32 Unicode scalars. A control byte's six JSON bytes
    // are wider than a four-byte UTF-8 scalar or a two-byte escaped quote.
    let name = "\u{0001}".repeat(32);
    let mut vault = serde_json::Map::new();
    vault.insert(name, json!(amount));
    assert!(bytes(&Value::Object(vault)) <= 240);
    // Either a gate's pending record + future approval and resolution trace,
    // or two vault-map entries; their per-visit surcharge fits in 512 bytes.
    assert!(101 + 256 + 35 + 90 <= 512);
    assert!(2 * 240 <= 512);
    assert!(86 + 150 + 512 <= 768);
    // Deliberately oversized unsigned tx: native EIP-1559 at u128/u64 widths
    // is <256 bytes. Signature callback input is bounded to 4096 bytes;
    // embedding its normalized JSON string requires at most twice that.
    let payout = json!({"attempt_id":u64::MAX.to_string(),"requested_at":u64::MAX.to_string(),
        "payout_id":u64::MAX.to_string(),"machine_id":id,"order_id":"x".repeat(64),
        "recipient":"0x".to_string()+&"f".repeat(40),"wei":amount,"fee":amount,
        "nonce":u64::MAX,"chain_id":11155111,"max_fee_per_gas":amount,
        "max_priority_fee_per_gas":amount,"gas_limit":21000,
        "unsigned_tx":vec![255u8;256],"payload":vec![255u8;32],
        "signature_json":"\"".repeat(4096),"status":"awaiting_signature"});
    assert!(bytes(&payout) + 128 <= 12_288);
    let bound = 64 * 768 + 1024 + 256 + 12_288 + 512 + 128;
    assert_eq!(bound, 63_360);
    assert!(bound <= ORDER_STORAGE_BOUND_BYTES);
    let byte_cost = 10_000_000_000_000_000_000u128;
    let cent = 10_000_000_000_000_000_000_000u128;
    assert_eq!(
        (u128::from(ORDER_STORAGE_BOUND_BYTES) * 2 * byte_cost).div_ceil(cent) * cent,
        ORDER_STORAGE_FEE
    );
    println!("G6 storage: width-checked lifecycle <= {bound} bytes, envelope {ORDER_STORAGE_BOUND_BYTES} bytes; retained fee {ORDER_STORAGE_FEE} yoctoNEAR");
}
