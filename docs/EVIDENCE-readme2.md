# README-2: captures and fresh-clone reproducibility

Source reviewed: `da3915ef0cc6e6262c10c889b640fb2378877f34` (GAME-9, GAME-10 and phone tray fix included). Checked 2026-11-14 UTC. Documentation/assets are uncommitted. No app/src edits, deployment, public upload, secret access or testnet sends.

## Clean clone and environment

Cloned the repository's committed HEAD locally, without hardlinks:

```sh
git clone --no-hardlinks /data/home/.t3/projects/near-hackathon /data/workspace/ww-readme2-clone
cd /data/workspace/ww-readme2-clone
git rev-parse HEAD
# da3915ef0cc6e6262c10c889b640fb2378877f34
```

This validates the committed files in a fresh working directory, not remote repository access or public visibility. No working-tree documentation/assets were smuggled into the clone. Node 22.23.3, npm 10.9.9, Bash, curl, jq, GNU base64, Rust/Cargo, cargo-near and local NEAR sandbox were already installed. Dependencies were installed into the clone on `/data/workspace`; native tests used the documented, existing `/opt/ww-target` cache. This was not an empty toolchain/cache test. The checked-in WASM needs no Rust rebuild to play.

## Run locally transcript summary

Commands were executed in the clone, not the source checkout:

```text
cd app
npm ci
  added 157 packages; audited 158; 0 vulnerabilities; exit 0
VITE_CONTRACT_ID= npm run build
  Vite 8.3.8 production build succeeded; exit 0
  existing warning: some chunks exceed 500 kB after minification
```

Then ran the exact README preview command from clone app/ in a foreground session:

```text
npm run preview -- --host 127.0.0.1 --port 4197 --strictPort
  Local: http://127.0.0.1:4197/
# another shell, as documented
curl --fail --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:4197/
  200; exit 0
```

Stopped the source-checkout capture server first to free that exact port; the curl above hit the clone's preview. Both servers were stopped after use.

Optional live-mode startup and server credentials in Run locally were deliberately not exercised. They require separately provisioned testnet accounts and are labeled accordingly. No secrets were opened or printed.

## Verify transcript summary (public reads only)

Ran the README's entire `near_view` function and three query pipelines literally with Bash and `pipefail`; exit 0. This uses `query` / `call_function` and `eth_getTransactionReceipt`, never broadcast.

```text
near_view get_machine '{"machine_id":"shop-ab044e8b-c83a2d2141"}' | jq '{owner, machine}'
  owner p83ed05965fc83a2d2141.ww-sponsor-g4-261112.testnet
  price 100000000000000000000000 yoctoNEAR; Splitter 7000/3000 bps
near_view get_payout '{"payout_id":"32"}' | jq '{payout_id,machine_id,order_id,status,recipient,wei,nonce}'
  machine abroad3-2d8d1b47-c83a2d2141; order ca740c84-c497-4e56-a311-22e17e155016
  status signed; wei 500000000000000; nonce 32
eth_getTransactionReceipt (README curl/jq command)
  hash 0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a
  status 0x1; block 0xb908fa; gasUsed 0x5208
  from 0x694ad57416073b1e1f3bc6e13b26bde28015a8b7
  to 0xe53aa3f186dd3f580d2b6259bca8aa86b10eaeb2
cd app
npm run --silent confirm -- 32 | jq '{payoutId,status,recipient,wei,evmTx,confirmations:[.confirmations[] | {rpc,hash,blockHash,status}]}'
  exit 0; payoutId 32; status confirmed; wei 500000000000000
  both rpc.sepolia.ethpandaops.io and sepolia.gateway.tenderly.co:
  same tx hash, status 1, blockHash 0x4baa712a371b65d9f4c038c851bbf1c8ccfbd3a71afcc685763d80901dcaacb7
```

This is inclusion evidence for the recorded payout, not a new payment, finality or a guarantee of future RPC availability. The command reconstructs/checks but never broadcasts.

## Tests and sandbox commands

