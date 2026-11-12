use worldworks_engine::{submit_order, Machine, Part, State};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("usage: run <machine.json>")?;
    // Accept the spec's repo-relative path when cargo runs from engine/.
    let contents = std::fs::read_to_string(&path).or_else(|e| {
        path.strip_prefix("engine/")
            .map_or(Err(e), std::fs::read_to_string)
    })?;
    let machine: Machine = serde_json::from_str(&contents)?;
    let price = machine
        .nodes
        .values()
        .find_map(|p| {
            if let Part::CoinSlot { price, .. } = p {
                Some(*price)
            } else {
                None
            }
        })
        .ok_or("missing CoinSlot")?;
    let outcome = submit_order(
        &mut State::default(),
        &machine,
        "demo-1".into(),
        "buyer.testnet".into(),
        price,
        Some("0x1111111111111111111111111111111111111111".into()),
    )
    .map_err(|e| format!("{e:?}"))?;
    println!("Local simulation only; no transactions are sent.");
    for line in outcome.trace {
        println!("{line}");
    }
    for effect in outcome.effects {
        println!("Effect: {effect:?}");
    }
    println!("Pending: {}", outcome.pending);
    Ok(())
}
