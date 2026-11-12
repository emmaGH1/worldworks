# README-1 — The judge-facing README (Astra drafts; Claude polishes; Astra audits against the product)

## North Star
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real; everything simulated is labeled. Never fake a transaction, never claim what the code does not do.

## Readers
1. Claude Code and Codex screeners (reproducibility check, feature verification, structured report, preliminary score). The official rules say: "write the README for a machine reader as well as a human one: what the product is, the problem it solves, and how to try it as 'do X - see Y' steps a judge can follow. No marketing." Read https://nearhackathon.com/HACKATHON.md.
2. Human judges: Illia Polosukhin, Eddy Lazzarin, Mert Mumtaz, Avichal Garg, Kain Warwick, Haseeb Qureshi, Stepan Gershuni.

## Hard requirements
- Within the first screen (15-30 seconds of reading): one-line description, a three-sentence "what and why", then **Try it** (hosted link placeholder `{{HOSTED_URL}}`, demo video placeholder `{{DEMO_POST_URL}}`, and 4-6 "do X -> see Y" steps that reproduce the first 60 seconds), then **Verify it yourself** (contract id, Portal treasury address, two or three explorer links to real NEAR and Sepolia transactions, and one command block).
- Then: how NEAR is used (accounts and sponsored sessions, approve-only function-call key, contract-built Chain Signatures payouts, keyless relayer, two-RPC confirmation) — each claim linked to the file that implements it and the evidence that proves it.
- What is real vs simulated (table). Limitations and what we do not claim — copy the substance of docs/CLAIMS.md as it stands (another review may update it; leave a marker comment where CLAIMS.md is used).
- Run locally: exact commands from a clean checkout (engine tests, contract sandbox tests, app build, mock-mode UI test, live API server with env vars from `.env.example`, without real secrets). Every command must actually work; test each one you can without sending transactions and say in your report which you ran.
- Architecture (short, one small diagram in Mermaid or ASCII), repository map, tracks (Open primary; list others only if honestly fitting — suggest which), hackathon disclosure (built 2026-11-12/14, no pre-hackathon code; AI assistance disclosed: Claude, GPT models; libraries listed per rule Q-005), license (MIT; add LICENSE file content in your report, not the file).
- No marketing adjectives, no emoji walls, no claims beyond evidence. Numbers must come from evidence docs.
- Keep it under ~350 lines.

## Output
Write the draft to `docs/README-draft.md` (do not overwrite README.md). In your final message: the draft path, the commands you executed and their results, every claim you could not verify, and suggested tracks.

## Sources
PLAN.md, docs/CLAIMS.md, docs/DEPLOYMENTS.md, docs/EVIDENCE-*.md, contract/USAGE.md, engine/MACHINE_FORMAT.md, specs/API-interface.md, app/package.json, app/ui-tests/, docs/design/screens/ (may reference screenshots by relative path).
