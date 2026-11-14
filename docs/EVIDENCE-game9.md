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
