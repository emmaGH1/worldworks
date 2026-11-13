# WORLDWORKS demo trailer (TRAILER-1)

Outputs (not committed, not uploaded anywhere):

| File | ffprobe | Notes |
|---|---|---|
| `/opt/ww-video/out/worldworks-trailer.mp4` | container 111.1 s; video 111.0 s (3330 frames), 1920×1080, 30 fps, H.264; AAC 48 kHz | Full cut. Audio −16.2 LUFS integrated, −1.1 dBFS peak |
| `/opt/ww-video/out/worldworks-trailer-30s.mp4` | container 30.1 s; video 30.0 s (900 frames), 1920×1080, 30 fps, H.264; AAC 48 kHz | 30 s cut. Audio −16.1 LUFS, −1.8 dBFS peak |
| `/opt/ww-video/out/worldworks-trailer-contact-sheet.png` | 3384×1092 PNG | Full cut, 7×4 tiles, left to right, one frame every 4 s at 0:02, 0:06, 0:10 … 1:50. No burned-in timecodes (this ffmpeg build has no drawtext). |

The older `worldworks-demo-15s.mp4`, `worldworks-demo-76s.mp4` and `contact-sheet.png` in the same folder are obsolete and were left in place.

Built with HyperFrames (HTML → video, local render, software GPU). Projects: `/opt/ww-video/trailer/hf` (full) and `/opt/ww-video/trailer/hf30` (30 s). Both are generated from edit lists by `/opt/ww-video/trailer/scripts/edl.mjs` (beats, trims, camera keys, captions, effect times, computed from the capture marks in `cap/*.json`) and `scripts/gen.mjs`. The audio of each HyperFrames render was loudness-normalized with ffmpeg `loudnorm`, with the video stream copied unchanged.

## Honesty rules applied

- **Mock footage is labelled.** Every gameplay shot from the local mock build carries a "Gameplay capture · mock mode" chip; the app's own MOCK badge and MOCK lines stay in frame. Build and Test are local simulation in every mode anyway.
- **The Portal moment in motion is a re-enactment.** It carries the chip "Re-enactment · mock mode · sped up · real receipts follow". The app's own "MOCK · timings imitate testnet, nothing is on chain" line and "Confirmed · MOCK" stay visible. It is followed by a cut to the **real** run: the two live stills from the recorded job-3 run ("Real run · NEAR testnet → Sepolia · recorded") and the two public explorer pages for that run ("Real receipt").
- **The factory is simulated.** Its own panel ("Simulated customers · not real money", Real rows at 0 NEAR) and the MOCK badge stay visible; the ⏩ 4× control reads "4× · SIMULATED".
- **The live site was only viewed.** No Ship, no Pay, no session, no order. As a safety net, the capture script aborted any `/api/session`, `/api/customer` or `/api/relay` request and any RPC body containing `broadcast_tx`/`send_tx`; its log shows none were attempted (`cap/shop.json`: `blocked: []`). The edit uses only the first 5 s of that capture, before the cursor drifts toward the Pay button.
- Captions use claims from README.md and docs/CLAIMS.md only. No voiceover. `/opt/ww-secrets` was not read.

## Beat list (full cut, 111 s)

