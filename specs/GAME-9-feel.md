# GAME-9: game feel: sound, navigation, buttons, no waiting (user rated sound 3/10)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## The user's playtest on a phone, on the live build (0eb534a), today. Each point is a requirement.
Screenshot: `/data/home/.t3/userdata/attachments/4129e1e5-110c-45ff-9df6-281d12ee7ca2-669911dd-7a99-4acc-8d1a-72838311c648.jpg`. It shows the factory after Job 1 with live TESTNET, 4× on, "64 simulated purchases · 1 machines running", the caption "Your machine now runs in your factory. Next: Bola's plot.", every Real total at 0, and a flat grey box to the right of the map.
1. "This takes over 5 minutes even with 4× and it's still running." The user did not know what they were waiting for or what to do next. First find out exactly what could have been "running":
   - an in-flight real ship or payout
   - the simulated sales loop, which never ends
   - the grey box, which looks like an unrendered or loading object
   Then fix the root cause. The player must never wait without knowing:
   - The factory always shows ONE clear primary next action ("Next job: Ada steps back →"). It should be a big button, plus a pulse on the plot.
   - Anything in flight shows its real status, how long it usually takes, and a way to keep playing or skip.
   - Nothing simulated runs as if it were a task to wait on.
   - Remove or properly render the grey box.
   - "1 machines" → correct plural.
2. "The music volume is extremely low even on the highest." Today `sound.ts` is about 40 lines of quiet sine beeps: 0.04 × 0.45 gain.
3. "No sound effects for clicking buttons or things happening in the factory." Every button, tab, menu, drag, drop, dial change, pill pass/fail, star, coin arrival, house payout, ship step, receipt confirmed and Portal moment needs a sound. Sound engineering was rated 3/10.
4. "We still have navigation and button problems":
   - no closing
   - no going back
   - no tap outside to close where needed
   - "the buttons are still bad"
5. "No skip found." There must be a skip for:
   - the tutorial or spotlight
   - intros and splash
   - long animations, including the fly-to-plot and Portal animations
   - waits
6. "Review the game and find more fixes and improvements needed."

## What to do
### A. Audit first (about 45 min)
Play the whole game as a new player in the mock build at 1366×768 (PC is the main target) and at 390×844:
- splash
- jobs 1–5
- the factory
- the shop page `/m/:id`
- the menu, help, sound popover and tooltips

Use Playwright, a GPT model for computer use, and screenshots, and look at every screen. Write `docs/AUDIT-game9.md`: every defect or friction point, with screen, severity and fix. Explicitly check, for every overlay, popover, sheet, dialog and menu:
- Is there a visible ✕?
- Does Esc close it?
- Does tap or click outside close it?
- Does the browser Back button close it instead of leaving the game? Use history state.

For every screen, check: is there a Back control, and does it go one level up (not to the title)? Check every button's size, contrast, label, states (hover, pressed, disabled, focus) and consistency.

### B. Sound: make it sound like a real game
- Use real sampled sound effects, with the WebAudio synth only as a fallback.
  - Source CC0 packs (Kenney: Interface Sounds, UI Audio, Impact Sounds, Casino Audio, Digital Audio, all CC0) or another source with an unambiguous CC0 or CC-BY licence.
  - Record each file with its URL and licence in `app/public/sounds/CREDITS.md`.
  - Ship small `.ogg` files with a `.mp3` fallback, under about 1.5 MB total for effects.
  - Preload them after the first gesture.
- Music:
  - A real looping track, or two: a calm build loop, plus a brighter factory loop or stingers. Use a clearly CC0 or CC-BY licensed source, recorded in CREDITS. If no suitable licensed track is found, compose a much richer procedural track: drums, bass, chords and melody, with real loudness.
  - Music must be clearly audible at default volume on a phone speaker.
  - Crossfade between screens.
  - Duck the music under the ship and Portal moments.
- Mix bus:
  - Master gain → compressor/limiter → destination.
  - Separate music and effects gains.
  - Loudness-normalise the samples.
  - Default master is about 0.8. At 100%, peaks should approach 0 dBFS through the limiter. Measure this and write the numbers in the evidence doc.
- Hook a sound to every action listed in point 3 above. Use slight random pitch variation so repeated coins don't sound robotic. Throttle so the 4× factory doesn't machine-gun.
- Sound button: a clear speaker control with a popover containing:
  - a Music slider and an Effects slider, both with live preview
  - a mute toggle
  - the settings persisted
  - closing by ✕, outside tap or Esc

  Respect iOS and Android unlock: resume the AudioContext on the first gesture, and play a silent buffer.
- Keep `?lowfx=1` starting with sound off.

### C. Navigation and buttons
- One consistent button system:
  - primary, secondary, ghost and icon-only variants
  - minimum hit target 44 px
  - visible pressed state, with a press scale and a sound
  - disabled state with a reason tooltip
  - focus ring

  Apply it everywhere, including the top bar. The top bar must have exactly one menu.
- Every overlay closes by ✕, Esc, outside tap and browser Back.
- A Back control on every non-root screen:
  - job → factory
  - shop page → game
  - help → where you were
- "?" opens contextual help over the current screen and never navigates away.
- Skip and fast paths:
  - "Skip tutorial" on the spotlight, at every step
  - splash: tap or any key skips it
  - fly-to and Portal animations: tap to skip
  - "Skip intro" on job cards the player has already seen
  - remember these choices

### D. No dead waiting
- Factory:
  - a big, persistent next-action CTA
  - in-flight real operations shown as a progress chip with honest status and an "usually ~N s" estimate, and the player can keep playing
  - when a real operation is slow, say so and keep the rest of the UI usable
- Fix every other friction point that the audit finds, prioritised by severity. Do at least all Highs and Mediums.

## Honesty and constraints (unchanged)
- Never fake a transaction. Simulated stays labeled. Real totals count only confirmed receipts.
- Do not touch the contract. No live orders and no new sessions on testnet: test with the mock build (`cd app && VITE_CONTRACT_ID= npm run build`, `npx vite preview`, which listens on `localhost`).
- Do not commit, push or deploy. I will review and deploy.
- Keep all existing tests green: `npm test` in app, plus the Playwright smoke scripts in `/tmp/claude-1000/-data-home--t3-projects-near-hackathon/484fbbcd-f14d-4553-8638-98cd27b9bb09/scratchpad/smoke/` (smoke.mjs, blocked.mjs, phone.mjs, pc.mjs). Add tests for:
  - overlay close by Esc, outside click and Back
  - the skip controls
  - the sound bus gains
  - the next-action CTA
- Disk is tight (about 1.5 GB free on /). Keep audio assets small and delete intermediates.
- Never print or commit secrets.

## Output
- Code changes in `app/`.
- `docs/AUDIT-game9.md`: findings and their status.
- `docs/EVIDENCE-game9.md`: what changed, with screenshots at 1366×768 and 390×844 of the factory CTA, the sound popover, a closed overlay, and the skip controls; test output; loudness numbers.
- `app/public/sounds/CREDITS.md`: updated.
- A final report that lists anything not done.
