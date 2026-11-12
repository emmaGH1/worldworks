# WORLDWORKS — build plan

Working title; name not yet checked for conflicts. Chosen 2026-11-12 ~20:50 UTC after nine ideation rounds (see HACKATHON.md).

## One line
Factorio for programmable money: build money machines in a game world, then open them as real apps that run outside the game.

## Judge's first 60 seconds
1. 0-10s: a cheerful machine is losing money; every customer gets paid out, nothing refills the reserve.
2. 10-25s: drag a Splitter onto the wire; the flow animation shows where coins now go.
3. 25-45s: an AI customer buys; real testnet balances move; the cross-chain payout shows as pending, then confirmed.
4. 45-60s: click "Open as app"; the same machine works as a standalone payment page with its own address.

## Components (the whole vocabulary for v1)
| Piece | Does | Real on chain |
|---|---|---|
| Coin Slot | takes a payment in testnet NEAR | yes |
| Splitter | divides a flow by percentages | yes |
| Vault | holds a reserve | yes |
| Gate | passes only if a rule holds (minimum amount, or a Worker approved) | yes |
| Worker | a crew member holding a NEAR key that can do one thing (approve) | yes, a scoped function-call key |
| Payout | pays a NEAR account | yes |
| Portal | pays out on another chain (Sepolia ETH) via Chain Signatures, bounded amount | yes, if gate 2 passes |

## Architecture
- One NEAR testnet contract (factory + interpreter). Each published machine is stored as a validated graph and gets its own address (sub-account, if gate testing confirms it is cheap enough).
- The contract runs the graph deterministically; invalid graphs (unfunded output, loops, duplicate execution) are rejected at publish time.
- Portal: the contract builds a constrained Sepolia transaction (fixed recipient rules, amount cap, nonce) and asks the Chain Signatures signer (v1.signer-prod.testnet) to sign it; a relayer only broadcasts. No server-held ETH key.
- AI customer: a small script with its own testnet account that buys from machines; labeled as a seeded customer.
- Machine spec as JSON + a one-page "how to call this machine" so any coding agent or the AI screener can use it without the game.

## Screens
1. Workshop: 2D/isometric toy-factory canvas; parts palette on the left; drag, wire, watch coins flow as particles; customers walk in from the side.
2. Ledger drawer: live balances, every transaction with explorer links (NEAR and Sepolia), honest pending/failed states.
3. Open as app: /m/<machine> standalone page with the machine's rules in plain words and a pay button. Plus the JSON spec.
4. Landing: starts directly in the broken machine; no wallet, no sign-up (browser key, sponsored testnet gas).

## Real vs simulated
Real: machine rules, contract execution, testnet balances, scoped worker keys, cross-chain testnet payout, standalone app.
Simulated and labeled: customer demand (seeded AI customer), story, all money is testnet.

## Timeline (UTC). Deadline 2026-11-14 23:59; internal finish 18:00
| When | Phase | Done means |
|---|---|---|
| Nov 12 night (3h) | Gates | G1: two different machines from one parts set, rewiring changes outcomes, bad graphs rejected (local). G2: one live Chain Signatures payout on Sepolia from a contract rule, duplicate rejected. G3: a fresh agent calls the machine without the UI. |
| Nov 13 morning | Contract | All seven parts, publish/validate/run, tests incl. cheating attempts |
| Nov 13 afternoon | Workshop UI | Drag/wire/run with coin animation; broken-machine opening |
| Nov 13 evening | App + customer | Open as app page, JSON spec, AI customer, ledger drawer |
| Nov 14 morning | Hardening | Clean-machine reproduction, fallbacks if RPC/relayer down, hosting, README as "do X, see Y" |
| Nov 14 afternoon | Ship | Demo video, X post draft (user posts), submission payload shown to user, submit by 18:00 |

## Kill switches
- G1 fails (it is just a form): stop; rethink before building UI.
- G2 fails (signer unavailable or too slow): keep NEAR-only machines; drop the cross-chain claim; never fake it.
- G3 fails (machine only works inside the game): fix before any polish.

## Needed from the user
- Approval to create and fund testnet accounts and send testnet transactions (free).
- Hours available on Nov 13 and Nov 14.
- Later: mainnet payout account, X post, submission confirmation, final name.

## Tracks (decide at submission)
Open (primary); Games and Agents only if the delivered build honestly fits.
