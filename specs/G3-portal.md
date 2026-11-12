# G3 — Portal: real cross-chain payouts from the main contract

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Context
- `contract/` (engine-backed, hardened in G1-fix) records Portal payouts as `awaiting_signature` behind a private seam.
- `probes/chainsig/` proved live: a contract builds a constrained Sepolia tx, tracks its own nonce, rejects duplicates and over-cap, and gets it signed by `v1.signer-prod.testnet` in ~14-15 s. Reuse its code and lessons (read probes/chainsig/README.md and docs/EVIDENCE-chainsig.md).
- Design decision: ONE shared Portal treasury address per contract (derivation path `worldworks/portal/sepolia/v1`), funded once from a faucet. Each machine's Portal spending is still bounded by that machine's validated `portal_cap_wei` and a contract-wide cap. Per-machine derived addresses are roadmap, not this task.

## Requirements
1. In `submit_order` (and in `approve`/`expire` when they release to a Portal), each ExternalPayout effect creates a payout record and, in the same transaction, calls the signer. The customer's one transaction triggers the signature. Callback stores the signature and sets `signed`; on signer failure sets `signature_failed`.
2. `retry_signature(payout_id)` callable by anyone, only for `signature_failed`; it re-signs the IDENTICAL transaction bytes (same nonce). No method can ever produce two different signed transactions for one payout, or sign anything not built by the contract.
3. The contract builds the EVM tx itself: chain id 11155111, to = validated recipient, value = wei, empty data, gas limit 21000, nonce from its own counter, fees from init params. An owner method may update fee params only within hard upper bounds set at init (document them); it cannot touch recipients, amounts, machines or funds.
4. Views: `get_payout(payout_id)` returns status, the unsigned tx fields, the signature (r, s, v / recovery id) and the precomputed raw signed tx hex once signed (or enough for anyone to reconstruct it), plus `get_portal_address()` (the derived address, computed and stored at init or documented how it's derived), `get_portal_nonce()`.
5. Relayer as a Vercel serverless function in `app/api/relay.ts` (TypeScript, viem): `POST {payout_id}` -> reads the contract view, assembles the raw tx, verifies the recovered sender equals the portal address, broadcasts to a configurable Sepolia RPC (`SEPOLIA_RPC_URL`, default a public RPC), returns `{evm_tx_hash}`. Idempotent: rebroadcasting a known tx returns the same hash. It holds no private key of any kind. Also a CLI wrapper `app/scripts/relay.ts` to run the same logic locally.
6. Sandbox tests with a mock signer contract (in `contract/tests/`): lifecycle awaiting -> signed; failure -> signature_failed -> retry -> signed with identical bytes; nonce increments exactly once per payout; over-cap rejected; zero-fee never signs.
7. Live testnet deployment of the main contract to a NEW account (record in docs/DEPLOYMENTS.md), publish `engine/examples/vending.json` and `escrow.json`, run one vending order on testnet and show the signature lands. If the portal address has Sepolia ETH, broadcast via the relayer and show the Sepolia receipt. If it has none, stop there and list the address under NEEDS USER (the user is funding the probe address 0x3BeF4f8A2eeEB1B9FaD8ba9ED44C23497F0CF9Ce now; a new contract derives a different address, so report it).

## Acceptance checks (paste output; write evidence to docs/EVIDENCE-portal.md)
1. `cd contract && cargo test` all pass (list new tests). `cd engine && cargo test` still passes.
2. `cargo near build non-reproducible-wasm` succeeds; size.
3. `cd app && npm run typecheck && npm run build` pass with the api function.
4. Testnet: deploy tx link, publish tx links, order tx link with signature in state (`get_payout` output).
5. If funded: relayer output with Sepolia tx link showing from = portal address, to = recipient, value = wei.

## Environment
CARGO_TARGET_DIR=/opt/ww-target, CARGO_HOME=/opt/ww-cargo-home, PATH includes ~/.cargo/bin, npm cache /opt/ww-npm-cache. Testnet transactions approved by the user; never mainnet. Keys never in the repo. You own contract/ and app/api, app/scripts. Another agent works in engine-wasm/ and app/src/engine/; do not touch those or engine/ (if engine needs a change, stop and report). Do not commit or push.
