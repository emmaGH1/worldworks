import { account } from './near.js';
export type Request = {method?:string;body?:unknown;socket?:{remoteAddress?:string};headers?:Record<string,string|string[]|undefined>};
export type Response = {status(code:number):{json(body:unknown):unknown};setHeader(name:string,value:string):unknown};
const limits = new Map<string,{until:number;count:number}>();
export function body(req:Request, res:Response, namespace:string): any {
  if(req.method !== 'POST') { res.setHeader('Allow','POST'); throw Object.assign(Error('POST required'),{code:405}); }
  try { const value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; if(!value || typeof value !== 'object') throw Error(); return value; }
  catch { throw Object.assign(Error('Invalid JSON body'),{code:400}); }
}
export function quota(req:Request, namespace:string) {
  // Only Vercel supplies these trusted headers. Local forwarding is untrusted.
  const header=(name:string)=>{const v=req.headers?.[name];return typeof v === 'string' ? v.split(',')[0].trim() : undefined;};
  const ip = process.env.VERCEL === '1' ? header('x-vercel-forwarded-for') ?? header('x-real-ip') ?? 'unknown' : req.socket?.remoteAddress ?? 'unknown';
  const now=Date.now();
  for(const [key,value] of limits) if(value.until < now) limits.delete(key);
  const key=namespace+':'+ip, entry=limits.get(key) ?? {until:now+3600000,count:0};
  if(entry.count >= (namespace === 'session' ? 5 : 10)) throw Object.assign(Error('Testnet rate limit reached; try again in one hour'),{code:429});
  entry.count++; limits.set(key,entry);
}
export const SPONSOR_HOURLY_CAP = 35_000_000_000_000_000_000_000_000n;
export const CUSTOMER_HOURLY_CAP = 20_000_000_000_000_000_000_000_000n;
const spend = new Map<string,{hour:number;spent:bigint}>();
export async function withSpend<T>(kind:'SPONSOR'|'CUSTOMER', who:ReturnType<typeof account>, reservation:bigint, fn:()=>Promise<T>):Promise<T> {
  const hour=Math.floor(Date.now()/3600000), key=kind+':'+who.accountId;
  const entry=spend.get(key)?.hour === hour ? spend.get(key)! : {hour,spent:0n};
  const cap=kind === 'SPONSOR' ? SPONSOR_HOURLY_CAP : CUSTOMER_HOURLY_CAP;
  if(entry.spent+reservation>cap) throw Object.assign(Error('Aggregate testnet hourly spend limit reached'),{code:429});
  const before=(await who.getState()).balance.total;
  // Fail closed if observation fails; reserve first, reconcile actual balance delta.
  entry.spent+=reservation;spend.set(key,entry);
  try { return await fn(); }
  finally {
    try {
      const after=(await who.getState()).balance.total;
      entry.spent=entry.spent-reservation+(before>after ? before-after : 0n);
    } catch { /* Retain reservation; never hide an already submitted transaction. */ }
  }
}
export function envAccount(prefix:string) {
  const id = process.env[`${prefix}_ACCOUNT_ID`], secret = process.env[`${prefix}_PRIVATE_KEY`];
  if(!id || !secret) throw Error(`${prefix} testnet account is not configured`);
  return account(id,secret);
}
export function failure(res:Response,error:unknown) {
  // Do not serialize provider errors: they may include signed request details.
  return res.status((error as any).code ?? 503).json({error:error instanceof Error ? error.message : 'Testnet service unavailable'});
}
let queue:Promise<unknown> = Promise.resolve();
export function serialized<T>(fn:()=>Promise<T>):Promise<T> {
  const result = queue.then(fn,fn); queue = result.catch(()=>{}); return result;
}
