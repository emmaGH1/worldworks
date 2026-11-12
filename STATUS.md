# Build status

A task is DONE only after the builder's evidence, a Claude review and an Astra re-run all agree.

| Task | Builder | Builder report | Claude review | Astra audit | State |
|---|---|---|---|---|---|
| G1 engine + G1-fix | Sol | all 13 findings fixed; 40 engine tests | 3 high, 2 medium, 6 low -> fixed | Sol check: all executable checks pass; 3 literal points resolved by spec amendment | DONE |
| G2a contract (local) | Sol | build 291 KB; sandbox tests pass a-d; engine 26 pass; storage measured (machine ~0.008 NEAR, order ~0.013 NEAR) | — | — | Sol check: DONE for local scope (fresh build 340 KB, sandbox a-e pass) | DONE (local); Astra security audit covers it with G3 |
| G2b live Chain Signatures probe | Sol | 3 live MPC signatures on testnet (~14-15 s each, ~0.00127 NEAR gas); duplicate and over-cap rejected on chain | — | — | SUPERSEDED by G3 (fund the G3 portal address instead) |
| Design references | Opus | docs/design/REFERENCES.md, 38 local images (not in git) | — | — | DONE (research) |
| Direction style tiles (CP1 input) | Opus | docs/design/directions.html; checked at 1440/1280/390 px | screenshots reviewed by orchestrator | n/a | DONE; waiting for user pick (default A) |
| T1 app scaffold | Terra | typecheck + build pass, SPA fallback works, 210 MB node_modules | orchestrator re-ran typecheck + build: pass | n/a (scaffold) | DONE, committed |
| G3 Portal in main contract + relayer | Sol | deployed ww-portal-261112.testnet; live MPC signature for a vending order; sandbox + 11 relayer tests pass | — | Astra security audit: 2 critical (treasury drain by 1-yocto Portal machine; FullAccess key on contract account), 5 high, 2 medium -> G5 | BUILT, committed; Sepolia broadcast BLOCKED on user funding 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7 |
| T2 engine in browser (wasm) | Terra | wasm 411 KB; app typecheck/build pass; node test: wasm == native | orchestrator re-ran node test: pass | n/a | DONE, committed (validate returns no flow count; engine API does not expose it; acceptable) |
| UI-1 workshop, app page, verify page | Opus | first run hit Claude rate limit; partial work kept | — | — | RUNNING (resumed; Direction A final) |
| G4 live adapter, wallet-free onboarding, scoped Worker key, seeded customer | Sol | e2e on testnet passes: session, publish, approve-only key verified by RPC (other method rejected), seeded order, payout signed; 14 tests | — | — | BUILT, committed; needs follow-up for G5 interface changes; completeness check after that |
| G5 contract hardening (audit fixes) | Sol | all audit items implemented; 40 engine + sandbox tests pass; redeployed, portal address unchanged | — | Astra re-audit after G4b | BUILT, committed |
| GATE 2: real cross-chain payout | Sol + orchestrator | 5 payouts confirmed on Sepolia from the NEAR-derived treasury (receipts on 2 RPCs) | — | — | DONE (docs/EVIDENCE-sepolia.md) |
| G4b app adopts G5, fee right-sizing, 2-RPC confirmation | Sol | order fee 0.77 NEAR, publish 0.40 NEAR (measured fixture x2; global worst case not proven); sessions get 7 NEAR; payouts 5-8 confirmed on 2 RPCs; e2e passes | — | Astra re-audit RUNNING | BUILT, committed; Sol completeness check RUNNING |
| Completeness check G3/G4/G4b/G5 | Sol | G5 SATISFIED; G3/G4/G4b PARTIAL: storage 2x margin off by 0.01 NEAR for an escaped-id case; effects parsed from trace strings (drops a 'vault:1' node); tsx missing from lockfile; some G3 sandbox regressions not in current suite. Live contract hash, limits, scoped key, Sepolia payouts 0 and 5 independently verified | — | — | follow-ups queued as specs/G6-followups.md |
