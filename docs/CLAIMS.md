# Claims after G6

Use [G6 evidence](EVIDENCE-g6.md) for current validation and deployment results.

May claim:
- Testnet prototype using NEAR Chain Signatures and a keyless relayer.
- Contract-built Sepolia native transfers: fixed chain, recipient/value, empty calldata, 21,000 gas, allocated nonce and snapshotted bounded fees.
- Retries preserve payload, bytes, recipient, value, fee and nonce; stale callbacks are ignored.
- Newly published graphs have bounded identifiers and effect counts. Exact splitter amounts are checked along all approval/expiry alternatives for Portal rate, payout and single-epoch reservation limits.
- Epoch spend reserves value plus 21,000 times snapshot max fee, and admits at most 20 payouts per epoch. This is an epoch policy, not a lifetime or actual ETH-balance solvency guarantee.
- Structured receipt effects identify actual payout IDs without trace parsing. If the submit transaction returns but its receipt value cannot be decoded, the app still returns the submitted transaction and order ID (a transport error before the transaction hash is known is still an error).
- Worker approval checks published bindings; vault owners can withdraw; failed transfers use unclaimed credits.
- The relayer checks unsigned bytes and recovered sender, assuming authentic NEAR RPC responses. Signed predecessors can advance while the requested target awaits its signature.
- Sepolia inclusion is reported only after matching successful receipts/transactions on two independent RPC hosts and three additional blocks on both. “Included on Sepolia, seen by two RPCs” is the accurate description.
- The retained order fee (1.32 test NEAR) is twice a derived, conservative 65,536-byte lifecycle storage upper bound for orders on machines published under the G6 identifier rules (docs/STORAGE-g6.md); the bound is an argument plus width checks and a sandbox measurement (13,041 bytes for an adversarial 32-node graph), not an exhaustive enumeration.
- Session/customer funding has best-effort per-client quotas, deterministic session idempotency and per-process hourly balance-delta caps; validation precedes quota.

Must not claim:
- No admin can move funds, immutable deployment, or exclusive signing authority: the contract still has FullAccess keys. The locking script has not been run.
- Production-safe, audited, trustless against malicious RPC, solvent by construction, or safe for mainnet.
- Every accepted or legacy order can complete/refund; expiry is automatic or always refunds. Budget exhaustion, missing callbacks, transfer failure, missing nonces or low treasury balance can block progress. Legacy graphs were not retroactively revalidated.
- Lifetime spending caps, fee replacement/cancellation, per-machine EVM treasuries, on-chain broadcast proof, automatic ETH replenishment, or guaranteed inclusion.
- A signature, NEAR success, broadcast hash, or shallow receipt proves confirmed payment or Ethereum finality.
- Distributed/durable abuse protection: in-memory quotas reset on cold starts and are not shared across server instances.
- That the G6 storage bound covers machines or orders created before the G6 migration, or that every publish fits in the 0.40 NEAR recommended deposit.
- High Portal throughput: with the deployed 0.01 ETH per 1,000-block epoch budget and 100 gwei snapshot max fee, each 0.001 ETH payout reserves 0.0031 ETH, so about three such payouts fit per epoch (count cap 20).
- Storage/history pruning or arbitrary contract-recipient support with the fixed 21,000 gas transfer.
