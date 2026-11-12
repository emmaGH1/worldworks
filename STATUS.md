# Build status

A task is DONE only after the builder's evidence, a Claude review and an Astra re-run all agree.

| Task | Builder | Builder report | Claude review | Astra audit | State |
|---|---|---|---|---|---|
| G1 engine | Sol | 26 tests pass, wasm builds (2026-11-12 ~21:50 UTC); orchestrator re-ran tests: 26 pass | FIX FIRST: 3 high (order lock with Portal behind approval gate; exponential path blow-up; uncapped Portal payouts), 2 medium, 6 low | NOT DONE: 63/30/7 allocation untested; zero price allowed | FIX QUEUED as specs/G1-fix.md, starts when G2a finishes (both touch engine/) |
| G2a contract (local) | Sol | — | — | — | RUNNING |
| G2b live Chain Signatures probe | Sol | — | — | — | RUNNING (testnet approved by user) |
| Design references | Opus | docs/design/REFERENCES.md, 38 local images (not in git) | — | — | DONE (research) |
| Direction style tiles (CP1 input) | Opus | — | — | — | RUNNING |
| T1 app scaffold | Terra | — | — | — | RUNNING |
