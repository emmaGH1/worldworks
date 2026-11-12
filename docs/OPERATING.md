# How we build WORLDWORKS

Read PLAN.md first. Every task prompt starts with the North Star below, verbatim.

## North Star (paste into every task)
WORLDWORKS is "Factorio for programmable money": players wire parts (Coin Slot, Splitter, Vault, Gate, Worker, Payout, Portal) into money machines that really run on NEAR testnet, and any machine can be opened as a standalone app with its own address. The wow moment: a machine built in the game pays out on another chain (Chain Signatures) and then works outside the game. Everything real is real (contract rules, testnet balances, scoped keys, cross-chain testnet payout); everything simulated is labeled (AI customer, story, testnet money). Never fake a transaction, never claim what the code does not do.

## Roles
| Role | Model | Used for |
|---|---|---|
| Orchestrator | Claude Fable (this thread) | Plans, writes task specs, routes work, merges, keeps the North Star |
| Hard builder ("Sol") | GPT-6.1 Sol, high effort (Codex; Pi if Codex is out of quota) | Contract, engine, Chain Signatures, relayer, anything with money or security |
| Easy/medium builder ("Terra") | GPT-6.1 Terra, medium (Codex; Pi fallback) | Templates, scaffolding, UI wiring from finished designs, docs plumbing, scripts |
| Designer | Claude Opus 5.5, high | Visual direction, UI screens, motion, demo video, from the reference board. No Figma: Opus designs clickable HTML screens directly (decided 2026-11-12) |
| Code reviewer | Claude | Reviews every merged change against its spec |
| Completeness checker | GPT-6.1 Sol, high (a separate session from the builder) | Re-runs acceptance checks from clean; says DONE or NOT DONE with evidence |
| Deep auditor | GPT-6 Astra, medium | Only big or fundamental pieces: contract security, the cross-chain payout, the final end-to-end audit, README vs product |
| README | Astra drafts, Claude polishes, Astra re-audits against the running product | |

If a model hits its limit: same model on the other provider (Codex <-> Pi); if both are out, the next model down the table for that role. Never pause the build waiting for a quota.

## Task protocol (every build task)
1. Spec file in `specs/` with: goal, North Star, exact files to touch, acceptance checks written as commands with expected output, and "out of scope".
2. Builder implements, runs the checks, and reports evidence (command output), not claims.
3. Claude reviews the diff against the spec.
4. A fresh Sol session re-runs the acceptance checks from a clean state (Astra for big/fundamental tasks) and answers DONE / NOT DONE with the failing evidence.
5. Only then does the orchestrator mark it done in `STATUS.md`. "Probably works" is NOT DONE.

Twice (end of Nov 13, morning of Nov 14) Astra runs a drift audit: does what exists still match PLAN.md and the North Star; list anything claimed but missing.

## Space and paths
- Repo: this directory. Rust build output goes to `/opt/ww-target` (the /data disk has ~1.6 GB free).
- Never commit secrets; keys live in env files outside the repo.
- `research/` and the internal `HACKATHON.md` deliberation stay out of the public repo.

## User checkpoints (the only times the build waits for you)
User is in Nigeria (WAT = UTC+1). Deadline Nov 14 23:59 UTC = Nov 15 00:59 WAT. User has 20+ hours.
| # | When (WAT) | What you do | Time |
|---|---|---|---|
| CP0 | Done Nov 12 | Approvals: testnet yes, private GitHub repo yes (emmaGH1/worldworks), Vercel yes, Figma skipped, caches cleared | - |
| CP1 | Nov 13 ~09:00 | Pick one of three visual directions from the reference board | 15 min |
| CP-V | When asked | Log in to Vercel once so I can deploy | 5 min |
| CP2 | Nov 13 ~21:00 | Play the build for 10 minutes; list what feels wrong | 10 min |
| CP3 | Nov 14 ~14:00 | Approve the demo video and README | 20 min |
| CP4 | Nov 14 ~17:00 | Make repo public, post on X, confirm submission payload | 30 min |
Work never blocks on a checkpoint: the default choice is taken and you can override it.
