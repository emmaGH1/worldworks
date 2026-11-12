# T1 — Front-end app scaffold (Terra)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Goal
An empty but correctly wired front-end shell in `app/` that designers and builders can fill in. No game logic yet.

## Requirements
- Vite + React + TypeScript (current stable versions; pin exact versions in package.json).
- Dependencies installed (exact versions from docs/design/REFERENCES.md section 6 where listed): `@xyflow/react`, `motion`, `howler`, `d3-sankey`, `near-api-js` (or the current recommended NEAR JS client per docs.near.org; say which), `viem` (EVM explorer links / address checks only).
- Routes (react-router or a tiny hash router; choose the lighter): `/` Workshop placeholder, `/m/:machineId` standalone machine app placeholder, `/verify` placeholder (will list contract address and explorer links).
- `src/styles/tokens.css` with CSS variables for colour, type, radius, shadow, motion durations, filled with Direction A "Toy Works" values from REFERENCES.md section 7 (the user may switch direction later; keep all tokens in this one file).
- Google Fonts for Direction A loaded in index.html.
- `src/config.ts` reading `VITE_CONTRACT_ID`, `VITE_NEAR_NETWORK` (default testnet), `VITE_RELAYER_URL` from env with safe defaults and an `.env.example` (no secrets).
- `vercel.json` with SPA rewrites so `/m/:id` works on refresh.
- A placeholder `src/engine/` folder with a README stating the wasm build of `engine/` will be wired here later (do not build wasm now).
- Scripts: `dev`, `build`, `preview`, `typecheck`.

## Environment
Use npm with cache /opt/ww-npm-cache (already the configured cache). The /data disk has ~1.5 GB free: install only what is listed; report `du -sh app/node_modules`. Do not touch engine/, contract/, probes/, research/, HACKATHON.md, README.md. Do not commit or push.

## Acceptance checks (paste output)
1. `cd app && npm run typecheck && npm run build` succeeds; print dist size.
2. `npm run preview` serves; `curl -s localhost:<port>/m/test` returns the app HTML (SPA fallback) — stop the server after.
3. `cat .env.example` shows no secrets.
4. `du -sh app/node_modules`.
