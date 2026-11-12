use near_sdk::collections::LookupMap;
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, Promise};
mod portal;
use portal::PortalConfig;
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
}
#[derive(Serialize, Deserialize, Clone, near_sdk::NearSchema)]
pub struct ExternalPayout {
    pub payout_id: String,
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
    owner_id: AccountId,
    min_fee_yocto_per_wei: U128,
    epoch_blocks: u64,
    epoch_budget_wei: U128,
    epoch: u64,
    epoch_spent: u128,
    signature_timeout_blocks: u64,
    escrow_liabilities: u128,
    vault_liabilities: u128,
    unclaimed_total: u128,
    in_flight: u128,
    unclaimed: LookupMap<AccountId, u128>,
    portal: PortalConfig,
    payouts: LookupMap<String, String>,
    machines: LookupMap<String, String>,
    orders: LookupMap<(String, String), String>,
}
fn must<T, E: std::fmt::Debug>(result: Result<T, E>) -> T {
    result.unwrap_or_else(|e| env::panic_str(&format!("{e:?}")))
}
#[near]
impl Contract {
    #[init]
    pub fn new(
        owner_id: AccountId,
        min_fee_yocto_per_wei: U128,
        epoch_blocks: U64,
        epoch_budget_wei: U128,
        max_wei_per_payout: U128,
        signature_timeout_blocks: U64,
        portal_config: Option<PortalConfig>,
    ) -> Self {
        assert_ne!(
            owner_id,
            env::current_account_id(),
            "owner must be separate"
        );
        assert!(
            min_fee_yocto_per_wei.0 > 0
                && epoch_blocks.0 > 0
                && epoch_budget_wei.0 > 0
                && max_wei_per_payout.0 > 0
                && signature_timeout_blocks.0 > 0,
            "positive limits required"
        );
        let mut portal = portal_config.unwrap_or_default().validate();
        portal.cap_wei = max_wei_per_payout;
        let contract = Self {
            owner_id,
            min_fee_yocto_per_wei,
            epoch_blocks: epoch_blocks.0,
            epoch_budget_wei,
            epoch: env::block_height() / epoch_blocks.0,
            epoch_spent: 0,
            signature_timeout_blocks: signature_timeout_blocks.0,
            escrow_liabilities: 0,
            vault_liabilities: 0,
            unclaimed_total: 0,
            in_flight: 0,
            unclaimed: LookupMap::new(b"u"),
            portal,
            payouts: LookupMap::new(b"p"),
            machines: LookupMap::new(b"m"),
            orders: LookupMap::new(b"o"),
        };
        contract.refresh_portal_address().detach();
        contract
    }

    #[payable]
    pub fn publish_machine(
        &mut self,
        machine_id: String,
        machine_json: String,
        workers: BTreeMap<String, AccountId>,
        expiry_blocks: U64,
    ) {
        assert!(
            !machine_id.is_empty() && machine_id.len() <= 32,
            "machine id length"
        );
        let storage_before = env::storage_usage();
        assert!(
            !self.machines.contains_key(&machine_id),
            "machine already published"
        );
        assert!(expiry_blocks.0 > 0, "expiry_blocks must be positive");
        let machine: Machine = must(serde_json::from_str(&machine_json));
        let validated = must(engine::validate(&machine));
        assert!(
            machine.portal_cap_wei <= self.portal.cap_wei.0,
            "portal cap exceeded"
        );
        assert!(
            machine.nodes.keys().all(|n| !n.is_empty() && n.len() <= 32),
            "node name length"
        );
        assert!(
            machine
                .nodes
                .values()
                .filter(|p| matches!(p, Part::Portal { .. }))
                .count()
                <= 1,
            "one Portal node maximum"
        );
        assert!(
            machine
                .nodes
                .values()
                .all(|p| !matches!(p, Part::Portal { wei: 0, .. })),
            "zero wei Portal"
        );
        let source = machine
            .nodes
            .iter()
            .find(|(_, p)| matches!(p, Part::CoinSlot { .. }))
            .unwrap()
            .0;
        let (transfers, portals) = effect_bounds(&machine, source);
        assert!(transfers <= 4 && portals <= 1, "resolution effect limit");
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
        };
        self.save_machine(&machine_id, &published);
        let cost = u128::from(env::storage_usage() - storage_before)
            * env::storage_byte_cost().as_yoctonear();
        let deposit = env::attached_deposit().as_yoctonear();
        assert!(deposit >= cost, "insufficient publish storage deposit");
        if deposit > cost {
            self.transfer_with_recovery(env::predecessor_account_id(), deposit - cost);
        }
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
            !order_id.is_empty() && order_id.len() <= 64,
            "order id length"
        );
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
            env::attached_deposit()
                .as_yoctonear()
                .checked_sub(ORDER_STORAGE_FEE)
                .expect("order storage fee required"),
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
        self.escrow_liabilities = self
            .escrow_liabilities
            .checked_add(env::attached_deposit().as_yoctonear() - ORDER_STORAGE_FEE)
            .expect("liability overflow");
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
            env::block_height() >= order.expires_at.0,
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
        (0..self.portal.next_nonce.0)
            .filter_map(|i| self.get_payout(i.to_string()))
            .filter(|p| p.machine_id == machine_id)
            .map(|p| ExternalPayout {
                payout_id: p.payout_id,
                machine_id: p.machine_id,
                order_id: p.order_id,
                recipient: p.recipient,
                wei: p.wei,
                fee: p.fee,
                status: p.status,
            })
            .collect()
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
            self.escrow_liabilities = self
                .escrow_liabilities
                .checked_sub(effect.inflow())
                .expect("escrow accounting");
            match effect {
                Effect::VaultCredit { name, amount } => {
                    self.vault_liabilities += amount;
                    let old = machine.vaults.entry(name).or_insert(U128(0));
                    old.0 = must(old.0.checked_add(amount).ok_or("vault overflow"));
                }
                Effect::Payout { account, amount } => {
                    self.transfer_with_recovery(must(account.parse()), amount);
                }
                Effect::ExternalPayout {
                    recipient,
                    wei,
                    fee,
                } => {
                    self.create_portal_payout(machine_id, order_id, &recipient, wei, fee);
                }
            }
        }
        self.orders.insert(
            &(machine_id.into(), order_id.into()),
            &must(serde_json::to_string(order)),
        );
        self.save_machine(machine_id, machine);
    }
}

