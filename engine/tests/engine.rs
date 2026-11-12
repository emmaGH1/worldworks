use proptest::prelude::*;
use worldworks_engine::*;
fn vending() -> Machine {
    serde_json::from_str(include_str!("../examples/vending.json")).unwrap()
}
fn escrow() -> Machine {
    serde_json::from_str(include_str!("../examples/escrow.json")).unwrap()
}
fn price(m: &Machine) -> u128 {
    m.nodes
        .values()
        .find_map(|p| match p {
            Part::CoinSlot { price, .. } => Some(*price),
            _ => None,
        })
        .unwrap()
}
fn buy(s: &mut State, m: &Machine, id: &str) -> Result<Outcome, EngineError> {
    submit_order(
        s,
        m,
        id.into(),
        "buyer.testnet".into(),
        price(m),
        Some("0x1111111111111111111111111111111111111111".into()),
    )
}
fn rejects(m: Machine, predicate: impl Fn(&ValidationError) -> bool) {
    assert!(validate(&m).unwrap_err().iter().any(predicate));
}
#[test]
fn rejects_cycle() {
    let mut m = vending();
    if let Part::Splitter { outputs } = m.nodes.get_mut("fees").unwrap() {
        outputs[0].target = "fees".into();
    }
    rejects(m, |e| matches!(e, ValidationError::Cycle(_)));
}
#[test]
fn rejects_no_coin_slot() {
    let mut m = vending();
    m.nodes.remove("slot");
    rejects(m, |e| matches!(e, ValidationError::CoinSlotCount(0)));
}
#[test]
fn rejects_multiple_coin_slots() {
    let mut m = vending();
    m.nodes.insert("second".into(), m.nodes["slot"].clone());
    rejects(m, |e| matches!(e, ValidationError::CoinSlotCount(2)));
}
#[test]
fn rejects_unconnected_output() {
    let mut m = escrow();
    if let Part::Gate { fail, .. } = m.nodes.get_mut("review").unwrap() {
        fail.clear();
    }
    rejects(m, |e| matches!(e, ValidationError::UnconnectedOutput(_)));
}
#[test]
fn rejects_unreachable_node() {
    let mut m = vending();
    m.nodes.insert(
        "unused".into(),
        Part::Vault {
            name: "unused".into(),
        },
    );
    rejects(m, |e| matches!(e, ValidationError::UnreachableNode(_)));
}
#[test]
fn rejects_splitter_sum() {
    let mut m = vending();
    if let Part::Splitter { outputs } = m.nodes.get_mut("fees").unwrap() {
        outputs[0].bps = 7001;
    }
    rejects(m, |e| matches!(e, ValidationError::InvalidSplitter(_)));
}
#[test]
fn rejects_splitter_output_count() {
    for count in [0, 1, 5] {
        let mut m = vending();
        m.nodes.insert(
            "fees".into(),
            Part::Splitter {
                outputs: (0..count)
                    .map(|_| Share {
                        bps: if count == 0 { 0 } else { 10000 / count },
                        target: "reserve_fee".into(),
                    })
                    .collect(),
            },
        );
        rejects(m, |e| matches!(e, ValidationError::InvalidSplitter(_)));
    }
}
#[test]
fn rejects_portal_above_cap() {
    let mut m = vending();
    m.portal_cap_wei = 1;
    rejects(m, |e| matches!(e, ValidationError::PortalAboveCap(_)));
}
#[test]
fn rejects_missing_worker() {
    let mut m = escrow();
    m.nodes.remove("inspector");
    rejects(m, |e| matches!(e, ValidationError::MissingWorker(_)));
}
#[test]
fn rejects_missing_edge_target() {
    let mut m = vending();
    m.nodes.remove("reserve");
    rejects(m, |e| matches!(e, ValidationError::MissingNode(_)));
}
#[test]
fn rejects_invalid_worker_scope() {
    let mut m = escrow();
    m.nodes.insert(
        "inspector".into(),
        Part::Worker {
            gates: vec!["seller".into()],
        },
    );
    rejects(m, |e| matches!(e, ValidationError::InvalidWorkerScope(_)));
}
#[test]
fn rejects_worker_as_flow_target() {
    let mut m = escrow();
    if let Part::Gate { pass, .. } = m.nodes.get_mut("review").unwrap() {
        *pass = "inspector".into();
    }
    rejects(m, |e| matches!(e, ValidationError::InvalidFlowTarget(_)));
}
#[test]
fn rejects_unsupported_chain() {
    let mut m = vending();
    if let Part::Portal { chain, .. } = m.nodes.get_mut("portal").unwrap() {
        *chain = "mainnet".into();
    }
    rejects(m, |e| matches!(e, ValidationError::UnsupportedChain(_)));
}
#[test]
fn rejects_duplicate_order() {
    let m = vending();
    let mut s = State::default();
    buy(&mut s, &m, "1").unwrap();
    let snapshot = s.clone();
    assert_eq!(buy(&mut s, &m, "1"), Err(EngineError::DuplicateOrder));
    assert_eq!(s, snapshot);
}
#[test]
fn rejects_wrong_amount() {
    let m = vending();
    let mut s = State::default();
    assert_eq!(
        submit_order(&mut s, &m, "1".into(), "buyer".into(), 1, None),
        Err(EngineError::WrongAmount)
    );
    assert_eq!(s, State::default());
}
#[test]
fn rejects_wrong_worker() {
    let m = escrow();
    let mut s = State::default();
    buy(&mut s, &m, "1").unwrap();
    let snapshot = s.clone();
    assert_eq!(
        approve(&mut s, &m, "1".into(), "intruder"),
        Err(EngineError::WrongWorker)
    );
    assert_eq!(s, snapshot);
}
#[test]
fn rejects_non_pending_approval() {
    let m = vending();
    let mut s = State::default();
    assert_eq!(
        approve(&mut s, &m, "missing".into(), "inspector"),
        Err(EngineError::NotPending)
    );
    buy(&mut s, &m, "1").unwrap();
    assert_eq!(
        approve(&mut s, &m, "1".into(), "inspector"),
        Err(EngineError::NotPending)
    );
}
#[test]
fn rejects_double_approval() {
    let m = escrow();
    let mut s = State::default();
    buy(&mut s, &m, "1").unwrap();
    approve(&mut s, &m, "1".into(), "inspector").unwrap();
    assert_eq!(
        approve(&mut s, &m, "1".into(), "inspector"),
        Err(EngineError::NotPending)
    );
    assert_eq!(expire(&mut s, &m, "1".into()), Err(EngineError::NotPending));
}
#[test]
fn two_machines_different_outcomes() {
    let (v, e) = (vending(), escrow());
    assert_eq!(price(&v), price(&e));
    let immediate = buy(&mut State::default(), &v, "same-order").unwrap();
    assert!(!immediate.pending);
    assert!(immediate
        .effects
        .iter()
        .any(|e| matches!(e, Effect::ExternalPayout { .. })));
    assert_eq!(
        immediate.effects.iter().map(Effect::inflow).sum::<u128>(),
        price(&v)
    );
    let mut s = State::default();
    let pending = buy(&mut s, &e, "same-order").unwrap();
    assert!(pending.pending);
    assert!(pending.effects.is_empty());
    let release = approve(&mut s, &e, "same-order".into(), "inspector").unwrap();
    assert!(!release.pending);
    assert_eq!(
        release.effects,
        vec![Effect::Payout {
            account: "seller.testnet".into(),
            amount: price(&e)
        }]
    );
}
#[test]
fn expiry_refunds_payer_and_rejects_later_approval() {
    let m = escrow();
    let mut s = State::default();
    buy(&mut s, &m, "1").unwrap();
    assert_eq!(
        expire(&mut s, &m, "1".into()).unwrap().effects,
        vec![Effect::Payout {
            account: "buyer.testnet".into(),
            amount: price(&m)
        }]
    );
    assert_eq!(
        approve(&mut s, &m, "1".into(), "inspector"),
        Err(EngineError::NotPending)
    );
}
#[test]
fn rewire_changes_outcome() {
    let mut m = vending();
    let before = buy(&mut State::default(), &m, "1").unwrap();
    // Move exactly one existing edge in vending.json. The fail port still reaches
    // the Portal, so every node remains structurally reachable.
    if let Part::Gate { pass, .. } = m.nodes.get_mut("delivery").unwrap() {
        *pass = "reserve".into();
    }
    let after = buy(&mut State::default(), &m, "1").unwrap();
    assert!(!after
        .effects
        .iter()
        .any(|e| matches!(e, Effect::ExternalPayout { .. })));
    assert_ne!(before.effects, after.effects);
    assert_eq!(
        after.effects.iter().map(Effect::inflow).sum::<u128>(),
        price(&m)
    );
}
#[test]
fn minimum_amount_fail_branch() {
    let mut m = escrow();
    if let Part::Gate { condition, .. } = m.nodes.get_mut("review").unwrap() {
        *condition = Condition::MinAmount { amount: u128::MAX };
    }
    m.nodes.remove("inspector");
    let o = buy(&mut State::default(), &m, "1").unwrap();
    assert_eq!(
        o.effects,
        vec![Effect::Payout {
            account: "buyer.testnet".into(),
            amount: price(&m)
        }]
    );
}
#[test]
fn missing_recipient_and_overflow_are_atomic() {
    let m = vending();
    let mut s = State::default();
    assert_eq!(
        submit_order(&mut s, &m, "1".into(), "buyer".into(), price(&m), None),
        Err(EngineError::MissingExternalRecipient)
    );
    assert_eq!(s, State::default());
    s.vaults.insert("reserve".into(), u128::MAX);
    let snapshot = s.clone();
    assert_eq!(buy(&mut s, &m, "1"), Err(EngineError::Overflow));
    assert_eq!(s, snapshot);
}
#[test]
fn json_roundtrip_full_u128() {
    let mut m = vending();
    if let Part::CoinSlot { price, .. } = m.nodes.get_mut("slot").unwrap() {
        *price = u128::MAX;
    }
    let decoded: Machine = serde_json::from_str(&serde_json::to_string(&m).unwrap()).unwrap();
    assert_eq!(price(&decoded), u128::MAX);
}
#[derive(Clone, Debug)]
enum Tree {
    Leaf,
    Branch(Vec<(u16, Tree)>),
}
fn trees() -> impl Strategy<Value = Tree> {
    Just(Tree::Leaf).prop_recursive(4, 64, 4, |inner| {
        prop::collection::vec((any::<u16>(), inner), 2..=4).prop_map(|children| {
            let weights: Vec<_> = children.iter().map(|(w, _)| u32::from(*w)).collect();
            let total = weights.iter().sum::<u32>();
            let mut bps: Vec<u16> = weights
                .iter()
                .map(|w| {
                    if total == 0 {
                        0
                    } else {
                        (w * 10000 / total) as u16
                    }
                })
                .collect();
            bps[0] += 10000 - bps.iter().sum::<u16>();
            Tree::Branch(
                children
                    .into_iter()
                    .zip(bps)
                    .map(|((_, t), b)| (b, t))
                    .collect(),
            )
        })
    })
}
fn add_tree(t: &Tree, nodes: &mut std::collections::BTreeMap<String, Part>) -> String {
    let id = format!("node-{}", nodes.len());
    nodes.insert(id.clone(), Part::Vault { name: id.clone() });
    if let Tree::Branch(children) = t {
        let outputs = children
            .iter()
            .map(|(bps, t)| Share {
                bps: *bps,
                target: add_tree(t, nodes),
            })
            .collect();
        nodes.insert(id.clone(), Part::Splitter { outputs });
    }
    id
}
proptest! {
    #![proptest_config(ProptestConfig::with_cases(512))]
    #[test]
    fn splitter_tree_conserves_every_yocto(tree in trees(), paid in any::<u128>()) {
        let mut nodes = std::collections::BTreeMap::new(); let root = add_tree(&tree, &mut nodes);
        nodes.insert("slot".into(), Part::CoinSlot { price: paid, output: root });
        let m = Machine { portal_cap_wei: 0, nodes }; prop_assert_eq!(validate(&m), Ok(()));
        let mut s = State::default(); let out = buy(&mut s, &m, "1").unwrap();
        prop_assert_eq!(out.effects.iter().map(Effect::inflow).sum::<u128>(), paid);
        prop_assert_eq!(s.vaults.values().sum::<u128>(), paid);
        prop_assert_eq!(&out, &buy(&mut State::default(), &m, "1").unwrap());
    }
}
#[test]
fn max_amount_and_first_output_remainder() {
    for paid in [0, 1, 3, 10001, u128::MAX] {
        let m = Machine {
            portal_cap_wei: 0,
            nodes: [
                (
                    "slot".into(),
                    Part::CoinSlot {
                        price: paid,
                        output: "split".into(),
                    },
                ),
                (
                    "split".into(),
                    Part::Splitter {
                        outputs: vec![
                            Share {
                                bps: 5000,
                                target: "a".into(),
                            },
                            Share {
                                bps: 5000,
                                target: "b".into(),
                            },
                        ],
                    },
                ),
                ("a".into(), Part::Vault { name: "a".into() }),
                ("b".into(), Part::Vault { name: "b".into() }),
            ]
            .into(),
        };
        let mut s = State::default();
        buy(&mut s, &m, "1").unwrap();
        assert_eq!(s.vaults["a"], paid / 2 + paid % 2);
        assert_eq!(s.vaults["b"], paid / 2);
    }
}