| Time | Beat | On screen | Source |
|---|---|---|---|
| 0:00–0:07 | Cold open | The whole factory, alive (belts, coins, customers), slow pull-back. Serif title card "WORLDWORKS" / "Money that runs itself." | MOCK capture `/opt/ww-video/trailer/cap/factory.mp4` (all-five saved-progress fixture, same builds as `app/ui-tests/game7-stills.mjs`) |
| 0:07–0:09.9 | Title card | Serif quote "“I pay my two helpers by hand every evening.”" · Job 1 · Ada, baker | Typography |
| 0:09.9–0:15 | The problem | Push-in on Ada's real job card (tutorial spotlight). Caption: "Every job is a real person's money problem." | MOCK capture `cap/job1.mp4` |
| 0:15–0:32.2 | Build | Spotlight tutorial: Start building, drag a Splitter onto its socket, add a belt, turn the dials (deliberately wrong, 50/25/25), drag three Payouts and choose Ada/Bola/Chi. Camera punches in on the socket, the dial sheet and the Payout sheet. Caption: "Wire parts into a money machine." | MOCK capture `cap/job1.mp4` |
| 0:32.2–0:35 | Reasoning tooltip | Punch-in on the exact Splitter tooltip "Splitter 60/20/20: of 0.1 NEAR, sends 0.06 to belt 1, 0.02 to belt 2, 0.02 to belt 3." | MOCK still `docs/design/screens/g7-tooltip-1920.png` (see Not done) |
| 0:35–0:50 | Test, fail, fix | Test starts with three simulated customers → fails with its one-line reason "Ada got 0.05, needs 3x Bola's 0.025 = 0.075." → Splitter reopened, dials to 60/20/20 → Test passes (all three goals ✓) and the game pulls out to the factory. Captions: "Simulated customers test it." / "You think, you fix." | MOCK capture `cap/job1.mp4`; Test runs captured at 2× |
| 0:50–0:52.4 | Title card | "Ship it for real." · Job 3 · Chi moved abroad | Typography |
| 0:52.4–1:02 | Portal re-enactment | Ship button ("MOCK: no chain, fake hashes"), "NEAR is signing an Ethereum transaction · 6s", "Crossing the water", "Chi got 0.0005 ETH on Ethereum · Confirmed · MOCK". Captions: "Ship it, and it runs on NEAR testnet." / "A NEAR contract pays Chi on Ethereum" / "by itself, through Chain Signatures." | MOCK capture `cap/portal.mp4` (job-3 saved build, mock API timings; signing and confirmation waits at 3×; the session/publish/order wait cut out) |
| 1:02–1:08 | The real run | Live stills of the recorded job-3 run: beam crossing with "NEAR signs · 21s", then "Chi got 0.0005 ETH on Ethereum" with "Confirmed · seen by 2 RPCs". | LIVE stills `docs/design/screens/g3-live-portal-moment-desktop.png`, `g3-live-portal-gem-desktop.png` |
| 1:08–1:12 | Real receipt, NEAR | NEAR Rocks testnet: tx `Wckcgn6SAXC8bvfMN9KBmfkxpfdbAf4uKfj8oCkw4G8`, `submit_order` on `ww-portal-261112.testnet` with machine `abroad3-2d8d1b47-c83a2d2141`, order `ca740c84-…` and Chi's `external_recipient` | Real browser screenshot of https://testnet.near.rocks/tx/Wckcgn6SAXC8bvfMN9KBmfkxpfdbAf4uKfj8oCkw4G8, taken 2026-11-13 (`/opt/ww-video/trailer/receipts/near.png`) |
| 1:12–1:16 | Real receipt, Sepolia | Sepolia tx `0xe0d34930…8d7a`: "Transfer 0.00050 ETH to 0xE5…aeb2", Success, from the Portal treasury `0x694Ad574…8A8b7` | Real browser screenshot of https://eth-sepolia.blockscout.com/tx/0xe0d34930bb80261cab1a9c8d488551e29e94f106c7e68a11e234c5db3ddc8d7a, taken 2026-11-13 (`receipts/sepolia-blockscout.png`); Blockscout, not Etherscan (see Not done) |
| 1:16–1:29 | Works outside the game | Live standalone shop `/m/shop-ab044e8b-c83a2d2141` ("STANDALONE APP · RUNS ON NEAR TESTNET", 70/30 split), push-in on the checkout panel; never paid. Chip: "Live site · standalone app /m/:id · viewed, not paid". Captions: "Every machine is also a real payment app" / "anyone can use." | LIVE site, read-only capture `cap/shop.mp4` (first 5 s, played at 0.385×) |
| 1:29–1:43 | The factory | Punch-in on the factory panel, the player clicks ⏩ 4× ("4× · SIMULATED"), pull out to the whole factory. Captions: "Build a whole economy." / "Each machine stays running." | MOCK capture `cap/factory.mp4` |
| 1:43–1:51 | End card | WORLDWORKS · Money that runs itself. · Play now · worldworks.vercel.app · Built at NEAR Hackathon · NEAR testnet | Typography |

## 30-second cut

