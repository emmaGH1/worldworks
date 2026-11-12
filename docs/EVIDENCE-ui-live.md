# INT-1 live UI evidence — 2026-11-12

NEAR testnet only: `ww-portal-261112.testnet`. Ethereum Sepolia only (11155111).

The workshop publishes an account-specific Lemonade machine on demand, attaches the limits-reported 0.40 NEAR deposit from the sponsored browser session (unused storage deposit is refunded), and records its NEAR receipt. The seeded customer pays 0.10 NEAR + 0.77 NEAR order storage fee. The repaired machine retains 0.07 NEAR and sends 0.03 NEAR to the Portal for 0.001 Sepolia ETH. The actual rate is 1,000,000 yoctoNEAR/wei; even Vending's 0.007 NEAR Portal branch exceeds the 0.001 NEAR minimum. No price increase or payout reduction is needed at the deployed rate. Templates derive a lower wei value when a higher rate or lower cap requires it.

Queue states are pending, automatically retried, and labeled “queued behind an earlier payout.” Signature failures and stalled payouts expose retry controls. Reserve owner withdrawal is exposed through the API facade and reserve card; unclaimed withdrawal appears only for a positive on-chain balance. Both standalone and workshop pay buttons wait for session and limits.

## Reproduce

Commands run from `app/`, with the existing installed dependencies. npm cache: `/opt/ww-npm-cache`.

```sh
API_PORT=3009 node --env-file=/opt/ww-secrets/live.env --import tsx scripts/dev-api.ts
VITE_CONTRACT_ID=ww-portal-261112.testnet VITE_RELAYER_URL=http://127.0.0.1:3009 npm run dev -- --host 127.0.0.1 --port 4182 --strictPort
# Separate shell; headless Chromium and playwright-core are pinned in common.mjs.
UI_BASE=http://127.0.0.1:4182 node ui-tests/flow-live.mjs
# A new browser context visiting /m/:id directly, retaining the sponsored account:
UI_BASE=http://127.0.0.1:4182 UI_STORAGE_STATE=/opt/ww-secrets/int1-ui-state.json node ui-tests/app-live.mjs
```

`app-live.mjs` also supports a fresh account when UI_STORAGE_STATE is omitted and an arbitrary published id via UI_MACHINE_ID. This recorded standalone run reused the funded workshop account in a new browser context to conserve faucet funds. Browser storage containing keys is saved only under `/opt/ww-secrets`; it is never copied into evidence.

## Earlier failures resolved

The pre-existing API on port 3001 was stale and its sponsor was below the funding threshold. Final checks use a new API process on 3009 with the current sources. Two testnet faucet accounts replenished the sponsor; all their private keys remain under `/opt/ww-secrets`. The original standalone run exposed a normal indexing race: a mined receipt paired with a transaction still reporting null blockHash. That case now withholds confirmation and polls again. Mismatches, reverts, and RPC failures still fail closed. An added fixture case checks this behavior. A mock dev-server run was interrupted by HMR; the recorded mock check uses the stable production preview on 4183.

## Not exercised / not done

- Live withdrawal transactions and a positive unclaimed balance were not exercised; the reserve withdrawal control is visible in the live screenshots, and zero unclaimed balance hides its control.
- A real stuck signature or earlier-nonce queue was not deliberately induced; normal signing, broadcasting, and two-RPC confirmation were exercised.
- No deployment, commit, or push was requested or performed. `contract/` and `engine/` were not modified.
- Existing build warnings about Motion's module directives and bundle size remain; builds exit successfully.

## Screenshots

- [live-01-broken.png](design/screens/live-01-broken.png)
- [live-02-splitter.png](design/screens/live-02-splitter.png)
- [live-03-pending.png](design/screens/live-03-pending.png)
- [live-04-confirmed.png](design/screens/live-04-confirmed.png)
- [live-05-ledger.png](design/screens/live-05-ledger.png)
- [live-06-app.png](design/screens/live-06-app.png)
- [live-07-app-paid.png](design/screens/live-07-app-paid.png)

