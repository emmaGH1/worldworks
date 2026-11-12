use wasm_bindgen::prelude::*;
use worldworks_engine::{Machine, State};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

fn parse(s: &str) -> Result<Machine, Value> { serde_json::from_str(s).map_err(|e| json!({"ok":false,"errors":[{"ParseError":e.to_string()}]})) }
fn output(v: Value) -> String { v.to_string() }
#[wasm_bindgen]
pub fn validate(machine_json: &str) -> String {
    output(match parse(machine_json) { Err(e) => e, Ok(m) => match worldworks_engine::validate(&m) { Ok(_) => json!({"ok":true}), Err(e) => json!({"ok":false,"errors":e}) } })
}
#[wasm_bindgen]
pub fn preview_order(machine_json: &str, amount: &str, external_recipient: Option<String>) -> String {
    output(match parse(machine_json) { Err(e) => e, Ok(m) => {
        let parsed = serde_json::from_value::<Amount>(json!(amount));
        match parsed { Err(e) => json!({"ok":false,"errors":[{"ParseError":e.to_string()}]}), Ok(Amount(n)) => match worldworks_engine::submit_order(&mut State::default(), &m, "demo-1".into(), "buyer.testnet".into(), n, external_recipient) { Ok(o) => json!(o), Err(e) => json!({"ok":false,"errors":[e]}) } }
    }})
}
#[derive(serde::Deserialize)] struct Amount(#[serde(with="worldworks_engine::amount")] u128);
#[wasm_bindgen]
pub fn machine_hash(machine_json: &str) -> String {
    output(match parse(machine_json) { Err(e) => e, Ok(m) => match worldworks_engine::validate(&m) { Err(e) => json!({"ok":false,"errors":e}), Ok(_) => json!(format!("{:x}", Sha256::digest(serde_json::to_vec(&m).unwrap()))) } })
}
