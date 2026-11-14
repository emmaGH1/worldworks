# GAME-9 audit

Initial audit: source inspection and Chromium at 1366×768 and 390×844, mock only. Baseline captures in `docs/game9/audit-*`. Existing visual identity retained. Final validation played jobs 1–5 through real pointer/dial controls and WASM checks in the 2D fallback at both sizes. Additional 3D captures exercised the factory, sound popover and fly-to at both sizes. No testnet operations were performed.

| Screen | Severity | Finding | Fix/status |
|---|---|---|---|
| Factory after Job 1 | High | Infinite simulated sales looks like an unfinished task; next step buried in caption | Persistent next-job CTA; explicitly endless preview; pause control |
| Factory | Medium | Empty grey Ethereum island looks unloaded | Only render island when Ethereum has a house |
| Factory | Medium | “1 machines running” | Correct singular; explain simulated preview |
| All | High | Audio ~0.018 peak before envelope; no mix bus; only sine beeps | Sampled CC0 SFX, compressed mix, richer music |
| Sound | Medium | One shared volume; no live preview | Separate sliders, master, mute, persisted |
| Menu/help/sound/jobs | High | Missing Esc/outside/Back; inconsistent close | Common dismissal lifecycle and visible × |
| Job card/part sheet/shop setup | High | Inconsistent close/Back/outside | Common dismissal; preserve edits on close |
| Portal/ship/inside-machine | High | Immersive view can obscure escape path | Skip view / keep playing; never skip network execution |
| Job tests | High | Three simulated customers must finish before continuing | Skip animation uses actual synchronous WASM test result |
| Splash | Medium | Only Enter and Start advance | Any non-control key or background tap skips |
| Fly-to | Medium | Mandatory camera movement | Visible skip and tap-to-skip |
| Tutorial | Medium | Skip exists but browser Back not handled | Keep skip at every step; history dismissal |
| Job editor | Medium | Home brand does not clearly say Back | Explicit Back to factory |
| Shop | Medium | Brand link lacks clear game-return label | Back to game |
| Buttons | Medium | Small mini/close controls; inconsistent press/focus | Shared 44px minimum and pressed/focus states |
| Hints/tooltips | Medium | Persistent tooltip has no explicit close/Esc | Common dismissal and close button |

Overlay checklist before fixes: ledger alone has visible × and Esc; other sheets mostly have Done/Close only. No overlay uses history state or outside-dismiss. Spotlight has Skip/Esc but outside shields block. Portal has receipt CTA only. Dismissal must never cancel or fabricate a real receipt.

Positive: simulated money is already labeled; real totals derive from confirmed ledger receipts; 4× is already guarded during unresolved network operations; there is exactly one top-bar menu.

## Final status

All High and Medium rows above are implemented. The dismissal lifecycle now covers menu, help, sound, jobs list, ledger, job cards, part sheets, shop setup, hints, tooltips, simulated Gate waits, test animations, run panels and the Portal presentation. Root splash has any-key/background-tap dismissal; tutorial has an always-visible Skip and outside/Esc/Back dismissal. The editor's Back control and browser Back return to factory. Inline receipt/details expansions are disclosure controls, not modal overlays.

The browser checks found and fixed additional issues:

- High: a lingering socket tooltip intercepted Back instead of closing the part sheet. Ordinary control activation clears tooltips.
- Medium: the phone factory heading covered the first plot row. Camera margins now measure the heading; fallback grid reserves space.
- Medium: the phone CTA covered the bottom house totals. Totals sit above the CTA.
- Medium: desktop house labels overlapped plot labels. House totals now form a separate readable row.
- Medium: translucent sheets showed underlying job/factory text. Sheets use opaque paper surfaces.
- Medium: the splash Start button's autofocus prevented other keys from skipping. Any non-modifier key now advances.
- Medium: job-5 and checkout had unclear return affordances. Both have explicit Back labels.

The Impeccable detector returned two warnings for existing Gate exit stripes (`jobs.css` port-p/port-f). Those colors encode delivered versus refund exits and were retained as meaningful diagram notation. No redesign or token migration was attempted.

| Dimension | Score / 4 | Scope |
|---|---:|---|
| Accessibility | 3 | Named controls, focus rings, 44px targets; no full screen-reader audit |
| Performance | 3 | Existing bounded scene; effects assets ~132 KB; software-renderer phone smoke ~23.5 fps |
| Theming | 2 | Incumbent colors retained; broad token migration out of scope |
| Responsive | 3 | 1366×768 / 390×844 captures and pointer tests; physical devices untested |
| Integrity | 3 | Real receipt rules preserved; previews explicitly simulated |
| Total | 14/20 | Good; physical-device validation still needed |

No known unaddressed High/Medium audit finding remains. This is a scoped game-feel audit, not a claim of WCAG certification. Physical phone speaker output, native mobile audio unlock and hardware Back behavior remain unverified; browser tests use Chromium emulation.