## Result

PASS: typecheck, mock build, live build, mock flow, live workshop flow, standalone live payment, and zero console errors in both recorded live runs. Final workshop: 57.7 seconds; earlier successful workshop: 49.1 seconds. Both recorded Sepolia payments have successful matching receipts from two independent RPC hosts.

## Full acceptance output

### `npm run typecheck`

```text

> worldworks-app@0.0.0 typecheck
> tsc --noEmit
```

Exit status: 0.

### `npm run build (mock)`

```text

> worldworks-app@0.0.0 build
> vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 488 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.78 kB │ gzip:   0.42 kB
dist/assets/worldworks_engine_wasm_bg-5coomDFX.wasm  411.00 kB │ gzip: 122.40 kB
dist/assets/index-2wxwH_nX.css                        58.54 kB │ gzip:  11.64 kB
dist/assets/index-mSbhNSS_.js                        658.88 kB │ gzip: 211.78 kB

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-max.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-max.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-constant.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-constant.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/LayoutGroup/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/LayoutGroup/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/LazyMotion/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/LazyMotion/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-force-update.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-force-update.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-unmount-effect.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-unmount-effect.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-animation.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-animation.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-follow-value.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-follow-value.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-min.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-min.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-pinch.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-pinch.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-motion-value-event.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-motion-value-event.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-motion-value.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-motion-value.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-scroll.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-scroll.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-page-in-view.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-page-in-view.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animate.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animate.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-scope-motion.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-scope-motion.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-motion-template.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-motion-template.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animate-style.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animate-style.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/events/use-dom-event.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/events/use-dom-event.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animation.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animation.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence-data.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence-data.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-animation-frame.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-animation-frame.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/LayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/LayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionConfigContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionConfigContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionContext/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionContext/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/PresenceContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/PresenceContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimateSharedLayout.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimateSharedLayout.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/DeprecatedLayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/DeprecatedLayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-inverted-scale.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-inverted-scale.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/namespace.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/namespace.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-cycle.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-cycle.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-in-view.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-in-view.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-instant-transition.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-instant-transition.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animated-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animated-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-will-change/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-will-change/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-spring.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-spring.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-time.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-time.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-transform.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-transform.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-velocity.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-velocity.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion-config.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion-config.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-is-mounted.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-is-mounted.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-computed.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-computed.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-combine-values.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-combine-values.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/features/layout/MeasureLayout.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/features/layout/MeasureLayout.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Board.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Board.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Item.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Item.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Group.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Group.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/ReorderBoardContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/ReorderBoardContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/ReorderContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/ReorderContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/LazyContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/LazyContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/@xyflow/react/dist/esm/index.js" may not be preserved when bundling.
   ╭─[ node_modules/@xyflow/react/dist/esm/index.js:1:1 ]
   │
 1 │ "use client"
   │ ──────┬─────  
   │       ╰─────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/use-render.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/use-render.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/svg/use-props.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/svg/use-props.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/html/use-html-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/html/use-html-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionContext/create.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionContext/create.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/svg/use-svg-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/svg/use-svg-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/html/use-props.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/html/use-props.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

✓ built in 335ms
```

Exit status: 0.

### `VITE_CONTRACT_ID=ww-portal-261112.testnet VITE_RELAYER_URL=http://127.0.0.1:3009 npm run build -- --outDir /tmp/ww-int1-live-dist`

