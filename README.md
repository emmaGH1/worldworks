# WORLDWORKS

WORLDWORKS is “Factorio for programmable money”: wire parts into money machines that run on NEAR testnet and open as standalone payment apps.

**Live:** https://worldworks.vercel.app · [Demo video]({{DEMO_VIDEO_URL}}) · [X post]({{DEMO_POST_URL}})

## Try it in 30 seconds — no wallet

1. Open the live game, choose **Start job 1**, and follow the guide. Place a Splitter and Payouts for Ada, Bola and Chi; try the dials, then **Test**. This is local simulation. A passing solution is 60/20/20. You can build and Test without creating a chain account. Stop before **Ship** to spend nothing.
2. See an **existing real payout**, without making another: [job-3 NEAR order](https://testnet.near.rocks/tx/Wckcgn6SAXC8bvfMN9KBmfkxpfdbAf4uKfj8oCkw4G8) → [0.0005 ETH on Sepolia, payout 32](https://sepolia.etherscan.io/tx/0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a). These are recorded receipts, not transactions your visit created.
3. Open [an existing standalone shop](https://worldworks.vercel.app/m/shop-ab044e8b-c83a2d2141) to inspect its checkout. **Pay** sends a new testnet order; viewing it does not. Its [recorded payment](https://testnet.near.rocks/tx/EJeyoqAjbMxrArWGt29PvfNfJ35rR9FRNp9B4GwjJ1eE) split NEAR between the player and a friend. This shop has no Portal; the cross-chain receipt above belongs to job 3.

**Real:** live publishing, orders and NEAR settlement run on a testnet contract; confirmed Portal payments have Sepolia receipts.<br>
**Simulated:** Test, factory customer traffic/totals, characters and coin motion; mock mode also simulates all payments and hashes.<br>
**Test money only:** NEAR testnet and Ethereum Sepolia; neither simulated motion nor a signature proves a payment.

The quick path is a starting point, not a measured completion-time promise. The recorded job-3 Ship-to-confirmed run took 117 seconds ([evidence](docs/EVIDENCE-game3.md)).

## Verify in 30 seconds without spending anything

Run from the repository root with Bash, `curl`, `jq` and GNU `base64`. These commands only read public state. Timing depends on RPC availability. IDs and transaction links come from [GAME-3 evidence](docs/EVIDENCE-game3.md); outputs below were read again for this documentation pass on 2026-11-13.

```sh
near_view() {
  curl --fail --silent --show-error --max-time 30 https://rpc.testnet.fastnear.com \
    -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg method "$1" --arg args "$(printf %s "$2" | base64 -w0)" \
      '{jsonrpc:"2.0",id:1,method:"query",params:{request_type:"call_function",finality:"final",account_id:"ww-portal-261112.testnet",method_name:$method,args_base64:$args}}')" \
    | jq -er '.result.result | implode | fromjson'
}
near_view get_machine '{"machine_id":"shop-ab044e8b-c83a2d2141"}' | jq '{owner, machine}'
near_view get_payout '{"payout_id":"32"}' | jq '{payout_id,machine_id,order_id,status,recipient,wei,nonce}'
curl --fail --silent --show-error --max-time 30 https://rpc.sepolia.ethpandaops.io \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a"]}' \
  | jq -e '.result | {transactionHash,status,from,to,blockNumber,gasUsed}'
```

Actual output, trimmed to relevant fields (the first result's graph is shortened here):

```json
{"owner":"p83ed05965fc83a2d2141.ww-sponsor-g4-261112.testnet","machine":{"portal_cap_wei":"0","nodes":{"n_r":{"type":"Splitter","outputs":[{"bps":7000,"target":"n_r_0"},{"bps":3000,"target":"n_r_1"}]},"slot":{"type":"CoinSlot","price":"100000000000000000000000","output":"n_r"}}}}
{"payout_id":"32","machine_id":"abroad3-2d8d1b47-c83a2d2141","order_id":"ca740c84-c497-4e56-a311-22e17e155016","status":"signed","recipient":"0xE53AA3F186Dd3f580D2b6259bCa8aA86B10Eaeb2","wei":"500000000000000","nonce":32}
{"transactionHash":"0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a","status":"0x1","from":"0x694ad57416073b1e1f3bc6e13b26bde28015a8b7","to":"0xe53aa3f186dd3f580d2b6259bca8aa86b10eaeb2","blockNumber":"0xb908fa","gasUsed":"0x5208"}
```

NEAR stores `signed`, not Ethereum confirmation. The successful Sepolia receipt is the inclusion evidence. To additionally reconstruct the signed transaction, recover its sender and check matching transaction/receipt data plus three blocks on top at **both** configured Sepolia RPC hosts, install app dependencies below and run:

```sh
cd app
npm run --silent confirm -- 32 | jq '{payoutId,status,recipient,wei,evmTx,confirmations:[.confirmations[] | {rpc,hash,blockHash,status}]}'
```

Actual output, trimmed:

```json
{"payoutId":"32","status":"confirmed","recipient":"0xE53AA3F186Dd3f580D2b6259bCa8aA86B10Eaeb2","wei":"500000000000000","evmTx":{"hash":"0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a","explorerUrl":"https://sepolia.etherscan.io/tx/0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a"},"confirmations":[{"rpc":"https://rpc.sepolia.ethpandaops.io","hash":"0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a","blockHash":"0x4baa712a371b65d9f4c038c851bbf1c8ccfbd3a71afcc685763d80901dcaacb7","status":1},{"rpc":"https://sepolia.gateway.tenderly.co","hash":"0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a","blockHash":"0x4baa712a371b65d9f4c038c851bbf1c8ccfbd3a71afcc685763d80901dcaacb7","status":1}]}
```

This means “included on Sepolia, seen by two RPCs”, not Ethereum finality or a light-client proof. The confirmation command never broadcasts.

## Facts for screeners

```yaml
facts:
  product: WORLDWORKS
  reviewed_head: "80c7418"
  network: NEAR testnet
  payout_network: Ethereum Sepolia
  evm_chain_id: 11155111
  live_url: https://worldworks.vercel.app
  standalone_example: https://worldworks.vercel.app/m/shop-ab044e8b-c83a2d2141
  contract_id: ww-portal-261112.testnet
  signer: v1.signer-prod.testnet
  derivation_path: worldworks/portal/sepolia/v1
  portal_treasury: "0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7"
  methods:
    reads: [get_machine, get_order, get_payout, get_limits, get_portal_address, get_vaults, get_unclaimed, explain_order]
    writes: [publish_machine, submit_order, approve, expire, retry_signature, withdraw_vault, withdraw_unclaimed]
  evidence:
    portal_machine: abroad3-2d8d1b47-c83a2d2141
    portal_order: ca740c84-c497-4e56-a311-22e17e155016
    payout_id: "32"
    near_order_tx: Wckcgn6SAXC8bvfMN9KBmfkxpfdbAf4uKfj8oCkw4G8
    sepolia_tx: "0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a"
    shop_publish_tx: yFpyrFesbzucpcZEmpot59jtfMz3pESMchSoNXvAyej
    shop_order_tx: EJeyoqAjbMxrArWGt29PvfNfJ35rR9FRNp9B4GwjJ1eE
    live_expiry_tx: 5oXXGB6oZceCMRjcuZpKxTaTaDWneNNN8pHMyk63LDmp
    files: [docs/EVIDENCE-game3.md, docs/EVIDENCE-game4.md, docs/EVIDENCE-game5.md, docs/EVIDENCE-game6.md, docs/EVIDENCE-g6.md, docs/EVIDENCE-sepolia.md]
  tests_from_root:
    - CARGO_TARGET_DIR=/opt/ww-target cargo test --manifest-path engine/Cargo.toml
    - cd app && npm run typecheck
    - cd app && npx tsc --noEmit -p api/tsconfig.json
    - cd app && node --import tsx --test scripts/*.test.ts
    - cd app && VITE_CONTRACT_ID= npm run build
  simulated: [Test customers and effects, factory customer stream and Sim totals, characters and coin motion, all mock-mode payments and hashes]
  games_prompt:
    loop: implemented; timings are design horizons, not measured guarantees
    readable_rules: docs/RULES.md
    reasoning_tooltip: partial; requirement titles and failure explanations, no general reasoning inspector
    fast_forward: absent as a player control
    no_wallet_popups: implemented through browser keys and sponsored testnet accounts
  limitations:
    - Testnet only; unaudited prototype
    - Fresh Sepolia addresses needing more than 21000 gas are refused by preflight
    - Payer chooses the Ethereum recipient; a link is only a suggestion
    - Sessions receive 4.5 test NEAR from a finite sponsor
    - FullAccess deployment key remains; deployment is mutable
    - Shared treasury and nonce queue; no guaranteed completion, solvency or inclusion
    - No EVM fee replacement or cancellation; no automatic treasury refill
    - Abuse quotas are per process; history is not pruned
    - Factory real markers tested with fixtures, not a new live factory payment
```

## How the game works

**Job → build → simulated Test → Ship for real → standalone app → factory.** Read a person's goal, place parts in sockets, adjust Splitters, then Test three simulated customers through the shared WASM engine. Failures explain an unmet goal; passing earns stars and saves the build. Ship creates/reuses a published machine and runs a seeded-customer testnet order. Its `/m/<id>` checkout uses the same contract graph outside the game. Solved machines appear together in the factory, even if they have not been shipped.

| Job | Goal |
|---|---|
| Ada's bakery | Ada keeps three times each helper's equal share. |
| Ada steps back | Ada gets half; Bola gets three times Chi's share of the rest. |
| Chi moved abroad | Chi gets at least 0.0005 Sepolia ETH; Bola keeps 20%; Ada gets the rest. |
| Dayo delivers | Ada gets 80%; Dayo's 20% waits for delivery or follows the refund exit. |
| Your shop | Pay your own account and optionally up to two friends; available after solving job 1. |

| Part | Rule |
|---|---|
| Coin Slot | One source; the order price must match. |
| Splitter | Divide NEAR by shares; engine rounding remainder goes to the first output. Game dials move in 5% steps; Splitters can chain. |
| Vault | Retain NEAR for the machine owner to withdraw. |
| Gate | Route by minimum amount or hold for approval; delivered/time-up exits in the game. |
| Worker (Key) | Approve only its bound Gates; it is a permission, not an AI agent. |
| Payout | Request a NEAR transfer to an account, or to the payer on a refund route. |
| Portal | Spend NEAR as a fee to request a fixed Sepolia ETH transfer from the shared treasury to the order's recipient. No automatic NEAR→ETH swap. |

[Readable game rules](docs/RULES.md) cover building, scoring, rounding and failure states. [Machine format](engine/MACHINE_FORMAT.md) describes the lower-level graph rules; the editor exposes a subset.

For the official Games prompt:

- **30-second loop:** place or change a part, Test, inspect a reason, change the build. **Five-minute loop:** solve a job, improve stars and optionally Ship. **Session loop:** unlock the jobs, build Your shop, revisit the saved factory and share an app. These are intended play horizons, not measured completion times.
- **Rules:** provided in [docs/RULES.md](docs/RULES.md).
- **Reasoning tooltip: partial.** Requirement pills have native title text; failed Tests show specific amount/ratio explanations with an inspect prompt. There is no general per-part reasoning inspector.
- **Fast-forward: missing.** Test runs a short scripted sequence; `lowfx` reduces effects and deterministic stepping is for tests. Neither is a player-facing fast-forward mode.
- **No wallet popups:** browser-generated keys and sponsored accounts handle live actions. Build/Test needs no wallet or sponsored session; Ship/Pay consumes finite test funds. The demo player holds job 4's real Worker key, even though the puzzle calls the role “customer”.

## Architecture and why NEAR

```text
React + Three.js game / standalone /m/<id>
  |-- shared Rust engine -> WASM: local Test (simulated)
  |-- browser NEAR key -> Rust NEAR contract -> shared Rust graph runtime
  |                         |-- NEAR effects / held Gates / Vaults
  |                         `-- builds Sepolia transfer -> Chain Signatures
  `-- serverless API                                  -> MPC signature
        /session: sponsor account creation
        /customer: seeded customer order
        /relay: verify bytes + recovered sender -> Sepolia broadcast
        /payout: matching receipt + tx at two RPCs, three blocks on top
```

The [contract](contract/src/lib.rs) executes published rules, rather than merely storing a picture. The [engine](engine/src/lib.rs) is Rust shared by that contract and the browser's [WASM wrapper](engine-wasm/src/lib.rs). The [app](app/package.json) uses React and Three.js with a 2D fallback. [Serverless handlers](app/api/) keep sponsor/customer NEAR keys server-side; the EVM relay has no EVM private key.

NEAR supplies the machine runtime, accounts that can be sponsored without wallet popups, scoped Worker keys, and Chain Signatures for a contract-built Sepolia transaction. The signer is `v1.signer-prod.testnet`, path `worldworks/portal/sepolia/v1`; all machines share treasury `0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7`. A standalone app is a machine URL, not a separate contract, account or EVM treasury. See [deployment history](docs/DEPLOYMENTS.md), [Portal evidence](docs/EVIDENCE-portal.md), [signing probe](docs/EVIDENCE-chainsig.md) and [live adapter evidence](docs/EVIDENCE-live.md); early unfunded/probe reports are superseded by the later receipts.

## Run locally

From this checkout, with Node/npm (checked here with Node 22.23.3 and npm 10.9.9):

```sh
cd app
npm ci
VITE_CONTRACT_ID= npm run build
npm run preview -- --host 127.0.0.1 --port 4197 --strictPort
```

Open the printed local URL. Empty `VITE_CONTRACT_ID` selects mock mode, labeled MOCK; all Ship/Pay operations in this build are simulated. In another shell:

```sh
curl --fail --silent --output /dev/null --write-out '%{http_code}\n' http://127.0.0.1:4197/
```

This pass: install succeeded, mock build succeeded, preview served HTTP `200`. The existing large-chunk build warning remains.

Live mode requires separately provisioned, funded testnet credentials. Do not run it for a free reproducibility check. The public client configuration names in [app/.env.example](app/.env.example) are **`VITE_CONTRACT_ID`, `VITE_NEAR_NETWORK`, `VITE_RELAYER_URL`**. Configure them in `app/.env.local` for the contract/network above and local API origin, then run these in separate shells from `app/`:

```sh
node --import tsx scripts/dev-api.ts
npm run dev -- --host 127.0.0.1
```

Supply the server environment separately: `SPONSOR_ACCOUNT_ID`, `SPONSOR_PRIVATE_KEY`, `CUSTOMER_ACCOUNT_ID`, `CUSTOMER_PRIVATE_KEY`. Optional server overrides are `PORTAL_CONTRACT`, `SEPOLIA_RPC_URL`, `SEPOLIA_CONFIRM_RPC_1`, `SEPOLIA_CONFIRM_RPC_2`; these server names are documented in [DEPLOYMENTS](docs/DEPLOYMENTS.md), not in the three-variable client example. Private keys must never use a `VITE_` prefix. The local API listens on its default port or `API_PORT`. No credential values are included here. Live startup was not run in this pass.

Tests (no remote sends):

```sh
# Repository root
CARGO_TARGET_DIR=/opt/ww-target cargo test --manifest-path engine/Cargo.toml
# app/
npm run typecheck
npx tsc --noEmit -p api/tsconfig.json
node --import tsx --test scripts/*.test.ts
```

Contract sandbox checks need Rust, cargo-near, a local NEAR sandbox and writable `/opt/ww-target`; the tests currently use fixed artifact paths:

```sh
# Repository root; local sandbox only
export CARGO_TARGET_DIR=/opt/ww-target
cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml
cargo near build non-reproducible-wasm --manifest-path contract/tests/mock-signer/Cargo.toml --no-abi --out-dir /opt/ww-target/portal-mock
cargo test --manifest-path contract/Cargo.toml -- --nocapture
```

Those contract commands are recorded in [G6 evidence](docs/EVIDENCE-g6.md); they were not rerun for this documentation change. Browser test instructions/results are in [GAME-6 evidence](docs/EVIDENCE-game6.md). Its scripts use machine-specific Playwright/Chromium paths and write evidence/screenshots; `npm ci` alone does not install those browser prerequisites.

## Honest limitations

- **Testnet only, unaudited prototype.** The contract still has a FullAccess deployment key (read again this pass); it can be redeployed. No immutability or exclusive signing-authority claim.
- **Fresh Sepolia recipients:** observed fresh addresses need more than 21,000 gas, while Portal signs exactly 21,000. Both game and standalone checkout preflight refuse incompatible recipients and fail closed on RPC errors. Arbitrary contract recipients are unsupported.
- **The payer chooses the Ethereum recipient per order.** `?to=` suggests an address; it does not bind it in the published graph. Your shop supports at most one Ethereum friend. Friend names are owner-local; shared pages show addresses.
- **Finite funding:** each new sponsored session receives 4.5 test NEAR. Publish recommends 0.40 NEAR with unused storage deposit refunded; each order retains a 1.32 NEAR storage fee in addition to its price. Sponsor exhaustion can prevent Ship/Pay. Older evidence lists larger grants; current `app/api/session.ts` sets 4.5 NEAR. Quotas are best-effort, per-process memory, not durable distributed abuse protection.
- **Shared Portal bottleneck:** at most 20 payouts per 1,000 NEAR blocks, with a 0.01 ETH epoch budget and a 0.002 ETH per-payout cap. Admission reserves value plus 21,000 × snapshotted max gas fee. It does not guarantee actual treasury solvency. Treasury replenishment is manual; the NEAR fee does not refill ETH automatically.
- **No guaranteed completion/refund:** missing callbacks, low balance, exhausted budgets or a stuck earlier nonce can block progress. No EVM fee replacement/cancellation or on-chain broadcast proof. Changing fees affects future payouts only. Expiry requires a caller after the deadline and follows the graph's fail exit; it is not an automatic universal refund.
- **RPC trust:** relay/confirmation assume authentic RPC data. Two RPCs and three additional blocks are not Ethereum finality. A NEAR success, signature or broadcast hash alone is not settlement proof. Missing NEAR transfer evidence remains unknown; new live successful/failed recovery cases were not exercised after GAME-5.
- **Factory customers are simulated.** Sim totals use WASM previews; Real totals only use scoped, confirmed receipts and settled NEAR transfers. Simulation runs while the overview is mounted/visible, not as a background economy. Purchase count is per visit; saved Sim amounts persist. Gate simulation uses delivered previews; Test checks refunds separately. Balance observations can include unrelated activity.
- **Presentation/test coverage:** factory all-five screenshots use saved-build fixtures, not a fresh full playthrough. Real factory confirmation markers are fixture-tested, not exercised by a new live factory payment. Miniatures simplify editor geometry; scene changes do not share one continuous camera. No real-phone FPS measurement or audio listening test. Sound scheduling was checked. Bundle warning remains.
- **Storage/recovery:** history is not pruned. The G6 storage bound is derived and measured, not exhaustive, and does not cover legacy machines/orders; legacy graphs were not revalidated. Publish may need more than its recommended deposit. Conservative alternative-Gate admission can reject a route that would fit alone. Ambiguous approval intent has no resend action and can remain checking if it never reached chain. Full multi-Gate orchestration is not verified. Old GAME-2 local progress is not migrated.
- **Live coverage boundary:** GAME-3 records a desktop production-style local Portal run and Your shop payment; GAME-4 later records real expiry/refund routing. Earlier “expiry missing” evidence is superseded. Live delivery approval, Vault withdrawal/positive unclaimed recovery and deliberately stuck queues are not established by those runs; sandbox/fixture checks are separate evidence.

[Claim-by-claim evidence and status](docs/CLAIMS.md) is the public claims ledger.

## Disclosure and license

Built with AI coding agents: Claude and GPT models orchestrated by the author for planning, implementation, review, tests and documentation ([process](docs/OPERATING.md)).

The hackathon window starts **October 19, 2026**, with submission deadline **November 14, 2026 at 23:59 UTC** (author-supplied event dates). Repository history starts **November 12, 2026**; it does not establish October 19 as the first code date. Work described here was built during that window. The initial commit contains a project-starter README and icon; no pre-event WORLDWORKS implementation is claimed.

Reused dependencies include React/React DOM, Three.js, near-api-js, viem, @xyflow/react, d3-sankey, howler and motion; Vite/TypeScript/tsx tooling; Rust near-sdk, omni-transaction, serde/serde_json, sha2, bs58 and wasm-bindgen; near-workspaces, tokio, anyhow, proptest and Playwright for tests. See [app manifest](app/package.json), [engine manifest](engine/Cargo.toml), [contract manifest](contract/Cargo.toml), [WASM manifest](engine-wasm/Cargo.toml) and lockfiles for exact dependencies. Sounds are synthesized ([credits](app/public/sounds/CREDITS.md)); fonts load Bricolage Grotesque, Fredoka, Nunito and JetBrains Mono ([font declarations](app/index.html)). The earlier [Chain Signatures probe](probes/chainsig/) is repository work, separate from the production Portal treasury.

[MIT License](LICENSE). Dependencies retain their own licenses.
