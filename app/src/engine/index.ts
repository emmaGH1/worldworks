import init, { validate, preview_order, machine_hash } from './pkg/worldworks_engine_wasm.js';

export type Effect = { VaultCredit: { name: string; amount: string } } | { Payout: { account: string; amount: string } } | { ExternalPayout: { recipient: string; wei: string; fee: string } };
export type Outcome = { effects: Effect[]; trace: string[]; pending: boolean };
export type ValidationError = string | Record<string, string | number>;
export type Failure = { ok: false; errors: ValidationError[] };
export type ValidationResult = { ok: true } | Failure;
const ready = () => init();
export async function validateMachine(machine: unknown): Promise<ValidationResult> { await ready(); return JSON.parse(validate(JSON.stringify(machine))); }
export async function previewOrder(machine: unknown, amount: string, recipient?: string): Promise<Outcome | Failure> { await ready(); return JSON.parse(preview_order(JSON.stringify(machine), amount, recipient)); }
export async function machineHash(machine: unknown): Promise<string | Failure> { await ready(); return JSON.parse(machine_hash(JSON.stringify(machine))); }
