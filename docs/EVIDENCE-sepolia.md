> Historical evidence: fee, balance and confirmation descriptions below may be superseded. See [G6 current state and acceptance](EVIDENCE-g6.md); zero treasury balance and 1 NEAR fee observations are historical, not current configuration.

# Evidence: NEAR contract paid out on Ethereum Sepolia (gate 2 passed)

Date: 2026-11-12 ~23:10 UTC. Treasury: `0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7`, the Chain Signatures address derived for `ww-portal-261112.testnet` (path `worldworks/portal/sepolia/v1`). Funded by the user with 0.53 Sepolia ETH from a faucet.

The contract built each transaction itself and obtained its signature from `v1.signer-prod.testnet` (MPC). The keyless relayer (`app/scripts/relay.ts`) only assembled and broadcast the signed bytes, in nonce order.

| Payout | Sepolia tx | Block | Status |
|---|---|---|---|
| 0 | [0xbf2a7ae1…a3e6](https://sepolia.etherscan.io/tx/0xbf2a7ae14ef28044ce775f9c18ed0c6294ffe916aac1f84653253b51f9d0a3e6) | 12121896 | success |
| 1 | [0xd3e3ebb3…cdd](https://sepolia.etherscan.io/tx/0xd3e3ebb392c064464a00fa17eb440f68b33fa9a4eeafc6a89ac421078b3efcdd) | 12121897 | success |
| 2 | [0x69a0083e…133f](https://sepolia.etherscan.io/tx/0x69a0083e7352b83bba98a029cd204b3603581bfe9e2557a8e7000d36362e133f) | 12121898 | success |
| 3 | [0xe96f4420…b90a](https://sepolia.etherscan.io/tx/0xe96f4420ca8f84b65dd332b47d21e22a7502f02f76170c2267e058c0803bb90a) | 12121899 | success |
| 4 | [0x10a30e35…3565](https://sepolia.etherscan.io/tx/0x10a30e352a7147fdb8bf7d0cfb855ee4c667cdb90dc26d7f1265f49c88ee3565) | 12121900 | success |

Each receipt was read independently from two RPCs (`rpc.sepolia.ethpandaops.io`, `sepolia.gateway.tenderly.co`): status `0x1`, `from` = the treasury address above, `to` = the demo recipient `0x…dEaD` used by the test orders.
