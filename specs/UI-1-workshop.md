# UI-1 — The real WORLDWORKS interface (Opus)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Inputs
- Visual direction: **A "Toy Works"** (default; the user may switch to B later, so keep every colour/font/radius in `app/src/styles/tokens.css`). Lift the part symbols from `docs/design/directions.html` (`a-*` symbols) and refine them as you proposed: 2-3 expressions per part switched by state, Splitter flap moving per coin, subtle paper texture, smooth pipe corners.
- References: `docs/design/REFERENCES.md` (follow its ten rules and "do not look like this" list).
- Interface: `specs/API-interface.md` and `app/src/api/types.ts` (do not change types.ts; if you need a change, write it in your report).
- Engine in the browser: `app/src/engine/index.ts` (`validateMachine`, `previewOrder`, `machineHash`). Machine format: `engine/MACHINE_FORMAT.md`; examples `engine/examples/*.json`.
- Timing facts from live testnet: NEAR tx ~1.5 s; Chain Signatures signature ~14-15 s; Sepolia confirmation ~12 s. The cross-chain wait is a feature: design a delightful, honest multi-step Portal state (signing on NEAR -> signed -> sent to Sepolia -> confirmed), each step with its explorer link when it exists.

## Build (inside app/, React + TypeScript, existing stack: @xyflow/react, motion, howler, d3-sankey)
1. `app/src/api/mock.ts` implementing `WorldworksApi` with realistic timings and a visible "MOCK DATA" badge in the UI whenever `api.mode === 'mock'`. `app/src/api/index.ts` exports `api` (mock unless `VITE_CONTRACT_ID` is set; the live adapter `live.ts` is being written by another agent: import it lazily so its absence does not break the build — if `live.ts` does not exist yet, fall back to mock).
2. **Workshop (`/`)**: opens straight into the broken "Lemonade Machine" (no splash, no wallet, no sign-up; call `api.session()` silently). Canvas with the seven parts as custom React Flow nodes, thick pipes as custom edges with rolling coins; parts palette; drag a part onto a pipe to insert it (the key interaction: dropping a Splitter onto the Coin Slot -> Portal pipe); click a part to edit its few settings in a small popover (price, split %, gate rule, worker, portal recipient); live validation through the wasm engine with friendly inline messages (never raw error names).
3. **Goal card**: "Make the machine stop losing money" -> success when a sale leaves reserve > 0 (from preview or real order). Then a second goal unlocks: "Pay a customer on Ethereum" (Portal live run). Keep it to these two goals plus free play.
4. **Serve a customer**: the seeded customer (labeled "seeded customer", never "AI" unless it is) walks in; coins animate along the actual effects returned by the API; numbers roll; Vault fills; Payout cheers; Portal runs its multi-step state.
5. **Ledger drawer**: every real transaction as a row with status and explorer link; mock rows marked mock.
6. **Publish** and **Open as app**: publish via `api.publish`, then `/m/:machineId` — a clean standalone payment page that reads the machine from `api.getMachine`, explains its rules in plain words generated from the machine JSON, has a Pay button (`api.order`), an EVM recipient field when the machine has a Portal, and shows receipts. It must look like a real product page, not the game.
7. **`/verify`**: contract id, portal address, explorer links, a "what is real / what is simulated" table, and "verify it yourself" commands (placeholders the README will reuse).
8. Templates menu: Lemonade (broken start), Escrow with an Inspector (Worker + approval Gate), Cross-chain vending.
9. Sound: optional, off by default, CC0 only (record source in `app/public/sounds/CREDITS.md`).
10. Responsive: desktop first; at 390 px wide show a polite "best on a bigger screen" view of the machine that still lets you serve a customer.

## Acceptance checks (paste output)
1. `cd app && npm run typecheck && npm run build`.
2. Headless Chromium screenshots (Playwright core is at /opt/ww-shot/node_modules/playwright-core; Chromium at /data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome) of: workshop broken state, splitter inserted, Portal pending, Portal confirmed (mock), `/m/lemonade`, `/verify`, and 390 px workshop. Save to `docs/design/screens/` and list them.
3. A scripted Playwright run that performs the first-60-seconds flow in mock mode (drop Splitter on the pipe, serve a customer, see reserve > 0) and asserts it; paste output.
4. No console errors during the scripted run.

## Constraints
You own app/src (except app/src/api/live.ts, app/src/api/types.ts and app/src/engine/) and app/public. Another agent (Sol) is writing app/src/api/live.ts, app/api/session.ts and app/api/customer.ts at the same time. Do not touch contract/, engine/, engine-wasm/, probes/, research/, HACKATHON.md, README.md. npm cache /opt/ww-npm-cache; /data disk ~1.2 GB free (no heavy dependencies). Do not commit or push.
