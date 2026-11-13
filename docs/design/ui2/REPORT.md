# UI-2 concept report: the Lemonade level as a 2.5D toy factory

Spec: `specs/UI-2-concepts.md`. Prototype: `app/concepts/ui2/` (standalone Vite entry, `app/src` untouched).
Everything on screen is **SIMULATED** (HUD pill + per-payout "SIMULATED" tag). No chain is touched.

## Deliverables

| File | What |
|---|---|
| `ui2-01-wide.png` | Wide shot, 1600×900: NEAR island factory, queue, belts, Vault, Portal, Ethereum island |
| `ui2-02-splitter.png` | Splitter close-up: 70/30 dial, coins splitting onto two belts, Vault stack |
| `ui2-03-portal.png` | Portal moment: beam across the water, gem pops out on the Ethereum island with a shockwave, `+0.0001 ETH · SIMULATED` |
| `ui2-04-phone.png` | 390×844 @2x, portrait camera: the flow runs top to bottom, Ethereum island below |
| `ui2-capture-10s.webm` | 10.0 s, 1280×720, 30 fps: coins flowing, customers served, a portal jump with the camera punch-in, the goal-met toast |

Run it: `cd app/concepts/ui2 && npm install --cache /opt/ww-npm-cache && npm run dev` → http://127.0.0.1:5190/

## What the prototype does

- **World**: a 2.5D orthographic camera over two low-poly islands in a shader-driven sea (shore foam, ripple bands). The factory sits on a tiled floor plate on the NEAR island. The Ethereum island sits across the water, in a cooler palette.
- **Parts as chunky machines**: a lemonade stand is the Coin Slot (awning, sign, slot mouth). The Splitter has a 70/30 dial and a needle that swings to each coin's exit. The Vault is a glass-walled bin where coins visibly stack in 9 columns. The Portal is a well with a swirling shader disc, and a matching exit portal stands on the Ethereum island.
- **Money is physical**: each sale is 10 coins (1 coin = 0.01 NEAR). They ride scrolling belts, split 7 left and 3 right, hop into the Vault and stack up, or spiral down into the Portal. When an order's 3 Portal coins are in, a beam arcs over the water and an ETH gem pops out of the exit portal. The gem bounces onto the supplier's pallet and the supplier jumps.
- **Customers**: characters walk out of the town houses, queue at the stand, flick a coin into the slot, get a lemonade cup and walk off.
- **Juice**: spring squash and stretch on every machine hit, particle bursts, shockwave rings, screen shake on the pop, a camera punch-in on the portal jump (at most once every 13 s), and floating `+0.07 NEAR` / `+0.0001 ETH` tags. Sound is synthesised in WebAudio, has no asset files, and is muted until the player taps the speaker button.
- **HUD (small)**: level card ("Lemonade stand · keep 70% of every sale · 10 customers") with a kept-% meter, a 70% target tick and 10 customer pips. The SIMULATED pill sits top right. The bottom dock shows the parts: Gate, Worker and Payout are dimmed as not-yet-unlocked. "Run it for real" is **not wired** and says so in a toast when clicked. A "★ Goal met" toast fires at customer 10. There is no hero headline.

## Library choice: Three.js (r187), not PixiJS

- The look depends on real light: soft shadows under every part, rim light on coins (a PMREM room environment), depth sorting of coins inside the glass Vault, and a camera that can punch in. These come built into a 3D scene. In PixiJS each part would need hand-painted iso sprites for every orientation and state. We have no artist, and the spec rules out AI images.
- All geometry is procedural (rounded boxes, cylinders, tori, instanced coins and gems), so the game ships **zero art assets**.
- Portrait framing comes cheaply: on phones the camera turns to azimuth 110° and the frame is refit to the content box. The flow then runs top to bottom with no second layout to maintain.
- Cost: `three` adds ~157 KB gzip to the JS bundle, and the engine wasm is a separate 122 KB gzip (the app already ships it). No other runtime dependencies.

## Performance (honest)

- Scene budget per frame: ~125 draw calls per pass (shadow pass + main, 251 total), ~82k triangles per pass, one 2048² shadow map, 9 textures. Static scenery is merged by material at boot; before the merge it was 449 calls. Coins, Vault stack, gems and particles are instanced: one draw each.
- **60 fps on a laptop is not verified.** This VM has no GPU. Chromium falls back to SwiftShader (software GL) and runs the scene at ~4.5 fps here. The budget above is well inside what an integrated laptop GPU handles at 60 fps, but someone has to open it on a real laptop and phone to confirm. If phones struggle, the first knobs are pixel ratio (capped at 2 today) and shadow map size.
- Because of that, the 10 s capture was made **deterministically**: the real prototype in Chromium (path from the spec), with the simulation stepped 1/30 s per frame and a screenshot taken each frame, then encoded with ffmpeg (VP9 webm). Every frame is a real render with no editing. Only the frame pacing is synthetic. A real-time screen recording on this VM would play at ~5 fps.

