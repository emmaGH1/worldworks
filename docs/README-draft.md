# WORLDWORKS

Factorio for programmable money: wire money machines in a game, run them on NEAR testnet, and open them as standalone apps.

Payment rules are difficult to inspect when they are hidden inside application code. WORLDWORKS represents them as connected Coin Slot, Splitter, Vault, Gate, Worker, Payout and Portal parts, interpreted by a shared NEAR contract. A published machine has a standalone `/m/<id>` URL; its Portal can pay Sepolia ETH through NEAR Chain Signatures, without the relayer holding an EVM key.

## Try it

App: {{HOSTED_URL}} · Demo video/post: {{DEMO_POST_URL}}

These are publication placeholders. The live walkthrough uses test funds and sends transactions; local mock mode below does not.

1. Open the app → the Lemonade machine starts with a **BROKE** stamp. Check whether **MOCK DATA** is present before interpreting any balance or receipt.
2. Drag **Splitter** onto the Coin Slot → Portal pipe → a reserve Vault appears and the machine becomes **RUNNING**.
3. Click the serve-customer button → a labeled seeded customer buys; in live mode the machine is published and an order records reserve and Portal effects.
4. Watch the Portal → pending signature, signed/broadcast, then confirmed only after receipt checks. Network delays can exceed a minute; pending is not payment proof.
5. Open the Ledger → inspect NEAR order and Sepolia payment links; click **Open as app** → the same published machine opens at `/m/<id>` with its own checkout.

[Recorded live walkthrough and screenshots](EVIDENCE-ui-live.md) document this flow. “Own address” means a machine ID and URL, not a dedicated blockchain account or treasury.

## Verify it yourself

