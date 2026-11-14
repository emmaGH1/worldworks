# TRAILER-2: narrated product demo (replaces TRAILER-1, which the user rated 2/10)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Why TRAILER-1 failed (the user's words, treat each as a requirement)
- "It doesn't feel like a game product demo. More like someone recording a video of them playing the game with their phone."
- "The recording is clipped in a way a lot of parts are not showing, even where it is supposed to zoom in, and where to cut unnecessary parts."
- "We need an actual voice, the narrator introducing our build, the goal and how it's connected to NEAR / what it does for NEAR."
- "It should have a splash screen / intro look" (reference: a game title screen with a strong logo on the left and illustrated key art on the right).
- "There is no sign of a logo."
- "It is supposed to be cutting and making the judges understand the game, the connection, and what value it brings to the NEAR ecosystem."

## What to make
A 1920×1080, 30 fps narrated product demo, about 95–105 s, driven by the voiceover. Plus a 30 s cut. This is an edited film about the product, not a playthrough.

## Voiceover (already recorded, do not regenerate)
The user's own cloned voice. Files in `/opt/ww-video/trailer2/vo/` (`01-hook.mp3` … `08-close.mp3`, with `-alt` second takes; `script.md` has the exact text; `all-preview.mp3` is all eight joined, 89 s). The video is cut TO the voice: every shot illustrates the sentence being spoken at that moment. Leave 0.3–0.6 s of air between segments. Duck the music under the voice (voice clearly on top, about −14 LUFS integrated for the final mix, music at least 12 dB under while the voice speaks).

## Brand
Logo and key art are being produced in parallel into `/opt/ww-video/trailer2/art/` (`logo.svg` or `logo.png`, `logo-mark.png`, `keyart.png`). Check that folder when you reach the splash and the end card. If nothing is there by the time everything else is cut, design the logo yourself as SVG (a bold wordmark WORLDWORKS with a simple mark that combines a gear and a coin, in the game's palette: cream #ffe7a8, teal #1f8a8a, coral #e75d63, deep navy #14213d) and build the splash from the best factory render; say so in the report. A small logo bug sits in a corner for the whole video. NEAR is named in text ("Built on NEAR", "NEAR Chain Signatures"); do not redraw or alter NEAR's logo.

## Structure (cut to the VO)
| VO | Picture |
|---|---|
| 01 hook | Cold open: 2–3 fast, beautiful close shots of the factory running (coins on belts, a house bouncing, the Portal spinning). No UI. |
| 02 name | Splash screen: key art + logo, "Factorio for programmable money", "Built on NEAR". Hold ~3 s, animated (parallax, logo reveal, sting). |
| 03 build | Ada's job card (punch in on her quote) → drag Splitter → dials → Payouts. Each action is ONE tight shot: zoomed on the thing being touched, cut on the action, no dead time, no waiting cursor. |
| 04 test | Customers pay, coins travel (close on the belt), a requirement pill fails with its reason (zoom on the pill), dial fix, pills tick, stars. |
| 05 ship | "Ship it for real" button press → a clean motion-graphic explainer panel built in HTML: Game → NEAR contract `ww-portal-261112.testnet` → real testnet transactions; "No wallet. No popups." Then the live TESTNET badge. |
| 06 portal | Portal dropped into the machine → the Portal moment (signing counter, beam across the water, gem lands) → hard cut to the REAL receipts, each with a slow zoom onto the line that matters (NEAR: `submit_order` … ; Sepolia: "0.0005 ETH · Success"). A simple diagram overlay: NEAR contract → signs → Ethereum, "No bridge". |
| 07 app | The standalone shop page `/m/:id` in a browser frame with its URL visible; the split bars; the Pay button (do not press it on the live site). |
| 08 close | Pull out over the whole factory at 4×; three short value lines appear in sync with the voice ("A new way into NEAR", "Learn by playing", "Leave with something that works"); end card: logo, "Play now", worldworks.vercel.app, "Built at NEAR Hackathon". |

## Editing rules (this is where TRAILER-1 failed)
- No shot longer than ~4 s without a cut, a push-in, or a new on-screen element. No dead air.
- Zooms must land ON the subject: compute crop rectangles from the element's bounding box at capture time (record them to JSON with the capture) instead of guessing. After rendering, extract a frame from every zoom and LOOK at it; if the subject is cut off or off-centre, fix it and re-render. Nothing important may be clipped by the frame edge or covered by a caption.
- Captions: short keyword captions only (the voice carries the sentence). Lower third, inside the safe area, never over UI text or buttons. If a shot's bottom is busy, move the caption or reframe the shot.
- Capture quality: capture at true 1920×1080 with device pixel ratio ≥ 1 for the 3D canvas, and a real frame for every output frame (30 fps deterministic stepping; the stepping hook makes this independent of CPU speed, it only takes longer). No 15 fps holds, no upscaled 720p.
- Hide debug/dev chrome. Keep honesty labels, but design them: one small consistent chip style ("Simulated" / "Mock re-enactment" / "Real · NEAR testnet").
- Transitions with intent: match cuts and quick whip/zoom transitions between sections, a sound hit on each section change.
- Sound design: music bed with a build and a drop at the Portal moment, UI sounds synced to visible actions, a riser into the real receipts.

## Honesty (unchanged)
Mock footage is labeled; the Portal motion is a labeled re-enactment followed by the real receipts (job-3 run in `docs/EVIDENCE-game3.md`: NEAR tx `Wckcgn6SAXC8bvfMN9KBmfkxpfdbAf4uKfj8oCkw4G8`, Sepolia tx `0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a`, payout 32); factory traffic is labeled simulated; no claim beyond README.md and docs/CLAIMS.md. Never press Ship or Pay on the live site; no sessions, no orders.

## Reuse
`/opt/ww-video/trailer/` has TRAILER-1's capture scripts, fixtures, receipts and HyperFrames projects; `docs/VIDEO.md` describes how captures work (mock build, `?step=1`, `__ww2.advance`, `__wwFactory.advance`). Re-capture what needs better framing or quality; reuse what is good. The game is at HEAD of `/data/home/.t3/projects/near-hackathon` (build with `cd app && VITE_CONTRACT_ID= npm run build`, serve with `npx vite preview`; it listens on `localhost`, not `127.0.0.1`).

## Output
- `/opt/ww-video/out/worldworks-demo.mp4` (~95–105 s) and `/opt/ww-video/out/worldworks-demo-30s.mp4` (30 s, uses VO 01+02 trimmed, the Portal/receipts lines, and 08's last sentence; cut the audio cleanly).
- `/opt/ww-video/out/worldworks-demo-contact-sheet.png` (a frame every 3 s).
- Rewrite `docs/VIDEO.md` for this version (beats with timestamps, source of every shot, labels, music/sfx source and license, voice = the user's own cloned voice via ElevenLabs, honest not-done list).
- Self-review before reporting: watch the contact sheet and at least 20 extracted frames; list each defect you found and fixed.

## Constraints
Disk tight (about 1.9 GB free on /): work in `/opt/ww-video/trailer2`, pipe frames to ffmpeg, delete intermediates. Never print/commit secrets (/opt/ww-secrets). Do not edit `app/src`. Do not commit, push or upload. When waiting on a long capture or render, block on it in a foreground command; never end your turn while work is still running. Target: first full cut in ~4 h.
