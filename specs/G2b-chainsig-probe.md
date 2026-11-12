# G2b — Live Chain Signatures probe on testnet (gate 2)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Goal
Prove, live, that a NEAR testnet contract (not a person, not a server key) can make a payment on an EVM testnet through Chain Signatures. This de-risks the Portal part. Work only in `probes/chainsig/` (another agent is building `contract/`; do not touch it).

## Approved by the user
Creating NEAR testnet accounts (faucet), deploying to testnet, sending testnet transactions. Testnet only: never mainnet, never real funds.

## Steps
1. Read the official docs first and follow them, not memory: https://docs.near.org/chain-abstraction/chain-signatures and https://docs.near.org/chain-abstraction/chain-signatures/implementation (testnet signer `v1.signer-prod.testnet`). Use maintained crates/libraries where they exist (e.g. near's omni-transaction for building EVM transactions in Rust; viem or ethers for the relayer). Verify crate versions on crates.io.
2. Create testnet accounts with the near CLI faucet sponsor (credentials stay in ~/.near-credentials or the CLI keychain, never in the repo). Record account names in `docs/DEPLOYMENTS.md`.
3. Minimal probe contract: method `pay(recipient_evm_address, wei)` that
   - validates the address format and `wei <= cap` (cap fixed at init),
   - builds the EVM transaction itself with chain id fixed to the chosen testnet, `to` = recipient, `value` = wei, empty data, nonce tracked by the contract (it is the only signer for its derived address), gas limit 21000, max fee within a cap set at init,
   - calls the signer contract with a derivation path specific to this contract,
   - stores the returned signature against a payout id and refuses to sign the same payout id twice.
   No method may sign an arbitrary payload supplied by a caller.
4. Derive the EVM address for (contract account, path). Fund it with testnet ETH. Choose the EVM testnet by which faucet works without a human login (try Sepolia first; Base Sepolia or another EVM testnet is acceptable if its faucet is easier; record the choice). If every faucet needs a human login or captcha, STOP that step, print the derived address and the exact faucet URL in your report under "NEEDS USER", and finish everything else.
5. Relayer script (TypeScript, `probes/chainsig/relayer/`): reads the stored signature from the contract, assembles the signed transaction, broadcasts it to a public RPC, waits for the receipt. It must not be able to change recipient, amount or nonce (it only assembles what the contract signed; prove this by showing the relayer has no private key).
6. Measure end-to-end latency (NEAR call submitted -> signature available -> EVM receipt).

## Acceptance checks (paste output)
1. NEAR explorer link for the `pay` transaction and the signer call.
2. EVM explorer link for the resulting transaction, showing from = derived address, to = recipient, value = wei.
3. Second `pay` with the same payout id is rejected (transaction link + error).
4. `pay` with wei above cap is rejected.
5. Latency numbers for at least 2 runs.
6. `git status` shows no keys or credentials in the repo.
Write all of this to `docs/EVIDENCE-chainsig.md`.

## Constraints
- Build with CARGO_TARGET_DIR=/opt/ww-target and CARGO_HOME=/opt/ww-cargo-home; npm cache is /opt/ww-npm-cache. The /data disk is nearly full.
- Do not commit or push.

## Report
Accounts and addresses, every link, measured latencies, cost per signature in NEAR, anything not done, anything that needs the user. Do not say done if any check fails.
