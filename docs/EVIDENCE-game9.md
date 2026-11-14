# GAME-9 evidence

## Implemented

- Sample-first CC0 effects for controls, placement, dials, results, stars, coins, ship stages and Portal events. Ten OGG files plus ten MP3 fallbacks (~132 KB total), loaded after first gesture; synth fallback on unavailable samples. Repeated coins and dials are throttled with small random pitch variation.
- Original layered procedural music: kick, hi-hat, bass, chords and melody. Build and brighter factory arrangements share a clock and crossfade on separate layer gains. Music ducks under shipping / Portal presentation.
- Separate master/music/effects buses; master → 20:1 compressor → destination. Master defaults to 0.8. Speaker popover has live music/effects/master sliders, mute, persisted settings and all dismissal paths. `lowfx=1` always starts muted. First gesture resumes the context and schedules a silent buffer.
- Common overlay lifecycle with visible dismissal, Escape, outside pointer and browser history. Contextual help stays in place, including keyboard `?`. Explicit Back labels on job editor and standalone shop.
- Tutorial, splash, repeat job intros, test animation, fly-to, Portal and network-wait fast paths. Tutorial skip, repeated-intro skip, fly skip and Portal skip preferences are remembered. Test skip uses the actual WASM result already computed; it does not invent success. Gate waits are also dismissible.
- Persistent next-job factory CTA and pulsing plot. Endless preview is labeled and pauseable; singular machine copy fixed. Empty Ethereum island is hidden until used. House totals no longer overlap the CTA or plot labels. In-flight operations show observed state, elapsed time, an approximate usual duration and a slow-status message while play remains available.
- Solid sheet surfaces, 44px controls, focus rings, pressed states and disabled explanations. One top-bar menu retained.

## Screenshots

All screenshots are from the local MOCK build. `audit-*` are **before** captures in the 2D fallback. Final playthrough captures use the 2D fallback; `*-3d` and fly captures use the normal WebGL factory (saved solved-build fixture, never fabricated real receipts).

| View | 1366×768 | 390×844 |
|---|---|---|
| Factory next action | [PC](game9/1366-factory-3d.png) | [Phone](game9/390-factory-3d.png) |
| Sound popover | [PC](game9/1366-sound-3d.png) | [Phone](game9/390-sound-3d.png) |
| Closed overlay | [PC](game9/1366-closed-3d.png) | [Phone](game9/390-closed-3d.png) |
| Tutorial skip | [PC](game9/1366-skip-tutorial.png) | [Phone](game9/390-skip-tutorial.png) |
| Test-animation skip | [PC](game9/1366-skip-test.png) | [Phone](game9/390-skip-test.png) |
| Portal skip | [PC](game9/1366-skip-portal.png) | [Phone](game9/390-skip-portal.png) |
| Fly-to skip | [PC](game9/1366-skip-fly.png) | [Phone](game9/390-skip-fly.png) |
| Published mock shop | [PC](game9/1366-shop.png) | [Phone](game9/390-shop.png) |

## Audio measurements

Measured actual post-compressor PCM in Chromium with a test-only ScriptProcessor inserted between the compressor and destination. Default capture covers ~6.5 s of build music and initial UI sounds. Full-volume capture covers music and repeated UI effects with all three sliders at 1.0. This measures browser output, **not physical phone speaker SPL**. PCM RMS is not LUFS. Randomized sample pitch / scheduling causes small variations between runs.

| Viewport | Mix | Peak dBFS | RMS dBFS |
|---|---|---:|---:|
| 1366 | default build mix | -2.46 | -24.67 |
| 1366 | 100% all buses with UI effects | -0.67 | -20.60 |
| 390 | default build mix | -2.99 | -24.44 |
| 390 | 100% all buses with UI effects | -0.56 | -21.11 |

No measured output sample exceeded 1.0. Full-volume peaks approach 0 dBFS. Verified default bus gains: master 0.8, music 0.7, effects 0.85. Compressor threshold −3 dB, knee 0, ratio 20:1, attack 2 ms, release 120 ms. The old music voices used peak gains of 0.026 × 0.45 before their envelopes. The original mix was not captured for an A/B measurement.

Samples were processed with FFmpeg loudnorm (−16 LUFS target, −1 dBTP, LRA 7), mono 44.1 kHz at 80 kbps. Very short effects and lossy encoding do not always achieve the integrated target; decoded per-file sample peaks and means are in [sample-metrics.json](game9/sample-metrics.json). Runtime compressor limits the combined output. Credits include exact original filenames, source/mirror URLs and CC0 licence; the original licence text is preserved.

## Validation

