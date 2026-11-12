# UI <-> chain interface (shared by the UI build and the chain adapter)

The UI never calls NEAR or Sepolia directly. It talks to one TypeScript interface, `WorldworksApi`, in `app/src/api/types.ts`. Two implementations:
- `app/src/api/mock.ts` (UI build): realistic timings (NEAR tx ~1.5 s, signature ~14 s, Sepolia confirm ~12 s), realistic fake hashes, clearly marked as mock in code.
- `app/src/api/live.ts` (chain adapter): real calls. The app picks live when `VITE_CONTRACT_ID` is set, mock otherwise; the UI shows a small "MOCK DATA" badge whenever mock is active, so a mock can never be mistaken for real.

```ts
export type Yocto = string;           // u128 as decimal string
export type TxRef = { hash: string; explorerUrl: string };
export type PayoutStatus = 'awaiting_signature' | 'signed' | 'signature_failed' | 'broadcast' | 'confirmed';

export interface Session { accountId: string; balance: Yocto; isNew: boolean; network: 'testnet' }

export interface MachineDoc {            // what gets published (engine/MACHINE_FORMAT.md)
  machine: unknown;                      // engine JSON, exactly as MACHINE_FORMAT.md
  workers: Record<string, string>;       // worker name -> NEAR account
}
export interface Layout { positions: Record<string, { x: number; y: number }> } // UI-only, never on chain

export interface OrderResult {
  tx: TxRef;
  orderId: string;
  pending: boolean;                      // held at an approval Gate
  effects: Array<
    | { kind: 'payout'; account: string; amount: Yocto }
    | { kind: 'vault'; name: string; amount: Yocto }
    | { kind: 'external'; payoutId: string; recipient: string; wei: string; fee: Yocto }>;
  trace: string[];
}

export interface PayoutView {
  payoutId: string; status: PayoutStatus; recipient: string; wei: string;
  portalAddress: string; nonce: number; nearTx?: TxRef; evmTx?: TxRef;
}

export interface WorldworksApi {
  mode: 'live' | 'mock';
  session(): Promise<Session>;                         // creates a funded testnet account on first visit (no wallet, no popup)
  validate(doc: MachineDoc): { ok: true } | { ok: false; errors: string[] };   // wasm, local
  preview(doc: MachineDoc, recipient?: string): OrderResult;                    // wasm, local, tx.hash = 'preview'
  publish(machineId: string, doc: MachineDoc): Promise<TxRef>;
  getMachine(machineId: string): Promise<{ doc: MachineDoc; owner: string; vaults: Record<string, Yocto> } | null>;
  order(machineId: string, recipient?: string): Promise<OrderResult>;           // pays the CoinSlot price from the session account
  customerOrder(machineId: string): Promise<OrderResult & { customer: string }>; // seeded customer account buys (labeled "seeded customer")
  approve(machineId: string, orderId: string): Promise<TxRef>;                   // as the bound Worker
  getPayout(payoutId: string): Promise<PayoutView>;
  relay(payoutId: string): Promise<PayoutView>;                                  // broadcasts via app/api/relay
  contractInfo(): Promise<{ contractId: string; portalAddress: string; explorer: string }>;
}
```

Rules: amounts are always strings; every on-chain thing shown in the UI carries its explorer link; the UI shows pending states honestly and never shows "confirmed" before `PayoutView.status === 'confirmed'`.
