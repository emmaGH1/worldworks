# TRAILER-1: the demo video (HyperFrames)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Goal
Make a demo video for the hackathon submission and the public X post, landscape 1920×1080 at 30 fps, about 90–120 s. Also cut a 30 s version.

The quality bar is a competitor's trailer (a medieval NEAR game called Crownfall):
- Cinematic title cards in a serif display font.
- Captions that build word by word: the current word white, the rest of the sentence dim.
- Close shots of real gameplay.
- A clean end card: name, "Play now", URL, "Built at NEAR Hackathon".

Ours must look like a game trailer, not a screen recording.

## Story (one idea per beat)
1. **Cold open (0–6 s).** The factory at 1920, alive, with coins flowing. Title card: "WORLDWORKS". Subtitle: "Money that runs itself."
2. **The problem (6–15 s).** Ada's job card: "I pay my two helpers by hand every evening." Caption: "Every job is a real person's money problem."
3. **Build (15–35 s).** The spotlight tutorial. Drag a Splitter, set the dials, place Payouts. Show a reasoning tooltip. Caption: "Wire parts into a money machine."
4. **Test, fail, fix (35–50 s).** A wrong build fails with its one-line reason, then gets fixed and earns ★★★. Caption: "Simulated customers test it. You think, you fix."
5. **Ship for real (50–75 s).** Job 3, the Portal moment:
   - "NEAR is signing an Ethereum transaction" with the seconds counting.
   - The beam crosses the water and the gem lands.
   - Caption: "Ship it, and it runs on NEAR testnet. A NEAR contract pays Chi on Ethereum by itself, through Chain Signatures."
   - Then a hard cut to the REAL receipts: the NEAR explorer tx and the Sepolia Etherscan tx for payout 32 (links are in docs/EVIDENCE-game3.md). Use real browser screenshots of those explorer pages.
6. **Works outside the game (75–90 s).** The standalone shop page `/m/:id`. Caption: "Every machine is also a real payment app anyone can use."
7. **The factory (90–105 s).** Pull out to the whole factory with ⏩ 4×. Caption: "Build a whole economy. Each machine stays running."
8. **End card.** WORLDWORKS · Play now · worldworks.vercel.app · Built at NEAR Hackathon · NEAR testnet.

## Honesty in the video
- Footage from MOCK mode must not be presented as real. Use the real-run stills and recordings for the Ship beat: `docs/design/screens/g3-live-*.png` and `g4-live-*.png`, plus real explorer pages.
- The live portal-moment stills are real captures of a real run.
- If you re-record the Portal moment in mock mode for smooth motion, the on-screen MOCK badge must stay visible, or add a small caption "re-enactment (mock); real receipts follow". Then show the real receipts.
- The factory's customers are simulated. Its badge says so; keep it visible.
- No claims beyond README.md and docs/CLAIMS.md.

## Footage
- Capture from the local production build in mock mode (`cd app && npm run build && npx vite preview`), or from https://worldworks.vercel.app for read-only screens. Do not press Ship or Pay on the live site; funds are scarce.
- Use Playwright with playwright-core (/opt/ww-shot/node_modules/playwright-core) and Chromium (/data/home/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome).
- There is no GPU. For smooth 3D motion, use the deterministic stepping hook the ui-tests use (`?step=1`; see app/ui-tests/game7-stills.mjs and game6-mock.mjs). Capture frame sequences at 30 fps and encode them with ffmpeg (/data/home/.local/bin/ffmpeg).
- Hide the mouse or animate a clean cursor.

## Audio
- A music bed with an upbeat, light, playful game feel. Use the in-game procedural music (app/src/game/jobs/sound.ts), rendered offline, or a royalty-free/CC0 source. State the source and its license in the report.
- Subtle UI sound effects on key beats.
- Voiceover is optional; captions are enough. If you use a voiceover, it must say exactly what the captions say.

## Output
- `/opt/ww-video/out/worldworks-trailer.mp4` (~90–120 s) and `/opt/ww-video/out/worldworks-trailer-30s.mp4`.
- A contact sheet PNG.
- `docs/VIDEO.md`: the beat list with timestamps, the source of every shot (mock or live, with file paths), music and license, and an honest list of anything not done.

The old videos in /opt/ww-video/out are obsolete. Leave them in place; do not delete them.

## Constraints
- Disk is tight: 2.1 GB free on /, 500 MB on /tmp. Work in /opt/ww-video/trailer. Delete frame sequences after encoding. Use npm cache /opt/ww-npm-cache.
- Never print or commit secrets (/opt/ww-secrets).
- No live orders and no sessions.
- Do not edit app/src. If a capture needs a hook, report that instead.
- Do not commit or push.
- Do not upload anything anywhere: no YouTube, no X.
- Target: a first full cut in ~3 h.
