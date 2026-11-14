# GAME-8 — WORLDWORKS title and brand

## Changes

- Illustrated HTML/CSS title screen with the supplied wordmark, tagline, explanatory sentence, vertical start/continue menu, conditional Factory and saved-run actions, existing contextual help, and sound toggle. Existing `intro`, `point`, `start`, and HUD test IDs remain.
- Phone composition places the menu on navy above Ada and her machine. Desktop keeps the logo/menu left and key art right. Keyboard Enter starts; focus rings remain visible. Art drift, logo entrance, and Portal glow stop with reduced motion or `?lowfx=1`. The splash renders with `?webgl=0`.
- Compact gear mark and wordmark in the Factory button; standalone `/m/:id` header links home with the mark and “Built in WORLDWORKS”.
- PNG favicon/apple icon (removed the unrelated old SVG), page title, description, Open Graph and Twitter cards. `brand/social.png` is a 1200×630 crop with the logo composited onto the dark left side.
- Reproducible asset script: `bash app/scripts/brand-assets.sh [source-art-directory]` (ffmpeg). Supplied source brand art was generated with OpenAI image generation. No new source artwork was generated for this implementation.
- Desktop key art: 1920×1080 WebP, about 106 KB; phone key art: 960×540 WebP, about 43 KB; transparent logo: 900×182 WebP, about 38 KB. Marks: 256, 64 and 180px PNG. Compact wordmark excludes the gear to avoid duplication beside the standalone mark.

## Verification

All commands run from `app` unless stated otherwise. Mock build only; no contract ID, sessions, orders, or chain writes.

- `npm run typecheck` — passed.
- `npx tsc --noEmit -p api/tsconfig.json` — passed.
- `node --import tsx --test scripts/*.test.ts` — 67 passed, 0 failed.
- `VITE_CONTRACT_ID= npm_config_cache=/opt/ww-npm-cache npx vite build --outDir /opt/ww-splash-dist --emptyOutDir` — passed; existing large-chunk warning. First attempt needed a writable `/opt/ww-splash-dist`; created only that directory with sudo and assigned it to the current user.
- `npx vite preview --outDir /opt/ww-splash-dist --port 4310` — local preview, `UI_BASE=http://localhost:4310`, `INSTABOX_HEADLESS=1` for UI checks.
- `node ui-tests/game7-controls.mjs` — passed touch-hold reasoning and unresolved-run guard; 0 console errors.
- `node ui-tests/game8-splash.mjs` — responsive title sweep at 360, 390, 412, 768, 1366 and 1920; no overflow, visible start/logo, lowfx animation disabled; help, Enter start and saved-progress Continue/Factory checks.
- Existing FX smoke selectors were updated from the removed legacy mute/help controls to the current sound settings and menu title replay. GAME-6 keeps its original deterministic capture loop, with a 120s action timeout for the shared CPU-only VM. The shared error collector excludes only expected `ERR_ABORTED` icon requests during fixture navigation/context teardown (64/180px brand icons); actual console errors and other request failures remain errors.
- Initial parallel WebGL attempts timed out. A test-only attempt to draw less frequently also failed to settle/reset camera rendering correctly; it was reverted.
- Impeccable mechanical detector run on changed UI files; findings refer to pre-existing socket stripes, styles and bounce easing outside the splash.

## Stills

Visually inspected the desktop and phone splash captures, the compact 360px top bar, and the social image. Screens are under `docs/design/screens/`:

- [390px splash](design/screens/g8-splash-390.png)
- [1366px splash](design/screens/g8-splash-1366.png)
- [1920px splash](design/screens/g8-splash-1920.png)
- [360px top bar](design/screens/g8-topbar-360.png)
- [390px standalone header](design/screens/g8-standalone-390.png)
- Additional responsive captures: `g8-splash-360.png`, `g8-splash-412.png`, `g8-splash-768.png`.

## Boundaries and remaining verification

No game rules, API, contract, engine, or README changes. No commit, push, deployment, live orders or sessions. `app/dist` was never built or modified by this task. The separate build is deleted after verification. Audio behavior is checked through settings/context state, without a listening test. Social metadata is verified locally; public crawler refresh requires deployment.

Final UI results are recorded below.

## Final UI results and honest not-done list

With `UI_BASE=http://localhost:4310 INSTABOX_HEADLESS=1`:

- `UI_WIDTH=1366 UI_FALLBACK=1 node ui-tests/game6-mock.mjs` — PASS, complete two-job playthrough, tooltips/help, Factory persistence, sound persistence, renderer-budget checks; empty error array.
- `UI_WIDTH=390 UI_FALLBACK=1 node ui-tests/game6-mock.mjs` — PASS, same two-job/persistence checks; empty error array. Final rerun also uses the restored original capture cadence.
- `node ui-tests/game4-fx-smoke.mjs` — PASS at 1366×800 and 390×844 in WebGL mode, title camera/start, gesture-unlocked audio context, sound persistence, help and title replay; 0 console errors.
- `node ui-tests/game7-controls.mjs` — PASS, touch-hold and unresolved-real-run guard using mock saved-run fixtures; 0 console errors.
- `node ui-tests/game8-splash.mjs` — PASS at all six requested widths with `webgl=0`, including Enter start, help, Continue/Factory, reduced motion, lowfx, and `/m/lemonade` header; 0 console errors. Final captures are from the separate final build.

**Not completed:** the full WebGL GAME-6 two-job suite did not produce a passing result. Initial parallel attempts timed out waiting for the title; later attempts timed out on gameplay actions. A reduced-draw test experiment left a socket outside the viewport and was reverted. The final original-loop attempt passed title/start/tutorial/card collapse, then remained in gameplay input; it was stopped during cleanup. The full WebGL GAME-6 suite should be rerun when the VM is free from concurrent video/shot capture. This is separate from the passing WebGL FX title/start checks and complete passing fallback playthroughs. No claim is made that every full WebGL gameplay regression check passed.

No live testnet integration, deployment/crawler refresh, or listening test was performed. No commit or push was made, per instruction.

Cleanup confirmed: stopped the port-4310 preview and removed `/opt/ww-splash-dist`. Restored `docs/game7-ui.json` after the tests wrote their generated report. Existing unrelated `specs/TRAILER-2.md` was left untouched. `git diff --check` passed. Final standalone header text was darkened for contrast against the teal background and its still re-inspected.
