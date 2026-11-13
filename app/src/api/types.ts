// Shared contract between the UI and the chain adapter. Source: specs/API-interface.md.
// Change only by updating the spec first.

export type Yocto = string;           // u128 as decimal string
export type TxRef = { hash: string; explorerUrl: string };
export type PayoutStatus = 'waiting_for_signature' | 'awaiting_signature' | 'signed' | 'signature_failed' | 'waiting_for_earlier_nonce' | 'broadcast' | 'confirmed';

export interface Session { accountId: string; balance: Yocto; isNew: boolean; network: 'testnet'; tx?: TxRef }

export interface MachineDoc {            // what gets published (engine/MACHINE_FORMAT.md)
  machine: unknown;                      // engine JSON, exactly as MACHINE_FORMAT.md
  workers: Record<string, string>;       // worker name -> NEAR account
}
export interface Layout { positions: Record<string, { x: number; y: number }> } // UI-only, never on chain

export interface OrderResult {
  tx: TxRef;
  orderId: string;
  pending: boolean;                      // held at an approval Gate
  recovered?: boolean;
  resolution?: 'approved' | 'expired' | 'pending' | 'completed';
  observation?: 'unknown';               // live only: tx was sent but its receipt could not be decoded; effects are unknown (not empty), pending is false
  effects: Array<
    | { kind: 'payout'; account: string; amount: Yocto; settled?: true | false | 'unknown' }
    | { kind: 'vault'; name: string; amount: Yocto }
    | { kind: 'external'; payoutId: string; recipient: string; wei: string; fee: Yocto }>;
  trace: string[];
}

export interface ApproveResult {
  tx: TxRef;
  effects: OrderResult['effects'];       // what the release routed, incl. Portal payouts (external effects carry payoutId)
  pending: boolean;                      // still held (e.g. a second Gate downstream)
  observation?: 'unknown';               // same meaning as OrderResult.observation
}

export interface PayoutView {
  nearBlockHeight?: string; confirmationProgress?: Array<{rpc:string;depth:string;blockNumber:string}>;
  payoutId: string; status: PayoutStatus; recipient: string; wei: string;
  portalAddress: string; nonce: number; nearTx?: TxRef; evmTx?: TxRef; waitingPayoutId?: string; retryEligible?: boolean; confirmations?: Array<{ rpc: string; hash: string; blockHash: string; status: number }>;
}

export interface WorldworksApi {
  mode: 'live' | 'mock';
  limits(): Promise<{orderFee: Yocto; publishDeposit: Yocto; rate: string; epochBudgetWei: string; epochRemainingWei: string; maxWeiPerPayout?: string}>;
  getUnclaimed?(): Promise<Yocto>;
  withdrawVault?(machineId: string, vaultName: string, amount: Yocto): Promise<TxRef>;
  withdrawUnclaimed?(): Promise<TxRef>;
  session(): Promise<Session>;                         // creates a funded testnet account on first visit (no wallet, no popup)
  validate(doc: MachineDoc): { ok: true } | { ok: false; errors: string[] };   // wasm, local
  preview(doc: MachineDoc, recipient?: string): OrderResult;                    // wasm, local, tx.hash = 'preview'
  publish(machineId: string, doc: MachineDoc): Promise<TxRef>;
  getMachine(machineId: string): Promise<{ doc: MachineDoc; owner: string; vaults: Record<string, Yocto> } | null>;
  order(machineId: string, recipient?: string, orderId?: string): Promise<OrderResult>;           // pays the CoinSlot price from the session account
  customerOrder(machineId: string, orderId?: string, recipient?: string): Promise<OrderResult & { customer: string }>; // seeded customer account buys (labeled "seeded customer")
  approve(machineId: string, orderId: string): Promise<ApproveResult>;           // as the bound Worker; effects include Portal payouts released by the approval
  getOrder(machineId: string, orderId: string): Promise<OrderResult | null>;
  expiry?(machineId: string, orderId: string): Promise<{ pending: boolean; expiresAt: string; blockHeight: string; eligible: boolean }>;
  expire?(machineId: string, orderId: string): Promise<ApproveResult>;
  balance(): Promise<Yocto>;
  retrySignature?(payoutId: string): Promise<void>;
  getPayout(payoutId: string): Promise<PayoutView>;
  relay(payoutId: string): Promise<PayoutView>;                                  // broadcasts via app/api/relay
  contractInfo(): Promise<{ contractId: string; portalAddress: string; explorer: string }>;
}
