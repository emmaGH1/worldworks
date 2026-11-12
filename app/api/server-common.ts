import { account } from './near.js';
export type Request = {method?:string;body?:unknown;socket?:{remoteAddress?:string};headers?:Record<string,string|string[]|undefined>};
export type Response = {status(code:number):{json(body:unknown):unknown};setHeader(name:string,value:string):unknown};
const limits = new Map<string,{until:number;count:number}>();
export function body(req:Request, res:Response, namespace:string): any {
  if(req.method !== 'POST') { res.setHeader('Allow','POST'); throw Object.assign(Error('POST required'),{code:405}); }
  // Only trust the runtime's peer address locally; do not accept spoofed forwarding headers.
  const ip = req.socket?.remoteAddress ?? 'unknown';
  const now = Date.now();
  for(const [key,value] of limits) if(value.until < now) limits.delete(key);
  const key = `${namespace}:${ip}`;
  const entry = limits.get(key) ?? {until:now+3600000,count:0};
  if(++entry.count > (namespace === 'session' ? 5 : 10)) throw Object.assign(Error('Testnet rate limit reached; try again in one hour'),{code:429});
  limits.set(key,entry);
  try { const value = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; if(!value || typeof value !== 'object') throw Error(); return value; }
  catch { throw Object.assign(Error('Invalid JSON body'),{code:400}); }
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