fn effect_bounds(m: &Machine, id: &str) -> (usize, usize) {
    match &m.nodes[id] {
        Part::Payout { .. } => (1, 0),
        Part::Portal { .. } => (0, 1),
        Part::CoinSlot { output, .. } => effect_bounds(m, output),
        Part::Splitter { outputs } => outputs
            .iter()
            .map(|s| effect_bounds(m, &s.target))
            .fold((0, 0), |a, b| (a.0 + b.0, a.1 + b.1)),
        Part::Gate { pass, fail, .. } => {
            let a = effect_bounds(m, pass);
            let b = effect_bounds(m, fail);
            (a.0.max(b.0), a.1.max(b.1))
        }
        _ => (0, 0),
    }
}
pub const ORDER_STORAGE_FEE: u128 = 770_000_000_000_000_000_000_000;
pub const PUBLISH_STORAGE_DEPOSIT: u128 = 400_000_000_000_000_000_000_000;
#[near]
impl Contract {
    pub fn get_limits(&self) -> serde_json::Value {
        let spent = if env::block_height() / self.epoch_blocks == self.epoch {
            self.epoch_spent
        } else {
            0
        };
        serde_json::json!({"owner_id":self.owner_id,"min_fee_yocto_per_wei":self.min_fee_yocto_per_wei,
            "epoch_blocks":U64(self.epoch_blocks),"epoch_budget_wei":self.epoch_budget_wei,
            "remaining_budget_wei":U128(self.epoch_budget_wei.0-spent),"max_wei_per_payout":self.portal.cap_wei,
            "signature_timeout_blocks":U64(self.signature_timeout_blocks),"order_storage_fee":U128(ORDER_STORAGE_FEE),"publish_storage_deposit":U128(PUBLISH_STORAGE_DEPOSIT)})
    }
    pub fn get_liabilities(&self) -> serde_json::Value {
        serde_json::json!({"escrow":U128(self.escrow_liabilities),"vaults":U128(self.vault_liabilities),
            "unclaimed":U128(self.unclaimed_total),"in_flight":U128(self.in_flight),"balance":U128(env::account_balance().as_yoctonear())})
    }
    pub fn get_unclaimed(&self, account: AccountId) -> U128 {
        U128(self.unclaimed.get(&account).unwrap_or(0))
    }
    pub fn withdraw_unclaimed(&mut self) {
        let account = env::predecessor_account_id();
        let amount = self.unclaimed.remove(&account).unwrap_or(0);
        assert!(amount > 0, "nothing unclaimed");
        self.unclaimed_total -= amount;
        self.transfer_with_recovery(account, amount);
    }
    pub fn withdraw_vault(&mut self, machine_id: String, vault_name: String, amount: U128) {
        let mut m = self.load_machine(&machine_id);
        assert_eq!(m.owner, env::predecessor_account_id(), "machine owner only");
        assert!(amount.0 > 0, "positive amount required");
        let balance = m.vaults.get_mut(&vault_name).expect("unknown vault");
        balance.0 = balance
            .0
            .checked_sub(amount.0)
            .expect("insufficient vault balance");
        self.vault_liabilities -= amount.0;
        self.save_machine(&machine_id, &m);
        self.transfer_with_recovery(m.owner, amount.0);
    }
    #[private]
    pub fn on_transfer(&mut self, account: AccountId, amount: U128) {
        self.in_flight -= amount.0;
        if env::promise_result_checked(0, 0).is_err() {
            let old = self.unclaimed.get(&account).unwrap_or(0);
            self.unclaimed.insert(
                &account,
                &old.checked_add(amount.0).expect("credit overflow"),
            );
            self.unclaimed_total += amount.0;
        }
    }
}
impl Contract {
    fn transfer_with_recovery(&mut self, account: AccountId, amount: u128) {
        if amount == 0 {
            return;
        }
        self.in_flight = self
            .in_flight
            .checked_add(amount)
            .expect("transfer overflow");
        Promise::new(account.clone())
            .transfer(NearToken::from_yoctonear(amount))
            .then(Promise::new(env::current_account_id()).function_call(
                "on_transfer",
                must(serde_json::to_vec(
                    &serde_json::json!({"account":account,"amount":U128(amount)}),
                )),
                NearToken::from_yoctonear(0),
                near_sdk::Gas::from_tgas(5),
            ))
            .detach();
    }
}

