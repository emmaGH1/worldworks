use near_sdk::collections::LookupMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use worldworks_engine::{self as engine, Effect, Machine, Outcome, Part, State};

#[derive(Serialize, Deserialize)]
pub struct PublishedMachine {
    pub machine: engine::ValidatedMachine,
    pub owner: AccountId,
    pub workers: BTreeMap<String, AccountId>,
    pub expiry_blocks: U64,
    pub vaults: BTreeMap<String, U128>,
    pub external_payouts: Vec<ExternalPayout>,
}
#[derive(Serialize, Deserialize, Clone, near_sdk::NearSchema)]
pub struct ExternalPayout {
    pub machine_id: String,
    pub order_id: String,
    pub recipient: String,
    pub wei: U128,
    pub fee: U128,
    pub status: String,
}
#[derive(Serialize, Deserialize)]
pub struct Order {
    pub payer: AccountId,
    pub submitted_at: U64,
    pub expires_at: U64,
    pub pending: bool,
    pub trace: Vec<String>,
    engine_state: State,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    machines: LookupMap<String, String>,
    orders: LookupMap<(String, String), String>,
}
fn must<T, E: std::fmt::Debug>(result: Result<T, E>) -> T {
    result.unwrap_or_else(|e| env::panic_str(&format!("{e:?}")))
}
#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self {
            machines: LookupMap::new(b"m"),
            orders: LookupMap::new(b"o"),
        }
    }

    pub fn publish_machine(
        &mut self,
        machine_id: String,
        machine_json: String,
        workers: BTreeMap<String, AccountId>,
        expiry_blocks: U64,
    ) {
        assert!(!machine_id.is_empty(), "empty machine id");
        assert!(
            !self.machines.contains_key(&machine_id),
            "machine already published"
        );
        assert!(expiry_blocks.0 > 0, "expiry_blocks must be positive");
        let machine: Machine = must(serde_json::from_str(&machine_json));
        let validated = must(engine::validate(&machine));
        let roles: Vec<_> = machine
            .nodes
            .iter()
            .filter_map(|(id, p)| matches!(p, Part::Worker { .. }).then_some(id))
            .collect();
        assert!(
            roles.len() == workers.len() && roles.iter().all(|id| workers.contains_key(*id)),
            "workers must match engine Worker nodes exactly"
        );
        for p in machine.nodes.values() {
            if let Part::Payout { account } = p {
                if account != "$payer" {
                    must(account.parse::<AccountId>());
                }
            }
        }
        let published = PublishedMachine {
            machine: validated,
            owner: env::predecessor_account_id(),
            workers,
            expiry_blocks,
            vaults: BTreeMap::new(),
            external_payouts: vec![],
        };
        self.save_machine(&machine_id, &published);
    }

    #[payable]
    pub fn submit_order(
        &mut self,
        machine_id: String,
        order_id: String,
        external_recipient: Option<String>,
    ) {
        let mut machine = self.load_machine(&machine_id);
        assert!(
            !self
                .orders
                .contains_key(&(machine_id.clone(), order_id.clone())),
            "DuplicateOrder"
        );
        if let Some(address) = &external_recipient {
            assert!(
                address.len() == 42
                    && address.starts_with("0x")
                    && address[2..].bytes().all(|b| b.is_ascii_hexdigit()),
                "invalid EVM recipient"
            );
        }
        let payer = env::predecessor_account_id();
        let mut state = State::default();
        let outcome = must(engine::submit_order(
            &mut state,
            &machine.machine,
            order_id.clone(),
            payer.to_string(),
            env::attached_deposit().as_yoctonear(),
            external_recipient,
        ));
        let mut order = Order {
            payer,
            submitted_at: U64(env::block_height()),
            expires_at: U64(must(
                env::block_height()
                    .checked_add(machine.expiry_blocks.0)
                    .ok_or("expiry overflow"),
            )),
            pending: false,
            trace: vec![],
            engine_state: state,
        };
        self.apply(&machine_id, &order_id, &mut machine, &mut order, outcome);
    }

    pub fn approve(&mut self, machine_id: String, order_id: String) {
        let mut machine = self.load_machine(&machine_id);
        let caller = env::predecessor_account_id();
        let workers: Vec<_> = machine
            .workers
            .iter()
            .filter(|(_, account)| *account == &caller)
            .map(|(name, _)| name.clone())
            .collect();
        assert!(!workers.is_empty(), "unauthorized worker");
        let mut order = self.load_order(&machine_id, &order_id);
        // An account may hold several roles. Release one currently pending role
        // per call; the engine decides whether that role has a held flow.
        let mut outcome = None;
        let mut not_pending = false;
        for worker in workers {
            match engine::approve(
                &mut order.engine_state,
                &machine.machine,
                order_id.clone(),
                &worker,
            ) {
                Ok(result) => {
                    outcome = Some(result);
                    break;
                }
                Err(engine::EngineError::WrongWorker) => continue,
                Err(engine::EngineError::NotPending) => {
                    not_pending = true;
                    continue;
                }
                Err(error) => env::panic_str(&format!("{error:?}")),
            }
        }
        let outcome = outcome.unwrap_or_else(|| {
            env::panic_str(if not_pending {
                "NotPending"
            } else {
                "WrongWorker"
            })
        });
        self.apply(&machine_id, &order_id, &mut machine, &mut order, outcome);
    }

    pub fn expire(&mut self, machine_id: String, order_id: String) {
        let mut machine = self.load_machine(&machine_id);
        let mut order = self.load_order(&machine_id, &order_id);
        assert!(
            env::predecessor_account_id() == machine.owner
                || env::block_height() >= order.expires_at.0,
            "order has not expired"
        );
        let outcome = must(engine::expire(
            &mut order.engine_state,
            &machine.machine,
            order_id.clone(),
        ));
        self.apply(&machine_id, &order_id, &mut machine, &mut order, outcome);
    }

    pub fn get_machine(&self, machine_id: String) -> Option<serde_json::Value> {
        self.machines.get(&machine_id).map(|s| {
            let mut value: serde_json::Value = must(serde_json::from_str(&s));
            value["machine"] = value["machine"]["machine"].take();
            value
        })
    }
    pub fn get_order(&self, machine_id: String, order_id: String) -> Option<serde_json::Value> {
        self.orders.get(&(machine_id, order_id)).map(|s| {
            let order: Order = must(serde_json::from_str(&s));
            serde_json::json!({"payer":order.payer, "submitted_at":order.submitted_at,
                "expires_at":order.expires_at, "pending":order.pending, "trace":order.trace})
        })
    }
    pub fn get_vaults(&self, machine_id: String) -> BTreeMap<String, U128> {
        self.load_machine(&machine_id).vaults
    }
    pub fn get_pending_external_payouts(&self, machine_id: String) -> Vec<ExternalPayout> {
        self.load_machine(&machine_id).external_payouts
    }
    pub fn explain_order(&self, machine_id: String, order_id: String) -> Vec<String> {
        self.load_order(&machine_id, &order_id).trace
    }
}
impl Contract {
    fn load_machine(&self, id: &str) -> PublishedMachine {
        must(serde_json::from_str(
            &self
                .machines
                .get(&id.to_owned())
                .unwrap_or_else(|| env::panic_str("unknown machine")),
        ))
    }
    fn load_order(&self, machine: &str, order: &str) -> Order {
        must(serde_json::from_str(
            &self
                .orders
                .get(&(machine.into(), order.into()))
                .unwrap_or_else(|| env::panic_str("unknown order")),
        ))
    }
    fn save_machine(&mut self, id: &str, machine: &PublishedMachine) {
        self.machines
            .insert(&id.to_owned(), &must(serde_json::to_string(machine)));
    }
    fn apply(
        &mut self,
        machine_id: &str,
        order_id: &str,
        machine: &mut PublishedMachine,
        order: &mut Order,
        outcome: Outcome,
    ) {
        order.pending = outcome.pending;
        order.trace.extend(outcome.trace);
        for effect in outcome.effects {
            match effect {
                Effect::VaultCredit { name, amount } => {
                    let old = machine.vaults.entry(name).or_insert(U128(0));
                    old.0 = must(old.0.checked_add(amount).ok_or("vault overflow"));
                }
                Effect::Payout { account, amount } => {
                    Promise::new(must(account.parse()))
                        .transfer(NearToken::from_yoctonear(amount))
                        .detach();
                }
                Effect::ExternalPayout {
                    recipient,
                    wei,
                    fee,
                } => {
                    machine.external_payouts.push(ExternalPayout {
                        machine_id: machine_id.into(),
                        order_id: order_id.into(),
                        recipient,
                        wei: U128(wei),
                        fee: U128(fee),
                        status: "awaiting_signature".into(),
                    });
                }
            }
        }
        self.orders.insert(
            &(machine_id.into(), order_id.into()),
            &must(serde_json::to_string(order)),
        );
        self.save_machine(machine_id, machine);
    }

    #[allow(dead_code)]
    fn request_external_signature(&self, _payout: &ExternalPayout) {
        // TODO(G2b): construct a constrained transaction and call Chain Signatures.
        // Deliberately unreachable from all exported methods; no signature is produced.
        env::panic_str("Chain Signatures is not implemented (G2b)");
    }
}