```text

> worldworks-app@0.0.0 build
> vite build --outDir /tmp/ww-int1-live-dist

vite v8.3.8 building client environment for production...
transforming...
[plugin rolldown:vite-resolve] Module "util" has been externalized for browser compatibility, imported by "/data/home/.t3/projects/near-hackathon/app/node_modules/generate-function/index.js". See https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.
✓ 530 modules transformed.

(!) outDir /tmp/ww-int1-live-dist is not inside project root and will not be emptied.
Use --emptyOutDir to override.

rendering chunks...
computing gzip size...
../../../../../../tmp/ww-int1-live-dist/index.html                                        0.78 kB │ gzip:   0.42 kB
../../../../../../tmp/ww-int1-live-dist/assets/worldworks_engine_wasm_bg-5coomDFX.wasm  411.00 kB │ gzip: 122.40 kB
../../../../../../tmp/ww-int1-live-dist/assets/index-2wxwH_nX.css                        58.54 kB │ gzip:  11.64 kB
../../../../../../tmp/ww-int1-live-dist/assets/live-Yd96NWau.js                         212.49 kB │ gzip:  65.16 kB
../../../../../../tmp/ww-int1-live-dist/assets/index-BXC6bUVc.js                        661.47 kB │ gzip: 212.75 kB

[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/LayoutGroup/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/LayoutGroup/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/LazyMotion/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/LazyMotion/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-unmount-effect.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-unmount-effect.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-animation.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-animation.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-max.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-max.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-min.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-min.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-pinch.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-pinch.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-motion-value-event.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-motion-value-event.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-motion-template.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-motion-template.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-motion-value.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-motion-value.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-follow-value.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-follow-value.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-spring.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-spring.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-time.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-time.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-transform.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-transform.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-velocity.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-velocity.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-will-change/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-will-change/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion-config.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion-config.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animate.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animate.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-scope-motion.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-scope-motion.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animate-style.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animate-style.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animation.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animation.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence-data.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence-data.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/@xyflow/react/dist/esm/index.js" may not be preserved when bundling.
   ╭─[ node_modules/@xyflow/react/dist/esm/index.js:1:1 ]
   │
 1 │ "use client"
   │ ──────┬─────  
   │       ╰─────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/events/use-dom-event.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/events/use-dom-event.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-animation-frame.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-animation-frame.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-cycle.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-cycle.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-in-view.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-in-view.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-instant-transition.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-instant-transition.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-page-in-view.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-page-in-view.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/LayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/LayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionConfigContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionConfigContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionContext/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionContext/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/PresenceContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/PresenceContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animated-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animated-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimateSharedLayout.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimateSharedLayout.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/DeprecatedLayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/DeprecatedLayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/LazyContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/LazyContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-scroll.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-scroll.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-force-update.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-force-update.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-inverted-scale.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-inverted-scale.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/namespace.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/namespace.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-is-mounted.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-is-mounted.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-combine-values.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-combine-values.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-computed.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-computed.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/features/layout/MeasureLayout.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/features/layout/MeasureLayout.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-constant.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-constant.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Board.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Board.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionContext/create.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionContext/create.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/use-render.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/use-render.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/svg/use-svg-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/svg/use-svg-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/html/use-html-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/html/use-html-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Item.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Item.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Group.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Group.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/ReorderBoardContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/ReorderBoardContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/svg/use-props.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/svg/use-props.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/html/use-props.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/html/use-props.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/ReorderContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/ReorderContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────  
   │       ╰──────── module level directive may not be preserved
   │ 
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

✓ built in 354ms
```

Exit status: 0.

### `UI_BASE=http://127.0.0.1:4183 node ui-tests/flow.mjs`