// Exact G3 root layout. Borsh rejects this after the G5 root has been written.
#[derive(near_sdk::borsh::BorshDeserialize)]
#[borsh(crate = "near_sdk::borsh")]
struct LegacyContract {
    portal: PortalConfig,
    payouts: LookupMap<String, String>,
    machines: LookupMap<String, String>,
    orders: LookupMap<(String, String), String>,
}
#[near]
impl Contract {
    /// G4b changes constants only. Decode and rewrite the exact same root;
    /// all map handles, accounting, fee policy and Portal state remain intact.
    #[init(ignore_state)]
    #[private]
    pub fn migrate_g4b() -> Self {
        assert!(!env::storage_has_key(b"g4b-migrated"), "already migrated");
        let c: Self = env::state_read().expect("G5 state required");
        env::storage_write(b"g4b-migrated", b"1");
        c
    }
    /// One-time self-account G3 migration, before access-key removal.
    /// IDs must be enumerated from a full view_state snapshot by the deployer.
    #[init(ignore_state)]
    #[private]
    pub fn migrate_g3(
        owner_id: AccountId,
        min_fee_yocto_per_wei: U128,
        epoch_blocks: U64,
        epoch_budget_wei: U128,
        max_wei_per_payout: U128,
        signature_timeout_blocks: U64,
        machine_ids: Vec<String>,
        order_keys: Vec<(String, String)>,
    ) -> Self {
        assert!(!env::storage_has_key(b"g5-migrated"), "already migrated");
        let old: LegacyContract = env::state_read().expect("G3 state required");
        let mut c = Self::new(
            owner_id,
            min_fee_yocto_per_wei,
            epoch_blocks,
            epoch_budget_wei,
            max_wei_per_payout,
            signature_timeout_blocks,
            Some(PortalConfig {
                next_nonce: U64(0),
                max_fee_per_gas: old.portal.fee_upper_bound,
                ..old.portal.clone()
            }),
        );
        let next_nonce = old.portal.next_nonce;
        c.portal.next_nonce = next_nonce;
        c.payouts = old.payouts;
        c.machines = old.machines;
        c.orders = old.orders;
        for id in machine_ids {
            let m = c.load_machine(&id);
            for amount in m.vaults.values() {
                c.vault_liabilities = c
                    .vault_liabilities
                    .checked_add(amount.0)
                    .expect("vault overflow");
            }
            c.save_machine(&id, &m); // Remove legacy history vectors; payout map retains every record.
        }
        for key in order_keys {
            let raw = c.orders.get(&key).expect("missing legacy order");
            let value: serde_json::Value = must(serde_json::from_str(&raw));
            for order in value["engine_state"]["orders"]
                .as_object()
                .expect("engine orders")
                .values()
            {
                for held in order["held"].as_array().expect("held flows") {
                    let amount: u128 = must(held["amount"].as_str().expect("held amount").parse());
                    c.escrow_liabilities = c
                        .escrow_liabilities
                        .checked_add(amount)
                        .expect("escrow overflow");
                }
            }
        }
        for i in 0..next_nonce.0 {
            let p = c.get_payout(i.to_string()).expect("legacy nonce gap");
            c.epoch_spent = c
                .epoch_spent
                .checked_add(p.wei.0)
                .expect("legacy budget overflow");
            c.save_payout(&p);
        }
        assert!(
            c.epoch_spent <= c.epoch_budget_wei.0,
            "legacy payouts exceed epoch budget"
        );
        env::storage_write(b"g5-migrated", b"1");
        c
    }
}