## How it plugs into the engine wasm and `WorldworksApi` (no changes to either)

**Already real in the concept:** `src/sim.ts` imports `app/src/engine/pkg/worldworks_engine_wasm.js`, the same wasm that `api.validate` and `api.preview` call. It validates a Lemonade `MachineDoc.machine` (slot 0.1 NEAR → split 7000/3000 bps → Vault `reserve` + Portal `sepolia`, 0.0001 ETH). Each simulated customer is one `preview_order` call. The coins are derived from the returned effects: `VaultCredit` 0.07 NEAR → 7 Vault coins, `ExternalPayout.fee` 0.03 NEAR → 3 Portal coins, `wei` → 1 gem. Nothing is hard-coded: change the bps and the coins change.

**Shipping it:** the renderer consumes `OrderResult.effects`, so every animation is driven by an effect list, simulated or real:

| Source | Call (`app/src/api/types.ts`, unchanged) | Drives |
|---|---|---|
| Building | `validate(doc)` per edit; `Layout.positions` → tile coordinates | parts on the grid, red-flash invalid joints |
| Simulated customers | `preview(doc, recipient)` (wasm, local) | the SIMULATED loop, as now |
| "Run it for real" | `session()` (sponsored, wallet-free) → `publish(machineId, doc)` → `customerOrder(machineId)` | one REAL order: the same coin animation, tagged REAL, with `tx.explorerUrl` |
| Vault | `effects[kind='vault']`, then `getMachine().vaults` | coin stack + verified balance |
| Payout | `effects[kind='payout']` | coins roll off the island to a mailbox |
| Gate + Worker (level 2) | `OrderResult.pending` → coins wait at the Gate; `approve(machineId, orderId)` | the Worker walks over, picks up the coins, the Gate opens |
| Portal (level 3) | `effects[kind='external'].payoutId` → poll `getPayout` / `relay` | `waiting_for_signature`/`signed` → coins swirl in the portal; `broadcast` → beam over the water; `confirmed` → gem pops out, linked to `evmTx.explorerUrl` (real Sepolia tx) |

The real Portal path holds the swirl state for as long as Chain Signatures actually takes. The pop is gated on `confirmed`, never on a timer, so the spectacle cannot claim a transaction that has not landed.

## Hour estimate to ship the full game on this direction (including live chain wiring)

| Work | Hours |
|---|---|
| Generic scene from `MachineDoc` + `Layout`: grid, belt auto-routing (grid A*), coin routing for any graph (N-way splitters, Gate pass/fail, Payout exits) | 10–14 |
| Remaining parts as machines: Gate, Worker (character that carries coins and approves), Payout (mailbox) | 6–8 |
| Building interaction: drag from dock to tile, rotate, connect, delete, undo; touch pan/zoom | 14–18 |
| Levels 1–3 with a broken start ("losing money"), goals, meters, win states, level select, first-run hints | 8–12 |
| Live wiring: session/publish/customerOrder → REAL coins; Gate approve; Portal status → swirl, beam, pop; ledger with explorer links; errors, retries, slow-testnet states | 10–14 |
| "Open as app" standalone view in the same visual language | 4–6 |
| Real-device performance pass (phone GPUs), audio, polish | 6–9 |
| QA on testnet, e2e scripts, demo recording | 6–8 |
| **Total** | **~64–89 h** |

A hackathon-cut vertical slice could ship in **~22–30 h**. It would cover this level and the Portal level, with building limited to filling slots (no free-form editing). "Run it for real" would be fully live: published machine, a seeded customer's real order, and the real Sepolia pop-out with its explorer link.

## Known gaps in the concept

- No building or editing yet; the Lemonade machine is pre-built.
- "Run it for real" is a labelled no-op.
- Gate and Worker models don't exist yet.
- When the Vault bin fills (~150 coins), the visual stack drops into the vault floor. The counter keeps the true total.
- The coin-per-0.01 NEAR mapping assumes prices are multiples of 0.01 NEAR. A real build needs a remainder coin or a coin-size rule.
- Sound is functional but placeholder.
