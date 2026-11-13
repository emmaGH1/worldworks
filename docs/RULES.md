# WORLDWORKS rules

Build a money machine that meets a person's goals. Test it locally, improve it, then optionally publish it as a NEAR testnet payment app. All money is test money.

## Turn and progression

1. Read the job's goal and parts budget. The tray is your available inventory.
2. Drag a part onto a socket, or tap a part and then a socket. Tap a placed part to configure it. Removing a part returns its subtree to the tray.
3. Press **Test**. Three simulated customers run through the browser's shared Rust/WASM engine. Requirement pills reveal amounts and pass/fail results. A failure explains what went wrong; change the build and try again.
4. Passing saves the build and awards stars. Jobs unlock in order; Your shop unlocks after job 1. You do not need to Ship to solve a job or see it in the factory.
5. **Ship** is optional and real in live mode: create/reuse a sponsored NEAR testnet account, publish the graph and submit a seeded-customer order. Watch the actual status and inspect receipt links. A pending order or signature is not a payment.
6. Open the machine's `/m/<id>` app, share the URL, or return to **Factory** to edit saved builds and open the next plot. Paying in a live standalone app sends another testnet order.

The short loop is build → Test → inspect → change. A longer loop is solve → improve stars → optionally Ship. A session builds a saved factory and a shareable shop. The ⏩ 4× toggle accelerates simulated customers, coins and Test pacing only. It is disabled during unresolved live runs; real transactions run at network speed. Hover or touch-hold parts, belts, people and requirement pills to inspect money routing and exact preview amounts.

## Parts

| Part | Rules |
|---|---|
| Coin Slot | Fixed source for the sale. In the game the price is 0.10 NEAR. The contract requires exactly the price plus its separate order-storage fee. Only the price flows through the machine. |
| Splitter | Divide the incoming NEAR between connected outputs. Game dials use 5% steps; shares must sum to 100%. The root can have two or three outputs; deeper Splitters have two. Chain Splitters for ratios a single dial cannot express. |
| Vault | Keep inflow as a machine-owner balance. It is not paid to a character automatically; owner withdrawal is a separate contract action. A Vault fails goals that require every coin to be paid out. |
| Gate | In the game, hold inflow for delivery approval. Connect both delivered and time-up exits. The lower-level engine also supports a minimum-amount condition. |
| Worker, shown as Key | A permission to approve its bound Gate, not a money destination or autonomous AI. The puzzle's customer role holds the Key in job 4; in live demo execution the shop-building player's account holds the actual scoped key. |
| Payout | Request a NEAR transfer to the chosen account. The customer refund uses the order's payer. Requested, unknown, failed and sent are different states. |
| Portal | Request a fixed Sepolia ETH amount for the order's Ethereum recipient. NEAR inflow pays the contract fee; it is not converted to ETH. ETH comes from a separately funded, shared Portal treasury. |

The editor builds a tree with root plus two deeper levels; deepest sockets take sinks (Payout, Vault or Portal). The lower-level machine format supports broader acyclic graphs. Graphs must have connected outputs, reachable nodes and valid roles; cycles are invalid. Money cannot flow into a Worker or back into the Coin Slot.

Splitter arithmetic is integer arithmetic: each share rounds down, then all remaining yoctoNEAR goes to the first output. Port order matters. NEAR amounts and ETH amounts are different units and must not be added together.

## Jobs and winning

| Job | Passing goal | Scoring |
|---|---|---|
| 1. Ada's bakery | Ada gets three times each helper; Bola and Chi get equal, positive shares. Every coin is paid out. | Three stars with at most four parts; two with one extra; otherwise one. |
| 2. Ada steps back | Ada gets half; Bola gets three times Chi; every coin is paid out. | Three stars with at most five parts; two with one extra; otherwise one. |
| 3. Chi moved abroad | Chi receives at least 0.0005 Sepolia ETH and no NEAR; Bola receives 20%; Ada gets the remaining NEAR after the Portal fee. | Three stars for exactly the required Portal fee, two for at most 0.001 NEAR extra, otherwise one. Extra fee stays in the contract. |
| 4. Dayo delivers | Ada gets 80%; Dayo's 20% is paid only after delivery. If delivery never happens, that share goes to the customer. The customer role has the Key. | Three stars if Ada is paid immediately; two if Ada also waits for delivery. |
| Your shop | You get a positive NEAR share; every added friend receives something; no money is retained or lost. Up to two friends, at most one Ethereum friend. | A passing shop gets three stars. |

