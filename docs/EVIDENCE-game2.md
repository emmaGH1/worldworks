# GAME-2 evidence — puzzle jobs

Implementation sub-agent, shared checkout based on `adee73b`. No commits or pushes. No changes in `contract/` or `engine/`. Testnet only.

## Implementation

Retained the WIP socket compiler, three job definitions, WASM preview tests, quiet Three.js island and drag/tap build controls. Completed standalone people/avatars and bakery copy, real demo recipients, durable run acknowledgement, background payout completion, Close/reopen, job switching, read-only unknown approval recovery, manual payout Retry and queued predecessor copy. Completion/progress is scoped to API mode and contract. A simulation never writes a ledger row. Tests use exactly three customers, including failed builds. Wrong shares, wrong recipients, a Vault, a NEAR payout for Chi and the wrong Key holder are real choices that fail Test.

The Worker is called “Key” in the game. In job 3 the player acts for the customer using the session’s approve-only Worker key. The third simulated delivery never arrives; its share takes the Gate’s refund path. Live expiry is contract block based, not a browser timer.

`/m/:id` retains GAME-1 balance checks, durable order intent, unknown-outcome protection, route boundary and WebGL fallback. Job shops identify Ada and show each person with the same face and allocation. The order total and contract deposit remain visible under Payment details; no deposit is presented as bakery revenue.

## Engine and contract fit (checked before shipping)

All three compiled graphs validate and execute through the checked-in WASM. Three-way Splitter uses 6000/2000/2000 bps. Direct payouts use valid real implicit NEAR accounts. A NeedsApproval Gate references Worker `checker`, with distinct pass (Dayo) and fail (`$payer`) destinations. Both paths terminate; no trapped escrow. Worker bindings match exactly. The browser WASM exposes preview only, so the simulated post-approval/refund result is another WASM preview with the Gate condition resolved to pass/fail; it is explicitly simulated, not a contract approval.

Live `get_limits`: rate **1,000,000 yocto NEAR/wei**, per-payout cap **2,000,000,000,000,000 wei**, remaining epoch budget at initial check **10,000,000,000,000,000 wei**. Portal pays **100,000,000,000,000 wei (0.0001 ETH)**. Chi’s fee branch is **0.02 NEAR = 20,000,000,000,000,000,000,000 yocto**, above the required **100,000,000,000,000,000,000 yocto**. Price is **0.10 NEAR**. Contract deposit per order is **1.32 NEAR**; publish deposit **0.40 NEAR**. Runtime shipping checks refreshed Portal rate/cap/budget before publication. Contract source effect bounds allow this graph (two direct transfers and one Portal).

## Demo accounts