| Time | Beat | Source |
|---|---|---|
| 0:00–0:04 | Title over the factory | `cap/factory.mp4` (mock) |
| 0:04–0:09.5 | Splitter drop, dials, reasoning tooltip. Caption "Wire parts into a money machine." | `cap/job1.mp4` (mock), `g7-tooltip-1920.png` (mock) |
| 0:09.5–0:13 | Test fails with its reason, then passes. Caption "Simulated customers test it." | `cap/job1.mp4` (mock) |
| 0:13–0:17 | Ship + Portal beam, re-enactment chip. Caption "Ship it, and it runs on NEAR testnet." | `cap/portal.mp4` (mock) |
| 0:17–0:21 | Real gem still, then the real NEAR and Sepolia receipts. Caption "A NEAR contract pays Chi on Ethereum" | live still + explorer screenshots |
| 0:21–0:24.2 | Live standalone shop. Caption "Every machine is a real payment app." (shortened from the full cut's line to fit) | `cap/shop.mp4` (live, read-only) |
| 0:24.2–0:26.5 | Factory at 4× (simulated) | `cap/factory.mp4` (mock) |
| 0:26.5–0:30 | End card | Typography |

## How the footage was captured

- Mock production build: `cd app && VITE_CONTRACT_ID= npm run build && npx vite preview --port 4290 --host 127.0.0.1` (server stopped afterwards).
- Playwright (`/opt/ww-shot/node_modules/playwright-core`) with Chromium 1243, headless, software GL. Scripts: `/opt/ww-video/trailer/scripts/cap.mjs` (shared) and `shot-job1.mjs`, `shot-portal.mjs`, `shot-factory.mjs`, `shot-shop.mjs`, `receipts.mjs`, `blockscout.mjs`.
- Deterministic stepping: `?step=1` with the existing `window.__ww2.advance` / `window.__wwFactory.advance` hooks. Playwright's fake clock is paused and advanced by exactly 1/30 s per frame, and page CSS animations are paused and stepped by the same amount. The live shop page used a one-callback-per-frame `requestAnimationFrame` shim injected by the capture script. No `app/src` edits; no hook had to be added.
- Saved progress came from owner-local fixtures (`scripts/fixture.mjs`, the same builds as the ui-tests): the factory used all five solved builds; the Portal shot used job 3's saved build marked solved so Ship was available.
- The cursor is a clean arrow drawn by the capture script and moved on eased paths; the system pointer is not visible.
- Frames were piped straight into ffmpeg (no frame folders written). Because the VM lost about 75% of its CPU to hypervisor steal during the session, holds and test runs were rendered once per two output frames (15 fps motion inside the 30 fps file); cursor moves and drags are full 30 fps.
- The UI is captured at 1.5× device scale (1920×1080 from a 1280×720 viewport) with the editor's 3D canvas at pixel ratio 1.0, so the 3D is slightly softer than the UI text. The factory and the shop were captured at 1920×1080.

## Music and sound

- **Music:** an offline arrangement of the game's own procedural music from `app/src/game/jobs/sound.ts`: the same motif (C4 D4 E4 G4 A4 G4 E4 D4), sine voices with the same attack and decay, the triangle bass on the bar, and the Portal drone (103.83 → 110 Hz) under the re-enactment. It is arranged at 120 BPM with a bass line, an arpeggio, soft noise hi-hats, one riser into the cut to the real run, and a final chord under the end card. Rendered with Chromium's `OfflineAudioContext` (`/opt/ww-video/trailer/scripts/music.html`, `audio.mjs`). **License:** made for this project, no third-party material; same terms as the repository (MIT).
- **Sound effects:** the game's own synthesized sounds (tap, place, dial, fail, pass, star, ship, beam, gem, coin, whoosh, chime) from `app/src/game/jobs/sound.ts` and `app/src/lib/sound.ts`, rendered offline with the same oscillators and envelopes and placed on the matching on-screen actions. Same license.
- Loudness and peaks were measured with ffmpeg `ebur128`; the mix was not listened to.

## Not done / limits

- **Etherscan page not captured.** sepolia.etherscan.io answered the automated browser with a Cloudflare "Verify you are human" check, both headless and headed; it was not bypassed. The video shows the same Sepolia transaction on Blockscout (also a public explorer). The Etherscan URL remains in README.md and docs/EVIDENCE-game3.md.
- **No live footage of the real Portal run exists.** The motion is a labelled, sped-up mock re-enactment; the real run is shown with its two recorded live stills and the two explorer receipts.
- **Tutorial hover tooltip not captured in motion.** While the job-1 spotlight is up, its shield blocks hover, so the in-editor tooltip never appeared in `cap/job1.mp4`. The tooltip beat uses the existing mock still `g7-tooltip-1920.png` (the same exact Splitter reasoning, shown on the factory view).
- **No separate ★★★ card.** Passing job 1 shows all three goals ✓ and the game immediately pulls out to the factory; the stars appear on the job chip. The trailer shows that sequence with the pass/star sounds; it does not add a fake stars overlay.
- **Timing is compressed.** Test runs play at 2×, and the Portal signing and confirmation waits at 3×; the re-enactment chip says "sped up". The recorded real run took 117 s from Ship to confirmed (docs/EVIDENCE-game3.md); the video makes no speed claim.
- Saved-progress fixtures were used for the factory and job 3, not a fresh full playthrough. The live shop shows a static world, because no sale was made.
- The job-1 capture script stopped on a wrong wait condition after the pass (it waited for a Ship button; job 1 pulls out to the factory instead). The footage up to that point is complete, and the pass mark (52.7 s) was set by frame inspection.
- Motion was checked on sampled frames and contact sheets only, and the audio was measured, not heard. No voiceover. Nothing was uploaded; README's `{{DEMO_VIDEO_URL}}` stays a placeholder. Nothing was committed.