A correct job-1 example is 60/20/20. Job 2 can use 50/50 with the second branch split 75/25. These are solutions, not changes to the goals. A valid machine can still fail a job: a refund exit leading to a Vault is legal graph structure but does not refund the customer.

Test checks approval and non-delivery alternatives locally; it does not wait for chain expiry or request a real signature. Its Portal animation is simulated. The contract additionally enforces Portal fees and admission limits; a passing local Test is not a guarantee that live Ship will succeed.

## Real actions and failure states

- Build and Test do not need a wallet or sponsored session. In live mode Ship/Pay uses browser-generated keys and a server-sponsored account with 4.5 test NEAR. The sponsor is finite and may be unavailable. Mock mode simulates all of these actions and labels them MOCK.
- Publishing recommends 0.40 NEAR; unused storage deposit is refunded. Each order retains a 1.32 NEAR storage fee, separate from the price and transaction gas. Expiry does not refund this storage fee.
- Approval releases held money through the delivered exit. After the published block deadline, anyone may call expiry to use the time-up exit. This needs a transaction; it does not happen automatically. A graph's fail exit determines whether a recipient actually gets a refund.
- Portal payouts share a treasury, nonce queue and epoch budget. An earlier stuck payout can delay later ones. A signature or broadcast hash is not confirmation. The app reports inclusion after matching successful transaction/receipt checks at two independent Sepolia RPC hosts and at least three blocks on top at both; this is not Ethereum finality.
- Portal uses exactly 21,000 gas. Observed fresh Sepolia addresses need more; the game and standalone preflight refuse them. RPC estimation errors also stop a new submission. Arbitrary EVM contract calls are unsupported.
- The payer supplies the Ethereum recipient. A shop link's `?to=` only suggests it; it is not fixed in the graph. Friend display names are saved locally for the owner, not published for shared visitors.
- After an ambiguous network response, check the saved order/status before retrying. The app preserves order intent and supports checking or explicit same-ID resend for stalled orders. Ambiguous approval has no resend action and can remain checking without an authoritative resolution. Missing transfer evidence must remain unknown.

## Factory rules

Solved saved builds appear as factory plots. Their miniature parts and moving coins illustrate routing. While the overview is visible, simulated purchases advance **Sim** totals using WASM previews. They never create chain orders, receipts or sponsored accounts. Sim amounts persist locally; the purchase count is for this overview visit. The stream pauses outside the overview or in a hidden tab. Gate simulation uses the delivered branch; refund testing remains separate.

**Real** totals are separate: only non-mock, confirmed receipts for machines in the current saved factory scope count, and NEAR transfers must be marked settled. Unknown, requested and failed transfers are excluded. Account balance changes may include unrelated activity; they are observations, not proof that the factory produced those funds.

## Sources

Rules checked against `app/src/game/jobs/jobs.ts` (jobs, scoring, compiler and Test), `JobsGame.tsx` (progression and live flow), `factory.ts` / `FactoryView.tsx` (Sim/Real separation), [machine format](../engine/MACHINE_FORMAT.md), [contract interface](../contract/USAGE.md), and [GAME-3](EVIDENCE-game3.md), [GAME-4](EVIDENCE-game4.md), [GAME-5](EVIDENCE-game5.md), [GAME-6 evidence](EVIDENCE-game6.md). See [CLAIMS](CLAIMS.md) for evidence locations and verification limits.
