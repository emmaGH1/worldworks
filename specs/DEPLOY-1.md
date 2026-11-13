# DEPLOY-1 — API facade fixes + Vercel deployment

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Part A — API fixes (from the Sol G6 completeness check)
1. `approve` must surface Portal effects: change `WorldworksApi.approve` to return `{ tx: TxRef; effects: OrderResult['effects']; pending: boolean; observation?: 'unknown' }` in `app/src/api/types.ts`, `live.ts`, `mock.ts`, `specs/API-interface.md`. Update the old callers in `app/src/pages/Workshop.tsx` and `MachineApp.tsx` minimally so they compile and track Portal payouts after approve (Opus is replacing these pages; keep edits tiny).
2. Observation failure: `app/api/near.ts` currently returns `pending:true` when the receipt can't be decoded. Add an explicit `observation: 'unknown'` field to OrderResult (optional) and set `pending:false` in that case; mock never sets it. Document in API-interface.md.
3. Unit tests for both in `app/scripts/live.test.ts`; all existing tests pass.

## Part B — Vercel
Token: `/opt/ww-secrets/vercel.token` (read into an env var inside the command; never echo it, never write it to the repo or logs). Account `emmagh1`. CLI: `npx --cache /opt/ww-npm-cache vercel@latest ... --token "$VERCEL_TOKEN"`.
1. Create project `worldworks` (root `app/`), framework Vite, serverless functions from `app/api/*`. Ensure `vercel.json` SPA rewrites keep `/api/*` working and route `/m/:id` and `/verify` to index.html.
2. Production env vars (encrypted, Production + Preview): from `/opt/ww-secrets/live.env` — sponsor + customer account ids/keys, Sepolia RPC URLs, contract id; plus `VITE_CONTRACT_ID=ww-portal-261112.testnet`, `VITE_NEAR_NETWORK=testnet`, `VITE_RELAYER_URL` = same origin (empty/relative if the client supports it; otherwise the production URL). No `VITE_` var may contain a secret.
3. Deploy current `main` to production. Verify on the deployed URL: `GET /` 200, `POST /api/session` creates a sponsored account (one real testnet session is OK), `/m/<an existing published machine id>` loads, a relay/confirm read of payout 15 returns confirmed. Do NOT place orders beyond one smoke-test order.
4. Also deploy the UI-2 concept as a separate preview (`app/concepts/ui2`, project `worldworks-concept`) so the user can test fps on a real phone. Report both URLs.
5. Check the serverless functions' cold-start/timeouts (Chain Signatures ~14 s; Vercel Hobby limit) and set `maxDuration` appropriately; report.

## Acceptance (docs/DEPLOYMENTS.md new section + your report)
URLs, env var NAMES (never values), smoke-test results with tx links, function durations, `npm run typecheck`, api typecheck, unit tests.

## Constraints
You own `app/src/api/*`, `app/api/*`, `app/scripts/*`, `app/vercel.json`, `app/package.json` (scripts/deps only if required), `specs/API-interface.md`, `docs/DEPLOYMENTS.md`, minimal compile fixes in Workshop.tsx/MachineApp.tsx. Opus is building the game in `app/src/game/` and replacing pages at the same time: do not touch `app/src/game/`, `app/src/components/`, styles. Testnet only. Do not commit or push. Never print secrets.
