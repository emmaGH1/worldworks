#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export CARGO_TARGET_DIR=${CARGO_TARGET_DIR:-/opt/ww-target}
export CARGO_HOME=${CARGO_HOME:-/opt/ww-cargo-home}
if ! "$CARGO_HOME/bin/wasm-bindgen" --version 2>/dev/null | grep -qx 'wasm-bindgen 0.2.100'; then
  cargo install wasm-bindgen-cli --version 0.2.100 --locked --root "$CARGO_HOME"
fi
cargo build --manifest-path engine-wasm/Cargo.toml --target wasm32-unknown-unknown --release
mkdir -p app/src/engine/pkg
"$CARGO_HOME/bin/wasm-bindgen" --target web --out-dir app/src/engine/pkg "$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/worldworks_engine_wasm.wasm"
wc -c app/src/engine/pkg/*_bg.wasm
