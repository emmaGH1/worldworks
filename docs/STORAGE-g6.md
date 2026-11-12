# G6 storage sizing (newly published machines)

The old 38,044-byte escaped-ID fixture was not a global worst-case proof.
G6 restricts machine/node IDs to 1–32 ASCII `[a-z0-9_-]` bytes and order IDs
to 1–64. Legacy records are preserved, not certified by this bound.

## Retained order fee

Use a **65,536-byte conservative lifecycle envelope**, not the size of an
ordinary order or a claim that one graph attains the envelope. At the current
10^19 yoctoNEAR/byte storage price, twice the envelope is 1.31072 NEAR;
rounded **up** to 0.01 NEAR the retained order fee is **1.32 test NEAR**.
It covers submission, later approval/expiry, a completed signature and failed
NEAR transfer credits. Gas is additional. There is no per-order fee refund.

The topology-independent bound below intentionally overcounts mutually exclusive
states, so it is an upper bound on the worst case, not an exact attainable maximum.
`contract/tests/storage_bound.rs` checks the individual serialized widths at
u128/u64 maximum widths, maximum identifier widths and maximally escaped names.
`storage_envelope` separately measures real sandbox trie growth of an adversarial
32-node graph, including the signer callback. Both are required acceptance tests.

### Why the bound covers every accepted topology

Engine validation unfolds **both** edges of each Gate and every parallel Splitter
port, and rejects graphs whose sum of path counts exceeds `MAX_FLOWS = 64`.
Thus the whole lifetime of one order visits at most 64 flow occurrences, not 64
per call: approval/expiry consumes a held occurrence and takes only one edge.
A later approval can visit a downstream Gate but cannot revisit an ancestor
(the graph is acyclic). A resolution consumes at least one held occurrence,
so there are at most 64 successful resolutions, including repeated roles.

Charge each flow occurrence the following deliberately loose allowance:

- 86 bytes for its serialized ordinary trace line (39-digit amount, 32-byte ID).
- 150 bytes for a Splitter edge trace, charged to the destination occurrence.
  There are at most 63 such edges; allowing one for all 64 overcounts.
- At most 512 extra bytes for either:
  - a Gate: pending/minimum-rule trace (101), current Held record (256), approved
    worker entry (35), and eventual resolution trace with 64-byte order ID (90);
    or
  - a Vault: two 240-byte map entries (engine per-order state and machine vault).
    A 32-scalar name needs at most 192 JSON bytes: control characters are wider
    than any four-byte UTF-8 scalar. Amounts use at most 39 decimal bytes.
  All other node kinds need no larger per-occurrence persistent allowance.

86 + 150 + 512 <= 768; **64 × 768 = 49,152 bytes**. Counting Held entries AND
future approval entries AND every branch simultaneously is conservative.
All per-order engine vault entries are charged, including machine vault decimal
width growth. Machine graph and worker bindings were funded at publication and
are never copied into an order.

Additional allowances, separate from those 49,152 bytes:

| State | Bytes | Reason |
|---|---:|---|
| Fixed order wrappers | 1,024 | outer/engine field names, payer twice (64 bytes each), order ID keys, nullable recipient (42), 32-byte hash as JSON byte array, height strings, empty-map/array punctuation |
| Order trie/key/value framing | 256 | tuple Borsh key (105), Borsh string length (4), NEAR trie record overhead (40), plus headroom |
| One Portal payout | 12,288 | field names, max-width numeric strings, nonce/IDs, <=256 unsigned transaction bytes as JSON, 32-byte payload, signature JSON, Borsh/trie framing |
| Failed transfer credits | 512 | at most four distinct transfers/credits across a resolution path; each account-key/u128/trie entry <=128 bytes; repeated recipients need less |
| Epoch count record | 128 | height/count tuple plus key/trie framing; root counters are fixed-width Borsh |
| **Total upper bound** | **63,360** | below the 65,536-byte envelope |

There is at most one external effect per lifetime resolution path (the publish
`effect_bounds` check sums parallel paths and maximizes Gate alternatives).
Portal native EIP-1559 bytes fit well below 256 bytes even at u128/u64 widths:
no calldata/access list, fixed chain/recipient/gas. `on_signature` reads at most
4,096 result bytes. Normalizing parsed JSON does not grow it by more than 2x
when embedded as the `signature_json` string; the oversized fixture includes
8,192 bytes for that field plus the other payout fields. Retry overwrites the
same record and never appends signature history. Transfer-credit bounds include
withdrawal failures, which restore the same credit, not another record.

The bound relies on the current engine path limit, schema, signer result limit,
native transaction shape, effect limits and NEAR storage accounting. A future
change to any of those must rerun/rederive it. It does not prove gas liveness,
ETH solvency, or completion of legacy orders.

## Publish deposit (refundable recommendation, not a retained fee)

The app continues attaching **0.40 NEAR**. Publication meters actual trie growth
and rejects deposits below actual cost; excess is returned with transfer recovery.
There is no claim that 0.40 NEAR accepts every possible publication: Worker gate
lists can contain repeated references and become arbitrarily large. Callers may
attach more. This does not affect the order bound: the immutable graph remains
in its machine record, and only its bounded execution is stored per order.
