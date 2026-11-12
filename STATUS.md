# Build status

A task is DONE only after the builder's evidence, a Claude review and an Astra re-run all agree.

| Task | Builder | Builder report | Claude review | Astra audit | State |
|---|---|---|---|---|---|
| G1 engine | Sol | 26 tests pass, wasm builds (2026-11-12 ~21:50 UTC); orchestrator re-ran tests: 26 pass | running | NOT DONE: vending example is 63/30/7, not the spec's 70/30 (spec was contradictory; amended); no exact-allocation test; zero price allowed | FIXES QUEUED (batched with Claude review) |
| G2a contract (local) | Sol | — | — | — | RUNNING |
| G2b live testnet + Chain Signatures | — | — | — | — | WAITING (needs CP0 answer 1: test transactions) |
| Design references | Opus | — | — | — | RUNNING |
