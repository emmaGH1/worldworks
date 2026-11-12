//! Allocation cost must depend on the active order, not accumulated history.
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use worldworks_engine::*;
struct Measured;
static TRACK: AtomicBool = AtomicBool::new(false);
static BYTES: AtomicUsize = AtomicUsize::new(0);
unsafe impl GlobalAlloc for Measured {
    unsafe fn alloc(&self, l: Layout) -> *mut u8 {
        if TRACK.load(Ordering::Relaxed) {
            BYTES.fetch_add(l.size(), Ordering::Relaxed);
        }
        unsafe { System.alloc(l) }
    }
    unsafe fn dealloc(&self, p: *mut u8, l: Layout) {
        unsafe { System.dealloc(p, l) }
    }
}
#[global_allocator]
static ALLOC: Measured = Measured;
fn measured(f: impl FnOnce()) -> usize {
    BYTES.store(0, Ordering::Relaxed);
    TRACK.store(true, Ordering::Relaxed);
    f();
    TRACK.store(false, Ordering::Relaxed);
    BYTES.load(Ordering::Relaxed)
}
#[test]
fn runtime_allocations_do_not_scale_with_state_history() {
    let m: Machine = serde_json::from_str(include_str!("../examples/escrow.json")).unwrap();
    let m = validate(&m).unwrap();
    let mut s = State::default();
    let submit = |s: &mut State, id: String| {
        submit_order(
            s,
            &m,
            id,
            "buyer.testnet".into(),
            1_000_000_000_000_000_000_000_000,
            None,
        )
        .unwrap()
    };
    let small = measured(|| {
        submit(&mut s, "small".into());
    });
    let small_approve = measured(|| {
        approve(&mut s, &m, "small".into(), "inspector").unwrap();
    });
    submit(&mut s, "expire-small".into());
    let small_expire = measured(|| {
        expire(&mut s, &m, "expire-small".into()).unwrap();
    });
    for n in 0..1000 {
        submit(&mut s, format!("history-{n}"));
    }
    let large = measured(|| {
        submit(&mut s, "large".into());
    });
    let large_approve = measured(|| {
        approve(&mut s, &m, "large".into(), "inspector").unwrap();
    });
    submit(&mut s, "expire-large".into());
    let large_expire = measured(|| {
        expire(&mut s, &m, "expire-large".into()).unwrap();
    });
    assert!(large <= small * 2, "submit {small} -> {large}");
    assert!(
        large_approve <= small_approve * 2,
        "approve {small_approve} -> {large_approve}"
    );
    assert!(
        large_expire <= small_expire * 2,
        "expire {small_expire} -> {large_expire}"
    );
}
