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
    Leaf(u8),
    Branch(Vec<(u16, Tree)>),
}
fn trees() -> impl Strategy<Value = Tree> {
    (0u8..3)
        .prop_map(Tree::Leaf)
        .prop_recursive(2, 4, 3, |inner| {
            prop::collection::vec((1u16..=2000, inner), 2..=3).prop_map(|children| {
                let weights: Vec<_> = children.iter().map(|(w, _)| u32::from(*w)).collect();
                let total = weights.iter().sum::<u32>();
                let mut bps: Vec<u16> = weights
                    .iter()
                    .map(|w| {
                        if total == 0 {
                            0
                        } else {
                            (1 + w * (10000 - weights.len() as u32) / total) as u16
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
    if let Tree::Leaf(kind) = t {
        match kind {
            1 => {
                nodes.insert(
                    id.clone(),
                    Part::Portal {
                        chain: "sepolia".into(),
                        wei: 1,
                    },
                );
            }
            2 => {
                let pass = format!("{id}-pass");
                let fail = format!("{id}-fail");
                nodes.insert(pass.clone(), Part::Vault { name: pass.clone() });
                nodes.insert(
                    fail.clone(),
                    Part::Payout {
                        account: "$payer".into(),
                    },
                );
                nodes.insert(
                    id.clone(),
                    Part::Gate {
                        condition: Condition::MinAmount { amount: 10000 },
                        pass,
                        fail,
                    },
                );
            }
            _ => {}
        }
    }
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
    fn splitter_tree_conserves_every_yocto(tree in trees(), paid in prop_oneof![1u128..100, 1u128..=u128::MAX]) {
        let mut nodes = std::collections::BTreeMap::new(); let root = add_tree(&tree, &mut nodes);
        nodes.insert("slot".into(), Part::CoinSlot { price: paid, output: root });
        let m = Machine { portal_cap_wei: u128::MAX, nodes }; prop_assert!(validate(&m).is_ok());
        let mut s = State::default(); let out = buy(&mut s, &m, "1").unwrap();
        prop_assert_eq!(out.effects.iter().map(Effect::inflow).sum::<u128>(), paid);
        prop_assert!(s.vaults.values().sum::<u128>() <= paid);
        prop_assert!(!out.effects.iter().any(|e| matches!(e, Effect::ExternalPayout { fee: 0, .. })), "zero fee payout");
        prop_assert_eq!(&out, &buy(&mut State::default(), &m, "1").unwrap());
    }
}
#[test]
fn max_amount_and_first_output_remainder() {
    for paid in [1, 3, 10001, u128::MAX] {
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

#[test]
fn recipient_checked_before_hold_and_identical_approval_targets_rejected() {
    let mut m = vending();
    m.nodes.insert(
        "inspector".into(),
        Part::Worker {
            gates: vec!["delivery".into()],
        },
    );
    if let Part::Gate {
        condition, fail, ..
    } = m.nodes.get_mut("delivery").unwrap()
    {
        *condition = Condition::NeedsApproval {
            worker: "inspector".into(),
        };
        *fail = "reserve".into();
    }
    for recipient in [
        None,
        Some(""),
        Some("0x123"),
        Some("0xgg11111111111111111111111111111111111111"),
    ] {
        let mut state = State::default();
        assert_eq!(
            submit_order(
                &mut state,
                &m,
                "1".into(),
                "buyer.testnet".into(),
                price(&m),
                recipient.map(str::to_owned)
            ),
            Err(EngineError::MissingExternalRecipient)
        );
        assert_eq!(state, State::default());
    }
    if let Part::Gate { fail, .. } = m.nodes.get_mut("delivery").unwrap() {
        *fail = "portal".into();
    }
    rejects(m, |e| {
        matches!(e, ValidationError::IdenticalApprovalTargets(_))
    });
}
fn chain(count: usize) -> Machine {
    let mut nodes = std::collections::BTreeMap::new();
    nodes.insert(
        "slot".into(),
        Part::CoinSlot {
            price: 1,
            output: "g0".into(),
        },
    );
    nodes.insert(
        "sink".into(),
        Part::Vault {
            name: "sink".into(),
        },
    );
    for n in 0..count - 2 {
        nodes.insert(
            format!("g{n}"),
            Part::Gate {
                condition: Condition::MinAmount { amount: 0 },
                pass: if n == count - 3 {
                    "sink".into()
                } else {
                    format!("g{}", n + 1)
                },
                fail: "sink".into(),
            },
        );
    }
    Machine {
        portal_cap_wei: 0,
        nodes,
    }
}
#[test]
fn iterative_chain_accepts_32_rejects_33_nodes() {
    let m = chain(32);
    assert!(!buy(&mut State::default(), &m, "1").unwrap().pending);
    rejects(chain(33), |e| matches!(e, ValidationError::TooManyNodes));
}
#[test]
fn rejects_path_explosion_and_counts_parallel_ports() {
    let mut m = chain(9);
    for n in 0..7 {
        if let Part::Gate { pass, fail, .. } = m.nodes.get_mut(&format!("g{n}")).unwrap() {
            *fail = pass.clone();
        }
    }
    rejects(m, |e| matches!(e, ValidationError::TooManyFlows));
}
#[test]
fn rejects_zero_price_zero_share_and_aggregate_portal_cap() {
    let mut m = vending();
    if let Part::CoinSlot { price, .. } = m.nodes.get_mut("slot").unwrap() {
        *price = 0;
    }
    rejects(m, |e| matches!(e, ValidationError::ZeroPrice(_)));
    let mut m = vending();
    if let Part::Splitter { outputs } = m.nodes.get_mut("fees").unwrap() {
        outputs[0].bps = 10000;
        outputs[1].bps = 0;
    }
    rejects(m, |e| matches!(e, ValidationError::InvalidSplitter(_)));
    let mut m = vending();
    m.portal_cap_wei /= 2;
    rejects(m, |e| matches!(e, ValidationError::PortalAboveCap(_)));
    let mut m = vending();
    m.nodes.insert(
        "creator".into(),
        Part::Portal {
            chain: "sepolia".into(),
            wei: 1,
        },
    );
    rejects(m, |e| matches!(e, ValidationError::PortalAboveCap(_)));
}
#[test]
fn zero_fee_never_emits_external_payout() {
    let mut m = vending();
    if let Part::CoinSlot { price, .. } = m.nodes.get_mut("slot").unwrap() {
        *price = 1;
    }
    let out = buy(&mut State::default(), &m, "1").unwrap();
    assert!(!out
        .effects
        .iter()
        .any(|e| matches!(e, Effect::ExternalPayout { .. })));
    assert_eq!(out.effects.iter().map(Effect::inflow).sum::<u128>(), 1);
}
#[test]
fn binds_machine_and_persists_held_targets() {
    let m = escrow();
    let mut state = State::default();
    buy(&mut state, &m, "1").unwrap();
    let saved = serde_json::to_value(&state).unwrap();
    assert_eq!(saved["orders"]["1"]["held"][0]["pass"], "seller");
    assert_eq!(saved["orders"]["1"]["held"][0]["fail"], "refund");
    let mut changed = m.clone();
    if let Part::Gate { pass, fail, .. } = changed.nodes.get_mut("review").unwrap() {
        std::mem::swap(pass, fail);
    }
    let snapshot = state.clone();
    assert_eq!(
        approve(&mut state, &changed, "1".into(), "inspector"),
        Err(EngineError::MachineMismatch)
    );
    assert_eq!(
        expire(&mut state, &changed, "1".into()),
        Err(EngineError::MachineMismatch)
    );
    assert_eq!(snapshot, state);
    let canonical: Machine = serde_json::from_str(&serde_json::to_string(&m).unwrap()).unwrap();
    approve(&mut state, &canonical, "1".into(), "inspector").unwrap();
}
#[test]
fn near_accounts_and_vault_names_validated() {
    for account in [
        "a",
        "A.testnet",
        "a..b",
        "a-_b",
        ".ab",
        "ab-",
        "$payerx",
        "a/b",
        &"a".repeat(65),
    ] {
        let mut m = escrow();
        m.nodes.insert(
            "seller".into(),
            Part::Payout {
                account: account.into(),
            },
        );
        rejects(m, |e| matches!(e, ValidationError::InvalidAccount(_)));
    }
    for account in ["ab", "a-b.c_d", "$payer", &"a".repeat(64)] {
        let mut m = escrow();
        m.nodes.insert(
            "seller".into(),
            Part::Payout {
                account: account.into(),
            },
        );
        assert!(validate(&m).is_ok());
    }
    for name in ["".to_owned(), "x".repeat(33)] {
        let mut m = vending();
        m.nodes.insert("reserve".into(), Part::Vault { name });
        rejects(m, |e| matches!(e, ValidationError::InvalidVaultName(_)));
    }
}
#[test]
fn strict_amounts_and_duplicate_node_keys() {
    for amount in [
        "+1",
        "01",
        "00",
        "-1",
        " 1",
        "1 ",
        "１",
        "",
        "340282366920938463463374607431768211456",
    ] {
        let json = format!(r#"{{"portal_cap_wei":"{amount}","nodes":{{}}}}"#);
        assert!(serde_json::from_str::<Machine>(&json).is_err(), "{amount}");
    }
    assert!(serde_json::from_str::<Machine>(r#"{"portal_cap_wei":"0","nodes":{"a":{"type":"Vault","name":"a"},"a":{"type":"Vault","name":"b"}}}"#).is_err());
}
#[test]
fn all_amounts_serialize_as_strings_and_state_roundtrips() {
    let mut m = escrow();
    if let Part::CoinSlot { price, .. } = m.nodes.get_mut("slot").unwrap() {
        *price = u128::MAX;
    }
    let mut state = State::default();
    buy(&mut state, &m, "1").unwrap();
    state.vaults.insert("max".into(), u128::MAX);
    let json = serde_json::to_value(&state).unwrap();
    assert_eq!(json["vaults"]["max"], u128::MAX.to_string());
    assert_eq!(
        json["orders"]["1"]["held"][0]["amount"],
        u128::MAX.to_string()
    );
    assert_eq!(serde_json::from_value::<State>(json).unwrap(), state);
    let out = approve(&mut state, &m, "1".into(), "inspector").unwrap();
    assert_eq!(
        serde_json::to_value(out).unwrap()["effects"][0]["Payout"]["amount"],
        u128::MAX.to_string()
    );
    let out = buy(&mut State::default(), &vending(), "1").unwrap();
    for e in out.effects {
        let json = serde_json::to_value(e).unwrap();
        for fields in json.as_object().unwrap().values() {
            for (key, value) in fields.as_object().unwrap() {
                if ["amount", "fee", "wei"].contains(&key.as_str()) {
                    assert!(value.is_string());
                }
            }
        }
    }
    serde_json::to_string(&EngineError::InvalidMachine(vec![
        ValidationError::TooManyFlows,
    ]))
    .unwrap();
}
#[test]
fn vending_exact_amended_allocation() {
    let out = buy(&mut State::default(), &vending(), "1").unwrap();
    assert_eq!(
        out.effects,
        vec![
            Effect::VaultCredit {
                name: "reserve".into(),
                amount: 630_000_000_000_000_000_000_000
            },
            Effect::ExternalPayout {
                recipient: "0x1111111111111111111111111111111111111111".into(),
                wei: 1_000_000_000_000_000,
                fee: 70_000_000_000_000_000_000_000
            },
            Effect::Payout {
                account: "creator.testnet".into(),
                amount: 300_000_000_000_000_000_000_000
            },
        ]
    );
}
#[test]
fn validated_machine_persistence_and_staged_resolution_failure() {
    let mut m = escrow();
    m.nodes.insert(
        "seller".into(),
        Part::Splitter {
            outputs: vec![
                Share {
                    bps: 5000,
                    target: "v1".into(),
                },
                Share {
                    bps: 5000,
                    target: "v2".into(),
                },
            ],
        },
    );
    m.nodes.insert(
        "v1".into(),
        Part::Vault {
            name: "first".into(),
        },
    );
    m.nodes.insert(
        "v2".into(),
        Part::Vault {
            name: "second".into(),
        },
    );
    let validated = validate(&m).unwrap();
    let validated: ValidatedMachine =
        serde_json::from_str(&serde_json::to_string(&validated).unwrap()).unwrap();
    let mut state = State::default();
    submit_order(
        &mut state,
        &validated,
        "1".into(),
        "buyer.testnet".into(),
        price(&m),
        None,
    )
    .unwrap();
    state.vaults.insert("second".into(), u128::MAX);
    let snapshot = state.clone();
    assert_eq!(
        approve(&mut state, &validated, "1".into(), "inspector"),
        Err(EngineError::Overflow)
    );
    assert_eq!(state, snapshot);
    state.vaults.remove("second");
    approve(&mut state, &validated, "1".into(), "inspector").unwrap();
}
#[test]
fn repeated_worker_with_other_pending_role_returns_not_pending() {
    let mut m = escrow();
    m.nodes.insert(
        "slot".into(),
        Part::CoinSlot {
            price: 100,
            output: "split".into(),
        },
    );
    m.nodes.insert(
        "split".into(),
        Part::Splitter {
            outputs: vec![
                Share {
                    bps: 5000,
                    target: "review".into(),
                },
                Share {
                    bps: 5000,
                    target: "other".into(),
                },
            ],
        },
    );
    m.nodes.insert(
        "other".into(),
        Part::Gate {
            condition: Condition::NeedsApproval {
                worker: "second".into(),
            },
            pass: "seller".into(),
            fail: "refund".into(),
        },
    );
    m.nodes.insert(
        "second".into(),
        Part::Worker {
            gates: vec!["other".into()],
        },
    );
    let mut state = State::default();
    buy(&mut state, &m, "1").unwrap();
    assert!(
        approve(&mut state, &m, "1".into(), "inspector")
            .unwrap()
            .pending
    );
    assert_eq!(
        approve(&mut state, &m, "1".into(), "inspector"),
        Err(EngineError::NotPending)
    );
    approve(&mut state, &m, "1".into(), "second").unwrap();
}
proptest! {
    #![proptest_config(ProptestConfig::with_cases(512))]
    #[test]
    fn splitter_gates_portals_conserve(paid in prop_oneof![1u128..100, 1u128..=u128::MAX], threshold in any::<u128>(), bps in 1u16..10000) {
        let mut m = vending();
        if let Part::CoinSlot { price, .. } = m.nodes.get_mut("slot").unwrap() { *price = paid; }
        if let Part::Gate { condition, fail, .. } = m.nodes.get_mut("delivery").unwrap() { *condition = Condition::MinAmount { amount: threshold }; *fail = "reserve".into(); }
        if let Part::Splitter { outputs } = m.nodes.get_mut("fees").unwrap() { outputs[0].bps = bps; outputs[1].bps = 10000-bps; }
        let out = buy(&mut State::default(), &m, "1").unwrap();
        prop_assert_eq!(out.effects.iter().map(Effect::inflow).sum::<u128>(), paid);
        prop_assert!(!out.pending);
        prop_assert!(!out.effects.iter().any(|e| matches!(e, Effect::ExternalPayout { fee: 0, .. })), "zero fee payout");
    }
}