| Command (working directory) | Fresh-clone result |
|---|---|
| `CARGO_TARGET_DIR=/opt/ww-target cargo test --manifest-path engine/Cargo.toml` (root) | Exit 0; 39 engine integration tests + 1 cost test; no failures. |
| `npm run typecheck` (app) | Exit 0. |
| `npx tsc --noEmit -p api/tsconfig.json` (app) | Exit 0. |
| `node --import tsx --test scripts/*.test.ts` (app; original README) | Exit 0; 68 passed. |
| `npm test` (app; revised README) | Exit 0; **69 passed, 0 failed**, including WASM/native parity. |
| `VITE_CONTRACT_ID= npm run build` (app) | Exit 0; large-chunk advisory only. |
| `export CARGO_TARGET_DIR=/opt/ww-target` then `cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml` (root) | Exit 0; 435,221-byte contract WASM. |
| `cargo near build non-reproducible-wasm --manifest-path contract/tests/mock-signer/Cargo.toml --no-abi --out-dir /opt/ww-target/portal-mock` (root) | Exit 0; 88,886-byte mock signer WASM. |
| `cargo test --manifest-path contract/Cargo.toml -- --nocapture` (root, same exported target) | Exit 0; 4 local sandbox integration tests + 1 storage component test; no failures. Local sandbox transactions only. |

README fixes from literal inspection/checking: the tests block now explicitly enters app in a subshell (the former `# app/` comment did not change directories); `npm test` replaces the incomplete scripts-only command and documents Rust as a prerequisite for its native parity check. Updated reviewed source revision, 69-test count, CC0 audio credits, and skip/dismissal behavior. No build/script fix was required. An intermediate check helper mistakenly named nonexistent `scripts/adapter.test.ts`; that helper failed, was corrected to the README glob, and is not counted as a product failure or test pass.

## Screenshot provenance and review

Built the committed source in MOCK mode (`cd app && VITE_CONTRACT_ID= npm run build`), served only on loopback port 4197. Playwright-core at `/opt/ww-shot/node_modules/playwright-core`, Chromium 1243, software WebGL enabled (no `webgl=0`). Used the existing `?step=1`, `__ww2.advance` and `__wwFactory.advance` hooks, paused fake clock and stepped CSS animations from the capture helpers documented in VIDEO.md. Screenshot viewport/output: 1920×1080, device scale 1, JPEG quality 88. No source/UI/CSS changes or hidden mock labels.

- `splash.jpg`: actual title screen and key art, not gameplay geometry. The title screen itself has no MOCK badge; caption identifies the mock build.
- `editor-test.jpg`: saved job-1 build, genuinely re-tested after changing a dial and restoring 60/20/20 through the UI. Coins mid-flight; goals visible. `hero.jpg` is a byte-for-byte copy.
- `factory.jpg`: saved-progress fixture with four solved plots (1, 3, 4, Your shop); Sim totals only, zero Real totals. Not a fresh progression playthrough.
- `portal.jpg`: job 3 shipped through the mock adapter; beam/broadcast phase. The displayed mock hashes are fabricated by that adapter; they are not linked as real receipts.
- `standalone.jpg`: `/m/abroad3-37a4e2bc-wwmfnbcu` from that same mock Ship in the same browser storage. Viewing only; Pay was never pressed. This locally generated ID is not a public/live machine URL.
- `coins.gif`: 36 genuinely stepped Test frames, 10 fps, 3.6-second repeating excerpt, 960×540, 709,857 bytes (under 3 MB). Mock badge retained. Inspected representative beginning/middle/end frames; this is simulated Test motion, with a cut at the loop boundary.
- `logo.webp`: copied from `app/public/brand/logo.webp`.

Every retained image was opened and inspected. The empty-board first attempt was replaced with the finished Test shot. A redundant confirmed-Portal capture was discarded; the strip uses the beam shot. Labels and requirement pills are readable, with no debug UI or clipped controls. All JPEGs are below 350 KB. Mock badges remain intact; captions distinguish mock from recorded live receipt evidence.

No full browser regression suite, physical-device performance/Back/audio check, new live delivery, withdrawal, expiry or Portal payment was performed in this pass. Existing live receipts were only read. Live production bundle equivalence to this HEAD is not established. Demo-video and X-post placeholders remain intentionally unchanged.

## Cleanup

The fresh clone `/data/workspace/ww-readme2-clone`, its node_modules and local target, temporary capture frames, scripts and logs were removed after recording this summary. Capture and clone preview servers were stopped, and the attempted preview tab was closed. Existing shared Rust caches were retained. No commit, push, deploy or visibility change. Pre-existing untracked `specs/GAME-9-feel.md` was left untouched.
