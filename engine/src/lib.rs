//! Deterministic, network-free money-machine interpreter.
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::borrow::Cow;
use std::collections::{BTreeMap, VecDeque};
pub const MAX_NODES: usize = 32;
pub const MAX_FLOWS: u64 = 64;

/// Decimal strings preserve the full u128 range in JSON and JavaScript.
pub mod amount {
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(v: &u128, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&v.to_string())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u128, D::Error> {
        let text = String::deserialize(d)?;
        if text.is_empty()
            || !text.bytes().all(|b| b.is_ascii_digit())
            || (text.len() > 1 && text.starts_with('0'))
        {
            return Err(serde::de::Error::custom(
                "expected canonical unsigned decimal string",
            ));
        }
        text.parse().map_err(serde::de::Error::custom)
    }
}

pub type OrderId = String;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Machine {
    #[serde(with = "amount")]
    pub portal_cap_wei: u128,
    #[serde(deserialize_with = "unique_nodes")]
    pub nodes: BTreeMap<String, Part>,
}
fn unique_nodes<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> Result<BTreeMap<String, Part>, D::Error> {
    struct Unique;
    impl<'de> serde::de::Visitor<'de> for Unique {
        type Value = BTreeMap<String, Part>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            f.write_str("unique node IDs")
        }
        fn visit_map<A: serde::de::MapAccess<'de>>(
            self,
            mut map: A,
        ) -> Result<Self::Value, A::Error> {
            let mut nodes = BTreeMap::new();
            while let Some((id, part)) = map.next_entry::<String, Part>()? {
                if nodes.insert(id, part).is_some() {
                    return Err(serde::de::Error::custom("duplicate node ID"));
                }
            }
            Ok(nodes)
        }
    }
    d.deserialize_map(Unique)
}

/// Persist only in trusted host storage; never accept this token from callers.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ValidatedMachine {
    machine: Machine,
    hash: [u8; 32],
    source: String,
    #[serde(with = "amount")]
    price: u128,
    has_portal: bool,
}
impl std::ops::Deref for ValidatedMachine {
    type Target = Machine;
    fn deref(&self) -> &Machine {
        &self.machine
    }
}
mod sealed {
    pub trait Sealed {}
}
impl sealed::Sealed for Machine {}
impl sealed::Sealed for ValidatedMachine {}
pub trait MachineInput: sealed::Sealed {
    fn validated(&self) -> Result<Cow<'_, ValidatedMachine>, EngineError>;
}
impl MachineInput for Machine {
    fn validated(&self) -> Result<Cow<'_, ValidatedMachine>, EngineError> {
        validate(self)
            .map(Cow::Owned)
            .map_err(EngineError::InvalidMachine)
    }
}
impl MachineInput for ValidatedMachine {
    fn validated(&self) -> Result<Cow<'_, ValidatedMachine>, EngineError> {
        Ok(Cow::Borrowed(self))
    }
}