```text
[  1.8s] ok   MOCK DATA badge is visible in mock mode
[  1.8s] ok   broken Lemonade Machine opens with the BROKE stamp
[  1.8s] ok   no Splitter on the board at start
[  1.8s] ok   goal 1 is open
[  2.6s] ok   Splitter dropped onto the Coin Slot -> Portal pipe
[  2.6s] ok   a reserve Vault came with it
[  2.6s] ok   machine validates in the wasm engine (stamp RUNNING)
[  2.6s] preview: previewnext sale: 0.10 NEAR in → 0.03 Portal fee → 0.001 ETH on Sepolia · 0.07 kept
[  4.9s] seeded customer walking in: One lemonade, please.seeded customer
[  9.5s] sales=1 kept=0.07 NEAR vault=0.07 NEAR
[  9.5s] ok   reserve > 0 after a sale (kept 0.07 NEAR)
[  9.5s] ok   goal 2 unlocked
[  9.6s] ok   ledger drawer has the order row, marked confirmed (mock)
[  9.6s] ok   order row shows the storage fee
[ 10.0s] portal status: awaiting_signature
[ 10.0s] ok   no receipts or "confirmed" shown while awaiting_signature
[ 20.9s] portal status: signed
[ 20.9s] ok   no receipts or "confirmed" shown while signed
[ 21.7s] portal status: broadcast
[ 21.7s] ok   no receipts or "confirmed" shown while broadcast
[ 34.2s] portal status: confirmed
[ 34.2s] ok   Portal went through its states in order (awaiting_signature > signed > broadcast > confirmed)
[ 34.2s] ok   two receipts shown once confirmed
[ 34.2s] ok   goal 2 done: paid a customer on Ethereum (mock)
[ 34.2s] total flow 34.2s
console errors: 0
RESULT: PASS
```

Exit status: 0.

### `UI_BASE=http://127.0.0.1:4182 node ui-tests/flow-live.mjs (final fresh session)`

```text
ok: live mode
ok: broken Lemonade opens
screenshot: docs/design/screens/live-01-broken.png
ok: Splitter validates
screenshot: docs/design/screens/live-02-splitter.png
ok: real reserve after sale
screenshot: docs/design/screens/live-03-pending.png
Portal: awaiting_signature
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
Portal: signed
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
Portal: broadcast
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
API confirmation: {"payoutId":"12","status":"confirmed","recipient":"0x000000000000000000000000000000000000dEaD","wei":"1000000000000000","nonce":12,"portalAddress":"0x694ad57416073b1e1f3bc6e13b26bde28015a8b7","confirmations":[{"rpc":"https://rpc.sepolia.ethpandaops.io","hash":"0x32417534f177ba60b339ab0b4aab14f0cce3db7d5ba335a70be3bf646a3d1c9a","blockHash":"0x2890161377f26bb531ea902fc9cbf70720adec2f6255d802806276d36dcc114d","blockNumber":"12122052","from":"0x694ad57416073b1e1f3bc6e13b26bde28015a8b7","to":"0x000000000000000000000000000000000000dead","value":"1000000000000000","status":1},{"rpc":"https://sepolia.gateway.tenderly.co","hash":"0x32417534f177ba60b339ab0b4aab14f0cce3db7d5ba335a70be3bf646a3d1c9a","blockHash":"0x2890161377f26bb531ea902fc9cbf70720adec2f6255d802806276d36dcc114d","blockNumber":"12122052","from":"0x694ad57416073b1e1f3bc6e13b26bde28015a8b7","to":"0x000000000000000000000000000000000000dead","value":"1000000000000000","status":1}],"evmTx":{"hash":"0x32417534f177ba60b339ab0b4aab14f0cce3db7d5ba335a70be3bf646a3d1c9a","explorerUrl":"https://sepolia.etherscan.io/tx/0x32417534f177ba60b339ab0b4aab14f0cce3db7d5ba335a70be3bf646a3d1c9a"}}
Portal: confirmed
ok: UI confirmed only after API confirmed
ok: two independent Sepolia RPC proofs
ok: matching successful receipts
ok: real Sepolia link
workshop elapsed seconds: 57.7
screenshot: docs/design/screens/live-04-confirmed.png
ok: publish ledger confirmed
ok: publish NEAR link
publish links: https://explorer.testnet.near.org/transactions/2VWXeFDj3qQt94YPV6zmPpkiuAf8NqHXrbxAkVAKhso5
ok: order ledger confirmed
ok: order NEAR link
order links: https://explorer.testnet.near.org/transactions/74TrnTq9ULij25jQvKWjy5X3TRfs6GheutDV3t48pMPC
ok: payout ledger confirmed
ok: payout NEAR link
payout links: https://explorer.testnet.near.org/transactions/74TrnTq9ULij25jQvKWjy5X3TRfs6GheutDV3t48pMPC https://sepolia.etherscan.io/tx/0x32417534f177ba60b339ab0b4aab14f0cce3db7d5ba335a70be3bf646a3d1c9a
screenshot: docs/design/screens/live-05-ledger.png
ok: machine id <=32 bytes: lemonade-b49a4e8f-16111a8eb144
app URL: http://127.0.0.1:4182/m/lemonade-b49a4e8f-16111a8eb144
console errors: 0
RESULT: PASS
```

