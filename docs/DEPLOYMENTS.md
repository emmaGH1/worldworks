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
