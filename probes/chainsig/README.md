# Chain Signatures testnet probe

This is an isolated probe, not the WORLDWORKS production contract. It signs only
Sepolia chain 11155111 native ETH transfers. No arbitrary payload method exists.

Official references read before implementation:
- https://docs.near.org/chain-abstraction/chain-signatures
- https://docs.near.org/chain-abstraction/chain-signatures/implementation
- https://github.com/near/mpc/blob/main/crates/contract/src/api/sign.rs
- https://github.com/near/mpc/blob/main/crates/near-mpc-contract-interface/src/deposits.rs

Versions verified through crates.io using `cargo search` and `cargo info`:
near-sdk 5.30.1; omni-transaction 0.5.0 (EVM feature only). Lockfiles included.

## Build / verify

From the repository root:

```sh
CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target \
  ~/.cargo/bin/cargo-near near build non-reproducible-wasm \
  --manifest-path probes/chainsig/Cargo.toml --no-abi --out-dir /opt/ww-target/chainsig
cd probes/chainsig/relayer
npm ci --cache /opt/ww-npm-cache
npm run check
npm test
npm run derive
```

Expected: successful WASM build, TypeScript check, eight passing tests,
Sepolia chain id 11155111 and the address recorded in DEPLOYMENTS.md.
`npm test` uses an actual recorded MPC response and checks recipient, amount,
nonce, chain, fee, and gas tampering as well as recovered signer and empty data.

## Contract interface

`new(cap: U128, max_fee_per_gas: U128)` is self-initialized once. The owner is
the contract account. The fee cap is fixed, positive, and at most 100 gwei.
`pay(payout_id, recipient_evm_address, wei)` requires the owner, a unique ID,
positive bounded amount, and a 20-byte hex address. It builds the full EIP-1559
transaction using omni-transaction, hashes with keccak256, reserves the nonce
and ID before calling v1.signer-prod.testnet with 1 yoctoNEAR, and stores the
signature only in a private callback. Gas is 21000, input/access list empty,
priority fee min(1 gwei, fee cap), path worldworks/sepolia/v1. `config` and
`get_payout` are views. This extra payout_id argument resolves the spec's
requirement to explicitly retry an ID.

Failed or timed-out signing permanently consumes the payout ID and nonce.
There is deliberately no arbitrary re-sign/retry/reset interface. A nonce gap
would block later EVM payouts; this probe requires a fresh deployment/path to
recover if no valid signature was obtained. Three valid signatures are stored
for nonces 0, 1, 2 and must be relayed in that order. The owner full-access NEAR
key can redeploy code: this is a probe, not an immutable custody deployment.
21000 gas requires an ordinary EVM account recipient, not arbitrary contract execution.

## Resume after funding

Fund the derived address on **Sepolia**, not mainnet. At the configured 20 gwei
maximum, three transfers require at most 0.001260000000000003 ETH; 0.003 test
ETH is sufficient. No EVM private key exists in the relayer. It only reads public
NEAR views, reconstructs the exact bytes, verifies their hash and recovered
address, broadcasts via public Sepolia RPC and checks the receipt succeeded.

```sh
cd probes/chainsig/relayer
npm run derive
npm run relay -- run-1
npm run relay -- run-2
npm run relay -- run-3
```

`EVM_RPC` can override the endpoint; actual chain ID is checked before broadcast.
`PROBE_ACCOUNT` can select another deployment; transaction policy remains Sepolia.
The relayer does not import or read NEAR credentials. The measurement driver
uses the CLI's external keychain solely to authorize a NEAR `pay` call:

```sh
EVIDENCE_LABEL=next-run ./node_modules/.bin/tsx measure.ts UNIQUE_ID 1
```

Run this from the relayer directory; results go to ../evidence/. Use a unique
EVIDENCE_LABEL for rejection tests. Timings include CLI startup, signing,
submission, completion and final view overhead; they are upper bounds, not
MPC computation time. Existing blocked runs cannot supply historical EVM
end-to-end latency. After funding, run two NEW payouts with submission,
signature observation, broadcast, and receipt timestamps to complete that check.

All credentials live outside the repository under ~/.near-credentials/testnet/.
Never copy credentials into this directory, including test fixtures.