- `VITE_CONTRACT_ID= npm run build`: pass; existing large-chunk advisory remains.
- `npm run typecheck`: pass.
- `npm test`: **69 passed, 0 failed** (68 prior tests plus a new bus-routing/default-gain test). The repo initially had no `test` script; added one that runs its existing Node/tsx suites, including WASM/native agreement.
- `game9-feel.mjs`: jobs 1–5 at 1366×768 and 390×844, pointer placement/dials and WASM checks; simulated animation skips and Escape from a Gate wait; mock Portal submission; factory CTA/pause/singular/zero-real-total checks; Esc/outside/Back for menu/sound/help/jobs/ledger; published shop loaded; zero unexpected browser errors.
- `game9-dismiss.mjs`: tutorial Back; job card, part sheet and shop setup Esc/outside/Back; remembered intro skip; contextual `?`; persisted music/effects volumes; mute/unmute; lowfx starts muted. Pass. Navigation-cancelled preload requests (`ERR_ABORTED`) are expected and explicitly filtered; application errors are not filtered.
- `game9-audio-stills.mjs`: actual default bus gains, post-compressor PCM measurement, normal WebGL captures at both sizes, visible fly skip + remembered choice, all ten MP3 fallbacks when OGG returns 404. Pass.
- Existing `game7-controls.mjs`: synthetic touch-hold tooltip and unresolved-operation 4× guard pass.
- Requested smoke scripts: smoke.mjs, blocked.mjs, phone.mjs and pc.mjs pass, with zero page errors. Two originals hardcode the deployed URL; temporary copies change only that origin to localhost to honor the no-testnet constraint. The blocked-storage probe reports `title shown: false` because the visible logo is an image; Start is present and the job card opens, with no page errors. Phone software-renderer smoke: ~23.5 fps.
- `git diff --check`: pass. No contract changes, commits, pushes or deployments.

Raw result files: [playthrough](game9/results.json), [audio](game9/audio-metrics.json), [sample normalization](game9/sample-metrics.json). Console output is preserved beside them in `game9/*-output.txt`.

## Limits / not done

No physical iOS/Android device or phone-speaker listening test was available; native audio unlock and hardware Back need device validation. No live testnet order/session was created, as required. The all-five-job automated playthrough uses the accessible 2D renderer and animation skips; normal WebGL was checked separately for the factory, popover and fly-to. This is not a full screen-reader or WCAG certification audit. A licensed recorded music track was not added; the spec's richer procedural option was implemented instead.

## Files changed

- `app/src/game/jobs/JobsGame.tsx`, `FactoryView.tsx`, `factoryScene.ts`, `Spotlight.tsx`, `ReasonTooltip.tsx`, `jobs.css`, `sound.ts`; new `useDismiss.tsx`.
- `app/src/game/AppPage.tsx`: explicit Back, shared button/effect sounds, honest checkout wait copy.
- `app/package.json`: test command for existing suites.
- `app/public/sounds/`: ten paired OGG/MP3 effects; `CREDITS.md` and original `LICENSE-Kenney.txt`.
- New `app/scripts/game9.test.ts`; `app/ui-tests/game9-feel.mjs`, `game9-dismiss.mjs`, `game9-audio-stills.mjs`.
- New `docs/AUDIT-game9.md`, `docs/EVIDENCE-game9.md` and screenshots / test evidence under `docs/game9/`.
- The supplied `specs/GAME-9-feel.md` remains untouched.

## GAME-10 — factory composition, compact mixer and recorded music

Mock-only follow-up. No contract changes, testnet operations, commits, pushes or deployments.

### Composition and settings

The camera reserves the heading and house-total/CTA rails; its bounds include the Ethereum island only when present. Five separate screen-space label slots have leader lines to their plots. Heading controls have equal sizes, and the receipt explanation and dismiss button align. A ResizeObserver tracks heading height changes. Arrival amounts fade inside their house cards.

Sound has one header close button, Music and Effects icon toggles with percentage sliders, and a Master row. Tracks and thumbs use the teal/gold palette. Effects preview on pointer or keyboard release. Existing Esc, outside, browser Back, persistence and lowfx behavior remain in use.

### Screenshots

Local mock build, normal WebGL, saved solved-job fixture with zero real receipts. Original GAME-9 captures are retained.

| View | 1366×768 | 1920×1080 | 390×844 |
|---|---|---|---|
| Factory | [PC](game9/game10-1366-factory-3d.png) | [Large PC](game9/game10-1920-factory-3d.png) | [Phone](game9/game10-390-factory-3d.png) |
| Sound | [PC](game9/game10-1366-sound-3d.png) | [Large PC](game9/game10-1920-sound-3d.png) | [Phone](game9/game10-390-sound-3d.png) |
| Closed | [PC](game9/game10-1366-closed-3d.png) | [Large PC](game9/game10-1920-closed-3d.png) | [Phone](game9/game10-390-closed-3d.png) |

