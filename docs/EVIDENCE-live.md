> Historical evidence: fee, balance and confirmation descriptions below may be superseded. See [G6 current state and acceptance](EVIDENCE-g6.md); zero treasury balance and 1 NEAR fee observations are historical, not current configuration.

# G4 live adapter evidence — NEAR verified; Sepolia funding needed

Testnet only. No commit/push. No contract, engine, UI, mock, index or shared type files edited by this implementation agent. The shared workspace includes concurrent work by others; the git status below is the entire workspace, not this agent's ownership list.

## Implemented files

- app/src/api/live.ts
- app/api/near.ts, server-common.ts, session.ts, customer.ts, payout.ts
- app/scripts/dev-api.ts, e2e-live.ts, live.test.ts
- docs/DEPLOYMENTS.md and this file

The existing relay.ts/portal.ts remain unchanged. Session creates a deterministic funded subaccount from the browser's public key (3 testnet NEAR maximum, no refill). Scoped keys have 0.5 testnet NEAR gas allowance, receiver ww-portal-261112.testnet, method approve only. Dedicated seeded customer has a 1 testnet NEAR per-order maximum. The adapter reads stored order traces/history for effects and payout IDs because submit_order returns void. Failed receipts produce an explicit error containing the real order explorer link. No failed NEAR transfer is reported as a successful order.

## Accounts created

- ww-sponsor-g4-261112.testnet: https://explorer.testnet.near.org/transactions/HfqMtEjdipVMuTnhFgVmoxbhQye4bueQym66vsbbehPK
- ww-customer-g4-261112.testnet: https://explorer.testnet.near.org/transactions/BaEdJfJZeVNx1rcXMkjkR9MYbzBe5eForoQB77bi1sHM
- p101b6c90d5db046759a9.ww-sponsor-g4-261112.testnet (initial attempts): https://explorer.testnet.near.org/transactions/EpRnwSqMetJ6bVGLWHtYDZMqcbXJ6Yp92iBbu8k8oPx1
- p23c3935347650b70686b.ww-sponsor-g4-261112.testnet (final successful run): https://explorer.testnet.near.org/transactions/CPEEc2ra3vT59eawBs7tuxCAj8kdnrGwDGwdodD1UBdK

## Outstanding / handoff

1. NEEDS USER: fund Sepolia treasury 0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7. Its live balance at acceptance is zero. No broadcast or confirmation is claimed. Payouts 0–3 have reserved nonces; relay in nonce order. About 0.007 Sepolia test ETH covers all four 0.001 ETH transfers and their current maximum gas fees. Explorer: https://sepolia.etherscan.io/address/0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7 . After funding, POST /api/relay for each payout then POST /api/payout to verify successful receipts. Actual Sepolia relay/confirmation acceptance remains NOT DONE.
2. The UI is a separate concurrent task. Its selector now recognizes the default/liveApi export. Displaying the public scoped-key RPC permission is available via LiveApi.workerPermission(); wiring that display in UI is not performed here. Shared WorldworksApi/PayoutView types were not changed.
3. Vercel deployment and env installation were not performed. Local API runs on 127.0.0.1:3001 using /opt/ww-secrets/live.env. Use docs/DEPLOYMENTS.md commands. Browser end-to-end UI behavior has not been exercised by this agent; the node script exercises the real adapter and local handlers.
4. In-memory per-process abuse limits are intentionally demo-grade; serverless replicas do not share them. Peerless runtimes share the unknown-IP bucket. Budgeted testnet sponsor/customer accounts need refills after their balances are spent. No production hardening or fee replacement is claimed.
5. Initial failed runs created a signed payout at nonce 1 and an unapproved escrow order in addition to the final run. These are real retained testnet state; the signed nonce must be relayed before nonce 2. Initial failure logs are included below. The final check passes after correcting legacy RPC missing-key handling and the prepaid-gas allowance.

## Final local checks — full output

```text
$ cd app && npm run typecheck && npm run build

> worldworks-app@0.0.0 typecheck
> tsc --noEmit


> worldworks-app@0.0.0 build
> vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 16 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.71 kB │ gzip:  0.39 kB
dist/assets/index-BMm0nApI.css    2.14 kB │ gzip:  0.86 kB
dist/assets/index-C-86EWvC.js   219.96 kB │ gzip: 68.85 kB

✓ built in 135ms
[exit 0]

$ cd app && npx tsc -p api/tsconfig.json
[exit 0]

$ cd app && npm exec --cache /opt/ww-npm-cache --package=tsx -- tsx --test scripts/live.test.ts scripts/relay.test.ts
TAP version 13
# Subtest: payout status requires successful Sepolia receipt; missing, pending, reverted and RPC errors stay honest
ok 1 - payout status requires successful Sepolia receipt; missing, pending, reverted and RPC errors stay honest
  ---
  duration_ms: 18.600969
  type: 'test'
  ...
# Subtest: session rejects malformed keys; customer rejects oversized identifiers and invalid recipients
ok 2 - session rejects malformed keys; customer rejects oversized identifiers and invalid recipients
  ---
  duration_ms: 0.518249
  type: 'test'
  ...
# Subtest: per-IP session rate limit rejects sixth request and method guard rejects GET
ok 3 - per-IP session rate limit rejects sixth request and method guard rejects GET
  ---
  duration_ms: 0.34384
  type: 'test'
  ...
# Subtest: live signature recovers contract-derived address and fixes transaction fields
ok 4 - live signature recovers contract-derived address and fixes transaction fields
  ---
  duration_ms: 26.287179
  type: 'test'
  ...
# Subtest: relayer rejects altered recipient
ok 5 - relayer rejects altered recipient
  ---
  duration_ms: 0.32177
  type: 'test'
  ...
# Subtest: relayer rejects altered wei
ok 6 - relayer rejects altered wei
  ---
  duration_ms: 0.12875
  type: 'test'
  ...
# Subtest: relayer rejects altered nonce
ok 7 - relayer rejects altered nonce
  ---
  duration_ms: 0.09641
  type: 'test'
  ...
# Subtest: relayer rejects altered chain_id
ok 8 - relayer rejects altered chain_id
  ---
  duration_ms: 0.1087
  type: 'test'
  ...
# Subtest: relayer rejects altered max_fee_per_gas
ok 9 - relayer rejects altered max_fee_per_gas
  ---
  duration_ms: 0.37252
  type: 'test'
  ...
# Subtest: relayer rejects altered gas_limit
ok 10 - relayer rejects altered gas_limit
  ---
  duration_ms: 0.10895
  type: 'test'
  ...
# Subtest: relayer rejects unsigned payout
ok 11 - relayer rejects unsigned payout
  ---
  duration_ms: 0.07489
  type: 'test'
  ...
# Subtest: broadcast returns deterministic hash and known-transaction rebroadcast is idempotent
ok 12 - broadcast returns deterministic hash and known-transaction rebroadcast is idempotent
  ---
  duration_ms: 1.64874
  type: 'test'
  ...
# Subtest: unaccepted broadcast preserves RPC failure
ok 13 - unaccepted broadcast preserves RPC failure
  ---
  duration_ms: 1.11258
  type: 'test'
  ...
# Subtest: wrong RPC chain cannot broadcast
ok 14 - wrong RPC chain cannot broadcast
  ---
  duration_ms: 0.488409
  type: 'test'
  ...
1..14
# tests 14
# suites 0
# pass 14
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 545.192477
[exit 0]

```

## Final live acceptance — full output

Command: `cd app && npm exec --cache /opt/ww-npm-cache --package=tsx -- tsx scripts/e2e-live.ts` with local API started with its external env file. Exit 0. The final source also preserves nearTx links for observed payouts and creates a fresh E2E key file for each run; those small follow-up changes were typechecked and local tests rerun without spending another sponsor grant.

