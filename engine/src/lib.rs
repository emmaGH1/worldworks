//! Deterministic, network-free money-machine interpreter.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Decimal strings preserve the full u128 range in JSON and JavaScript.
pub mod amount {
    use serde::{Deserialize, Deserializer, Serializer};
    pub fn serialize<S: Serializer>(v: &u128, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&v.to_string())
    }
    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<u128, D::Error> {
        String::deserialize(d)?
            .parse()
            .map_err(serde::de::Error::custom)
    }
}

pub type OrderId = String;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Machine {
    #[serde(with = "amount")]
    pub portal_cap_wei: u128,
    pub nodes: BTreeMap<String, Part>,
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

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ValidationError {
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
pub fn validate(m: &Machine) -> Result<(), Vec<ValidationError>> {
    use ValidationError::*;
    let mut errors = vec![];
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
            Part::Splitter { outputs }
                if !(2..=4).contains(&outputs.len())
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
                ..
            } => match m.nodes.get(worker) {
                Some(Part::Worker { gates }) => {
                    if !gates.contains(id) {
                        errors.push(InvalidWorkerScope(id.clone()));
                    }
                }
                _ => errors.push(MissingWorker(worker.clone())),
            },
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
    fn visit(
        id: &str,
        m: &Machine,
        marks: &mut BTreeMap<String, u8>,
        errors: &mut Vec<ValidationError>,
    ) {
        match marks.get(id) {
            Some(1) => {
                errors.push(ValidationError::Cycle(id.into()));
                return;
            }
            Some(2) => return,
            _ => {}
        }
        marks.insert(id.into(), 1);
        if let Some(p) = m.nodes.get(id) {
            for t in targets(p) {
                if m.nodes.contains_key(t) {
                    visit(t, m, marks, errors);
                }
            }
        }
        marks.insert(id.into(), 2);
    }
    let mut marks = BTreeMap::new();
    for id in m.nodes.keys() {
        visit(id, m, &mut marks, &mut errors);
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
        Ok(())
    } else {
        Err(errors)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Effect {
    VaultCredit {
        name: String,
        amount: u128,
    },
    Payout {
        account: String,
        amount: u128,
    },
    /// `fee` is the NEAR inflow; `wei` is an external-chain amount, never added to NEAR.
    ExternalPayout {
        recipient: String,
        wei: u128,
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
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Outcome {
    pub effects: Vec<Effect>,
    pub trace: Vec<String>,
    pub pending: bool,
}
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EngineError {
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
    amount: u128,
    worker: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct Order {
    payer: String,
    recipient: Option<String>,
    held: Vec<Held>,
}
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct State {
    pub vaults: BTreeMap<String, u128>,
    orders: BTreeMap<OrderId, Order>,
}
fn run(
    state: &mut State,
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
                ..
            } => {
                result
                    .trace
                    .push(format!("Gate '{id}': pending approval by {worker}"));
                order.held.push(Held {
                    gate: id,
                    amount: value,
                    worker: worker.clone(),
                });
            }
            Part::Vault { name } => {
                let balance = state.vaults.entry(name.clone()).or_default();
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
            Part::Portal { wei, .. } => result.effects.push(Effect::ExternalPayout {
                recipient: order
                    .recipient
                    .clone()
                    .filter(|s| !s.is_empty())
                    .ok_or(EngineError::MissingExternalRecipient)?,
                wei: *wei,
                fee: value,
            }),
            Part::Worker { .. } => unreachable!("validation excludes worker flow targets"),
        }
    }
    result.pending = !order.held.is_empty();
    Ok(result)
}
pub fn submit_order(
    state: &mut State,
    m: &Machine,
    id: OrderId,
    payer: String,
    amount: u128,
    external_recipient: Option<String>,
) -> Result<Outcome, EngineError> {
    validate(m).map_err(EngineError::InvalidMachine)?;
    if state.orders.contains_key(&id) {
        return Err(EngineError::DuplicateOrder);
    }
    let (source, price) = m
        .nodes
        .iter()
        .find_map(|(id, p)| {
            if let Part::CoinSlot { price, .. } = p {
                Some((id.clone(), *price))
            } else {
                None
            }
        })
        .unwrap();
    if amount != price {
        return Err(EngineError::WrongAmount);
    }
    let mut next = state.clone();
    let mut order = Order {
        payer,
        recipient: external_recipient,
        held: vec![],
    };
    let outcome = run(&mut next, m, &mut order, vec![(source, amount)])?;
    next.orders.insert(id, order);
    *state = next;
    Ok(outcome)
}
fn resolve(
    state: &mut State,
    m: &Machine,
    id: OrderId,
    worker: Option<&str>,
) -> Result<Outcome, EngineError> {
    validate(m).map_err(EngineError::InvalidMachine)?;
    let mut next = state.clone();
    let mut order = next.orders.remove(&id).ok_or(EngineError::NotPending)?;
    if order.held.is_empty() {
        return Err(EngineError::NotPending);
    }
    if let Some(w) = worker {
        if !order.held.iter().any(|h| h.worker == w) {
            return Err(EngineError::WrongWorker);
        }
    }
    let mut flows = vec![];
    let held = std::mem::take(&mut order.held);
    for h in held {
        if worker.is_some_and(|w| w != h.worker) {
            order.held.push(h);
            continue;
        }
        let Some(Part::Gate {
            condition: Condition::NeedsApproval { worker: scoped },
            pass,
            fail,
        }) = m.nodes.get(&h.gate)
        else {
            return Err(EngineError::NotPending);
        };
        if scoped != &h.worker {
            return Err(EngineError::WrongWorker);
        }
        flows.push((if worker.is_some() { pass } else { fail }.clone(), h.amount));
    }
    let mut outcome = run(&mut next, m, &mut order, flows)?;
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
    next.orders.insert(id, order);
    *state = next;
    Ok(outcome)
}
pub fn approve(
    state: &mut State,
    m: &Machine,
    id: OrderId,
    worker: &str,
) -> Result<Outcome, EngineError> {
    resolve(state, m, id, Some(worker))
}
/// Caller decides when expiry is authorized; the pure engine has no clock.
pub fn expire(state: &mut State, m: &Machine, id: OrderId) -> Result<Outcome, EngineError> {
    resolve(state, m, id, None)
}
