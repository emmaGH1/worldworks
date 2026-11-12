# What we may and may not claim (Astra audit 2026-11-12; re-review 2026-11-13: findings 4, 6, 8, 9 and early expiry FIXED; 1, 3, 5, 7 PARTIAL; key lock OPEN)

Re-check every line after G5 hardening lands; update when the code changes. The README, demo video and X post must follow this file.

## May claim (pre-G5 wording; strengthen only when G5 evidence supports it)
- Testnet prototype using NEAR Chain Signatures and a keyless relayer.
- The contract constructs the Sepolia EIP-1559 transfers itself: fixed chain id, empty calldata, 21,000 gas, contract-allocated nonces, snapshotted fees.
- Signature retries request the same stored transaction payload.
- Published machines cannot be edited through the application API.
- Worker approval checks the caller against the published role bindings.
- The relayer checks the unsigned bytes and the recovered sender, assuming authentic NEAR RPC responses; it holds no keys.
- Existing evidence shows real MPC signatures; a Sepolia payment counts as proven only once its receipt link is in the evidence.

## Must not claim (unless later evidence changes it)
- "No admin can move funds", "immutable deployment", or "the contract is the only possible signing authority" (false while the contract account holds any FullAccess key; becomes true only after scripts/lock-contract.sh runs on the final deployment and the key list is shown empty).
- That caps bound cumulative or lifetime spending (pre-G5 they are per order).
- That every accepted order can be completed or refunded; that expiry always refunds; that expiry is automatic.
- That Vault balances are withdrawable (until G5 adds owner withdrawal).
- That a signed payout, a relay hash, or a NEAR order proves an EVM payment (only a Sepolia receipt does).
- That the relayer is trustless against a malicious RPC.
- "Production-safe", "audited", "solvent by construction", or free from storage or nonce denial of service.