```text
session {
  "accountId": "p23c3935347650b70686b.ww-sponsor-g4-261112.testnet",
  "balance": "3000000000000000000000000",
  "isNew": true,
  "network": "testnet",
  "tx": {
    "hash": "CPEEc2ra3vT59eawBs7tuxCAj8kdnrGwDGwdodD1UBdK",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/CPEEc2ra3vT59eawBs7tuxCAj8kdnrGwDGwdodD1UBdK"
  }
}
wasm preview {
  "tx": {
    "hash": "preview",
    "explorerUrl": ""
  },
  "orderId": "preview",
  "pending": false,
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ],
  "effects": [
    {
      "kind": "vault",
      "amount": "630000000000000000000000",
      "name": "reserve"
    },
    {
      "kind": "external",
      "payoutId": "preview",
      "fee": "70000000000000000000000",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    }
  ]
}
publish vending {
  "hash": "BzdbdwrZvAcmragpL2nEct8twqPPdviqDQ4FU3kyasDf",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/BzdbdwrZvAcmragpL2nEct8twqPPdviqDQ4FU3kyasDf"
}
publish escrow (installs approve-only key) {
  "hash": "8u6MgMibDLnH4qT6BDuERNUzgQb5FHgEpBNF6VdMdzHz",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/8u6MgMibDLnH4qT6BDuERNUzgQb5FHgEpBNF6VdMdzHz"
}
add scoped key {
  "hash": "Dd21UT1g2Hn1hvPJrvouCCf7TKyE7E2VJkxMz3xzfapM",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/Dd21UT1g2Hn1hvPJrvouCCf7TKyE7E2VJkxMz3xzfapM"
}
scoped permission from RPC {
  "publicKey": "ed25519:4MYNTQYXNN8H3pMsfYENFrBkyc2BgZ2Rycyj85Cp8PeP",
  "permission": {
    "FunctionCall": {
      "allowance": "500000000000000000000000",
      "method_names": [
        "approve"
      ],
      "receiver_id": "ww-portal-261112.testnet"
    }
  },
  "label": "This key can only approve"
}
vending order {
  "tx": {
    "hash": "9t9fapHW6iDiajGSgNbQnUgeNGZtwuUwwcJqJuF7ycTa",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/9t9fapHW6iDiajGSgNbQnUgeNGZtwuUwwcJqJuF7ycTa"
  },
  "orderId": "939fb9b8-c8a6-43a5-90fc-7fb0cb48878b",
  "pending": false,
  "effects": [
    {
      "kind": "vault",
      "name": "reserve",
      "amount": "630000000000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    },
    {
      "kind": "external",
      "payoutId": "2",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000",
      "fee": "70000000000000000000000"
    }
  ],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ]
}
escrow order {
  "tx": {
    "hash": "38bn1gvKeafzSna41FXixTUx2kKURUnT1sJnBdx5ZF4Z",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/38bn1gvKeafzSna41FXixTUx2kKURUnT1sJnBdx5ZF4Z"
  },
  "orderId": "fb020c26-45f3-441b-b875-d66ff66d1fb7",
  "pending": true,
  "effects": [],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "review: 1000000000000000000000000 yoctoNEAR",
    "Gate 'review': pending approval by inspector"
  ]
}
approve using scoped key {
  "hash": "5ceK5RDWCe7jBBUL4oGUBTCHtS7kMQjYJ3cWLLZbmAdJ",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/5ceK5RDWCe7jBBUL4oGUBTCHtS7kMQjYJ3cWLLZbmAdJ"
}
scoped key CANNOT publish (expected rejection) "AccessKeyMethodNameMismatchActionError: Access key does not allow method publish_machine"
seeded customer order {
  "tx": {
    "hash": "CG16bGscuuAQLz1uaGoCS6CVFEkR8hX31XkTXoPn2TUa",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/CG16bGscuuAQLz1uaGoCS6CVFEkR8hX31XkTXoPn2TUa"
  },
  "orderId": "2e692aba-6804-49d5-8deb-3778b53dffac",
  "pending": false,
  "effects": [
    {
      "kind": "vault",
      "name": "reserve",
      "amount": "630000000000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    },
    {
      "kind": "external",
      "payoutId": "3",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000",
      "fee": "70000000000000000000000"
    }
  ],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ],
  "customer": "ww-customer-g4-261112.testnet",
  "label": "seeded customer"
}
payout {
  "payoutId": "2",
  "status": "signed",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 2,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7"
}
Sepolia treasury wei "0"
NEEDS USER: fund Sepolia treasury 0x694ad57416073b1e1f3bc6e13b26bde28015a8b7; relay/confirmed acceptance not performed.
PASS: session, WASM validate/preview, publishes, orders, scoped approval/rejection, seeded customer, signed payout.
```

## Initial failed attempts — full output, superseded

Attempt 1 (missing-key RPC format), exit 1:

```text
session {
  "accountId": "p101b6c90d5db046759a9.ww-sponsor-g4-261112.testnet",
  "balance": "3000000000000000000000000",
  "isNew": true,
  "network": "testnet",
  "tx": {
    "hash": "EpRnwSqMetJ6bVGLWHtYDZMqcbXJ6Yp92iBbu8k8oPx1",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/EpRnwSqMetJ6bVGLWHtYDZMqcbXJ6Yp92iBbu8k8oPx1"
  }
}
wasm preview {
  "tx": {
    "hash": "preview",
    "explorerUrl": ""
  },
  "orderId": "preview",
  "pending": false,
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ],
  "effects": [
    {
      "kind": "vault",
      "amount": "630000000000000000000000",
      "name": "reserve"
    },
    {
      "kind": "external",
      "payoutId": "preview",
      "fee": "70000000000000000000000",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    }
  ]
}
publish vending {
  "hash": "B6NbnJi3xb2WPAMWpJJjf8fjScgwizGMUGRi83xSB2xS",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/B6NbnJi3xb2WPAMWpJJjf8fjScgwizGMUGRi83xSB2xS"
}
/data/home/.t3/projects/near-hackathon/app/src/api/live.ts:67
    if(!permission || permission.receiver_id !== CONTRACT || permission.method_names.length !== 1 || permission.method_names[0] !== 'approve') throw Error('Worker key does not have approve-only permission');
                                                                                                                                                     ^

Error: Worker key does not have approve-only permission
    at LiveApi.workerPermission (/data/home/.t3/projects/near-hackathon/app/src/api/live.ts:67:150)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async LiveApi.ensureWorkerKey (/data/home/.t3/projects/near-hackathon/app/src/api/live.ts:56:11)
    at async LiveApi.publish (/data/home/.t3/projects/near-hackathon/app/src/api/live.ts:51:60)
    at async <anonymous> (/data/home/.t3/projects/near-hackathon/app/scripts/e2e-live.ts:21:50)

Node.js v22.23.3
```

Attempt 2 (0.05 NEAR allowance cannot reserve 300 Tgas at testnet gas price), exit 1:

