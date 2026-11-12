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
