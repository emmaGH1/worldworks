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
