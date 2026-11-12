use near_sdk::collections::LookupMap;
use near_sdk::json_types::U128;
use near_sdk::serde_json::{self, Value, json};
use near_sdk::{AccountId, Gas, NearToken, PanicOnDefault, Promise, env, near};
use omni_transaction::evm::{EVMTransaction, utils::parse_eth_address};

const CHAIN_ID: u64 = 11155111;
const PATH: &str = "worldworks/sepolia/v1";
const SIGNER: &str = "v1.signer-prod.testnet";

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Payout {
    pub payout_id: String,
    pub recipient: String,
    pub wei: U128,
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

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Probe {
    owner: AccountId,
    cap: u128,
    fee_cap: u128,
    next_nonce: u64,
    payouts: LookupMap<String, Payout>,
}

#[near]
impl Probe {
    #[init]
    pub fn new(cap: U128, max_fee_per_gas: U128) -> Self {
        assert_eq!(
            env::predecessor_account_id(),
            env::current_account_id(),
            "self init only"
        );
        assert!(
            cap.0 > 0 && max_fee_per_gas.0 > 0 && max_fee_per_gas.0 <= 100_000_000_000,
            "invalid caps"
        );
        Self {
            owner: env::predecessor_account_id(),
            cap: cap.0,
            fee_cap: max_fee_per_gas.0,
            next_nonce: 0,
            payouts: LookupMap::new(b"p"),
        }
    }

    pub fn config(&self) -> Value {
        json!({"owner":self.owner,"cap":self.cap.to_string(),"max_fee_per_gas":self.fee_cap.to_string(),
            "next_nonce":self.next_nonce,"chain_id":CHAIN_ID,"path":PATH,"signer":SIGNER})
    }
    pub fn get_payout(&self, payout_id: String) -> Option<Payout> {
        self.payouts.get(&payout_id)
    }

    pub fn pay(&mut self, payout_id: String, recipient_evm_address: String, wei: U128) -> Promise {
        assert_eq!(env::predecessor_account_id(), self.owner, "owner only");
        assert!(
            !payout_id.is_empty() && payout_id.len() <= 64,
            "invalid payout id"
        );
        assert!(
            self.payouts.get(&payout_id).is_none(),
            "duplicate payout id"
        );
        assert!(
            wei.0 > 0 && wei.0 <= self.cap,
            "amount exceeds cap or is zero"
        );
        assert!(
            recipient_evm_address.len() == 42
                && recipient_evm_address.starts_with("0x")
                && recipient_evm_address[2..]
                    .bytes()
                    .all(|c| c.is_ascii_hexdigit()),
            "invalid EVM address"
        );
        let priority = self.fee_cap.min(1_000_000_000);
        let tx = EVMTransaction {
            chain_id: CHAIN_ID,
            nonce: self.next_nonce,
            to: Some(parse_eth_address(&recipient_evm_address[2..])),
            value: wei.0,
            input: vec![],
            gas_limit: 21000,
            max_fee_per_gas: self.fee_cap,
            max_priority_fee_per_gas: priority,
            access_list: vec![],
        };
        let unsigned_tx = tx.build_for_signing();
        let payload = env::keccak256(&unsigned_tx);
        let payout = Payout {
            payout_id: payout_id.clone(),
            recipient: recipient_evm_address,
            wei,
            nonce: self.next_nonce,
            chain_id: CHAIN_ID,
            max_fee_per_gas: U128(self.fee_cap),
            max_priority_fee_per_gas: U128(priority),
            gas_limit: 21000,
            unsigned_tx,
            payload: payload.clone(),
            signature_json: None,
            status: "pending".into(),
        };
        self.next_nonce = self.next_nonce.checked_add(1).expect("nonce overflow");
        self.payouts.insert(&payout_id, &payout);
        // Legacy ECDSA wire format is supported by signer v3.18.0.
        Promise::new(SIGNER.parse().unwrap())
            .function_call(
                "sign",
                serde_json::to_vec(
                    &json!({"request":{"payload":payload,"path":PATH,"key_version":0}}),
                )
                .unwrap(),
                NearToken::from_yoctonear(1),
                Gas::from_tgas(250),
            )
            .then(Promise::new(env::current_account_id()).function_call(
                "on_signature",
                serde_json::to_vec(&json!({"payout_id":payout_id})).unwrap(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(15),
            ))
    }

    #[private]
    pub fn on_signature(&mut self, payout_id: String) -> bool {
        let mut p = self.payouts.get(&payout_id).expect("unknown payout");
        assert_eq!(p.status, "pending", "already resolved");
        let ok = match env::promise_result_checked(0, 4096) {
            Ok(bytes) => {
                let value: Value = serde_json::from_slice(&bytes).expect("invalid signer JSON");
                p.signature_json = Some(value.to_string());
                p.status = "signed".into();
                true
            }
            _ => {
                p.status = "failed".into();
                false
            }
        };
        self.payouts.insert(&payout_id, &p);
        ok
    }
}