```text
session {
  "accountId": "p101b6c90d5db046759a9.ww-sponsor-g4-261112.testnet",
  "balance": "2999734902583905900000000",
  "isNew": false,
  "network": "testnet"
}
wasm preview {
  "tx": {
    "hash": "preview",
    "explorerUrl": ""
  },
  "orderId": "preview",
  "pending": false,
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ],
  "effects": [
    {
      "kind": "vault",
      "amount": "630000000000000000000000",
      "name": "reserve"
    },
    {
      "kind": "external",
      "payoutId": "preview",
      "fee": "70000000000000000000000",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    }
  ]
}
publish vending {
  "hash": "41KDzzmqQd5uCH6QnRrQGKHDMkazXsnJhzmjt5fFXnrV",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/41KDzzmqQd5uCH6QnRrQGKHDMkazXsnJhzmjt5fFXnrV"
}
publish escrow (installs approve-only key) {
  "hash": "EwxkhLkLw9pCbbcBP57vMbywSbqXMjpai7iiBMPKjP2t",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/EwxkhLkLw9pCbbcBP57vMbywSbqXMjpai7iiBMPKjP2t"
}
scoped permission from RPC {
  "publicKey": "ed25519:5ouYTGi9Sicotg9Ja64rN9KWMeVw3smvyVY4rVqMgYRA",
  "permission": {
    "FunctionCall": {
      "allowance": "50000000000000000000000",
      "method_names": [
        "approve"
      ],
      "receiver_id": "ww-portal-261112.testnet"
    }
  },
  "label": "This key can only approve"
}
vending order {
  "tx": {
    "hash": "6A9vmNMoiLhi5gMim6zyCaX7QQeyUM64AyiDuayrFPC2",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/6A9vmNMoiLhi5gMim6zyCaX7QQeyUM64AyiDuayrFPC2"
  },
  "orderId": "2d1cb4d4-2c97-44db-801b-bd085ccf91b0",
  "pending": false,
  "effects": [
    {
      "kind": "vault",
      "name": "reserve",
      "amount": "630000000000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    },
    {
      "kind": "external",
      "payoutId": "1",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000",
      "fee": "70000000000000000000000"
    }
  ],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ]
}
escrow order {
  "tx": {
    "hash": "CFN3hjqCtidyAdyRDaPDxsz7oLX6s7BYiYrbWhRaqhxC",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/CFN3hjqCtidyAdyRDaPDxsz7oLX6s7BYiYrbWhRaqhxC"
  },
  "orderId": "4cc78832-1108-40fb-92c6-2346352f61b8",
  "pending": true,
  "effects": [],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "review: 1000000000000000000000000 yoctoNEAR",
    "Gate 'review': pending approval by inspector"
  ]
}
/data/home/.t3/projects/near-hackathon/app/node_modules/near-api-js/src/providers/errors/parse.ts:1354
        return new AccessKeyNotEnoughAllowanceActionError(
               ^

AccessKeyNotEnoughAllowanceActionError: Not enough allowance for access key ed25519:5ouYTGi9Sicotg9Ja64rN9KWMeVw3smvyVY4rVqMgYRA on account p101b6c90d5db046759a9.ww-sponsor-g4-261112.testnet (allowance: 50000000000000000000000, cost: 300919509846106000000000)
    at parseInvalidAccessKeyError (/data/home/.t3/projects/near-hackathon/app/node_modules/near-api-js/src/providers/errors/parse.ts:1354:16)
    at parseInvalidTransactionError (/data/home/.t3/projects/near-hackathon/app/node_modules/near-api-js/src/providers/errors/parse.ts:1395:16)
    at parseTransactionExecutionError (/data/home/.t3/projects/near-hackathon/app/node_modules/near-api-js/src/providers/errors/parse.ts:689:23)
    at parseHandlerError (/data/home/.t3/projects/near-hackathon/app/node_modules/near-api-js/src/providers/errors/parse.ts:309:24)
    at parseRpcError (/data/home/.t3/projects/near-hackathon/app/node_modules/near-api-js/src/providers/errors/parse.ts:214:20)
    at JsonRpcProvider.sendJsonRpc (/data/home/.t3/projects/near-hackathon/app/node_modules/near-api-js/src/providers/json-rpc-provider.ts:878:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async Account.signAndSendTransaction (/data/home/.t3/projects/near-hackathon/app/node_modules/near-api-js/src/accounts/account.ts:485:22)
    at async send (/data/home/.t3/projects/near-hackathon/app/api/near.ts:26:18)
    at async LiveApi.approve (/data/home/.t3/projects/near-hackathon/app/src/api/live.ts:74:91) {
  txHash: '',
  blockHash: '',
  actionIndex: null,
  accountId: 'p101b6c90d5db046759a9.ww-sponsor-g4-261112.testnet',
  allowance: 50000000000000000000000n,
  cost: 300919509846106000000000n,
  publicKey: _PublicKey {
    ed25519Key: {
      keyType: 0,
      data: Uint8Array(32) [
         71, 114, 223, 235,  41,  32,  48,
        234, 198, 104, 241, 244, 106,  50,
         34, 242, 187, 158, 108, 132,  34,
        225,  99, 100,  81, 147, 121, 239,
        161,  84, 198, 173
      ]
    },
    enum: 'ed25519Key'
  }
}

Node.js v22.23.3
```

## Repository and key checks

Generated private-key values from sponsor, customer, and both browser session/worker stores were compared against every tracked and nonignored untracked repository file and the published acceptance logs. No matches. Files under /opt/ww-secrets are mode 600. No key was written to the repo.

```text
 M app/src/styles/tokens.css
 M contract/src/lib.rs
 M contract/src/portal.rs
 M contract/tests/sandbox.rs
 M docs/DEPLOYMENTS.md
?? app/api/customer.ts
?? app/api/near.ts
?? app/api/payout.ts
?? app/api/server-common.ts
?? app/api/session.ts
?? app/public/
?? app/scripts/dev-api.ts
?? app/scripts/e2e-live.ts
?? app/scripts/live.test.ts
?? app/src/api/index.ts
?? app/src/api/live.ts
?? app/src/api/mock.ts
?? app/src/components/
?? app/src/lib/
?? contract/evidence/hardening-before-live.log
?? contract/evidence/hardening-build.log
?? contract/evidence/hardening-contract-test.log
?? contract/evidence/hardening-engine-test.log
?? docs/EVIDENCE-live.md
```

Final restarted local server smoke check (final handler source, curl exit 0):

```text
$ curl --silent --show-error --fail-with-body --max-time 60 -H 'Content-Type: application/json' --data '{"payout_id":"2"}' http://127.0.0.1:3001/api/payout
{"payoutId":"2","status":"signed","recipient":"0x000000000000000000000000000000000000dEaD","wei":"1000000000000000","nonce":2,"portalAddress":"0x694ad57416073b1e1f3bc6e13b26bde28015a8b7"}
$ git diff --check
[exit 0; no output]
```

Additional browser-target adapter library build succeeded (ES2022). Vite warns that near-api-js's unused typed-contract dependency imports Node `util`; this adapter uses Account/KeyPair, not the ABI typed-contract wrapper. Browser runtime behavior remains the UI task's verification responsibility.

## G4b adoption — acceptance transcripts

Testnet only. No commit or push. Portal address remains `0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7`.

*(Superseded by G6: order fee 1.32 NEAR from a derived lifecycle bound, sessions 9 NEAR; see [EVIDENCE-g6.md](EVIDENCE-g6.md).)* **NOT DONE against the full spec:** the adversarial measurement is not an exhaustive/proven global worst-case storage bound (requirement 1). The deployed order fee is 0.77 NEAR (38,044 bytes × 2 × 10^19 yocto/byte, rounded up to 0.01 NEAR). Publish deposit recommendation is 0.40 NEAR (19,528 bytes × 2, same rounding); unused publish deposit is refunded. Session funding is 7 NEAR; five 0.1 NEAR orders + one publish require 4.75 NEAR before refunds and gas. See `contract/USAGE.md` for measurement limits.

Deployment succeeded; its original verification stopped on address casing after byte-for-byte state comparison. The corrected independent verification passed without another deployment. It verified every one of 24 preexisting records, the new migration marker, address derivation, WASM SHA-256 and limits. Earlier e2e attempt stopped before a transaction because the sponsor needed a refill; the final transcript below uses the refilled sponsor.

### Transaction links