Exit status: 0.

### `UI_BASE=http://127.0.0.1:4182 UI_STORAGE_STATE=/opt/ww-secrets/int1-ui-state.json node ui-tests/app-live.mjs`

```text
ok: standalone live mode
machine: lemonade-b49a4e8f-d041f9f3a0d4 total: 0.87 NEAR
screenshot: docs/design/screens/live-06-app.png
NEAR: https://explorer.testnet.near.org/transactions/DnQkqYyq7dxR9FcQZnaAcvPwBCVYFdvNoQcSPiNtYUzY
Portal: awaiting_signature
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
Portal: signed
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
Portal: broadcast
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
ok: no premature confirmed receipts
API confirmation: {"payoutId":"11","status":"confirmed","recipient":"0x000000000000000000000000000000000000dEaD","wei":"1000000000000000","nonce":11,"portalAddress":"0x694ad57416073b1e1f3bc6e13b26bde28015a8b7","confirmations":[{"rpc":"https://rpc.sepolia.ethpandaops.io","hash":"0x4609a556172b41d36a7a33f279d31e21893487c488d33a646bb68aa480f29775","blockHash":"0x8bedda0d9b615ee968e6d9bc72aec15db06bbc3cda72da0477173ca6e03a06b1","blockNumber":"12122047","from":"0x694ad57416073b1e1f3bc6e13b26bde28015a8b7","to":"0x000000000000000000000000000000000000dead","value":"1000000000000000","status":1},{"rpc":"https://sepolia.gateway.tenderly.co","hash":"0x4609a556172b41d36a7a33f279d31e21893487c488d33a646bb68aa480f29775","blockHash":"0x8bedda0d9b615ee968e6d9bc72aec15db06bbc3cda72da0477173ca6e03a06b1","blockNumber":"12122047","from":"0x694ad57416073b1e1f3bc6e13b26bde28015a8b7","to":"0x000000000000000000000000000000000000dead","value":"1000000000000000","status":1}],"evmTx":{"hash":"0x4609a556172b41d36a7a33f279d31e21893487c488d33a646bb68aa480f29775","explorerUrl":"https://sepolia.etherscan.io/tx/0x4609a556172b41d36a7a33f279d31e21893487c488d33a646bb68aa480f29775"}}
Portal: confirmed
ok: UI confirmed only after API confirmed
ok: two independent Sepolia RPC proofs
ok: matching successful receipts
ok: real Sepolia link
screenshot: docs/design/screens/live-07-app-paid.png
console errors: 0
RESULT: PASS
```

Exit status: 0.

### `node --import tsx --test scripts/live.test.ts scripts/relay.test.ts`

