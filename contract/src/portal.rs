use super::*;
use near_sdk::Gas;
use omni_transaction::evm::{utils::parse_eth_address, EVMTransaction};
use serde_json::{json, Value};
pub const PATH: &str = "worldworks/portal/sepolia/v1";

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct PortalConfig {
    pub signer: AccountId,
    pub cap_wei: U128,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
    pub fee_upper_bound: U128,
    pub priority_upper_bound: U128,
    #[serde(default)]
    pub next_nonce: U64,
}
impl Default for PortalConfig {
    fn default() -> Self {
        Self {
            signer: "v1.signer-prod.testnet".parse().unwrap(),
            cap_wei: U128(2_000_000_000_000_000),
            max_fee_per_gas: U128(100_000_000_000),
            max_priority_fee_per_gas: U128(1_000_000_000),
            fee_upper_bound: U128(100_000_000_000),
            priority_upper_bound: U128(10_000_000_000),
            next_nonce: U64(0),
        }
    }
}
impl PortalConfig {
    pub fn validate(self) -> Self {
        assert!(self.cap_wei.0 > 0, "invalid portal cap");
        assert!(
            self.fee_upper_bound.0 <= 100_000_000_000
                && self.priority_upper_bound.0 <= self.fee_upper_bound.0,
            "invalid fee bounds"
        );
        self.check_fees(self.max_fee_per_gas, self.max_priority_fee_per_gas);
        self
    }
    fn check_fees(&self, fee: U128, priority: U128) {
        assert!(
            fee.0 > 0
                && fee.0 <= self.fee_upper_bound.0
                && priority.0 <= self.priority_upper_bound.0
                && priority.0 <= fee.0,
            "fee bounds exceeded"
        );
    }
}
#[derive(Serialize, Deserialize, Clone, near_sdk::NearSchema)]
pub struct PortalPayout {
    #[serde(default)]
    pub attempt_id: U64,
    #[serde(default)]
    pub requested_at: U64,
    pub payout_id: String,
    pub machine_id: String,
    pub order_id: String,
    pub recipient: String,
    pub wei: U128,
    pub fee: U128,
    pub nonce: u64,
    pub chain_id: u64,
    pub max_fee_per_gas: U128,
    pub max_priority_fee_per_gas: U128,
    pub gas_limit: u64,
    pub unsigned_tx: Vec<u8>,
    pub payload: Vec<u8>,
    pub signature_json: Option<String>,
    pub status: String,
}
#[near]
impl Contract {
    pub fn get_payout(&self, payout_id: String) -> Option<PortalPayout> {
        if payout_id.starts_with('$') {
            return None;
        }
        self.payouts
            .get(&payout_id)
            .map(|s| must(serde_json::from_str(&s)))
    }
    pub fn get_portal_queue(&self, evm_next_nonce: Option<U64>) -> Value {
        json!({"next_nonce":self.portal.next_nonce,"oldest_unbroadcast_payout":(evm_next_nonce.unwrap_or(U64(0)).0..self.portal.next_nonce.0).find_map(|i| self.get_payout(i.to_string())),
            "broadcast_status":"unknown_on_near; compare with Sepolia transaction count"})
    }
    pub fn get_portal_nonce(&self) -> U64 {
        self.portal.next_nonce
    }
    /// Cached address derived from the trusted signer public key during init.
    pub fn get_portal_address(&self) -> Option<String> {
        self.payouts.get(&"$address".into())
    }
    pub fn refresh_portal_address(&self) -> Promise {
        Promise::new(self.portal.signer.clone())
            .function_call(
                "derived_public_key",
                must(serde_json::to_vec(
                    &json!({"predecessor":env::current_account_id(),"path":PATH,"domain_id":0}),
                )),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(5),
            )
            .then(Promise::new(env::current_account_id()).function_call(
                "on_portal_address",
                b"{}".to_vec(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(5),
            ))
    }
    #[private]
    pub fn on_portal_address(&mut self) {
        let bytes = env::promise_result_checked(0, 4096).expect("key derivation failed");
        let key: String = must(serde_json::from_slice(&bytes));
        let encoded = key
            .strip_prefix("secp256k1:")
            .expect("expected secp256k1 key");
        let public = must(bs58::decode(encoded).into_vec());
        assert_eq!(public.len(), 64, "invalid public key length");
        let hash = env::keccak256(&public);
        let address = format!(
            "0x{}",
            hash[12..]
                .iter()
                .map(|b| format!("{b:02x}"))
                .collect::<String>()
        );
        if let Some(old) = self.get_portal_address() {
            assert_eq!(old, address, "derived address changed");
        }
        self.payouts.insert(&"$address".into(), &address);
    }
    pub fn get_portal_derivation(&self) -> Value {
        json!({"signer":self.portal.signer,"method":"derived_public_key",
            "args":{"predecessor":env::current_account_id(),"path":PATH,"domain_id":0},
            "derivation":"keccak256(bs58_decode(public_key.split(':')[1]))[12..32]; public key is 64 bytes, no SEC1 prefix",
            "chain_id":11155111})
    }
    pub fn set_portal_fees(&mut self, max_fee_per_gas: U128, max_priority_fee_per_gas: U128) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "owner only");
        self.portal
            .check_fees(max_fee_per_gas, max_priority_fee_per_gas);
        self.portal.max_fee_per_gas = max_fee_per_gas;
        self.portal.max_priority_fee_per_gas = max_priority_fee_per_gas;
    }
    pub fn retry_signature(&mut self, payout_id: String) -> Promise {
        let mut p = self.get_payout(payout_id).expect("unknown payout");
        assert!(
            p.status == "signature_failed"
                || (p.status == "awaiting_signature"
                    && env::block_height().saturating_sub(p.requested_at.0)
                        >= self.signature_timeout_blocks),
            "signature not retryable"
        );
        p.attempt_id.0 = p.attempt_id.0.checked_add(1).expect("attempt overflow");
        p.requested_at = U64(env::block_height());
        p.status = "awaiting_signature".into();
        self.save_payout(&p);
        self.request_external_signature(&p)
    }
    #[private]
    pub fn on_signature(&mut self, payout_id: String, attempt_id: U64) -> bool {
        let mut p = self.get_payout(payout_id).expect("unknown payout");
        if p.attempt_id != attempt_id || p.status != "awaiting_signature" {
            return false;
        }
        let signature = env::promise_result_checked(0, 4096)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
            .filter(valid_signature);
        p.status = if signature.is_some() {
            "signed"
        } else {
            "signature_failed"
        }
        .into();
        p.signature_json = signature.map(|v| v.to_string());
        self.save_payout(&p);
        p.status == "signed"
    }
}
fn valid_signature(v: &Value) -> bool {
    let s = v.get("signature").unwrap_or(v);
    let hex = |x: Option<&str>, n| {
        x.is_some_and(|x| x.len() == n && x.bytes().all(|b| b.is_ascii_hexdigit()))
    };
    hex(s["big_r"]["affine_point"].as_str(), 66)
        && hex(s["s"]["scalar"].as_str(), 64)
        && matches!(s["recovery_id"].as_u64(), Some(0 | 1))
}
impl Contract {
    pub(super) fn save_payout(&mut self, p: &PortalPayout) {
        self.payouts
            .insert(&p.payout_id, &must(serde_json::to_string(p)));
    }
    pub(super) fn create_portal_payout(
        &mut self,
        machine_id: &str,
        order_id: &str,
        recipient: &str,
        wei: u128,
        fee: u128,
    ) -> String {
        assert!(
            fee > 0 && wei > 0 && wei <= self.portal.cap_wei.0,
            "portal cap or zero fee"
        );
        assert!(
            fee >= wei
                .checked_mul(self.min_fee_yocto_per_wei.0)
                .expect("rate overflow"),
            "Portal rate rule"
        );
        let epoch = env::block_height() / self.epoch_blocks;
        if epoch != self.epoch {
            self.epoch = epoch;
            self.epoch_spent = 0;
        }
        self.epoch_spent = self.epoch_spent.checked_add(wei).expect("budget overflow");
        assert!(
            self.epoch_spent <= self.epoch_budget_wei.0,
            "epoch budget exhausted"
        );
        let nonce = self.portal.next_nonce.0;
        let id = nonce.to_string();
        let tx = EVMTransaction {
            chain_id: 11155111,
            nonce,
            to: Some(parse_eth_address(&recipient[2..])),
            value: wei,
            input: vec![],
            gas_limit: 21000,
            max_fee_per_gas: self.portal.max_fee_per_gas.0,
            max_priority_fee_per_gas: self.portal.max_priority_fee_per_gas.0,
            access_list: vec![],
        };
        let unsigned_tx = tx.build_for_signing();
        let p = PortalPayout {
            attempt_id: U64(0),
            requested_at: U64(env::block_height()),
            payout_id: id.clone(),
            machine_id: machine_id.into(),
            order_id: order_id.into(),
            recipient: recipient.into(),
            wei: U128(wei),
            fee: U128(fee),
            nonce,
            chain_id: 11155111,
            max_fee_per_gas: self.portal.max_fee_per_gas,
            max_priority_fee_per_gas: self.portal.max_priority_fee_per_gas,
            gas_limit: 21000,
            payload: env::keccak256(&unsigned_tx),
            unsigned_tx,
            signature_json: None,
            status: "awaiting_signature".into(),
        };
        self.portal.next_nonce.0 = nonce.checked_add(1).expect("nonce overflow");
        self.save_payout(&p);
        self.request_external_signature(&p).detach();
        id
    }
    fn request_external_signature(&self, p: &PortalPayout) -> Promise {
        Promise::new(self.portal.signer.clone())
            .function_call(
                "sign",
                must(serde_json::to_vec(
                    &json!({"request":{"payload":p.payload,"path":PATH,"key_version":0}}),
                )),
                NearToken::from_yoctonear(1),
                Gas::from_tgas(35),
            )
            .then(Promise::new(env::current_account_id()).function_call(
                "on_signature",
                must(serde_json::to_vec(
                    &json!({"payout_id":p.payout_id,"attempt_id":p.attempt_id}),
                )),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(15),
            ))
    }
}