### Recorded music

**Happy Clappy Loop**, **OwlishMedia**, **CC0 1.0 Universal**. Verified directly by fetching [the actual source page](https://opengameart.org/content/happy-clappy-loop): Author OwlishMedia, License(s) CC0. Original WAV: https://opengameart.org/sites/default/files/HappyClappyLoop.wav . The author identifies it as a seamless game loop adapted from *Cat's Sky*. File details and processing are in `app/public/sounds/CREDITS.md`.

Two synchronized AudioBufferSourceNodes share one recording, with 1800 Hz build / 12000 Hz factory low-pass filters and a 0.3-second gain crossfade. Portal/shipping duck the music bus to 22% (−13.15 dB), with 0.25-second smoothing. OGG is preferred, then MP3 on fetch/decode failure; only failure of both starts the procedural score. Both codecs decode in Chromium to **17.4406349206 seconds**, with loopEnd equal to buffer duration. WebAudio loops without a media restart; the procedural score does not play under the recording.

The pair is **635,500 bytes** (~621 KiB), under 2.5 MB. FFmpeg ebur128 measured the OGG at **−16.0 LUFS integrated, −2.5 dBFS true peak, 1.3 LU LRA**. The original measured −21.45 LUFS. A static +5.45 dB gain preserves its exact duration; dynamic loudnorm was rejected because it padded the end.

Post-compressor browser PCM, using the same ScriptProcessor capture method as GAME-9 (RMS is not LUFS; not physical speaker SPL):

| Viewport | Mix | Peak dBFS | RMS dBFS |
|---|---|---:|---:|
| 1366 | default build mix | -2.46 | -19.46 |
| 1366 | 100% all buses with UI effects | -0.96 | -15.57 |
| 1920 | default build mix | -2.84 | -19.44 |
| 1920 | 100% all buses with UI effects | -0.92 | -15.38 |
| 390 | default build mix | -2.75 | -19.46 |
| 390 | 100% all buses with UI effects | -0.91 | -15.38 |

Default RMS is about 5 dB above the GAME-9 procedural capture. No measured sample exceeded 1.0. Compressor: threshold −4.5 dB, ratio 20:1, attack 1 ms, release 120 ms. The threshold was lowered after an exploratory run showed transient overshoot. Default master/music/effects remain 0.8/0.7/0.85. [Raw audio metrics](game9/game10-audio-metrics.json).

### Validation

- Mock build and typecheck pass; existing large-chunk advisory remains. `npm test`: **69 passed, 0 failed**.
- `game9-feel.mjs`: pass, jobs 1–5 and mock Portal, original PC/phone sizes, all overlay dismissal paths, CTA and zero real totals.
- `game9-dismiss.mjs`: pass, new icon toggle semantics, persistence, lowfx, tutorial/card/part/shop dismissal.
- `game9-audio-stills.mjs`: pass at 1366×768, 1920×1080 and 390×844: default gains, recorded loops, pairwise label rectangle collision checks, WebGL captures, fly skip, **11 MP3 fallbacks**. Explicit clipping assertion passes for every capture.
- `game10-music.mjs`: pass, OGG/MP3 exact decoded duration, two looping layers, no procedural music beneath recording, and procedural recovery if both files fail.
- All four supplied smoke scripts pass with zero browser/page errors. Temporary copies change only hardcoded production origins to localhost. Blocked-storage text-logo detection remains false while Start and the job card work.
- Impeccable detector: only the same two existing Gate delivered/refund stripe warnings as GAME-9. `git diff --check`: pass.

Logs: [unit](game9/game10-unit-output.txt), [build](game9/game10-build-output.txt), [typecheck](game9/game10-typecheck-output.txt), [playthrough](game9/game10-feel-output.txt), [dismissal](game9/game10-dismiss-output.txt), [audio](game9/game10-audio-output.txt), [music fallback](game9/game10-music-output.txt), [smoke](game9/game10-smoke-output.txt).

### Files and limits

Changed `FactoryView.tsx`, `factoryScene.ts`, `JobsGame.tsx`, `jobs.css`, `sound.ts`; the bus assertion in `scripts/game9.test.ts`; GAME-9 audio/dismiss UI tests; new `ui-tests/game10-music.mjs`; paired music assets and credits; this section and GAME-10 captures/logs.

Physical iOS/Android unlock, hardware Back and phone speaker listening remain untested. Signal measurements do not establish perceived loudness on a physical device. No requested implementation item remains deferred. Software-rendered phone smoke measured 7.5 requestAnimationFrame callbacks per second; a separate rerun measured the same, so smooth physical-device performance is not established. Concurrent exploratory browser runs that terminated are not counted as passes. Downloaded source audio and temporary processing files were deleted.
