# G2b Chain Signatures evidence — NOT DONE

2026-11-12 UTC. Scope: probes/chainsig/, this report, and DEPLOYMENTS.md.
No commit or push. Existing contract/ and engine/ work was not modified by this agent.

## Result

Live NEAR contract-built EIP-1559 transactions obtained three genuine MPC
signatures. All three signed transactions recover the contract-derived address.
The relayer verifies exact unsigned bytes/hash and rejects field tampering.
Duplicate-ID and over-cap transactions are rejected on chain without signer calls.
**No EVM payment was confirmed. Gate 2 does not pass.**

## Accounts and setup

- Contract/owner: [ww-chainsig-261112.testnet](https://testnet.nearblocks.io/address/ww-chainsig-261112.testnet).
- [Account creation](https://explorer.testnet.near.org/transactions/G7Gk1agRNahi8rqmxCoDUdMp977zskBiPjAgQA7UA1Ck).
- [Deployment/init](https://explorer.testnet.near.org/transactions/83rajaWoeyKfMSSEqHt4RphBB7QEwDb5oUw8Q3SrJ9aD), fee 0.0012405160770988 NEAR.
- Signer [v1.signer-prod.testnet](https://testnet.nearblocks.io/address/v1.signer-prod.testnet), version 3.18.0; path `worldworks/sepolia/v1`, ECDSA domain 0.
- Derived address: [0x3BeF4f8A2eeEB1B9FaD8ba9ED44C23497F0CF9Ce](https://sepolia.etherscan.io/address/0x3BeF4f8A2eeEB1B9FaD8ba9ED44C23497F0CF9Ce).
- Target: Ethereum Sepolia 11155111. Recipient [0x000000000000000000000000000000000000dEaD](https://sepolia.etherscan.io/address/0x000000000000000000000000000000000000dEaD), each value 1 wei.
- Fixed amount cap 100000000000000 wei, fee cap 20 gwei, priority fee 1 gwei, gas 21000, empty data and access list.

## Live signing transactions and costs

Explorer fragments identify signer execution receipt IDs inside the parent transaction.
Raw `EXPERIMENTAL_tx_status`/`tx` evidence includes each executor, status, logs,
receipt ID, and signature. Gas cost sums `tokens_burnt` across transaction and
all receipt outcomes. Each successful request also transfers 1 yoctoNEAR to
the signer (0.000000000000000000000001 NEAR); it is additional to gas.
Storage stake is retained on the contract and is not included as a burned fee.

- **run-1**, nonce 0: [pay transaction](https://explorer.testnet.near.org/transactions/DoCLooJoix1v3N1DZnwe9x1RfDT2C6fy1Z8rv2kpFNdZ); gas **0.00126496618858 NEAR**. [sign call](https://explorer.testnet.near.org/transactions/DoCLooJoix1v3N1DZnwe9x1RfDT2C6fy1Z8rv2kpFNdZ#Fmc7yUfeSXzggcV3mN8AmmQPoNotGzPRx4mmneHdjPJX), [signer return](https://explorer.testnet.near.org/transactions/DoCLooJoix1v3N1DZnwe9x1RfDT2C6fy1Z8rv2kpFNdZ#9EE69FCbXYvi7BXYUnD3J4LtvoK8Xt7kNZg8aBjMZKxq). Evidence: `run-1-tx.json`, `run-1-verified.json`.
- **run-2**, nonce 1: [pay transaction](https://explorer.testnet.near.org/transactions/AxQNJyLpWm9Ksj7HA6h3e9JgaZzXDVdQVjfzc2VZegix); gas **0.001261301526517 NEAR**. [sign call](https://explorer.testnet.near.org/transactions/AxQNJyLpWm9Ksj7HA6h3e9JgaZzXDVdQVjfzc2VZegix#5uGzvepDF8VkGbVNs7ifmYAVfiPQTYvA9f7W1hg9DqDs), [signer return](https://explorer.testnet.near.org/transactions/AxQNJyLpWm9Ksj7HA6h3e9JgaZzXDVdQVjfzc2VZegix#6KK77SJaWsH6n3Hh21DMhWCxC8bCU8feUKbvjD8h15xK). Evidence: `run-2-success-tx.json`, `run-2-verified.json`.
- **run-3**, nonce 2: [pay transaction](https://explorer.testnet.near.org/transactions/ATn2n9tTsMfMLxmjJ5Kh9WTgz75y7S1puowsqKaf8DdR); gas **0.0012666954211285 NEAR**. [sign call](https://explorer.testnet.near.org/transactions/ATn2n9tTsMfMLxmjJ5Kh9WTgz75y7S1puowsqKaf8DdR#EoebkayaM7tqbifoXHF5YGFNRqxiEzcFpS9tnLfwt1CT), [signer return](https://explorer.testnet.near.org/transactions/ATn2n9tTsMfMLxmjJ5Kh9WTgz75y7S1puowsqKaf8DdR#BdxY7Lf2rEvr8sV4XVudjKSdCPwC18ZK8NXfzbsdLzTw). Evidence: `run-3-1-tx.json`, `run-3-verified.json`.

## Latencies (two measured runs)

| Run | CLI invoked UTC | NEAR call returned | Signature view observed | Invocation → return | Invocation → signature view | EVM receipt / end-to-end |
|---|---|---|---|---|---|---|
| run-2 | 2026-11-12T21:51:59.425Z | 2026-11-12T21:52:07.164Z | 2026-11-12T21:52:13.743Z | 7.739 s | 14.318 s | unavailable, unfunded |
| run-3 | 2026-11-12T21:52:29.503Z | 2026-11-12T21:52:37.697Z | 2026-11-12T21:52:44.408Z | 8.194 s | 14.905 s | unavailable, unfunded |

These wall times start immediately before spawning the near CLI and include
local preparation, signing, submission, NEAR finality, a transaction-status
query and final view. They are conservative observation bounds, not isolated
MPC service latency. No precise network-submission timestamp was captured.
Run 1 was exploratory and has no measured local submission timestamp.

## Rejection checks (live output)

[duplicate payout id transaction](https://explorer.testnet.near.org/transactions/zNudfiXK2G6ERX2aXbmvLfxqUeodA4s3E3NCZ2u7KzQ):

```text
Smart contract panicked: panicked at src/lib.rs:57:9:
duplicate payout id
```

No signer receipts were created. Raw output and RPC response: `probes/chainsig/evidence/duplicate-tx.json`.

[amount exceeds cap or is zero transaction](https://explorer.testnet.near.org/transactions/CVCCM6zBzgL6CX1AaHU65E7HZV9HQRCKuLP9s5yJu6yY):

```text
Smart contract panicked: panicked at src/lib.rs:58:9:
amount exceeds cap or is zero
```

No signer receipts were created. Raw output and RPC response: `probes/chainsig/evidence/above-cap-100000000000001-tx.json`.

## Funding / broadcast output

`npm run derive` returned:

```json
{"account":"ww-chainsig-261112.testnet","path":"worldworks/sepolia/v1","address":"0x3BeF4f8A2eeEB1B9FaD8ba9ED44C23497F0CF9Ce","balance":"0","chainId":11155111}
```

`npm run relay -- run-1` assembled the real signature, recovered the derived
address, verified the chain, and attempted broadcast. RPC rejected it:

```text
insufficient funds for gas * price + value: have 0 want 420000000000001
```

See `probes/chainsig/evidence/broadcast-attempt.log`. No explorer transaction
link is claimed for a broadcast rejected before acceptance.

## Verification commands and output

```sh
CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target \
  ~/.cargo/bin/cargo-near near build non-reproducible-wasm \
  --manifest-path probes/chainsig/Cargo.toml --no-abi --out-dir /opt/ww-target/chainsig
# Finished release profile; contract built successfully (evidence/build.log)
cd probes/chainsig/relayer
npm run check
# tsc --noEmit, exit 0
npm test
# tests 8; pass 8; fail 0
npm audit
# found 0 vulnerabilities
```

Source contains no EVM private-key imports, wallet creation, key derivation,
or signing calls in the relayer. `recoverTransactionAddress` verifies a public
MPC signature; it does not sign. The separate measurement driver authorizes
NEAR calls through the CLI's external keychain. Tests use a public live
signature fixture; signatures and signed transactions are not credentials.

Secret scan (source/evidence, excluding dependencies/locks):

```sh
rg -n 'private_key|secret_key|seed_phrase|BEGIN.*PRIVATE' probes/chainsig \
  --glob '!node_modules/**' --glob '!package-lock.json' --glob '!Cargo.lock'
# no matches; exit 1
```

## NEEDS USER

Fund **Sepolia** address **0x3BeF4f8A2eeEB1B9FaD8ba9ED44C23497F0CF9Ce**
with approximately 0.003 test ETH (three reserved transfers have a combined
maximum gas+value cost 0.001260000000000003 ETH). Exact faucet options checked:

- https://cloud.google.com/application/web3/faucet/ethereum/sepolia — requires Google sign-in. Stopped before login.
- https://sepolia-faucet.pk910.de/ — live config requires custom CAPTCHA at session start; stopped before challenge. Raw config saved in `evidence/pow-faucet-config.json` (`modules.captcha.requiredForStart: true`).
- https://faucet.zalalena.com/base — Base Sepolia alternative requires CAPTCHA and reports all networks offline for maintenance. Did not switch deployment to that chain.
- https://www.ethereum-ecosystem.com/faucets/base-sepolia — returned HTTP 402; unavailable.

The faucet check is limited to these options; it does not establish that every
EVM testnet faucet requires a human. No login or CAPTCHA was bypassed.

## Not done / limitations

1. Funding the derived address: blocked on the checked faucet requirements.
2. Confirmed EVM payout / explorer transaction link: not done; broadcast rejected for zero balance.
3. Two complete NEAR-submission → signature → EVM-receipt latency measurements: not done. Two signing observation bounds above are real; receipt times are unavailable.
4. Gate 2 remains NOT DONE. Relayer broadcast/receipt success is implemented but not verified with a funded live transfer.
5. This probe is owner-only and isolated; no integration with the concurrent production contract or engine was attempted.
6. Failed signing reserves a nonce permanently; recovery would require a fresh deployment/path. All three current signatures succeeded; relay them in nonce order.

Resume commands are in `probes/chainsig/README.md`. After funding, relay run-1,
run-2, run-3 in order, then use `measure.ts UNIQUE_ID 1 --relay` for two fresh
fully timed runs. Save outputs and update this report before calling G2 done.

## Final repository status

`git status --short` (concurrent agents own the contract/engine/plan/status changes):

```text
 M PLAN.md
 M STATUS.md
 M contract/Cargo.lock
 M contract/src/lib.rs
 M engine/Cargo.lock
 M engine/Cargo.toml
 M engine/examples/vending.json
 M engine/src/lib.rs
 M engine/tests/engine.rs
?? docs/DEPLOYMENTS.md
?? docs/EVIDENCE-chainsig.md
?? engine/tests/cost.rs
?? probes/
```

Detailed allowed-path file listing is saved in `probes/chainsig/evidence/scoped-status.txt`; no key or credential files are present. `node_modules/` is ignored. No commits or pushes were made.
