# WORLDWORKS: X post drafts

Drafts only. **The user posts**; the post link becomes the submission's `demoUrl`. Pick one of the three versions below.

Rules every version follows:

- Official guidance ("The demo post"): the first line is the user problem; one complete moment (drag → customer pays → Portal confirms → receipt on Sepolia); NEAR's role stated concretely (the contract builds the Ethereum transfer, NEAR Chain Signatures signs it); a next step (try link, repo, a real question). Says "Built at NEAR HACKATHON", tags **@NEARProtocol** and **#NEARHackathon** in the first post; optional **@NearBuilders** / **@NearLegion** in the last.
- [docs/CLAIMS.md](../CLAIMS.md) (G6 version): no immutability, no "audited", no production or mainnet safety, no finality, no "trustless", no claim that the epoch budget caps total spend, no "confirmed payment" from a signature. Inclusion is described as on-chain receipts you can check yourself.
- Character counts are X-weighted (each link counts as 23). All posts are ≤ 280.

**Placeholders to fill before posting**

| Placeholder | Source |
|---|---|
| `{{HOSTED_URL}}` | hosted app (must stay up until at least 2026-11-18) |
| `{{REPO_URL}}` | public GitHub repo (must be public before 2026-11-14 23:59 UTC) |
| `https://testnet.near.rocks/tx/Gah48XxvFzjks1uDVrN5Poi3DYMc8XPp7KzRyL4csGBe` | `links.near` in the recording's `marks.json` (the order shown in the video). Fallback: [order for payout 0](https://explorer.testnet.near.org/transactions/5gVpK4eFaaFFfmEJsj1UWb3oEWmGVjLmXBqzysiPkQJN) |
| `https://eth-sepolia.blockscout.com/tx/0xe1037289c605bd67737874942182d66a755ea3b1c74aaa601e818f46614f5eb5` | `links.sepolia` in `marks.json`. Fallback: [payout 0 receipt](https://sepolia.etherscan.io/tx/0xbf2a7ae14ef28044ce775f9c18ed0c6294ffe916aac1f84653253b51f9d0a3e6) |

Use the links from the video's own take if you can, so a judge who clicks sees the same transaction the video shows. **Check the numbers** (0.10 NEAR price, 70/30 split, 0.07/0.03, 0.001 ETH) against that take; G6 changed the fee configuration, and the numbers in the posts must match the screen.

**Media:** attach the **15 s cut** to post 1 (it autoplays muted, captions carry it) and the **76 s main cut** to post 2. Or attach only the 76 s cut to post 1; its first 3.5 s (title card) still works muted.

---

## Version A: "Where does your money go?" (general audience) — recommended

**1/ (251)** — attach video
```
When an app takes your money, the rules for where it goes are hidden in code. You can't see them.

WORLDWORKS shows them. Wire a money machine, run it on NEAR testnet, watch it pay out on Ethereum.

Built at NEAR HACKATHON @NEARProtocol #NEARHackathon
```

**2/ (245)**
```
In the video: the Lemonade machine pays every coin straight out. I drop a Splitter on the pipe. A seeded test customer pays 0.10 NEAR (+ a storage fee). 0.07 stays in a reserve on chain; 0.03 pays for 0.001 Sepolia ETH to the customer's address.
```

**3/ (229)**
```
NEAR does the cross-chain part. Our NEAR contract writes the Ethereum transaction itself (fixed chain, amount, nonce, gas) and asks NEAR Chain Signatures to sign it. The relayer only broadcasts the signed bytes. It holds no keys.
```

**4/ (226)**
```
Don't take the UI's word for it.
NEAR order: https://testnet.near.rocks/tx/Gah48XxvFzjks1uDVrN5Poi3DYMc8XPp7KzRyL4csGBe
Sepolia receipt: https://eth-sepolia.blockscout.com/tx/0xe1037289c605bd67737874942182d66a755ea3b1c74aaa601e818f46614f5eb5

Testnet prototype, not audited. The customer is seeded. What is real and what is simulated: {{HOSTED_URL}}/verify
```

**5/ (178)**
```
Try it, no wallet needed (testnet): {{HOSTED_URL}}
Code: {{REPO_URL}}

What payment rule would you wire first? I'd love to hear it.

@NearBuilders @NearLegion
```

---

## Version B: "A game where the money is real" (games / builders)

**1/ (273)** — attach video
```
Splits, reserves, payouts: most payment logic sits in code nobody reads.

I built a toy factory where you wire it instead. Drop a Splitter, a customer pays, and the machine runs on NEAR testnet and pays out on Ethereum.

Built at NEAR HACKATHON @NEARProtocol #NEARHackathon
```

**2/ (248)**
```
One moment from the video: the machine is losing money. One drag fixes it. The next sale keeps 70% in an on-chain reserve and sends 0.001 Sepolia ETH to the customer's Ethereum address. Then "Open as app" turns the same machine into a payment page.
```

**3/ (212)**
```
What NEAR does here: the NEAR contract builds the Sepolia transfer and NEAR Chain Signatures signs it for an address derived from that contract. No Ethereum key on our relayer; it checks the bytes and broadcasts.
```

**4/ (201)**
```
Check both chains yourself:
https://testnet.near.rocks/tx/Gah48XxvFzjks1uDVrN5Poi3DYMc8XPp7KzRyL4csGBe
https://eth-sepolia.blockscout.com/tx/0xe1037289c605bd67737874942182d66a755ea3b1c74aaa601e818f46614f5eb5

It's a testnet prototype, not audited. Customer demand is seeded. The /verify page lists what is real and what is simulated.
```

**5/ (165)**
```
Play it (testnet, no wallet): {{HOSTED_URL}}
Repo: {{REPO_URL}}

Builders: what would you put between the Coin Slot and the Portal? @NearBuilders
```

---

## Version C: "No Ethereum key on the server" (developer audience)

**1/ (269)** — attach video
```
Paying out on Ethereum from an app usually means a server holds an Ethereum key.

In WORLDWORKS a NEAR contract writes the transfer, NEAR Chain Signatures signs it, and the relayer holds no keys. You wire the rules.

Built at NEAR HACKATHON @NEARProtocol #NEARHackathon
```

**2/ (244)**
```
The video is one live run on NEAR testnet: I fix a broken Lemonade machine with a Splitter, a seeded customer buys, and 0.001 Sepolia ETH is sent to the customer's address. The Portal card shows each step: signing, signed, broadcast, confirmed.
```

**3/ (220)**
```
"Confirmed" only appears once two separate Sepolia RPCs return the same successful receipt, three blocks deep. A signature alone never counts.

NEAR order: https://testnet.near.rocks/tx/Gah48XxvFzjks1uDVrN5Poi3DYMc8XPp7KzRyL4csGBe
Sepolia receipt: https://eth-sepolia.blockscout.com/tx/0xe1037289c605bd67737874942182d66a755ea3b1c74aaa601e818f46614f5eb5
```

**4/ (278)**
```
"Open as app" gives the same machine its own payment page at /m/<id>, on the same contract.

Testnet prototype, not audited; the customer is seeded.
Try it: {{HOSTED_URL}}
Code: {{REPO_URL}}

Which rule should the next part enforce? @NearBuilders @NearLegion
```

Version C's hook ("usually means a server holds an Ethereum key") is a general statement about common practice, not a measured claim. If you'd rather not make it, use A or B.

---

## Claims check (all versions)

| Phrase | Basis |
|---|---|
| "runs on NEAR testnet", "testnet prototype" | CLAIMS: testnet prototype using Chain Signatures and a keyless relayer. |
| "contract writes/builds the Ethereum transaction (fixed chain, amount, nonce, gas)" | CLAIMS: contract-built Sepolia native transfers, fixed chain, recipient/value, 21,000 gas, allocated nonce. |
| "relayer only broadcasts … holds no keys" / "no Ethereum key on our relayer" | CLAIMS: keyless relayer checks unsigned bytes and recovered sender. Not "trustless" (it assumes authentic NEAR RPC responses). The NEAR sponsor and customer services do hold NEAR keys, so no post says "no keys anywhere". |
| "address derived from that contract" | EVIDENCE-sepolia: treasury derived for `ww-portal-261112.testnet`. It is one shared treasury, so no post says "each machine has its own wallet". |
| "Confirmed … two RPCs … three blocks deep" | G6 CLAIMS: inclusion reported only after matching receipts on two RPC hosts and three more blocks on both. No "final" or "finality". |
| "its own payment page at /m/<id>" | README: "own address" means a machine ID and URL. |
| "no wallet needed" | Sponsored browser session on testnet (README "How NEAR is used"). |
| "not audited", "customer is seeded" | Stated plainly, as CLAIMS and README require. |

Do not add in replies: immutable, no admin can move funds, audited, secure, production or mainnet ready, finality, trustless, guaranteed refund or inclusion, AI customer or agent, lifetime or total spending cap, "the epoch budget caps total spend".

---

## Video alt text

**76 s main cut** (paste into X's "Add description", ≤ 1,000 chars):

> Screen recording of WORLDWORKS, a browser game on NEAR testnet. A title reads "Payment rules hide inside app code." A cartoon Lemonade Machine shows a red BROKE stamp: a Coin Slot is piped straight to a purple Portal, and the caption says every coin goes straight out. A cursor drags a Splitter part onto the pipe; the stamp turns to RUNNING and the headline says it now keeps 70% of every sale. A seeded test customer pays; a reserve vault shows 0.07 NEAR on chain. A side card, sped up with an on-screen speed label, steps through Signing on NEAR, Signed, Broadcast to Sepolia and Confirmed. The real NEAR testnet explorer and Sepolia Etherscan pages follow, showing status Success. A ledger lists each transaction with explorer links. "Open as app" opens the same machine as a standalone payment page, which takes a payment too. The end card shows the try-it link, the code link and "Built at NEAR HACKATHON, testnet prototype".

**15 s autoplay cut:**

> Fifteen-second clip of WORLDWORKS on NEAR testnet. A cartoon Lemonade Machine stamped BROKE loses every coin. A cursor drops a Splitter on its pipe and it turns to RUNNING, keeping 70% in a reserve. A customer pays; a card, sped up with an on-screen label, steps from Signing on NEAR to Confirmed. The Sepolia Etherscan page shows status Success. The same machine opens as its own payment page, ending on the WORLDWORKS link.

---

## Generated images

**None needed.** The guidance asks for the product in action, and the live screenshots (`docs/design/screens/live-*.png`) and the recording's stills (`still-confirmed.png`, `still-app-paid.png`, `still-sepolia.png`) show real things. A generated picture would be the least credible image in the thread.

Optional, only if the user wants a static image for a reply or a profile banner (ChatGPT image generation; do not use it as product proof):

> **Request:** A wide 1600×900 illustration in a flat, rounded "toy factory" style on a warm cream background (#F4EEE3). Left: a chubby orange coin-slot robot with a smiling face. A thick dark-navy pipe (#36314D) runs right into a teal splitter robot with a dial face, which splits the pipe into two: one branch goes down into a grey-blue vault robot, the other goes right into a periwinkle (#9797FF) round portal robot with a swirl window. Small golden coins travel along the pipes. Chunky shapes, soft 6px bottom shadows, no gradients, no text, no logos, no real brand marks. Leave the top-left third empty for a headline.