The sponsor cannot create sibling names under `.testnet`. One direct creation attempt failed with CreateAccountNotAllowed: [failed creation, funds refunded except gas](https://testnet.near.rocks/tx/5nsvGTcPAZd8ohDnenMgiE25yDUdNohEBSsWroj6JWu8). Used the spec’s permitted implicit accounts instead, each created by a **0.1 test NEAR** transfer from the sponsor. No recipient funding retry was needed.

| Person | Real NEAR implicit account | Funding transaction |
|---|---|---|
| Ada | `65c8bc5009157ffaa72a5160b0d56f4864c19e2214cc07f42c8f4205cfc7a4be` | [0.1 NEAR](https://testnet.near.rocks/tx/CpqBwyLdteD4JMzjnVDLWUmxg4CGLBqs3gbn1BY79HZU) |
| Bola | `c7aaf34cd0000ea3928cada72e5c0da7f137dd6253570653f679181d547f0c4b` | [0.1 NEAR](https://testnet.near.rocks/tx/BUgvWTBS7HEUHi7tyfMEstgAbdnhqZxC1wqWWzNRLNdt) |
| Chi | `e60155237987e0d17f00d19940bc0af331bc2014a4f49c2a6081194cf5b7fc24` | [0.1 NEAR](https://testnet.near.rocks/tx/AzCctFUW6HCZ5ybe1SsJ3Uvu114JG19J8Vi53ucpyWQx) |
| Dayo | `9de1cf2e633861aee8633e3801f32e6d0f663960fd4fe55d96aad246945698c2` | [0.1 NEAR](https://testnet.near.rocks/tx/C6DjnHwCTroLwubuJ8WLK8GS5vWTTnzcv6XYEFXBPT6H) |

Chi’s Sepolia wallet (demo): `0xE53AA3F186Dd3f580D2b6259bCa8aA86B10Eaeb2`. Verified that the key in `/opt/ww-secrets/chi-sepolia.json` derives this address; file mode `600`. Its private key was never printed or copied into the checkout. NEAR demo keys also remain only in `/opt/ww-secrets/`, mode `600`.

## Verification

- `npm run typecheck`: PASS.
- `npx tsc --noEmit -p api/tsconfig.json`: PASS.
- `node --import tsx --test scripts/*.test.ts`: **40/40 PASS**.
- Mock and pinned-live Vite production builds: PASS; existing bundle-size advisory remains.
- `UI_BASE=http://127.0.0.1:4253 node ui-tests/game2-fallback.mjs`: **PASS**, desktop and 390px normal taps, Gate/Key approval, **0 console errors**.
- Design detector: `[]` (no findings).
- Repository secret scan: PASS; also checked Chi’s EVM key and all four NEAR demo keys without printing values.
- `UI_BASE=http://127.0.0.1:4251 UI_ADVANCE=1 UI_SHOTS=1 node ui-tests/game2-mock.mjs`: **PASS**, all jobs 1–3 on desktop **1366×800** and phone **390×844**, **0 console errors**, **514.2 seconds**. Deliberate wrong split, wrong chain and wrong Key holder all fail with the expected message, then pass after the player fixes them. Includes real pointer drag on desktop, tap placement on phone, Close + job switching + reload during payout, completion only after API confirmation, three stars/live links, and named standalone checkout. The software-GPU automation uses the existing deterministic stepping hook; render resolution is reduced between captures and restored to full resolution for every still. No engine or API confirmation clock is advanced.
- `UI_BASE=http://127.0.0.1:4252 UI_ADVANCE=1 node ui-tests/game2-live.mjs`: **BLOCKED / FAIL**, one seeded-customer order, zero shipment retries. The transfer reverted; payout API intentionally fails closed with HTTP 502, producing **5 console errors**, then stops polling with manual Retry. No confirmed Chi receipt, gem, shipped completion or live-success claim. Live acceptance is **not** marked passed.
- Added and exercised a read-only `eth_estimateGas` preflight after that live finding. With the actual Chi wallet it rejects before another publish/order. Unit tests cover the 21,000-gas boundary, incompatible estimate and API failure. The final mock/live bundles include this guard; no second live sale was sent.

## Live job 2 — reproducible blocker

Exactly **one** job-2 shipment was attempted; **no retry**. Reused an existing funded session (no new 4.5 NEAR grant). NEAR publication and the 0.10 NEAR seeded sale succeeded. Ada’s direct payout is 0.06 NEAR; Bola’s is 0.02 NEAR. Final NEAR account reads verified Ada at **0.16 NEAR** and Bola at **0.12 NEAR** (each started with the recorded 0.10 NEAR funding), matching those direct payouts. The Portal consumes Chi’s 0.02 NEAR fee share but did **not** deliver the 0.0001 ETH.

| Action | Public receipt |
|---|---|
| Machine | `abroad-0c0cd2d4-c83a2d2141` |
| Publish | [NEAR publication](https://testnet.near.rocks/tx/EzD4FrsQZX8WX6dtSY2NyXepL6wqLK22CbEmrLn3fSeG) |
| One seeded sale; Ada/Bola payout effects | [NEAR order](https://testnet.near.rocks/tx/DBQHcRzFLPwbYFM6k9V2SbHg7LrcfNDP4G1z3nUMLAbb) |
| Portal payout 29, **REVERTED** | [Sepolia transaction](https://sepolia.etherscan.io/tx/0xb92bc7a5474a2edbff7c46310c5c8044ae394ca075ef88f2e15f94789546b55e) |

Order ID: `fa575ae3-d38c-4ae7-ae91-e1f27928bc85`. [Structured public evidence](game2-live.json).

Both independent RPCs return the same reverted receipt in block **12,125,310**, block hash `0x1fca1f2865a72f1abc28c2dbf6613158a299361e2aaf5ed9dd56705bc5819733`, observed **27 blocks deep**. Signed gas limit and gas used are both **21,000**. The two RPCs estimate **204,600** and **207,391** gas for that same value transfer now. Chi’s recipient has no code and zero balance. This supports a gas-limit failure; no protocol-change explanation is guessed from the estimate alone.

The hard-coded gas appears in `contract/src/portal.rs:243` / `:262` and the relay enforces it in `app/api/_portal.ts:36`. Fixing the signed gas policy would require work outside the authorized contract scope. Alternatively, the orchestrator can investigate initializing/funding this existing demo wallet independently and re-checking its gas estimate. I did neither, and did not substitute someone else’s wallet. The final game checks the live estimate before allowing another sale and displays:

> Chi’s Ethereum wallet needs more gas than this test contract allows. No sale was sent. The demo needs an initialized wallet or a contract update.

The original attempted shipment correctly stayed in an unconfirmed state. Its read failures are visible, with manual Retry; the global tracker stopped after five errors. Reverted transactions are never treated as paid. **Live job-2 acceptance and a real Portal-gem still remain blocked.** The Portal-gem stills listed below are explicitly MOCK.

## Stills

All files are in `docs/design/screens/`. The paired acceptance stills below are **MOCK**, not chain evidence.

| State | Desktop | 390px phone |
|---|---|---|
| Job card | [PNG](design/screens/g2-job-card-desktop.png) | [PNG](design/screens/g2-job-card-phone.png) |
| Build | [PNG](design/screens/g2-build-desktop.png) | [PNG](design/screens/g2-build-phone.png) |
| Test fail | [PNG](design/screens/g2-test-fail-desktop.png) | [PNG](design/screens/g2-test-fail-phone.png) |
| Test pass | [PNG](design/screens/g2-test-pass-desktop.png) | [PNG](design/screens/g2-test-pass-phone.png) |
| Mock shipment | [PNG](design/screens/g2-ship-desktop.png) | [PNG](design/screens/g2-ship-phone.png) |
| Mock Portal gem | [PNG](design/screens/g2-portal-gem-desktop.png) | [PNG](design/screens/g2-portal-gem-phone.png) |
| Standalone mock shop | [PNG](design/screens/g2-live-shop-desktop.png) | [PNG](design/screens/g2-live-shop-phone.png) |

Real run: [test passed before shipment](design/screens/g2-live-test-pass-desktop.png), [blocked payout screen](design/screens/g2-live-blocked-desktop.png). There is no successful real Portal-gem image.

## First 60 seconds: literal captured screen text

Automated, paced 390px walkthrough, using the 2D fallback (identical control copy) to remove software-GPU timing distortion. No shipping or spending. The canvas footer additionally reads `2D view · all controls work`. This is a hallway-test substitute, not a claim that five people participated. Each entry below is the complete rendered text at a change, sampled every 250 ms from intro readiness; unchanged text persists until the next entry. The intro entry records only the modal because the game behind it is obscured. [Raw transcript](game2-first60.json), reproducible with `ui-tests/game2-first60.mjs`.

**0.0 seconds**

```text
WORLDWORKS

Money that runs itself: solve a real person’s money problem with parts, then ship it as a real payment app on NEAR.

Start job 1
```

**8.3 seconds**

```text
+
splits the money
+
pays someone
+
pays someone
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Drag a part onto a glowing spot (or tap the part, then the spot).
◔
Splitter
splits money into shares
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**13.3 seconds**

```text
+
splits the money
+
pays someone
+
pays someone
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Now tap a glowing spot for the Splitter.
◔
Splitter
splits money into shares
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**15.3 seconds**

```text
◔
Splitter
40% · 30% · 30%
+
pays someone
+
pays someone
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Fill the glowing spot.
◔
Splitter
×

How much goes down each belt?

belt 1
−
40%
+
belt 2
−
30%
+
belt 3
−
30%
+

Total 100% ✓

Back to tray
Done
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**21.5 seconds**

```text
◔
Splitter
40% · 30% · 30%
+
pays someone
+
pays someone
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Drag a part onto a glowing spot (or tap the part, then the spot).
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**23.0 seconds**

```text
◔
Splitter
40% · 30% · 30%
+
pays someone
+
pays someone
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Now tap a glowing spot for the Payout.
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**24.0 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays… who?
+
pays someone
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Who does this Payout pay? Tap it and choose.
✉
Payout
×

Who gets paid?

Ada
Bola
Chi
Back to tray
Done
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**25.8 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
+
pays someone
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Drag a part onto a glowing spot (or tap the part, then the spot).
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**27.3 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
+
pays someone
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Now tap a glowing spot for the Payout.
✉
Payout
pays one person on NEAR
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**28.3 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays… who?
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Who does this Payout pay? Tap it and choose.
✉
Payout
×

Who gets paid?

Ada
Bola
Chi
Back to tray
Done
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**29.8 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Drag a part onto a glowing spot (or tap the part, then the spot).
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**31.3 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
+
pays someone
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Now tap a glowing spot for the Payout.
✉
Payout
pays one person on NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**32.5 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
✉
Payout
pays… who?
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Who does this Payout pay? Tap it and choose.
✉
Payout
×

Who gets paid?

Ada
Bola
Chi
Back to tray
Done
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**34.0 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
✉
Payout
pays Chi
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%
Everything is placed. Press Test to try it with 3 customers.
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**38.0 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
✉
Payout
pays Chi
Ada
Bola
Chi
Customer 1
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
SIMULATED
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
○
Ada gets 60%
○
Bola gets 20%
○
Chi gets 20%

Test · simulated in your browser by the same engine the contract runs. Not on any chain.

Customer 1 of 3 pays 0.10 NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**39.0 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
✉
Payout
pays Chi
Ada
Bola
Chi
Customer 1
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
SIMULATED
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
✗
Ada gets 60%
+0.04 NEAR
✗
Bola gets 20%
+0.03 NEAR
✗
Chi gets 20%
+0.03 NEAR

Test · simulated in your browser by the same engine the contract runs. Not on any chain.

Customer 1 of 3 pays 0.10 NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**39.3 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
✉
Payout
pays Chi
Ada
Bola
Chi
Customer 2
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
SIMULATED
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
✗
Ada gets 60%
+0.04 NEAR
✗
Bola gets 20%
+0.03 NEAR
✗
Chi gets 20%
+0.03 NEAR

Test · simulated in your browser by the same engine the contract runs. Not on any chain.

Customer 2 of 3 pays 0.10 NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**40.5 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
✉
Payout
pays Chi
Ada
Bola
Chi
Customer 3
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
SIMULATED
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
✗
Ada gets 60%
+0.04 NEAR
✗
Bola gets 20%
+0.03 NEAR
✗
Chi gets 20%
+0.03 NEAR

Test · simulated in your browser by the same engine the contract runs. Not on any chain.

Customer 3 of 3 pays 0.10 NEAR
▣
Vault
keeps money locked
Test
3 customers · simulated
```

**41.8 seconds**

```text
◔
Splitter
40% · 30% · 30%
✉
Payout
pays Ada
✉
Payout
pays Bola
✉
Payout
pays Chi
Ada
Bola
Chi
Ada's Bakery
Coin Slot · 0.10 NEAR a loaf
Job 1 of 3 ▾
MOCK DATA
≡
?
JOB 1 · Ada, baker, owns the shop
I pay my two helpers by hand every evening. Make my shop pay everyone automatically.
✗
Ada gets 60%
+0.04 NEAR
✗
Bola gets 20%
+0.03 NEAR
✗
Chi gets 20%
+0.03 NEAR

Test · simulated in your browser by the same engine the contract runs. Not on any chain.

✗ Ada got 40%, needs 60%.
▣
Vault
keeps money locked
Test
3 customers · simulated
```

Questions for five readers: “Whose problem are you solving?”, “What do the parts do?”, “What would you change after the failure?”, “Which action spends testnet money?”, “What can someone do with the shop link?” No participant results are invented.

## Limits / honest list

**Live job 2 is blocked by the observed gas mismatch above; its live suite has five HTTP-error console entries and is not an acceptance pass.** Job 4 (rent jar) is optional and not implemented. Jobs use fixed sockets rather than arbitrary graph wiring. Real job 3 shipment is not exercised under the one-live-job constraint. If an approval’s response is completely lost and the read API cannot reconstruct its historical direct payout effect, the UI retains a neutral unknown state and explorer link; it does not infer Dayo was paid or submit another approval. A reload during session/publication exposes a retryable error; an existing publication is checked and reused before a new sale. No deployment is performed, so local new shop links are not claimed to already exist on the production site.

## Live job 2 — PASS after recipient initialization (orchestrator, 2026-11-13)
Cause of the earlier revert: on current Sepolia a plain transfer to a never-used address estimated ~204,600 gas, while the Portal signs a fixed 21,000. Funding Chi's address once (0.1 Sepolia ETH from the project owner) brought the estimate to 21,000 (`0x5208`). The game's `eth_estimateGas` preflight still blocks sales to fresh addresses.

`UI_BASE=https://worldworks.vercel.app UI_ADVANCE=1 node ui-tests/game2-live.mjs` against **production**: **PASS**, exactly one seeded-customer order, 0 console errors.
- NEAR order: https://testnet.near.rocks/tx/HPPU7EhYDk28S7Lgt3gbPPQPJqNbdXakpzuh9PjLfHx4
- Payout 30 to Chi, confirmed by ethpandaops + tenderly at 3 blocks: https://sepolia.etherscan.io/tx/0x91771257110a6009650943f093da26de1e1031147f3e122547b52b78b49cc774