```text
TAP version 13
# Subtest: two independent matching receipts required; missing, altered, reverted and offline responses cannot confirm
ok 1 - two independent matching receipts required; missing, altered, reverted and offline responses cannot confirm
  ---
  duration_ms: 65.755557
  type: 'test'
  ...
# Subtest: session rejects malformed keys; customer rejects oversized identifiers and invalid recipients
ok 2 - session rejects malformed keys; customer rejects oversized identifiers and invalid recipients
  ---
  duration_ms: 0.60186
  type: 'test'
  ...
# Subtest: per-IP session rate limit rejects sixth request and method guard rejects GET
ok 3 - per-IP session rate limit rejects sixth request and method guard rejects GET
  ---
  duration_ms: 0.367429
  type: 'test'
  ...
# Subtest: live signature recovers contract-derived address and fixes transaction fields
ok 4 - live signature recovers contract-derived address and fixes transaction fields
  ---
  duration_ms: 27.533809
  type: 'test'
  ...
# Subtest: relayer rejects altered recipient
ok 5 - relayer rejects altered recipient
  ---
  duration_ms: 0.30033
  type: 'test'
  ...
# Subtest: relayer rejects altered wei
ok 6 - relayer rejects altered wei
  ---
  duration_ms: 0.10027
  type: 'test'
  ...
# Subtest: relayer rejects altered nonce
ok 7 - relayer rejects altered nonce
  ---
  duration_ms: 0.08282
  type: 'test'
  ...
# Subtest: relayer rejects altered chain_id
ok 8 - relayer rejects altered chain_id
  ---
  duration_ms: 0.1004
  type: 'test'
  ...
# Subtest: relayer rejects altered max_fee_per_gas
ok 9 - relayer rejects altered max_fee_per_gas
  ---
  duration_ms: 0.35951
  type: 'test'
  ...
# Subtest: relayer rejects altered gas_limit
ok 10 - relayer rejects altered gas_limit
  ---
  duration_ms: 0.10083
  type: 'test'
  ...
# Subtest: relayer rejects unsigned payout
ok 11 - relayer rejects unsigned payout
  ---
  duration_ms: 0.06986
  type: 'test'
  ...
# Subtest: broadcast returns deterministic hash and known-transaction rebroadcast is idempotent
ok 12 - broadcast returns deterministic hash and known-transaction rebroadcast is idempotent
  ---
  duration_ms: 1.839509
  type: 'test'
  ...
# Subtest: unaccepted broadcast preserves RPC failure
ok 13 - unaccepted broadcast preserves RPC failure
  ---
  duration_ms: 0.96289
  type: 'test'
  ...
# Subtest: wrong RPC chain cannot broadcast
ok 14 - wrong RPC chain cannot broadcast
  ---
  duration_ms: 0.65893
  type: 'test'
  ...
# Subtest: broadcast rejects a provider returning another hash
ok 15 - broadcast rejects a provider returning another hash
  ---
  duration_ms: 0.49861
  type: 'test'
  ...
# Subtest: relay walks signed predecessors in nonce order and stops before an unsigned gap
ok 16 - relay walks signed predecessors in nonce order and stops before an unsigned gap
  ---
  duration_ms: 0.19777
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 713.205618
```

Exit status: 0.

### `node --import tsx scripts/check-secrets.ts`

```text
PASS: 226 repository files scanned against 16 private keys/seed phrases; no matches. Secret values not printed.
```

Exit status: 0.

### `Impeccable detector (changed UI targets)`

```text
[]
```

Exit status: 0.

### `git diff --check`

```text
[exit 0; no output]
```

## Files changed

- `app/api/near.ts`
- `app/api/payout.ts`
- `app/scripts/live.test.ts`
- `app/src/api/index.ts`
- `app/src/api/live.ts`
- `app/src/api/types.ts`
- `app/src/components/Ledger.tsx`
- `app/src/components/PortalSteps.tsx`
- `app/src/lib/limits.ts`
- `app/src/lib/machine.ts`
- `app/src/lib/store.ts`
- `app/src/pages/MachineApp.tsx`
- `app/src/pages/Workshop.tsx`
- `app/ui-tests/app-live.mjs`
- `app/ui-tests/flow-live.mjs`
- `app/ui-tests/live-common.mjs`
- `docs/EVIDENCE-ui-live.md`
- `docs/design/screens/live-01-broken.png`
- `docs/design/screens/live-02-splitter.png`
- `docs/design/screens/live-03-pending.png`
- `docs/design/screens/live-04-confirmed.png`
- `docs/design/screens/live-05-ledger.png`
- `docs/design/screens/live-06-app.png`
- `docs/design/screens/live-07-app-paid.png`
