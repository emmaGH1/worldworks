# G4 — Wallet-free onboarding, seeded customer, scoped Worker keys, live adapter

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Goal
Implement `app/src/api/live.ts` (the real `WorldworksApi` from `app/src/api/types.ts` / `specs/API-interface.md`) plus the serverless functions it needs, against the deployed contract `ww-portal-261112.testnet` (see docs/DEPLOYMENTS.md, contract/USAGE.md).

## Requirements
1. **Session, no wallet**: the browser generates an ed25519 key pair (kept in localStorage; never sent anywhere except the public key). `POST /api/session {publicKey}` (`app/api/session.ts`) creates a fresh testnet sub-account of a sponsor account with that public key as its key and funds it with a small testnet amount (enough for a few orders and one publish; state it). Sponsor key only in env `SPONSOR_ACCOUNT_ID` / `SPONSOR_PRIVATE_KEY` (Vercel env; locally an env file outside the repo, e.g. /opt/ww-secrets/.env). Simple abuse limits: per-IP rate limit (in-memory is fine) and a hard cap on funding per account. If the sponsor runs low, return a clear error the UI can show.
2. **Scoped Worker key (real NEAR feature)**: when the player publishes a machine with a Worker bound to their account, `live.ts` adds a function-call access key to the player's account restricted to receiver = contract and methods = ["approve"], with a small gas allowance, and uses ONLY that key for `approve`. Expose in `PayoutView`/UI data enough to show "this key can only approve" (the key's permission as read from RPC `view_access_key`).
3. **Seeded customer**: `POST /api/customer {machineId}` (`app/api/customer.ts`) places an order from a dedicated seeded customer account (key in env), with a Portal recipient that is a fixed demo Sepolia address unless the request provides one. Rate-limited. It is labeled "seeded customer" everywhere.
4. **Orders and payouts**: `order()` signs `submit_order` with the session key, attaching exactly the price; parses effects and payout ids from the receipt/return value; `getPayout()` reads `get_payout`; `relay()` calls the existing `app/api/relay.ts` logic; status `confirmed` only after a Sepolia receipt with success status.
5. `validate`/`preview` use the wasm engine (`app/src/engine/index.ts`).
6. Local dev: a tiny server or `vercel dev`-free way to run the functions locally (e.g. a `scripts/dev-api.ts` using node:http that mounts the same handlers) so everything is testable on this machine without Vercel.
7. Deploy/refresh testnet state as needed: create the sponsor and seeded customer accounts (faucet), fund them, record in docs/DEPLOYMENTS.md (names only, never keys).

## Acceptance checks (write evidence to docs/EVIDENCE-live.md)
1. `cd app && npm run typecheck && npm run build`.
2. A node script `app/scripts/e2e-live.ts` that, against testnet with the local API server: creates a session, publishes a copy of `vending.json` and `escrow.json` under new ids, places an order, adds the scoped Worker key and approves an escrow order with it, shows the scoped key's permission from RPC, shows that the scoped key CANNOT call another method (attempt + error), runs a seeded customer order, and polls a payout to `signed`. Paste output with explorer links.
3. If the portal treasury (0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7) has Sepolia ETH, relay one payout and show `confirmed` with the Sepolia link; otherwise mark NEEDS USER.
4. `git status`: no keys in the repo.

## Constraints
You own app/src/api/live.ts, app/api/ (session.ts, customer.ts; keep relay.ts working), app/scripts/, docs/DEPLOYMENTS.md, docs/EVIDENCE-live.md. Opus is building app/src UI and app/src/api/mock.ts + index.ts at the same time: do not touch those or types.ts (if the interface must change, stop and report). Do not touch contract/ or engine/. Testnet only. Do not commit or push.
