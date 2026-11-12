# Testnet deployments

## G2b isolated Chain Signatures probe — 2026-11-12 UTC

- NEAR network: testnet only.
- Account/owner/contract: [ww-chainsig-261112.testnet](https://testnet.nearblocks.io/address/ww-chainsig-261112.testnet).
- [Faucet account creation](https://explorer.testnet.near.org/transactions/G7Gk1agRNahi8rqmxCoDUdMp977zskBiPjAgQA7UA1Ck).
- [Deployment and init](https://explorer.testnet.near.org/transactions/83rajaWoeyKfMSSEqHt4RphBB7QEwDb5oUw8Q3SrJ9aD).
- Deployed NEAR code hash: `HX2ykB2WpcgBgPiqexNZnPbmkteRyustFu87195Bqpou`.
- Signer: [v1.signer-prod.testnet](https://testnet.nearblocks.io/address/v1.signer-prod.testnet), live version 3.18.0.
- Path: `worldworks/sepolia/v1`; ECDSA domain 0.
- Chain: Ethereum Sepolia, chain ID 11155111.
- Derived EVM address: [0x3BeF4f8A2eeEB1B9FaD8ba9ED44C23497F0CF9Ce](https://sepolia.etherscan.io/address/0x3BeF4f8A2eeEB1B9FaD8ba9ED44C23497F0CF9Ce).
- Recipient: [0x000000000000000000000000000000000000dEaD](https://sepolia.etherscan.io/address/0x000000000000000000000000000000000000dEaD), 1 wei per probe transfer.
- Cap: 100000000000000 wei; fixed maximum fee: 20000000000 wei/gas; gas: 21000.
- Public EVM RPC verified: `https://rpc.sepolia.ethpandaops.io`.
- Credentials remain in `~/.near-credentials/testnet/` outside the repository. No EVM signing key is created or held by the relayer.
- Status: MPC signatures obtained for nonces 0–2. Derived address has zero Sepolia ETH; no EVM payment confirmed. See [evidence](EVIDENCE-chainsig.md).


## G3 main contract Portal — 2026-11-12 UTC

Main contract: `ww-portal-261112.testnet`. Portal address:
[0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7](https://sepolia.etherscan.io/address/0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7).
Path `worldworks/portal/sepolia/v1`, signer `v1.signer-prod.testnet`, domain 0.

All local acceptance checks pass. A real 1 NEAR vending order caused the main
contract to build and obtain a genuine MPC signature for a 1000000000000000 wei
Sepolia transfer to `0x000000000000000000000000000000000000dEaD`. Independent
viem recovery matches the stored/derived treasury. Every receipt in the saved
NEAR transaction succeeded (including the NEAR creator payout).

The address has **0 Sepolia wei**. Conditional acceptance check 5 is unperformed,
as expressly permitted by the spec: no broadcast was attempted, no confirmed EVM
transaction/link is claimed. The computed EVM hash in the inspection JSON is
only the hash of the assembled bytes, not proof of broadcast.

Final Wasm: 394737 bytes; SHA-256 `b8b04a862ed87098ab2fac2a3c968d45bac594d091e09fb6a842bda04c3a181b`.
Final artifact deployed in `deploy-verified`; preceding deploy installed the same
behavior before the live order. The final rebuild changed an embedded ABI doc
comment, so it was redeployed and sandbox-tested again; stored signed bytes persist.
Initial deployment predates address-cache support; the public trusted-signer
refresh call filled the cache. Fresh deployments call it automatically at init.

## Explorer links

- [Contract](https://testnet.nearblocks.io/address/ww-portal-261112.testnet)
- [Signer](https://testnet.nearblocks.io/address/v1.signer-prod.testnet)
- [Portal](https://sepolia.etherscan.io/address/0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7)
- [Recipient](https://sepolia.etherscan.io/address/0x000000000000000000000000000000000000dEaD)
- [create-account](https://explorer.testnet.near.org/transactions/C1vcY95srkGZf5ixabVK5PBw6jwEew8TR5riv1M5a4Re)
- [deploy-init](https://explorer.testnet.near.org/transactions/AGvzQTwrbTnGqPjnty7D8S8nBinKdwYtMxreegdNSNxs)
- [deploy-final](https://explorer.testnet.near.org/transactions/C6WVX2FaaZ2TSmkhhJkSD5zvUpA6Z8kAC6Ggzru39Hi3)
- [deploy-verified](https://explorer.testnet.near.org/transactions/4Cq9KQNNu2MstK4CXfwa7u7nzisLWJEvvgoN7ZxZXTus)
- [derive-address](https://explorer.testnet.near.org/transactions/4CCqzaPV7XxB4KxhfE9GuaszDMABi2Y5PjaCsvq4AfU9)
- [publish-vending](https://explorer.testnet.near.org/transactions/6uueugq1ritQTscJjT1SmgTF8wLPmbey9audsxZfawX9)
- [publish-escrow](https://explorer.testnet.near.org/transactions/8aeXXZqMFSYK6mjcFD4xoGfHDopdEfWMdeZTBf1SyoG7)
- [vending-order](https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN)
- [Signer request receipt](https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN#8dWpU882uvedtXCGuYithLDutwja4ZBrZMBXmDQgc6yU)
- [Signer response receipt](https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN#5sJcGdhFremHZs8JRpEeY7Gcm8LiU39n37deMjbhdS43)


Machines `vending` and `escrow` are the unmodified engine example JSON graphs.
Escrow worker `inspector` is bound to `ww-portal-261112.testnet`; expiry 100 blocks.
Vending live order ID `portal-live-1`, payout ID `0`, nonce 0.
Default global per-order cap 2000000000000000 wei, fee 20 gwei, priority 1 gwei;
hard fee bounds 100/10 gwei. Contract account owns fee updates only.
Credentials live under `~/.near-credentials/testnet/`, outside the repository.
See [full Portal evidence](EVIDENCE-portal.md) and `contract/USAGE.md`.

## G4 live adapter — 2026-11-12 UTC

- Sponsor: `ww-sponsor-g4-261112.testnet` ([creation](https://explorer.testnet.near.org/transactions/HfqMtEjdipVMuTnhFgVmoxbhQye4bueQym66vsbbehPK)).
- Seeded customer: `ww-customer-g4-261112.testnet` ([creation](https://explorer.testnet.near.org/transactions/BaEdJfJZeVNx1rcXMkjkR9MYbzBe5eForoQB77bi1sHM)).
- Initial browser acceptance account: `p101b6c90d5db046759a9.ww-sponsor-g4-261112.testnet` ([creation](https://explorer.testnet.near.org/transactions/EpRnwSqMetJ6bVGLWHtYDZMqcbXJ6Yp92iBbu8k8oPx1)).
- Final browser acceptance account: `p23c3935347650b70686b.ww-sponsor-g4-261112.testnet` ([creation](https://explorer.testnet.near.org/transactions/CPEEc2ra3vT59eawBs7tuxCAj8kdnrGwDGwdodD1UBdK)).
- Testnet contract remains `ww-portal-261112.testnet`; no contract changes/deployment.
- Session grant is fixed at **3 testnet NEAR** per public key, with no refill endpoint. A deterministic subaccount prevents repeat funding after server restart. This covers two standard 1 NEAR orders, a publish, and gas/storage overhead.
- Worker access key allowance: **0.5 NEAR** for gas; receiver exactly the testnet contract; only method `approve`. RPC evidence exposed by `LiveApi.workerPermission()`; key-add transaction exposed by `workerKeyTx` when added in this instance. Existing `WorldworksApi` and `PayoutView` are unchanged.
- Server credentials and acceptance browser storage live only in `/opt/ww-secrets/`, files mode 600. Local environment file: `/opt/ww-secrets/live.env` (`SPONSOR_ACCOUNT_ID`, `SPONSOR_PRIVATE_KEY`, `CUSTOMER_ACCOUNT_ID`, `CUSTOMER_PRIVATE_KEY`). Vercel requires the same server-only variables; never use VITE-prefixed secrets.

Local API (no Vercel required):

```sh
cd app
npm exec --cache /opt/ww-npm-cache --package=tsx -- tsx --env-file=/opt/ww-secrets/live.env scripts/dev-api.ts
# In a second shell:
npm exec --cache /opt/ww-npm-cache --package=tsx -- tsx scripts/e2e-live.ts
# UI dev, when the UI's live selector is integrated:
VITE_CONTRACT_ID=ww-portal-261112.testnet VITE_API_URL=http://127.0.0.1:3001 npm run dev
```

API listens on loopback port 3001 (override `API_PORT`). Local browser CORS allows loopback origins only. Hosted functions are same-origin. In-memory rate limits: 5 session requests and 10 seeded-customer requests per IP per hour per process; peer address is used, no arbitrary forwarding header is trusted. Runtimes without a peer IP share the `unknown` bucket. Serverless replicas do not share limits; this is a demo service, not a production faucet. Seeded customer spends at most 1 NEAR/order; its balance is a separate bounded budget.

`session()` initializes WASM before synchronous `validate`/`preview`; await it first. The live adapter exports `LiveApi`, `liveApi`, `live`, and default `liveApi`. The UI owner must select it when `VITE_CONTRACT_ID` is present and display `workerPermission()` if desired. Node acceptance initializes the identical wasm binary via `initSync`; no engine files are changed. Browser private keys stay in origin localStorage; only public keys go to the session server. A different browser origin starts a new session.

See [full G4 acceptance evidence](EVIDENCE-live.md), including conditional Sepolia funding status. No commits, pushes, mainnet calls, or hosting deployment are part of this implementation.

Each E2E run creates a fresh local browser key file under `/opt/ww-secrets/` and consumes another 3 NEAR sponsor grant. Refill the testnet sponsor when needed; `E2E_STORAGE_FILE` can explicitly reuse a previously funded browser session (its orders still cost NEAR). No automatic faucet refill occurs.


## G5 hardened main contract — 2026-11-12 UTC

Same `ww-portal-261112.testnet`, same `worldworks/portal/sepolia/v1` derivation,
same Portal [0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7](https://sepolia.etherscan.io/address/0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7).
Atomic G3 migration preserved all existing machines/orders/signatures and nonce 4.
No account deletion or recreation. New examples are `vending-g5` and `escrow-g5`;
original IDs stay intact. Publisher, escrow worker and bounded-fee admin:
`ww-chainsig-261112.testnet` (separate from contract account).

- [deploy-migrate](https://explorer.testnet.near.org/transactions/2A3aCVdCejYXiwyV4BHB1c9UkGKnFiMyEB63G5s6WKL1)
- [publish-vending](https://explorer.testnet.near.org/transactions/6VXbwjjJDY5VSkrmHZWkGdw4ngEAHuFYn1XxZjxWqrz7)
- [publish-escrow](https://explorer.testnet.near.org/transactions/GXbzjAMd3uWiCPLGFwQ4vPagb2uzHARk2AisDKhgJhfp)
- [live-order](https://explorer.testnet.near.org/transactions/EinsGGeGAnaMEYhdGLodeNU7fv8jkWptTQbA64PvVhBn)

Artifact: 424933 bytes; SHA-256 `997fb3007ff358829be173486048e2d0889b6fc89dc90ca5b0f59f2b44249219`;
NEAR code hash `BLCKJgUKF1aawUcWVW2DjFVgAZzQZpkdr3i6xxZ9RDua`, independently matched.
Live order `g5-live-1` in `vending-g5`, payout/nonce 4, status signed; independent
signature recovery matches Portal address. No Sepolia broadcast/receipt claimed.

Rate 1000000 yoctoNEAR/wei, epoch 1000 blocks, budget 10000000000000000 wei,
max payout 2000000000000000 wei, signature timeout 200 blocks, future fees
100 gwei max / 1 gwei priority (bounds 100/10). Order attaches price + 1 NEAR
storage fee (example: 2 NEAR); publishing is payable with measured refund.
See [interface changes](../contract/USAGE.md#interface-changes-for-the-app) and
[full hardening evidence](EVIDENCE-hardening.md).

**Not immutable**: FullAccess key remains; `scripts/lock-contract.sh` was written
and syntax-checked but NOT run. Old contract-owned vaults/escrow are retained;
resolve/withdraw them before locking if desired. Keys remain outside the repo.
