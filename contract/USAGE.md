# WORLDWORKS contract and Sepolia Portal

NEAR testnet only. Machine rules use `../engine/MACHINE_FORMAT.md`. The shared
Portal treasury is one Chain Signatures EVM address per contract, using path
`worldworks/portal/sepolia/v1`, domain 0, signer `v1.signer-prod.testnet`.
No EVM private key exists in the contract or relayer.

```sh
export PATH="$HOME/.cargo/bin:$PATH"
export CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target
cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml
cargo near build non-reproducible-wasm --manifest-path contract/tests/mock-signer/Cargo.toml --no-abi --out-dir /opt/ww-target/portal-mock
cd contract
cargo test -- --nocapture
cd ../engine
cargo test
cd ../app
npm run typecheck && npm run build
npx tsc -p api/tsconfig.json
npm exec --cache /opt/ww-npm-cache --package=tsx -- tsx --test scripts/relay.test.ts
```

The sandbox test uses these Wasm paths (override the main artifact with
`WORLDWORKS_WASM`). Build both before testing. Tests never use the live signer.

Initialize with `new({})`, or `new({portal_config: {...}})` for explicit settings.
Default cap is 2000000000000000 wei **per order across all releases**, in addition
to the engine's immutable per-machine per-order cap. Default max fee is 20 gwei,
priority fee 1 gwei. Init fixes `fee_upper_bound` (at most 100 gwei),
`priority_upper_bound` (at most the max fee bound), `cap_wei`, and `signer`.
Explicit config requires all these fields plus `max_fee_per_gas` and
`max_priority_fee_per_gas`; `next_nonce` may be omitted and must initially be zero.
`set_portal_fees(max_fee_per_gas, max_priority_fee_per_gas)` is self-account only;
it checks both init bounds, positive max fee and priority <= max fee. It changes
future payouts only. No exported method changes machines, recipients, values,
reserved nonces, transaction bytes or fund balances administratively.

Init asynchronously queries the signer's `derived_public_key` with predecessor =
this contract, path above, domain_id = 0. It stores the last 20 bytes of keccak256
of the 64-byte base58-decoded secp256k1 public key (without SEC1 prefix).
`get_portal_address()` returns that hex address or null before the callback.
Anyone may call `refresh_portal_address()` to repeat the trusted public query;
the private callback refuses to replace a previously derived address.
`get_portal_derivation()` exposes the exact derivation query.

`publish_machine(machine_id, machine_json, workers, expiry_blocks)` stores an
immutable validated engine graph, publisher as owner, exact Worker-node/account
bindings and a positive block expiry. `machine_json` is a JSON string.
No storage deposit is charged; prefund the contract for growing storage.

`submit_order(machine_id, order_id, external_recipient?)` attaches exactly the
CoinSlot price; payer is predecessor. IDs stay reserved after completion/expiry.
Portal-reachable graphs require a 20-byte `0x` hex recipient up front.
`approve(machine_id, order_id)` authenticates Worker by predecessor, releasing
one currently pending role per call. `expire(machine_id, order_id)` is available
to the publisher immediately, anyone at the original expiry block. Both can
release Portal effects through their respective branches. Expiry is manual.

Every positive-fee ExternalPayout immediately reserves a decimal global
`payout_id` equal to its nonce (starting at `"0"`), stores exact unsigned EIP-1559
bytes and payload hash, and calls the signer in the same customer transaction.
The contract fixes chain 11155111, recipient, wei, gas 21000, empty data/access
list and fees at creation. Callback sets `signed` with public MPC signature JSON,
or `signature_failed` on signer failure/malformed response. A successful NEAR
order does not mean an EVM transaction was broadcast or paid.

`retry_signature(payout_id)` is public only for `signature_failed`. It signs the
stored payload again, with identical nonce and bytes even after fee changes.
Pending/signed retries and external callback calls are rejected. A failed
signature consumes its nonce, so retry it before relaying later nonces. There is
no fee replacement or cancellation; an underpriced signed transaction must wait
for suitable Sepolia fees. Multiple payouts reserve 35 Tgas per signer and 15
Tgas per callback; caller must supply enough gas (300 Tgas recommended). If a
release exceeds available gas, NEAR rolls back the entire receipt including all
scheduled effects. Graph flow limits alone do not guarantee sufficient host gas.

Views: `get_payout(payout_id)` exposes status, all tx fields, unsigned bytes,
keccak payload and `signature_json` (`big_r.affine_point`, `s.scalar`,
`recovery_id`). These suffice to reconstruct raw signed bytes; the relayer does
so and verifies both bytes/hash and recovered sender. `get_portal_nonce()` is a
decimal-string next nonce. `get_machine`, `get_order`, `get_vaults`,
`get_pending_external_payouts` (historical records too, with current signature
status), and `explain_order` retain their existing interfaces; external records
now also include `payout_id`. Amounts/block heights are decimal strings.

## Keyless relayer

`app/api/relay.ts` is a Vercel Node serverless handler: POST `{ "payout_id":"0" }`
returns `{ "evm_tx_hash":"0x..." }` after broadcast. A known exact transaction
returns the same deterministic hash on rebroadcast. RPC failures without proof
of acceptance remain errors. It independently derives the signer address,
checks the stored address, recovers the sender, and checks RPC chain 11155111.
Configuration: `PORTAL_CONTRACT` (default `ww-portal-261112.testnet`),
`SEPOLIA_RPC_URL` (default `https://rpc.sepolia.ethpandaops.io`). NEAR views always
use `https://rpc.testnet.near.org`. No credentials are read.

```sh
cd app
npm exec --cache /opt/ww-npm-cache --package=tsx -- tsx scripts/inspect-portal.ts 0
npm exec --cache /opt/ww-npm-cache --package=tsx -- tsx scripts/relay.ts 0
```

Fund the derived address on **Sepolia** first; relay nonces in order. An RPC
acceptance/hash is not confirmation: inspect the Sepolia receipt separately.
The Node API/scripts have their own `api/tsconfig.json` because the existing app
`npm run typecheck` checks `src` only; always run the extra API check above.

## Limits

Fresh deployment required: persisted state differs from G2a. Machines/orders and
external records grow without pruning/pagination; prefunding and bounded demo
usage are required. NEAR transfers are asynchronous without recovery callbacks.
Full-access account keys can redeploy code; this is testnet demo custody, not an
immutable production vault. 21000 gas targets ordinary EVM accounts, not general
contract execution. No serverless hosting deployment or EVM confirmation is
claimed by source installation. See `../docs/EVIDENCE-portal.md` for live proof.
