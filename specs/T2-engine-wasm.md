# T2 — Engine in the browser (wasm bindings)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Goal
The exact same engine crate that runs in the contract runs in the browser, so the workshop can validate and preview a machine before publishing ("same rules in the game and on chain").

## Requirements
- New crate `engine-wasm/` depending on `../engine` by path. Do NOT modify `engine/`.
- wasm-bindgen exports taking and returning JSON strings: `validate(machine_json) -> {ok: true, flows, ...} | {ok: false, errors: [...]}`; `preview_order(machine_json, amount, external_recipient?) -> Outcome` (effects + trace) on a fresh State; `machine_hash(machine_json)`.
- Build script `engine-wasm/build.sh` producing an ES module + .wasm into `app/src/engine/pkg/` (wasm-bindgen-cli matching the wasm-bindgen crate version, or wasm-pack; install into /opt or ~/.cargo/bin and say which).
- `app/src/engine/index.ts`: typed wrapper (`validateMachine`, `previewOrder`, `machineHash`) with TypeScript types for Effect/Outcome/ValidationError mirroring `engine/MACHINE_FORMAT.md`.
- A node test (`app/src/engine/engine.test.ts`, vitest or node:test, whichever adds less weight) that loads the wasm and checks: vending.json validates; preview gives 63/30/7 exact amounts; an invalid machine (Splitter sum 9999) returns the named error; output equals what `cargo run --example run` prints for the same order (effects match).

## Acceptance checks (paste output)
1. `bash engine-wasm/build.sh` succeeds; size of the .wasm.
2. `cd app && npm run typecheck && npm run build`.
3. The node test passes.

## Environment
CARGO_TARGET_DIR=/opt/ww-target, CARGO_HOME=/opt/ww-cargo-home, npm cache /opt/ww-npm-cache; /data disk ~1.2 GB free. Another agent owns contract/, app/api/ and app/scripts/: do not touch them. Do not commit or push.