Contract: [`ww-portal-261112.testnet`](https://testnet.nearblocks.io/address/ww-portal-261112.testnet). Shared Portal treasury: [`0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7`](https://sepolia.etherscan.io/address/0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7).

- [NEAR order producing payout 0](https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN)
- [Sepolia payout 0 receipt](https://sepolia.etherscan.io/tx/0xbf2a7ae14ef28044ce775f9c18ed0c6294ffe916aac1f84653253b51f9d0a3e6)
- [Sepolia payout 4 receipt](https://sepolia.etherscan.io/tx/0x10a30e352a7147fdb8bf7d0cfb855ee4c667cdb90dc26d7f1265f49c88ee3565)

From the checkout root, after installing app dependencies as below:

```sh
cd app
npm_config_cache=/opt/ww-npm-cache npm run confirm -- 0
```

This command reads NEAR state and Sepolia RPCs; it does not broadcast. This draft pass returned `confirmed` for payout 0 with matching proofs from both hosts. Expect `confirmed` with two matching successful receipt proofs when both RPCs are available. [Sepolia evidence](EVIDENCE-sepolia.md) records successful receipts; earlier unfunded reports in [deployment history](DEPLOYMENTS.md) describe earlier states, not the final payment result.

## How NEAR is used

| Behavior | Implementation | Evidence |
| --- | --- | --- |
| Browser-generated session key; server sponsors a NEAR testnet account. Browser key stays in origin localStorage; sponsor/customer secrets stay server-side. | [session endpoint](../app/api/session.ts), [live adapter](../app/src/api/live.ts) | [live adapter evidence](EVIDENCE-live.md), [live UI evidence](EVIDENCE-ui-live.md) |
| Worker function-call key is limited to `approve` on this contract; published role bindings also constrain approval. It is not a general-purpose autonomous agent. | [live adapter](../app/src/api/live.ts), [contract](../contract/src/lib.rs) | [live adapter evidence](EVIDENCE-live.md), [sandbox tests](../contract/tests/sandbox.rs) |
| Published graphs execute in a deterministic Rust interpreter; app preview uses its WASM build. | [engine](../engine/src/lib.rs), [WASM wrapper](../engine-wasm/src/lib.rs), [contract](../contract/src/lib.rs) | [engine tests](../engine/tests/engine.rs), [hardening evidence](EVIDENCE-hardening.md) |
| Contract constructs Sepolia EIP-1559 transfers: fixed chain, empty calldata, 21,000 gas, allocated nonce and snapshotted fees. Retries use stored payloads. | [contract](../contract/src/lib.rs) | [Portal evidence](EVIDENCE-portal.md), [hardening evidence](EVIDENCE-hardening.md) |
| Chain Signatures signs for derivation path `worldworks/portal/sepolia/v1`, through `v1.signer-prod.testnet`. | [contract](../contract/src/lib.rs) | [Portal evidence](EVIDENCE-portal.md), [receipt evidence](EVIDENCE-sepolia.md) |
| Keyless EVM relayer verifies unsigned bytes and recovered sender, then broadcasts in nonce order. NEAR sponsor/customer services do hold NEAR keys. | [Portal relay implementation](../app/api/portal.ts), [CLI](../app/scripts/relay.ts) | [live evidence](EVIDENCE-live.md), [relay tests](../app/scripts/relay.test.ts) |
| Confirmation requires transaction and successful receipt agreement at two different RPC hosts, including sender, recipient, value, nonce and block hash. | [confirmation endpoint](../app/api/payout.ts) | [Sepolia evidence](EVIDENCE-sepolia.md), [live UI evidence](EVIDENCE-ui-live.md) |

## Real versus simulated

| Element | Live mode | Mock mode |
| --- | --- | --- |
| Graph validation and preview | Local deterministic WASM computation; preview is not settlement | Same local computation |
| Published machine, order, reserve, NEAR payout | NEAR testnet contract state and transactions | Simulated state/transactions |
| Worker approval | Scoped key plus contract role checks | Simulated approval |
| Portal payment | Contract-built MPC signature and Sepolia receipt | Simulated timings, statuses and hashes; no payment |
| Customer demand, story, walking customers, coin animation | Scripted/seeded presentation, not organic demand or an AI inference claim | Simulated |
| Standalone checkout | URL for a graph in the shared contract | Mock checkout |
| Money | Testnet NEAR and Sepolia ETH only | Mock balances |

## Limitations and claims boundary

<!-- CLAIMS.md source marker: preserve/recheck against docs/CLAIMS.md before publication; current source explicitly uses pre-G5 wording. -->

The following preserves the substance of [CLAIMS.md](CLAIMS.md), including its conservative pre-G5 caveats:

- This is a testnet prototype using Chain Signatures and a keyless EVM relayer. Published machines cannot be edited through the application API. Worker approval checks published role bindings.
- The relayer's byte and sender checks assume authentic NEAR RPC responses. It is not trustless against a malicious RPC; two Sepolia RPCs are not a light-client proof.
- Do not claim “no admin can move funds,” an immutable deployment, or the contract as the only possible signing authority. A FullAccess key remains in the recorded deployment; the locking script was not run.
- Do not describe per-order caps as cumulative or lifetime spending limits. G5 adds an epoch budget; it does not establish a lifetime bound. See [contract usage](../contract/USAGE.md).
- Do not guarantee every accepted order completes or refunds, or that expiry always refunds or runs automatically.
- The source withheld withdrawable-Vault claims until G5. Owner withdrawal now exists in the contract/API, but live withdrawals and positive unclaimed-balance flows were not exercised in the UI evidence.
- A signature, relay hash or NEAR order does not prove EVM payment. Only a successful Sepolia receipt does; the later Sepolia evidence supplies these receipts.
- Do not call this production-safe, audited, solvent by construction, or free from storage or nonce denial of service.

Additional implementation limits: the shared treasury needs separate Sepolia funding, including gas; admission does not replenish it. Earlier unsigned nonces can block later payouts. History is not pruned; callback failures can strand in-flight liabilities. The fixed storage fee is not an exact per-order refund scheme. The measured storage fixture is not a proven global worst-case bound. Transfers use 21,000 gas and do not support arbitrary EVM contract execution. Session limits are per process, not shared across serverless replicas. Browser localStorage keys are suitable only for this testnet demo.

## Run locally

Start in the repository root. Prerequisites: Rust/Cargo, `cargo-near`, Node with `--env-file` and `--import` support, npm, and a Linux environment capable of running NEAR sandbox and Chromium. Lockfiles pin package resolution. A clean-machine installation has not been independently reproduced by this draft pass; the checks used installed dependencies.

```sh
export PATH=/data/home/.cargo/bin:$PATH
export CARGO_HOME=/opt/ww-cargo-home
export CARGO_TARGET_DIR=/opt/ww-target-astra
export npm_config_cache=/opt/ww-npm-cache
cargo test --manifest-path engine/Cargo.toml
```

Expected: engine tests pass without a network or transactions.

### Contract sandbox

The current [sandbox test source](../contract/tests/sandbox.rs) hard-codes `/opt/ww-target/near/worldworks_contract.wasm` and `/opt/ww-target/portal-mock/portal_mock_signer.wasm`. Setting `CARGO_TARGET_DIR` alone does not redirect those reads. On a clean checkout, build those fixtures first (build outputs only, no public-chain deployment):

```sh
cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml --no-abi --out-dir /opt/ww-target/near
cargo near build non-reproducible-wasm --manifest-path contract/tests/mock-signer/Cargo.toml --no-abi --out-dir /opt/ww-target/portal-mock
cargo test --manifest-path contract/Cargo.toml -- --nocapture
```

All three sandbox tests passed against the existing fixtures in this environment. Both fixture-build commands subsequently passed; the sandbox suite was not rerun against those rebuilt artifacts. Sandbox transactions are local, not NEAR testnet or Sepolia transactions.

### App and mock UI

```sh
cd app
npm ci --cache /opt/ww-npm-cache
npm run typecheck
VITE_CONTRACT_ID= npm run build
npm run preview -- --host 127.0.0.1 --port 4197 --strictPort
```

In another shell, from `app/`:

```sh
UI_BASE=http://127.0.0.1:4197 node ui-tests/flow.mjs
```

Expect **MOCK DATA**, a repaired machine, a simulated sale, mock Portal progression and a passing test with no console errors. The UI runner currently requires `playwright-core` at `/opt/ww-shot/node_modules/playwright-core` and Chromium at `/data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` (see [helper](../app/ui-tests/common.mjs)). These are environment-specific prerequisites, not installed by `npm ci`; a portable clean-checkout UI bootstrap remains a gap. Build warnings about Motion directives and bundle size do not prevent completion. `npm ci` was not rerun during this documentation-only pass.

### Live API startup without secrets

From `app/`, this starts the API with the public settings in [.env.example](../app/.env.example), explicitly clearing credential variables:

```sh
SPONSOR_ACCOUNT_ID= SPONSOR_PRIVATE_KEY= CUSTOMER_ACCOUNT_ID= CUSTOMER_PRIVATE_KEY= API_PORT=4198 node --env-file=.env.example --import tsx scripts/dev-api.ts
```

Startup was checked; stop with Ctrl-C. The startup log hard-codes port 3001, but the listener uses `API_PORT`. With empty secrets, sponsored sessions and seeded purchases cannot work. `.env.example` contains `VITE_CONTRACT_ID`, `VITE_NEAR_NETWORK`, and `VITE_RELAYER_URL`, but omits the four required server credential variables above. They must be supplied privately for a funded live deployment, never as `VITE_` secrets.

A live frontend needs `VITE_CONTRACT_ID=ww-portal-261112.testnet`, `VITE_NEAR_NETWORK=testnet` and `VITE_RELAYER_URL=http://127.0.0.1:4198`. Do not treat live browsing as read-only: session creation, publishing, purchases, retries, approvals and withdrawals can send transactions. This draft verification ran no live UI tests, relay command, deployment or locking script. See [operating notes](OPERATING.md) for deployment context.

## Architecture

```text
Workshop / standalone /m/<id>
  |-- WASM engine: local validation and preview
  |-- browser NEAR key --> shared NEAR contract --> NEAR payouts / Vault
  |                           |-- Rust graph interpreter
  |                           `-- Chain Signatures --> signed Sepolia bytes
  `-- API: sponsored sessions / seeded customer / keyless relay
                                                `--> Sepolia
                                       two RPCs --> receipt confirmation
```

Machine rules are JSON, separate from visual layout. [Machine format](../engine/MACHINE_FORMAT.md), [contract usage](../contract/USAGE.md) and [API interface](../specs/API-interface.md) describe non-game integration. Standalone apps use the same contract and machine ID, not a separate deployment.

## Repository map

- `engine/`: graph schema, validation, interpreter, examples and property tests.
- `engine-wasm/`: browser WASM wrapper; `app/src/engine/`: packaged browser engine.
- `contract/`: NEAR storage, execution, payout construction, callbacks and sandbox tests.
- `app/src/`: workshop, standalone checkout, mock/live adapters.
- `app/api/`, `app/scripts/`: sessions, customer service, relay and receipt verification.
- `app/ui-tests/`: mock/live browser acceptance checks.
- `probes/chainsig/`: earlier isolated signing probe; its address is not the main Portal treasury.
- `docs/`: claims boundary, deployment history, evidence and [screenshots](design/screens/).

## Suggested tracks

**Open (`open`) primary.** Games (`games`) is also a fit for the machine-building interaction and game-to-standalone-app flow. Do not claim Agents on the basis of a scripted customer or approval-only Worker; there is no demonstrated autonomous agent decision loop. Final track selection belongs to the team. See the [official rules and track descriptions](https://nearhackathon.com/HACKATHON.md).

## Hackathon disclosure and dependencies

Declared project build window: **2026-11-12–2026-11-14**, for NEAR HACKATHON. Declared baseline: **no pre-hackathon project code**. These are team declarations to confirm before publication, not facts established by the current source audit; the window includes planned work after this draft. AI assistance: **Claude and GPT models**.

Under rule Q-005, reused libraries/tooling include React, React DOM, XYFlow/React Flow, d3-sankey, Howler, Motion, near-api-js, viem, Vite, TypeScript, tsx, serde/serde_json, sha2, wasm-bindgen, near-sdk, near-workspaces, omni-transaction, bs58, Tokio, anyhow, proptest and Playwright/Chromium. See [app manifest](../app/package.json), [engine manifest](../engine/Cargo.toml), [contract manifest](../contract/Cargo.toml), [WASM manifest](../engine-wasm/Cargo.toml), and their lockfiles for dependencies; [sound credits](../app/public/sounds/CREDITS.md) cover audio provenance. The repository starter README identifies T3 Code. Any additional template or pre-existing asset provenance must be confirmed by the team.

## License

Intended project license: MIT. A LICENSE file is not added by this draft; proposed full text accompanies the drafting report. Third-party dependencies and assets retain their own licenses.
