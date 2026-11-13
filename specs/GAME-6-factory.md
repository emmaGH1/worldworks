# GAME-6 — One big factory, plus the user's phone-playtest fixes

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Context
HEAD `ad3ce88` is deployed at https://worldworks.vercel.app. Read `docs/EVIDENCE-game4.md` and `docs/EVIDENCE-game5.md` first, then `app/src/game/jobs/*`. The game today is one machine at a time (`scene.ts`, 821 lines; `JobsGame.tsx`, 1061 lines). The user played the deployed build on a phone (Android Chrome, 412px CSS width) and said "go factory", and reported the issues in Part A. Judges will mostly play on a PC (1366–1920), so the PC layout is the main target; the phone must not confuse.

## Part A — playtest fixes (do these FIRST, ~2h, keep everything green)
1. **Top bar is badly designed.** Today it has ♪, the job dropdown, the TESTNET badge, **two hamburger icons** (☰ = Jobs, ≡ = Ledger, `JobsGame.tsx:693–700`) and ?. Redesign it as one clean game HUD:
   - Left: a "Factory" home button (part B) and the current job chip.
   - Right: a small network badge, a sound button, and ONE menu button. The menu opens a sheet with: Jobs, Real transactions (the ledger), Help, Replay tutorial, Restart this job.
   - Use distinct, recognisable icons (inline SVG, no emoji glyphs like ♪̸). Give everything consistent sizes and 44px touch targets. Nothing may be cut off at 360px.
2. **"?" sends the player back to the title screen regardless of level.** Help must be contextual. It opens a sheet over the current job, containing:
   - This job's goal and the parts it uses (one line each).
   - "Show me again", which replays this job's hint (the job 1 spotlight tutorial on job 1, the one-bubble hint on later jobs).
   - Close.

   The title screen is reachable only from the menu ("Title screen"). Its button must say "Continue: job N" when there is progress, not only "Replay job 1 tutorial". Fix the title screen on phones: the shop reads as a squashed top-down shape, and the "View the real run" pill floats oddly. Frame the island at a nice 3/4 angle and put secondary links under the main button.
3. **Sound: not enough effects, no music, weak sound button.**
   - Add a calm background music loop, generated in code with WebAudio (`jobs/sound.ts`, no audio files and no external assets): a gentle 70–90 bpm pentatonic loop, low volume, with a slight change during Test and a tense pad during the Portal moment.
   - Add effects for: UI tap, part pick-up, part placed, dial step, belt start, each coin landing (pitch rises with amount), requirement tick ✓, fail buzz, stars (one chime per star), ship, Portal hum while signing, beam whoosh, gem chime, level unlocked, and the factory ambience (part B).
   - The sound button opens a small popover with separate Music and Effects toggles and a volume slider. Remember the choice (localStorage, wrapped in try/catch). The button shows its state clearly.
   - Sound starts after the first user gesture (autoplay rules). `?lowfx=1` keeps sound available but off by default.
4. **Tray on phones**: the last part is cut off ("Payou"). Use a horizontal scroller with a fade and a peek arrow, or wrap to two rows, so no label is ever truncated mid-word.
5. On phones the job card covers most of the world. That is acceptable for the intro card only. Make sure it collapses to the chip after "Start building", as GAME-3 intended.

## Part B — One big factory (~8h)
The island becomes ONE persistent factory, and it is the game's home screen.
- **Map.** A larger island with one plot per job (1–4) plus "Your shop", laid out around a shared customer road. The Ethereum island sits across the water (the Portal beam goes there). Each person has a house on the edge of the factory: Ada, Bola, Chi (on the Ethereum island once job 3 is solved), Dayo and You.
- **Plots.**
  - A solved plot shows its saved machine (the same parts/tree the player built), scaled to the plot, with its stars.
  - The next unsolved plot glows with "Next job" and the person's face.
  - Later plots are locked: a dim foundation with a padlock and the job name.
  - A shipped plot (real run confirmed, or a ship recorded for this contract/mode) shows a TESTNET flag and its live `/m/:id` link chip.
- **Logistics.** Payout belts from every machine run to the matching person's house. Several machines can feed the same house (Ada is paid by jobs 1–4). This is the Factorio feeling: one network of belts and houses. It is honest because each Payout really pays that person's account. A Portal output runs into a Portal on the plot and beams to Chi's house on the Ethereum island.
- **Running factory.**
  - On the factory view, a slow stream of customers walks the road and buys at solved shops. Coins flow through each machine and along the belts into the houses.
  - This stream is labeled **SIMULATED** (a visible badge: "Simulated customers · not real money"). Use the wasm engine `preview` for the amounts, as Test does.
  - A factory counter shows each house's simulated total.
  - A separate **Real** total per house comes only from real confirmed receipts in the ledger or the order results. Never mix the two numbers.
  - Real shipped runs that confirm while the factory is open trigger a gold coin with the TESTNET label at that plot.
- **Navigation.**
  - Tap a plot: the camera flies in and the existing job editor opens for that plot. Reuse the current editor, Test and Ship code; do not rewrite them.
  - "Factory" in the top bar: the camera flies back out.
  - The first visit starts on job 1 with the spotlight tutorial, as today. After job 1 is solved, the camera pulls out to show the factory once, with a short caption: "Your machine now runs in your factory. Next: Bola's plot."
- **Your shop** gets the plot nearest the road. Its belt runs to the You house. When a real payment lands, the You house shows the real balance going up, from the existing balance observation.
- **Performance.**
  - Instance coins and customers. Cap visible coins.
  - Customers pause when the tab is hidden.
  - `?lowfx=1` shows the factory static, with the counters only.
  - Target smooth play on a mid-range Android phone. You can't measure real fps here: keep draw calls low, report them (renderer.info), and set a budget (e.g. < 150 draw calls, < 120k triangles on the factory view).
- **Feature flag and fallback.** Build the factory behind a module-level flag that defaults ON. If at the end it is not solid, set the flag OFF so the game works exactly as today, and say so plainly. Never leave the main flow broken.
- 2D fallback (no WebGL): the factory becomes a simple plot grid of buttons with the same counters.

## Acceptance (`docs/EVIDENCE-game6.md`)
- typecheck, api typecheck, build, all unit tests pass. Add unit tests for the factory model: plot states from progress, the simulated vs real totals kept apart, and the house mapping from machine trees.
- Update `ui-tests/game3-mock.mjs` (or a new `game6-mock.mjs`) to cover: title → job 1 tutorial → solved → factory pull-out → tap plot 2 → solve → back to factory showing 2 machines running → contextual help on job 2 (it must stay on job 2) → menu items → sound popover toggles persist across reload. Run at 1366, 1920 and 390, with 0 console errors. Also run the 2D fallback.
- Stills `docs/design/screens/g6-*.png`: factory overview (fresh, after 2 jobs, after all 5) at 1920 and 390; top bar at 360/390/1366; help sheet; sound popover; title on phone.
- No live orders and no new sponsored sessions. Funds are scarce, and the factory adds no new chain behaviour. If something real must be checked, write down the exact one-order test for the orchestrator.
- An honest unfinished list, the draw-call numbers, and the final state of the flag.

## Constraints
- Testnet only. Never print or commit secrets (/opt/ww-secrets). No contract or engine changes. Do not commit or push.
- Disk is tight: npm cache /opt/ww-npm-cache.
- Chromium: /data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome. playwright-core: /opt/ww-shot/node_modules/playwright-core. There is no GPU, so use the deterministic stepping hook.
- Order: Part A, then make sure everything is green, then Part B. Target: Part A in ~2h, all of it in ~10h.