- [En68P2fVFvC6nN5DXLfSd49RJUJfUu2jFQGJrE7tHLXY](https://explorer.testnet.near.org/transactions/En68P2fVFvC6nN5DXLfSd49RJUJfUu2jFQGJrE7tHLXY)
- [8CHkufaebLhuvuJaRKPyoetkkwi7MJdvRivGNdw31r1o](https://explorer.testnet.near.org/transactions/8CHkufaebLhuvuJaRKPyoetkkwi7MJdvRivGNdw31r1o)
- [H99xA3wkLmEnyi2e5sy53S2WneUcScEjdF8oQHdma3hY](https://explorer.testnet.near.org/transactions/H99xA3wkLmEnyi2e5sy53S2WneUcScEjdF8oQHdma3hY)
- [GFvWuoPrTLx7Cemyz4LfnJxsycLYieLei3XBkDGd1ekd](https://explorer.testnet.near.org/transactions/GFvWuoPrTLx7Cemyz4LfnJxsycLYieLei3XBkDGd1ekd)
- [BqCsJhX8rFjVG2tFaLcjFWNCEJNdw4v8A54qH41hTjKj](https://explorer.testnet.near.org/transactions/BqCsJhX8rFjVG2tFaLcjFWNCEJNdw4v8A54qH41hTjKj)
- [FQq6ZB1v1DD6xvDq2irzARtRDyZDxgrs6od6eRSYnGWp](https://explorer.testnet.near.org/transactions/FQq6ZB1v1DD6xvDq2irzARtRDyZDxgrs6od6eRSYnGWp)
- [GviEi4c24dnV74ZTfEbngQcmn7yVbEQ2seJvY8siYWLB](https://explorer.testnet.near.org/transactions/GviEi4c24dnV74ZTfEbngQcmn7yVbEQ2seJvY8siYWLB)
- [BUbzAf72N8x9qQHbELh8jyxriPPG7w7u3jc9iCgUoGCJ](https://explorer.testnet.near.org/transactions/BUbzAf72N8x9qQHbELh8jyxriPPG7w7u3jc9iCgUoGCJ)
- [HuNKauKoYjRP1eA8cvadfnBL3KsBVGAEkh9kZqbBVkS5](https://explorer.testnet.near.org/transactions/HuNKauKoYjRP1eA8cvadfnBL3KsBVGAEkh9kZqbBVkS5)
- [0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce](https://sepolia.etherscan.io/tx/0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce)
- [4r3KjpydrDXEzr1jRiUiNN5s58Km3RR5aewF2dS3TEHP](https://explorer.testnet.near.org/transactions/4r3KjpydrDXEzr1jRiUiNN5s58Km3RR5aewF2dS3TEHP)
- [BcPhRVCL7NPEJ2vXAB6eBZpoA5izTJjS5KX43xgk9dF2](https://explorer.testnet.near.org/transactions/BcPhRVCL7NPEJ2vXAB6eBZpoA5izTJjS5KX43xgk9dF2)
- [3xGFPp3uYDPVPpeJFEx3NJtJh1Xhn5bLeME37D7S7udm](https://explorer.testnet.near.org/transactions/3xGFPp3uYDPVPpeJFEx3NJtJh1Xhn5bLeME37D7S7udm)
- [B7gUg34H5DwS87hdb37ikfUzgdpYt7vpTtNAo7P3TWvx](https://explorer.testnet.near.org/transactions/B7gUg34H5DwS87hdb37ikfUzgdpYt7vpTtNAo7P3TWvx)
- [8CSJcYKikxwbE5JkuVqjm6oX6DyuNhtDGWTHqCaShVZz](https://explorer.testnet.near.org/transactions/8CSJcYKikxwbE5JkuVqjm6oX6DyuNhtDGWTHqCaShVZz)
- [BbTW5iBx9URyAFkGy7X9JeHHuNKsbDiVkd1sSUPAp5Gm](https://explorer.testnet.near.org/transactions/BbTW5iBx9URyAFkGy7X9JeHHuNKsbDiVkd1sSUPAp5Gm)
- [BVGTpK45zyPokAL4Ts5y5nwoP1XyyvtJsqE3bFCcYLPW](https://explorer.testnet.near.org/transactions/BVGTpK45zyPokAL4Ts5y5nwoP1XyyvtJsqE3bFCcYLPW)
- [0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c](https://sepolia.etherscan.io/tx/0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c)
- [0xb865599414cf240b352dffbecc7e57cc9c03ff424007a55dc9245d17be29436f](https://sepolia.etherscan.io/tx/0xb865599414cf240b352dffbecc7e57cc9c03ff424007a55dc9245d17be29436f)
- [0x24821f3e2d23ebf17fd1f298e30feafb4a174f6e6e987264d2c9e600f38cf28b](https://sepolia.etherscan.io/tx/0x24821f3e2d23ebf17fd1f298e30feafb4a174f6e6e987264d2c9e600f38cf28b)

### Contract WASM build

```sh
PATH="$HOME/.cargo/bin:$PATH" CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml
```

```text
• Collecting cargo project metadata...
• done

• Checking rustc version...
INFO: contract's near-sdk targets protocol version 84; rustc 1.99.0 accepted (bulk-memory opcodes supported by nearcore VM)
• done

• Checking the host environment...
• done

• Generating ABI
 │    Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
 │     Finished `dev` profile [unoptimized] target(s) in 0.39s
• Extracting ABI...
• done

• Compressing ABI to be embedded..
• done

• Building contract
 │    Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
 │     Finished `release` profile [optimized] target(s) in 2.79s

Modification timestamps of:
 |    "/opt/ww-target/wasm32-unknown-unknown/release/worldworks_contract.wasm" = SystemTime { tv_sec: 1794523893, tv_nsec: 867870545 }
 |    "/opt/ww-target/near/worldworks_contract.wasm" = SystemTime { tv_sec: 1794523810, tv_nsec: 642501987 }

• Running an optimize for size post-step with wasm-opt --enable-nontrapping-float-to-int --enable-bulk-memory...
    Finished wasm-opt -O in 1s 64ms
• done

✓ Contract successfully built! (in CARGO_NEAR_BUILD_ENVIRONMENT=host)
     -                Binary: /opt/ww-target/near/worldworks_contract.wasm
     -                  Size: 425.6 KB (425564 bytes)
     - SHA-256 checksum hex : b09b78d3b54257e4852730be4da4ae85a5475ec9392189108878720acd3ec2c6
     - SHA-256 checksum bs58: CtQFnsDNtfyWutURgV5pugvp7yJTtJ7QUDJGSTiXBjyX
     -                   ABI: /opt/ww-target/near/worldworks_contract_abi.json
     -          Embedded ABI: /opt/ww-target/near/worldworks_contract_abi.zst
    Finished cargo near build in 4s
Here is the console command if you ever need to re-run it again:
cargo near build non-reproducible-wasm --manifest-path contract/Cargo.toml
```

### Contract tests (including migration and storage measurement)

```sh
PATH="$HOME/.cargo/bin:$PATH" CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target cargo test --manifest-path contract/Cargo.toml -- --nocapture
```

```text
   Compiling worldworks-contract v0.1.0 (/data/home/.t3/projects/near-hackathon/contract)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 1.15s
     Running unittests src/lib.rs (/opt/ww-target/debug/deps/worldworks_contract-0565a401b3e6f795)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/sandbox.rs (/opt/ww-target/debug/deps/sandbox-2e014510b8a61cf3)

running 3 tests
STORAGE publish vending: 1026 bytes
G4B ADVERSARIAL STORAGE publish=19528 bytes order=38044 bytes (32 nodes, max escaped IDs, max order ID, four transfers, Portal/signature, Vault)
test storage_envelope ... ok
PASS drain rejected atomically; publish deposit and order fee required
PASS full G3 snapshot migration: nonce 4 preserved, payout bytes/signature unchanged, vaults 2520000000000000000000000, held 1000000000000000000000000, repeated migration rejected
test migrates_full_g3_snapshot_without_nonce_or_liability_loss ... ok
STORAGE signed vending order: 2187 bytes (G4b fee)
PASS callback with 200 historical payouts; machine unchanged; stuck retry identical bytes and nonce; private callback rejected
PASS signer failure -> signature_failed -> retry -> signed, identical payload/nonce/bytes
PASS epoch budget exhaustion rejected
PASS multiple Portal / zero wei / >4 transfers / cap rejected at publish
PASS vault owner only; early expiry rejected even owner; timed expiry; escrow liabilities
test hardening_sandbox has been running for over 60 seconds
PASS failed transfer -> unclaimed -> withdraw exactly once
PASS G4b same-layout migration preserves nonce, signed payout and liabilities; private and one-time
PASS separate fee owner; finished hardening sandbox
test hardening_sandbox ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 63.41s

   Doc-tests worldworks_contract

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

```

### Engine tests

```sh
PATH="$HOME/.cargo/bin:$PATH" CARGO_HOME=/opt/ww-cargo-home CARGO_TARGET_DIR=/opt/ww-target cargo test --manifest-path engine/Cargo.toml
```

```text
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.03s
     Running unittests src/lib.rs (/opt/ww-target/debug/deps/worldworks_engine-f097ce4e51783f1c)

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/cost.rs (/opt/ww-target/debug/deps/cost-9ca12ce46267e931)

running 1 test
test runtime_allocations_do_not_scale_with_state_history ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

     Running tests/engine.rs (/opt/ww-target/debug/deps/engine-a94f7189b893ab13)

running 39 tests
test expiry_refunds_payer_and_rejects_later_approval ... ok
test binds_machine_and_persists_held_targets ... ok
test all_amounts_serialize_as_strings_and_state_roundtrips ... ok
test max_amount_and_first_output_remainder ... ok
test minimum_amount_fail_branch ... ok
test iterative_chain_accepts_32_rejects_33_nodes ... ok
test missing_recipient_and_overflow_are_atomic ... ok
test near_accounts_and_vault_names_validated ... ok
test rejects_cycle ... ok
test rejects_duplicate_order ... ok
test recipient_checked_before_hold_and_identical_approval_targets_rejected ... ok
test rejects_invalid_worker_scope ... ok
test rejects_missing_edge_target ... ok
test rejects_double_approval ... ok
test rejects_multiple_coin_slots ... ok
test rejects_missing_worker ... ok
test rejects_no_coin_slot ... ok
test rejects_path_explosion_and_counts_parallel_ports ... ok
test rejects_portal_above_cap ... ok
test rejects_non_pending_approval ... ok
test rejects_unconnected_output ... ok
test rejects_splitter_sum ... ok
test rejects_splitter_output_count ... ok
test rejects_unsupported_chain ... ok
test rejects_unreachable_node ... ok
test rejects_wrong_amount ... ok
test rejects_worker_as_flow_target ... ok
test rejects_zero_price_zero_share_and_aggregate_portal_cap ... ok
test json_roundtrip_full_u128 ... ok
test rejects_wrong_worker ... ok
test repeated_worker_with_other_pending_role_returns_not_pending ... ok
test strict_amounts_and_duplicate_node_keys ... ok
test rewire_changes_outcome ... ok
test two_machines_different_outcomes ... ok
test validated_machine_persistence_and_staged_resolution_failure ... ok
test vending_exact_amended_allocation ... ok
test zero_fee_never_emits_external_payout ... ok
test splitter_gates_portals_conserve ... ok
test splitter_tree_conserves_every_yocto ... ok

test result: ok. 39 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.09s

   Doc-tests worldworks_engine

running 0 tests

test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s

```

### App typecheck

```sh
cd app && npm run typecheck
```

```text

> worldworks-app@0.0.0 typecheck
> tsc --noEmit

```

### App production build

```sh
cd app && npm run build
```

```text

> worldworks-app@0.0.0 build
> vite build

vite v8.3.8 building client environment for production...
transforming...
✓ 488 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.78 kB │ gzip:   0.42 kB
dist/assets/worldworks_engine_wasm_bg-5coomDFX.wasm  411.00 kB │ gzip: 122.40 kB
dist/assets/index-Ct-XuHJX.css                        57.31 kB │ gzip:  11.42 kB
dist/assets/index-D5XnJNVy.js                        656.29 kB │ gzip: 210.87 kB

[plugin builtin:vite-reporter]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/PopChild.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/PresenceChild.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/LayoutGroup/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/LayoutGroup/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/LazyMotion/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/LazyMotion/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/MotionConfig/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-force-update.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-force-update.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-isomorphic-effect.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-unmount-effect.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-unmount-effect.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-animation.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-animation.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-max.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-max.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-min.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-min.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/features-pinch.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/features-pinch.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-motion-value-event.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-motion-value-event.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-motion-template.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-motion-template.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-motion-value.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-motion-value.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-follow-value.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-follow-value.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-spring.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-spring.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-will-change/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-will-change/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-time.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-time.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion-config.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion-config.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-transform.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-transform.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-velocity.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-velocity.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animate.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animate.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-scope-motion.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-scope-motion.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/LazyContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/LazyContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-is-mounted.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-is-mounted.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-combine-values.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-combine-values.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animate-style.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animate-style.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animation.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animation.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-computed.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-computed.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence-data.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimatePresence/use-presence-data.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/events/use-dom-event.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/events/use-dom-event.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-animation-frame.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-animation-frame.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-cycle.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-cycle.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-in-view.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-in-view.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-instant-transition.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-instant-transition.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-page-in-view.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-page-in-view.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/LayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/LayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionConfigContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionConfigContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/PresenceContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/PresenceContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionContext/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionContext/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/SwitchLayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/animation/hooks/use-animated-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/animation/hooks/use-animated-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/AnimateSharedLayout.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/AnimateSharedLayout.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-inverted-scale.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-inverted-scale.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/DeprecatedLayoutGroupContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/DeprecatedLayoutGroupContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/namespace.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/namespace.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/@xyflow/react/dist/esm/index.js" may not be preserved when bundling.
   ╭─[ node_modules/@xyflow/react/dist/esm/index.js:1:1 ]
   │
 1 │ "use client"
   │ ──────┬─────
   │       ╰─────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Board.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Board.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/utils/use-constant.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/utils/use-constant.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/value/use-scroll.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/value/use-scroll.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/index.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/index.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/features/layout/MeasureLayout.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/features/layout/MeasureLayout.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/ReorderBoardContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/ReorderBoardContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Item.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Item.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/dom/use-render.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/dom/use-render.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/html/use-html-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/html/use-html-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/svg/use-svg-visual-state.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/svg/use-svg-visual-state.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-visual-element.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/MotionContext/create.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/MotionContext/create.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/context/ReorderContext.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/context/ReorderContext.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/svg/use-props.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/svg/use-props.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/render/html/use-props.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/render/html/use-props.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/motion/utils/use-motion-ref.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

[MODULE_LEVEL_DIRECTIVE] The semantics of the module level directive "use client" in "node_modules/framer-motion/dist/es/components/Reorder/Group.mjs" may not be preserved when bundling.
   ╭─[ node_modules/framer-motion/dist/es/components/Reorder/Group.mjs:1:1 ]
   │
 1 │ "use client";
   │ ──────┬──────
   │       ╰──────── module level directive may not be preserved
   │
   │ Help: For more information, see https://rolldown.rs/in-depth/directives#other-directives
───╯

✓ built in 280ms
```

### API and scripts typecheck

```sh
cd app && npx tsc -p api/tsconfig.json
```

```text
[exit 0; no output]
```

### API/relay unit tests

```sh
cd app && node --import tsx --test scripts/live.test.ts scripts/relay.test.ts
```

```text
TAP version 13
# Subtest: two independent matching receipts required; missing, altered, reverted and offline responses cannot confirm
ok 1 - two independent matching receipts required; missing, altered, reverted and offline responses cannot confirm
  ---
  duration_ms: 56.292167
  type: 'test'
  ...
# Subtest: session rejects malformed keys; customer rejects oversized identifiers and invalid recipients
ok 2 - session rejects malformed keys; customer rejects oversized identifiers and invalid recipients
  ---
  duration_ms: 0.64533
  type: 'test'
  ...
# Subtest: per-IP session rate limit rejects sixth request and method guard rejects GET
ok 3 - per-IP session rate limit rejects sixth request and method guard rejects GET
  ---
  duration_ms: 0.36191
  type: 'test'
  ...
# Subtest: live signature recovers contract-derived address and fixes transaction fields
ok 4 - live signature recovers contract-derived address and fixes transaction fields
  ---
  duration_ms: 23.353959
  type: 'test'
  ...
# Subtest: relayer rejects altered recipient
ok 5 - relayer rejects altered recipient
  ---
  duration_ms: 0.25412
  type: 'test'
  ...
# Subtest: relayer rejects altered wei
ok 6 - relayer rejects altered wei
  ---
  duration_ms: 0.09146
  type: 'test'
  ...
# Subtest: relayer rejects altered nonce
ok 7 - relayer rejects altered nonce
  ---
  duration_ms: 0.07402
  type: 'test'
  ...
# Subtest: relayer rejects altered chain_id
ok 8 - relayer rejects altered chain_id
  ---
  duration_ms: 0.091
  type: 'test'
  ...
# Subtest: relayer rejects altered max_fee_per_gas
ok 9 - relayer rejects altered max_fee_per_gas
  ---
  duration_ms: 0.33593
  type: 'test'
  ...
# Subtest: relayer rejects altered gas_limit
ok 10 - relayer rejects altered gas_limit
  ---
  duration_ms: 0.05863
  type: 'test'
  ...
# Subtest: relayer rejects unsigned payout
ok 11 - relayer rejects unsigned payout
  ---
  duration_ms: 0.06726
  type: 'test'
  ...
# Subtest: broadcast returns deterministic hash and known-transaction rebroadcast is idempotent
ok 12 - broadcast returns deterministic hash and known-transaction rebroadcast is idempotent
  ---
  duration_ms: 1.77898
  type: 'test'
  ...
# Subtest: unaccepted broadcast preserves RPC failure
ok 13 - unaccepted broadcast preserves RPC failure
  ---
  duration_ms: 0.95507
  type: 'test'
  ...
# Subtest: wrong RPC chain cannot broadcast
ok 14 - wrong RPC chain cannot broadcast
  ---
  duration_ms: 0.58312
  type: 'test'
  ...
# Subtest: broadcast rejects a provider returning another hash
ok 15 - broadcast rejects a provider returning another hash
  ---
  duration_ms: 0.47323
  type: 'test'
  ...
# Subtest: relay walks signed predecessors in nonce order and stops before an unsigned gap
ok 16 - relay walks signed predecessors in nonce order and stops before an unsigned gap
  ---
  duration_ms: 0.18697
  type: 'test'
  ...
1..16
# tests 16
# suites 0
# pass 16
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 611.893523
```

### Atomic testnet deployment

```sh
cd app && node --import tsx scripts/deploy-g4b.ts
```

```text
deploy/state-preserving migration {"hash":"En68P2fVFvC6nN5DXLfSd49RJUJfUu2jFQGJrE7tHLXY","explorerUrl":"https://explorer.testnet.near.org/transactions/En68P2fVFvC6nN5DXLfSd49RJUJfUu2jFQGJrE7tHLXY"}
node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ actual - expected

+ '0x694ad57416073b1e1f3bc6e13b26bde28015a8b7'
- '0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7'

    at <anonymous> (/data/home/.t3/projects/near-hackathon/app/scripts/deploy-g4b.ts:21:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5) {
  generatedMessage: true,
  code: 'ERR_ASSERTION',
  actual: '0x694ad57416073b1e1f3bc6e13b26bde28015a8b7',
  expected: '0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.23.3
```

### Independent post-deployment verification (corrected case-insensitive address comparison)

```sh
cd app && node --import tsx scripts/verify-g4b.ts
```

```text
{
  "address": "0x694Ad57416073B1E1f3BC6E13B26BDE28015A8b7",
  "wasmBytes": 425564,
  "sha256": "b09b78d3b54257e4852730be4da4ae85a5475ec9392189108878720acd3ec2c6",
  "preservedRecords": 24,
  "limits": {
    "owner_id": "ww-chainsig-261112.testnet",
    "min_fee_yocto_per_wei": "1000000",
    "epoch_blocks": "1000",
    "epoch_budget_wei": "10000000000000000",
    "remaining_budget_wei": "10000000000000000",
    "max_wei_per_payout": "2000000000000000",
    "signature_timeout_blocks": "200",
    "order_storage_fee": "770000000000000000000000",
    "publish_storage_deposit": "400000000000000000000000"
  },
  "liabilities": {
    "escrow": "1000000000000000000000000",
    "vaults": "3150000000000000000000000",
    "unclaimed": "0",
    "in_flight": "0",
    "balance": "14497641466480927699999995"
  }
}
```

### Testnet sponsor refill

```sh
Existing testnet owner transfers 5 NEAR to sponsor
```

```text
refill testnet sponsor {"hash":"8CHkufaebLhuvuJaRKPyoetkkwi7MJdvRivGNdw31r1o","explorerUrl":"https://explorer.testnet.near.org/transactions/8CHkufaebLhuvuJaRKPyoetkkwi7MJdvRivGNdw31r1o"}
refill acceptance session {"hash":"H99xA3wkLmEnyi2e5sy53S2WneUcScEjdF8oQHdma3hY","explorerUrl":"https://explorer.testnet.near.org/transactions/H99xA3wkLmEnyi2e5sy53S2WneUcScEjdF8oQHdma3hY"}
```

### Live end-to-end

```sh
cd app && E2E_STORAGE_FILE=/opt/ww-secrets/e2e-browser-1794524111872.json API_URL=http://127.0.0.1:3008 node --import tsx scripts/e2e-live.ts
```

```text
session {
  "accountId": "p8b83d9aeb55060a80860.ww-sponsor-g4-261112.testnet",
  "balance": "4437996455977716900000000",
  "isNew": false,
  "network": "testnet"
}
G5 limits {
  "orderFee": "770000000000000000000000",
  "publishDeposit": "400000000000000000000000",
  "rate": "1000000",
  "epochBudgetWei": "10000000000000000",
  "epochRemainingWei": "8000000000000000"
}
wasm preview {
  "tx": {
    "hash": "preview",
    "explorerUrl": ""
  },
  "orderId": "preview",
  "pending": false,
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ],
  "effects": [
    {
      "kind": "vault",
      "amount": "630000000000000000000000",
      "name": "reserve"
    },
    {
      "kind": "external",
      "payoutId": "preview",
      "fee": "70000000000000000000000",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    }
  ]
}
publish vending {
  "hash": "GFvWuoPrTLx7Cemyz4LfnJxsycLYieLei3XBkDGd1ekd",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/GFvWuoPrTLx7Cemyz4LfnJxsycLYieLei3XBkDGd1ekd"
}
publish escrow (installs approve-only key) {
  "hash": "BqCsJhX8rFjVG2tFaLcjFWNCEJNdw4v8A54qH41hTjKj",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/BqCsJhX8rFjVG2tFaLcjFWNCEJNdw4v8A54qH41hTjKj"
}
scoped permission from RPC {
  "publicKey": "ed25519:4FGcqyitUdWRXernHVrKbyDNV2jz41X6NyiCPMzFv3Tg",
  "permission": {
    "FunctionCall": {
      "allowance": "499466566113216800000000",
      "method_names": [
        "approve"
      ],
      "receiver_id": "ww-portal-261112.testnet"
    }
  },
  "label": "This key can only approve"
}
vending order {
  "tx": {
    "hash": "FQq6ZB1v1DD6xvDq2irzARtRDyZDxgrs6od6eRSYnGWp",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/FQq6ZB1v1DD6xvDq2irzARtRDyZDxgrs6od6eRSYnGWp"
  },
  "orderId": "f54873d9-129a-4cf6-8519-a1ba22754098",
  "pending": false,
  "effects": [
    {
      "kind": "vault",
      "name": "reserve",
      "amount": "630000000000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    },
    {
      "kind": "external",
      "payoutId": "7",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000",
      "fee": "70000000000000000000000"
    }
  ],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ]
}
escrow order {
  "tx": {
    "hash": "GviEi4c24dnV74ZTfEbngQcmn7yVbEQ2seJvY8siYWLB",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/GviEi4c24dnV74ZTfEbngQcmn7yVbEQ2seJvY8siYWLB"
  },
  "orderId": "c2cea809-1391-40dc-97ec-f1baf7fd9fc1",
  "pending": true,
  "effects": [],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "review: 1000000000000000000000000 yoctoNEAR",
    "Gate 'review': pending approval by inspector"
  ]
}
approve using scoped key {
  "hash": "BUbzAf72N8x9qQHbELh8jyxriPPG7w7u3jc9iCgUoGCJ",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/BUbzAf72N8x9qQHbELh8jyxriPPG7w7u3jc9iCgUoGCJ"
}
scoped key CANNOT publish (expected rejection) "AccessKeyMethodNameMismatchActionError: Access key does not allow method publish_machine"
seeded customer order {
  "tx": {
    "hash": "HuNKauKoYjRP1eA8cvadfnBL3KsBVGAEkh9kZqbBVkS5",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/HuNKauKoYjRP1eA8cvadfnBL3KsBVGAEkh9kZqbBVkS5"
  },
  "orderId": "a9f24733-9d6a-47a0-9d8a-866e076a6f90",
  "pending": false,
  "effects": [
    {
      "kind": "vault",
      "name": "reserve",
      "amount": "630000000000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    },
    {
      "kind": "external",
      "payoutId": "8",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000",
      "fee": "70000000000000000000000"
    }
  ],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ],
  "customer": "ww-customer-g4-261112.testnet",
  "label": "seeded customer"
}
payout {
  "payoutId": "7",
  "status": "signed",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 7,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "nearTx": {
    "hash": "FQq6ZB1v1DD6xvDq2irzARtRDyZDxgrs6od6eRSYnGWp",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/FQq6ZB1v1DD6xvDq2irzARtRDyZDxgrs6od6eRSYnGWp"
  }
}
Sepolia treasury wei "524894999998320000"
relay ordered payout {
  "payoutId": "7",
  "status": "broadcast",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 7,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "evmTx": {
    "hash": "0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce",
    "explorerUrl": "https://sepolia.etherscan.io/tx/0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce"
  },
  "nearTx": {
    "hash": "FQq6ZB1v1DD6xvDq2irzARtRDyZDxgrs6od6eRSYnGWp",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/FQq6ZB1v1DD6xvDq2irzARtRDyZDxgrs6od6eRSYnGWp"
  }
}
confirmed Sepolia payout (two independent RPCs) {
  "payoutId": "7",
  "status": "confirmed",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 7,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "confirmations": [
    {
      "rpc": "https://rpc.sepolia.ethpandaops.io",
      "hash": "0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce",
      "blockHash": "0x4572318b797abf31cfdeba10be58600f0d6244ad5425a48af27dc7136d293a47",
      "blockNumber": "12121965",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    },
    {
      "rpc": "https://sepolia.gateway.tenderly.co",
      "hash": "0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce",
      "blockHash": "0x4572318b797abf31cfdeba10be58600f0d6244ad5425a48af27dc7136d293a47",
      "blockNumber": "12121965",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    }
  ],
  "evmTx": {
    "hash": "0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce",
    "explorerUrl": "https://sepolia.etherscan.io/tx/0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce"
  }
}
PASS: session, WASM validate/preview, publishes, orders, scoped approval/rejection, seeded customer, signed payout.
```

### Previous live attempt stopped on deprecated NEAR RPC

```sh
Same e2e command before switching NEAR to rpc.testnet.fastnear.com
```

```text
session {
  "accountId": "p8b83d9aeb55060a80860.ww-sponsor-g4-261112.testnet",
  "balance": "7000000000000000000000000",
  "isNew": true,
  "network": "testnet",
  "tx": {
    "hash": "4r3KjpydrDXEzr1jRiUiNN5s58Km3RR5aewF2dS3TEHP",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/4r3KjpydrDXEzr1jRiUiNN5s58Km3RR5aewF2dS3TEHP"
  }
}
G5 limits {
  "orderFee": "770000000000000000000000",
  "publishDeposit": "400000000000000000000000",
  "rate": "1000000",
  "epochBudgetWei": "10000000000000000",
  "epochRemainingWei": "10000000000000000"
}
wasm preview {
  "tx": {
    "hash": "preview",
    "explorerUrl": ""
  },
  "orderId": "preview",
  "pending": false,
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ],
  "effects": [
    {
      "kind": "vault",
      "amount": "630000000000000000000000",
      "name": "reserve"
    },
    {
      "kind": "external",
      "payoutId": "preview",
      "fee": "70000000000000000000000",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    }
  ]
}
publish vending {
  "hash": "BcPhRVCL7NPEJ2vXAB6eBZpoA5izTJjS5KX43xgk9dF2",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/BcPhRVCL7NPEJ2vXAB6eBZpoA5izTJjS5KX43xgk9dF2"
}
publish escrow (installs approve-only key) {
  "hash": "3xGFPp3uYDPVPpeJFEx3NJtJh1Xhn5bLeME37D7S7udm",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/3xGFPp3uYDPVPpeJFEx3NJtJh1Xhn5bLeME37D7S7udm"
}
add scoped key {
  "hash": "B7gUg34H5DwS87hdb37ikfUzgdpYt7vpTtNAo7P3TWvx",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/B7gUg34H5DwS87hdb37ikfUzgdpYt7vpTtNAo7P3TWvx"
}
scoped permission from RPC {
  "publicKey": "ed25519:4FGcqyitUdWRXernHVrKbyDNV2jz41X6NyiCPMzFv3Tg",
  "permission": {
    "FunctionCall": {
      "allowance": "500000000000000000000000",
      "method_names": [
        "approve"
      ],
      "receiver_id": "ww-portal-261112.testnet"
    }
  },
  "label": "This key can only approve"
}
vending order {
  "tx": {
    "hash": "8CSJcYKikxwbE5JkuVqjm6oX6DyuNhtDGWTHqCaShVZz",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/8CSJcYKikxwbE5JkuVqjm6oX6DyuNhtDGWTHqCaShVZz"
  },
  "orderId": "c1acda47-ad88-452c-8d38-104d2e67ad78",
  "pending": false,
  "effects": [
    {
      "kind": "vault",
      "name": "reserve",
      "amount": "630000000000000000000000"
    },
    {
      "kind": "payout",
      "account": "creator.testnet",
      "amount": "300000000000000000000000"
    },
    {
      "kind": "external",
      "payoutId": "5",
      "recipient": "0x000000000000000000000000000000000000dEaD",
      "wei": "1000000000000000",
      "fee": "70000000000000000000000"
    }
  ],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "fees: 1000000000000000000000000 yoctoNEAR",
    "Splitter 'fees': 7000 bps -> reserve_fee (700000000000000000000000 yoctoNEAR)",
    "Splitter 'fees': 3000 bps -> creator (300000000000000000000000 yoctoNEAR)",
    "reserve_fee: 700000000000000000000000 yoctoNEAR",
    "Splitter 'reserve_fee': 9000 bps -> reserve (630000000000000000000000 yoctoNEAR)",
    "Splitter 'reserve_fee': 1000 bps -> delivery (70000000000000000000000 yoctoNEAR)",
    "reserve: 630000000000000000000000 yoctoNEAR",
    "delivery: 70000000000000000000000 yoctoNEAR",
    "Gate 'delivery': -> portal",
    "portal: 70000000000000000000000 yoctoNEAR",
    "creator: 300000000000000000000000 yoctoNEAR"
  ]
}
escrow order {
  "tx": {
    "hash": "BbTW5iBx9URyAFkGy7X9JeHHuNKsbDiVkd1sSUPAp5Gm",
    "explorerUrl": "https://explorer.testnet.near.org/transactions/BbTW5iBx9URyAFkGy7X9JeHHuNKsbDiVkd1sSUPAp5Gm"
  },
  "orderId": "e0e4083c-9d39-4c4b-89a2-5474f7e7c0f8",
  "pending": true,
  "effects": [],
  "trace": [
    "slot: 1000000000000000000000000 yoctoNEAR",
    "review: 1000000000000000000000000 yoctoNEAR",
    "Gate 'review': pending approval by inspector"
  ]
}
approve using scoped key {
  "hash": "BVGTpK45zyPokAL4Ts5y5nwoP1XyyvtJsqE3bFCcYLPW",
  "explorerUrl": "https://explorer.testnet.near.org/transactions/BVGTpK45zyPokAL4Ts5y5nwoP1XyyvtJsqE3bFCcYLPW"
}
scoped key CANNOT publish (expected rejection) "AccessKeyMethodNameMismatchActionError: Access key does not allow method publish_machine"
/data/home/.t3/projects/near-hackathon/app/src/api/live.ts:16
    const data = await response.json(); if(!response.ok) throw Error(data.error ?? `API ${response.status}`); return data;
                                                               ^

Error: {"jsonrpc":"2.0","error":{"code":-429,"message":"WARNING! THIS ENDPOINT IS DEPRECATED! STOP USING IT NOW! Switch to https://fastnear.com or alternative RPC providers at https://docs.near.org/api/rpc/providers"},"id":"1"}
    at LiveApi.post (/data/home/.t3/projects/near-hackathon/app/src/api/live.ts:16:64)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async LiveApi.customerOrder (/data/home/.t3/projects/near-hackathon/app/src/api/live.ts:80:64)
    at async <anonymous> (/data/home/.t3/projects/near-hackathon/app/scripts/e2e-live.ts:36:14)

Node.js v22.23.3
```

### Relay CLI

```sh
cd app && npm run relay -- 8
```

```text

> worldworks-app@0.0.0 relay
> npx tsx scripts/relay.ts 8

{"status":"broadcast","evm_tx_hash":"0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c"}
```

### Confirmation CLI

```sh
cd app && npm run confirm -- 8
```

```text

> worldworks-app@0.0.0 confirm
> npx tsx scripts/confirm.ts 8

{
  "payoutId": "8",
  "status": "confirmed",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 8,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "confirmations": [
    {
      "rpc": "https://rpc.sepolia.ethpandaops.io",
      "hash": "0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c",
      "blockHash": "0x49c73dd2215d73bddc757fd15f86f4d47b7c0f72fba367ee75604de9614ec537",
      "blockNumber": "12121968",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    },
    {
      "rpc": "https://sepolia.gateway.tenderly.co",
      "hash": "0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c",
      "blockHash": "0x49c73dd2215d73bddc757fd15f86f4d47b7c0f72fba367ee75604de9614ec537",
      "blockNumber": "12121968",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    }
  ],
  "evmTx": {
    "hash": "0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c",
    "explorerUrl": "https://sepolia.etherscan.io/tx/0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c"
  }
}
```

### All payouts broadcast in this task

```sh
confirm payouts 5 through 8
```

```text
{
  "payoutId": "5",
  "status": "confirmed",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 5,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "confirmations": [
    {
      "rpc": "https://rpc.sepolia.ethpandaops.io",
      "hash": "0xb865599414cf240b352dffbecc7e57cc9c03ff424007a55dc9245d17be29436f",
      "blockHash": "0x4572318b797abf31cfdeba10be58600f0d6244ad5425a48af27dc7136d293a47",
      "blockNumber": "12121965",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    },
    {
      "rpc": "https://sepolia.gateway.tenderly.co",
      "hash": "0xb865599414cf240b352dffbecc7e57cc9c03ff424007a55dc9245d17be29436f",
      "blockHash": "0x4572318b797abf31cfdeba10be58600f0d6244ad5425a48af27dc7136d293a47",
      "blockNumber": "12121965",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    }
  ],
  "evmTx": {
    "hash": "0xb865599414cf240b352dffbecc7e57cc9c03ff424007a55dc9245d17be29436f",
    "explorerUrl": "https://sepolia.etherscan.io/tx/0xb865599414cf240b352dffbecc7e57cc9c03ff424007a55dc9245d17be29436f"
  }
}
{
  "payoutId": "6",
  "status": "confirmed",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 6,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "confirmations": [
    {
      "rpc": "https://rpc.sepolia.ethpandaops.io",
      "hash": "0x24821f3e2d23ebf17fd1f298e30feafb4a174f6e6e987264d2c9e600f38cf28b",
      "blockHash": "0x4572318b797abf31cfdeba10be58600f0d6244ad5425a48af27dc7136d293a47",
      "blockNumber": "12121965",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    },
    {
      "rpc": "https://sepolia.gateway.tenderly.co",
      "hash": "0x24821f3e2d23ebf17fd1f298e30feafb4a174f6e6e987264d2c9e600f38cf28b",
      "blockHash": "0x4572318b797abf31cfdeba10be58600f0d6244ad5425a48af27dc7136d293a47",
      "blockNumber": "12121965",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    }
  ],
  "evmTx": {
    "hash": "0x24821f3e2d23ebf17fd1f298e30feafb4a174f6e6e987264d2c9e600f38cf28b",
    "explorerUrl": "https://sepolia.etherscan.io/tx/0x24821f3e2d23ebf17fd1f298e30feafb4a174f6e6e987264d2c9e600f38cf28b"
  }
}
{
  "payoutId": "7",
  "status": "confirmed",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 7,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "confirmations": [
    {
      "rpc": "https://rpc.sepolia.ethpandaops.io",
      "hash": "0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce",
      "blockHash": "0x4572318b797abf31cfdeba10be58600f0d6244ad5425a48af27dc7136d293a47",
      "blockNumber": "12121965",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    },
    {
      "rpc": "https://sepolia.gateway.tenderly.co",
      "hash": "0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce",
      "blockHash": "0x4572318b797abf31cfdeba10be58600f0d6244ad5425a48af27dc7136d293a47",
      "blockNumber": "12121965",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    }
  ],
  "evmTx": {
    "hash": "0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce",
    "explorerUrl": "https://sepolia.etherscan.io/tx/0xf6b29efe962918137ec2dc12f9e65d2c9b35997e039a720fae45d0953df08bce"
  }
}
{
  "payoutId": "8",
  "status": "confirmed",
  "recipient": "0x000000000000000000000000000000000000dEaD",
  "wei": "1000000000000000",
  "nonce": 8,
  "portalAddress": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
  "confirmations": [
    {
      "rpc": "https://rpc.sepolia.ethpandaops.io",
      "hash": "0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c",
      "blockHash": "0x49c73dd2215d73bddc757fd15f86f4d47b7c0f72fba367ee75604de9614ec537",
      "blockNumber": "12121968",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    },
    {
      "rpc": "https://sepolia.gateway.tenderly.co",
      "hash": "0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c",
      "blockHash": "0x49c73dd2215d73bddc757fd15f86f4d47b7c0f72fba367ee75604de9614ec537",
      "blockNumber": "12121968",
      "from": "0x694ad57416073b1e1f3bc6e13b26bde28015a8b7",
      "to": "0x000000000000000000000000000000000000dead",
      "value": "1000000000000000",
      "status": 1
    }
  ],
  "evmTx": {
    "hash": "0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c",
    "explorerUrl": "https://sepolia.etherscan.io/tx/0x2d32a8a14f9cc6ccb23ee16f2cac9124236578ddcf4b09912d13c2ab0d1c570c"
  }
}
```

### No keys in repository

```sh
cd app && node --import tsx scripts/check-secrets.ts
```

```text
PASS: 213 repository files scanned against 13 private keys/seed phrases; no matches. Secret values not printed.
```

### Whitespace check

```sh
git diff --check
```

```text
[exit 0; no output]
```
