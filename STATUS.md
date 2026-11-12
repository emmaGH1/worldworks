# Build status

A task is DONE only after the builder's evidence, a Claude review and an Astra re-run all agree.

| Task | Builder | Builder report | Claude review | Astra audit | State |
|---|---|---|---|---|---|
| G1 engine | Sol | 26 tests pass, wasm builds (2026-11-12 ~21:50 UTC); orchestrator re-ran tests: 26 pass | FIX FIRST: 3 high (order lock with Portal behind approval gate; exponential path blow-up; uncapped Portal payouts), 2 medium, 6 low | NOT DONE: 63/30/7 allocation untested; zero price allowed | FIX RUNNING (Sol) |
| G2a contract (local) | Sol | build 291 KB; sandbox tests pass a-d; engine 26 pass; storage measured (machine ~0.008 NEAR, order ~0.013 NEAR) | — | — | BUILT, committed; completeness check after G1-fix (fix changes contract); Astra security audit after Portal integration |
| G2b live Chain Signatures probe | Sol | 3 live MPC signatures on testnet (~14-15 s each, ~0.00127 NEAR gas); duplicate and over-cap rejected on chain | — | — | BLOCKED on user: fund 0x3BeF4f8A2eeEB1B9FaD8ba9ED44C23497F0CF9Ce with ~0.003 Sepolia ETH, then broadcast |
| Design references | Opus | docs/design/REFERENCES.md, 38 local images (not in git) | — | — | DONE (research) |
| Direction style tiles (CP1 input) | Opus | — | — | — | RUNNING |
| T1 app scaffold | Terra | typecheck + build pass, SPA fallback works, 210 MB node_modules | orchestrator re-ran typecheck + build: pass | n/a (scaffold) | DONE, committed |
