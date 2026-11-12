use near_sdk::serde_json::{self, json, Value};
use near_sdk::{env, near, Gas, NearToken, PanicOnDefault, Promise};
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Mock {
    fail: bool,
    id: String,
}
#[near]
impl Mock {
    #[init]
    pub fn new() -> Self {
        Self {
            fail: false,
            id: "0".into(),
        }
    }
    pub fn derived_public_key(&self) -> String {
        format!("secp256k1:{}", "1".repeat(64))
    }
    pub fn configure(&mut self, fail: bool, id: String) {
        self.fail = fail;
        self.id = id;
    }
    #[payable]
    pub fn sign(&mut self, request: Value) -> Promise {
        assert!(!self.fail, "mock signer failure");
        assert_eq!(request["path"], "worldworks/portal/sepolia/v1");
        Promise::new(env::predecessor_account_id())
            .function_call(
                "get_payout",
                serde_json::to_vec(&json!({"payout_id":self.id})).unwrap(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(5),
            )
            .then(Promise::new(env::current_account_id()).function_call(
                "finish",
                serde_json::to_vec(&json!({"request":request})).unwrap(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(5),
            ))
    }
    #[private]
    pub fn finish(&self, request: Value) -> Value {
        let p: Value =
            serde_json::from_slice(&env::promise_result_checked(0, 20000).unwrap()).unwrap();
        assert_eq!(p["status"], "awaiting_signature");
        assert_eq!(p["payload"], request["payload"]);
        json!({"big_r":{"affine_point":format!("02{}","11".repeat(32))},"s":{"scalar":"22".repeat(32)},"recovery_id":0})
    }
}