pub fn valid_near_account(account: &str) -> bool {
    if !(2..=64).contains(&account.len()) {
        return false;
    }
    let mut separator = true;
    for b in account.bytes() {
        if b.is_ascii_lowercase() || b.is_ascii_digit() {
            separator = false;
        } else if matches!(b, b'.' | b'-' | b'_') && !separator {
            separator = true;
        } else {
            return false;
        }
    }
    !separator
}
pub fn valid_evm_recipient(address: &str) -> bool {
    address.len() == 42
        && address.starts_with("0x")
        && address.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum Part {
    CoinSlot {
        #[serde(with = "amount")]
        price: u128,
        output: String,
    },
    Splitter {
        outputs: Vec<Share>,
    },
    Vault {
        name: String,
    },
    Gate {
        condition: Condition,
        pass: String,
        fail: String,
    },
    Worker {
        gates: Vec<String>,
    },
    Payout {
        account: String,
    },
    Portal {
        chain: String,
        #[serde(with = "amount")]
        wei: u128,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Share {
    pub bps: u16,
    pub target: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", deny_unknown_fields)]
pub enum Condition {
    MinAmount {
        #[serde(with = "amount")]
        amount: u128,
    },
    NeedsApproval {
        worker: String,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub enum ValidationError {
    TooManyNodes,
    TooManyFlows,
    ZeroPrice(String),
    IdenticalApprovalTargets(String),
    InvalidAccount(String),
    InvalidVaultName(String),
    Cycle(String),
    CoinSlotCount(usize),
    UnconnectedOutput(String),
    UnreachableNode(String),
    InvalidSplitter(String),
    PortalAboveCap(String),
    MissingWorker(String),
    MissingNode(String),
    InvalidWorkerScope(String),
    InvalidFlowTarget(String),
    UnsupportedChain(String),
}
fn targets(part: &Part) -> Vec<&str> {
    match part {
        Part::CoinSlot { output, .. } => vec![output],
        Part::Splitter { outputs } => outputs.iter().map(|s| s.target.as_str()).collect(),
        Part::Gate { pass, fail, .. } => vec![pass, fail],
        _ => vec![],
    }
}
pub fn validate(m: &Machine) -> Result<ValidatedMachine, Vec<ValidationError>> {
    use ValidationError::*;
    let mut errors = vec![];
    if m.nodes.len() > MAX_NODES {
        return Err(vec![TooManyNodes]);
    }
    let sources: Vec<_> = m
        .nodes
        .iter()
        .filter(|(_, p)| matches!(p, Part::CoinSlot { .. }))
        .map(|(id, _)| id.clone())
        .collect();
    if sources.len() != 1 {
        errors.push(CoinSlotCount(sources.len()));
    }
    for (id, p) in &m.nodes {
        for t in targets(p) {
            if t.is_empty() {
                errors.push(UnconnectedOutput(id.clone()));
            } else if !m.nodes.contains_key(t) {
                errors.push(MissingNode(t.into()));
            } else if matches!(m.nodes[t], Part::Worker { .. } | Part::CoinSlot { .. }) {
                errors.push(InvalidFlowTarget(t.into()));
            }
        }
        match p {
            Part::CoinSlot { price: 0, .. } => errors.push(ZeroPrice(id.clone())),
            Part::Payout { account } if account != "$payer" && !valid_near_account(account) => {
                errors.push(InvalidAccount(id.clone()))
            }
            Part::Vault { name } if name.is_empty() || name.chars().count() > 32 => {
                errors.push(InvalidVaultName(id.clone()))
            }
            Part::Splitter { outputs }
                if outputs.iter().any(|s| s.bps == 0)
                    || !(2..=4).contains(&outputs.len())
                    || outputs.iter().map(|s| u32::from(s.bps)).sum::<u32>() != 10000 =>
            {
                errors.push(InvalidSplitter(id.clone()))
            }
            Part::Portal { wei, chain } => {
                if *wei > m.portal_cap_wei {
                    errors.push(PortalAboveCap(id.clone()));
                }
                if chain != "sepolia" {
                    errors.push(UnsupportedChain(id.clone()));
                }
            }
            Part::Gate {
                condition: Condition::NeedsApproval { worker },
                pass,
                fail,
            } => {
                if pass == fail {
                    errors.push(IdenticalApprovalTargets(id.clone()));
                }
                match m.nodes.get(worker) {
                    Some(Part::Worker { gates }) => {
                        if !gates.contains(id) {
                            errors.push(InvalidWorkerScope(id.clone()));
                        }
                    }
                    _ => errors.push(MissingWorker(worker.clone())),
                }
            }
            Part::Worker { gates } => {
                for gate in gates {
                    if !matches!(m.nodes.get(gate), Some(Part::Gate { condition: Condition::NeedsApproval { worker }, .. }) if worker == id)
                    {
                        errors.push(InvalidWorkerScope(id.clone()));
                    }
                }
            }
            _ => {}
        }
    }
    // Kahn's algorithm also accounts for parallel ports as separate paths.
    let mut indegree: BTreeMap<_, usize> = m.nodes.keys().map(|id| (id.clone(), 0)).collect();
    for p in m.nodes.values() {
        for t in targets(p) {
            if let Some(d) = indegree.get_mut(t) {
                *d += 1;
            }
        }
    }
    let mut queue: VecDeque<_> = indegree
        .iter()
        .filter(|(_, d)| **d == 0)
        .map(|(id, _)| id.clone())
        .collect();
    let mut paths: BTreeMap<String, u64> = sources.iter().map(|id| (id.clone(), 1)).collect();
    let mut visited = 0;
    let mut total = 0u64;
    let mut portal_total = 0u128;
    let mut portal_overflow = false;
    while let Some(id) = queue.pop_front() {
        visited += 1;
        let count = *paths.get(&id).unwrap_or(&0);
        total = total.saturating_add(count);
        if let Part::Portal { wei, .. } = &m.nodes[&id] {
            match wei
                .checked_mul(u128::from(count))
                .and_then(|v| portal_total.checked_add(v))
            {
                Some(v) => portal_total = v,
                None => portal_overflow = true,
            }
        }
        for t in targets(&m.nodes[&id]) {
            if let Some(d) = indegree.get_mut(t) {
                let n = paths.entry(t.into()).or_default();
                *n = n.saturating_add(count);
                *d -= 1;
                if *d == 0 {
                    queue.push_back(t.into());
                }
            }
        }
    }
    if visited != m.nodes.len() {
        errors.push(Cycle("flow graph".into()));
    }
    if total > MAX_FLOWS {
        errors.push(TooManyFlows);
    }
    if portal_overflow || portal_total > m.portal_cap_wei {
        errors.push(PortalAboveCap("machine aggregate".into()));
    }
    let mut reachable = BTreeMap::new();
    let mut todo = sources;
    while let Some(id) = todo.pop() {
        if reachable.insert(id.clone(), ()).is_some() {
            continue;
        }
        if let Some(p) = m.nodes.get(&id) {
            todo.extend(targets(p).into_iter().map(str::to_owned));
            if let Part::Gate {
                condition: Condition::NeedsApproval { worker },
                ..
            } = p
            {
                todo.push(worker.clone());
            }
        }
    }
    for id in m.nodes.keys() {
        if !reachable.contains_key(id) {
            errors.push(UnreachableNode(id.clone()));
        }
    }
    if errors.is_empty() {
        let source = sources_for(m);
        let price = match m.nodes[&source] {
            Part::CoinSlot { price, .. } => price,
            _ => unreachable!(),
        };
        Ok(ValidatedMachine {
            hash: Sha256::digest(serde_json::to_vec(m).expect("machine JSON serialization")).into(),
            source,
            price,
            has_portal: m.nodes.values().any(|p| matches!(p, Part::Portal { .. })),
            machine: m.clone(),
        })
    } else {
        Err(errors)
    }
}
fn sources_for(m: &Machine) -> String {
    m.nodes
        .iter()
        .find(|(_, p)| matches!(p, Part::CoinSlot { .. }))
        .unwrap()
        .0
        .clone()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub enum Effect {
    VaultCredit {
        name: String,
        #[serde(with = "amount")]
        amount: u128,
    },
    Payout {
        account: String,
        #[serde(with = "amount")]
        amount: u128,
    },
    /// `fee` is the NEAR inflow; `wei` is an external-chain amount, never added to NEAR.
    ExternalPayout {
        recipient: String,
        #[serde(with = "amount")]
        wei: u128,
        #[serde(with = "amount")]
        fee: u128,
    },
}
impl Effect {
    pub fn inflow(&self) -> u128 {
        match self {
            Self::VaultCredit { amount, .. } | Self::Payout { amount, .. } => *amount,
            Self::ExternalPayout { fee, .. } => *fee,
        }
    }
}
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Outcome {
    pub effects: Vec<Effect>,
    pub trace: Vec<String>,
    pub pending: bool,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub enum EngineError {
    MachineMismatch,
    InvalidMachine(Vec<ValidationError>),
    DuplicateOrder,
    WrongAmount,
    WrongWorker,
    NotPending,
    MissingExternalRecipient,
    Overflow,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Held {
    gate: String,
    pass: String,
    fail: String,
    #[serde(with = "amount")]
    amount: u128,
    worker: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Order {
    machine_hash: [u8; 32],
    approved_workers: Vec<String>,
    payer: String,
    recipient: Option<String>,
    held: Vec<Held>,
}
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct State {
    #[serde(with = "vault_amounts")]
    pub vaults: BTreeMap<String, u128>,
    orders: BTreeMap<OrderId, Order>,
}
fn run(
    vaults: &BTreeMap<String, u128>,
    staged: &mut BTreeMap<String, u128>,
    m: &Machine,
    order: &mut Order,
    flows: Vec<(String, u128)>,
) -> Result<Outcome, EngineError> {
    let mut result = Outcome::default();
    // A stack with reversed pushes preserves declared port order.
    let mut todo: Vec<_> = flows.into_iter().rev().collect();
    while let Some((id, value)) = todo.pop() {
        result.trace.push(format!("{id}: {value} yoctoNEAR"));
        match &m.nodes[&id] {
            Part::CoinSlot { output, .. } => todo.push((output.clone(), value)),
            Part::Splitter { outputs } => {
                let mut amounts: Vec<_> = outputs
                    .iter()
                    .map(|s| {
                        (value / 10000) * u128::from(s.bps)
                            + (value % 10000) * u128::from(s.bps) / 10000
                    })
                    .collect();
                amounts[0] += value - amounts.iter().sum::<u128>();
                for (s, a) in outputs.iter().zip(&amounts) {
                    result.trace.push(format!(
                        "Splitter '{id}': {} bps -> {} ({a} yoctoNEAR)",
                        s.bps, s.target
                    ));
                }
                todo.extend(
                    outputs
                        .iter()
                        .zip(amounts)
                        .rev()
                        .map(|(s, a)| (s.target.clone(), a)),
                );
            }
            Part::Gate {
                condition: Condition::MinAmount { amount },
                pass,
                fail,
            } => {
                let target = if value >= *amount { pass } else { fail };
                result.trace.push(format!("Gate '{id}': -> {target}"));
                todo.push((target.clone(), value));
            }
            Part::Gate {
                condition: Condition::NeedsApproval { worker },
                pass,
                fail,
            } => {
                result
                    .trace
                    .push(format!("Gate '{id}': pending approval by {worker}"));
                order.held.push(Held {
                    gate: id,
                    pass: pass.clone(),
                    fail: fail.clone(),
                    amount: value,
                    worker: worker.clone(),
                });
            }
            Part::Vault { name } => {
                let balance = staged
                    .entry(name.clone())
                    .or_insert_with(|| *vaults.get(name).unwrap_or(&0));
                *balance = balance.checked_add(value).ok_or(EngineError::Overflow)?;
                result.effects.push(Effect::VaultCredit {
                    name: name.clone(),
                    amount: value,
                });
            }
            Part::Payout { account } => result.effects.push(Effect::Payout {
                account: if account == "$payer" {
                    order.payer.clone()
                } else {
                    account.clone()
                },
                amount: value,
            }),
            Part::Portal { wei, .. } if value > 0 => result.effects.push(Effect::ExternalPayout {
                recipient: order
                    .recipient
                    .clone()
                    .filter(|s| !s.is_empty())
                    .ok_or(EngineError::MissingExternalRecipient)?,
                wei: *wei,
                fee: value,
            }),
            Part::Portal { .. } => {}
            Part::Worker { .. } => unreachable!("validation excludes worker flow targets"),
        }
    }
    result.pending = !order.held.is_empty();
    Ok(result)
}
pub fn submit_order<M: MachineInput>(
    state: &mut State,
    m: &M,
    id: OrderId,
    payer: String,
    amount: u128,
    external_recipient: Option<String>,
) -> Result<Outcome, EngineError> {
    let validated = m.validated()?;
    let m = validated.as_ref();
    if state.orders.contains_key(&id) {
        return Err(EngineError::DuplicateOrder);
    }
    let source = m.source.clone();
    let price = m.price;
    if amount != price {
        return Err(EngineError::WrongAmount);
    }
    if m.has_portal
        && !external_recipient
            .as_deref()
            .is_some_and(valid_evm_recipient)
    {
        return Err(EngineError::MissingExternalRecipient);
    }
    let mut staged = BTreeMap::new();
    let mut order = Order {
        machine_hash: m.hash,
        approved_workers: vec![],
        payer,
        recipient: external_recipient,
        held: vec![],
    };
    let outcome = run(
        &state.vaults,
        &mut staged,
        m,
        &mut order,
        vec![(source, amount)],
    )?;
    state.vaults.extend(staged);
    state.orders.insert(id, order);
    Ok(outcome)
}
fn resolve<M: MachineInput>(
    state: &mut State,
    m: &M,
    id: OrderId,
    worker: Option<&str>,
) -> Result<Outcome, EngineError> {
    let validated = m.validated()?;
    let m = validated.as_ref();
    let mut order = state
        .orders
        .get(&id)
        .ok_or(EngineError::NotPending)?
        .clone();
    if order.machine_hash != m.hash {
        return Err(EngineError::MachineMismatch);
    }
    let mut staged = BTreeMap::new();
    if order.held.is_empty() {
        return Err(EngineError::NotPending);
    }
    if let Some(w) = worker {
        if !order.held.iter().any(|h| h.worker == w) {
            return Err(if order.approved_workers.iter().any(|a| a == w) {
                EngineError::NotPending
            } else {
                EngineError::WrongWorker
            });
        }
        order.approved_workers.push(w.into());
    }
    let mut flows = vec![];
    let held = std::mem::take(&mut order.held);
    for h in held {
        if worker.is_some_and(|w| w != h.worker) {
            order.held.push(h);
            continue;
        }
        flows.push((if worker.is_some() { h.pass } else { h.fail }, h.amount));
    }
    let mut outcome = run(&state.vaults, &mut staged, m, &mut order, flows)?;
    outcome.trace.insert(
        0,
        format!(
            "Order '{id}': {}",
            if worker.is_some() {
                "approved"
            } else {
                "expired"
            }
        ),
    );
    state.vaults.extend(staged);
    state.orders.insert(id, order);
    Ok(outcome)
}
pub fn approve<M: MachineInput>(
    state: &mut State,
    m: &M,
    id: OrderId,
    worker: &str,
) -> Result<Outcome, EngineError> {
    resolve(state, m, id, Some(worker))
}
/// Caller decides when expiry is authorized; the pure engine has no clock.
pub fn expire<M: MachineInput>(
    state: &mut State,
    m: &M,
    id: OrderId,
) -> Result<Outcome, EngineError> {
    resolve(state, m, id, None)
}

mod vault_amounts {
    use super::*;
    #[derive(Serialize, Deserialize)]
    struct Decimal(#[serde(with = "amount")] u128);
    pub fn serialize<S: serde::Serializer>(
        v: &BTreeMap<String, u128>,
        s: S,
    ) -> Result<S::Ok, S::Error> {
        v.iter()
            .map(|(k, v)| (k, Decimal(*v)))
            .collect::<BTreeMap<_, _>>()
            .serialize(s)
    }
    pub fn deserialize<'de, D: serde::Deserializer<'de>>(
        d: D,
    ) -> Result<BTreeMap<String, u128>, D::Error> {
        Ok(BTreeMap::<String, Decimal>::deserialize(d)?
            .into_iter()
            .map(|(k, v)| (k, v.0))
            .collect())
    }
}
