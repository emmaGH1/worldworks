import type { WorldworksApi, MachineDoc, Session, OrderResult, PayoutView, TxRef, ApproveResult } from './types.js';
import { account, KeyPair, actions, CONTRACT, DEMO_RECIPIENT, rpc, view, send, price, placeOrder, txRef, limits, checkId, checkLegacyId, receiptResult, readOrder, withSettlement } from '../../api/_near.js';
import { validateMachine } from '../engine/index.js';
import { validate as wasmValidate, preview_order } from '../engine/pkg/worldworks_engine_wasm.js';
const config = (import.meta as ImportMeta & {env?:Record<string,string>}).env ?? {};
type Storage = Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
export class LiveApi implements WorldworksApi {
  readonly mode = 'live' as const;
  workerKeyTx?:TxRef;
  private pendingSession?:Promise<Session>;
  constructor(private storage:Storage = globalThis.localStorage, private base = config.VITE_RELAYER_URL ?? config.VITE_API_URL ?? '', contractId = config.VITE_CONTRACT_ID ?? CONTRACT) {
    if(contractId !== CONTRACT) throw Error(`This adapter is pinned to testnet contract ${CONTRACT}`);
  }
  private async post(path:string,body:unknown):Promise<any> {
    const response = await fetch(`${this.base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const data=await response.json().catch(()=>null);
    if(!response.ok) throw Object.assign(Error(typeof data?.error==='string'?data.error:`API ${response.status}`),{status:response.status,definitive:data?.definitive===true});
    if(!data)throw Error('API returned a non-JSON response');
    return data;
  }

  private key(name='session') {
    const path = `worldworks.testnet.${name}.key`;
    let secret = this.storage.getItem(path);
    if(!secret) { secret = KeyPair.fromRandom('ed25519').toString(); this.storage.setItem(path,secret); }
    return KeyPair.fromString(secret as `ed25519:${string}`);
  }
  session():Promise<Session> {
    if(!this.pendingSession) this.pendingSession = this.openSession().catch(error=>{this.pendingSession=undefined;throw error;});
    return this.pendingSession;
  }
  private async openSession():Promise<Session> {
    await validateMachine({}); // Initializes the shared wasm module before sync validate/preview.
    const key = this.key();
    const saved = this.storage.getItem('worldworks.testnet.account');
    if(saved) {
      const state = await rpc('query',{request_type:'view_account',finality:'final',account_id:saved});
      return {accountId:saved,balance:state.amount,isNew:false,network:'testnet'};
    }
    const session = await this.post('session',{publicKey:key.getPublicKey().toString(),idempotencyKey:key.getPublicKey().toString()});
    this.storage.setItem('worldworks.testnet.account',session.accountId); return session;
  }
  private async player(scoped=false) { const s = await this.session(); return account(s.accountId,this.key(scoped?'worker':'session').toString()); }
  validate(doc:MachineDoc):ReturnType<WorldworksApi['validate']> {
    try { const result = JSON.parse(wasmValidate(JSON.stringify(doc.machine))); return result.ok ? {ok:true} : {ok:false,errors:result.errors.map((e:unknown)=> typeof e === 'string' ? e : JSON.stringify(e))}; }
    catch(error) { return {ok:false,errors:[`Engine unavailable; await session() first: ${error}`]}; }
  }
  preview(doc:MachineDoc,recipient=DEMO_RECIPIENT):OrderResult {
    const result = JSON.parse(preview_order(JSON.stringify(doc.machine),price(doc.machine),recipient));
    if(result.ok === false) throw Error(JSON.stringify(result.errors));
    return {tx:{hash:'preview',explorerUrl:''},orderId:'preview',pending:result.pending,trace:result.trace,effects:result.effects.map((e:any)=>e.Payout ? {kind:'payout',...e.Payout} : e.VaultCredit ? {kind:'vault',...e.VaultCredit} : {kind:'external',payoutId:'preview',...e.ExternalPayout})};
  }
  async publish(machineId:string,doc:MachineDoc):Promise<TxRef> {
    checkId(machineId);
    for(const id of Object.keys((doc.machine as any).nodes ?? {})) checkId(id);
    await this.session();
    const valid = this.validate(doc); if(!valid.ok) throw Error(valid.errors.join(', '));
    const who = await this.player();
    if(Object.values(doc.workers).includes(who.accountId)) await this.ensureWorkerKey();
    return (await send(who,'publish_machine',{machine_id:machineId,machine_json:JSON.stringify(doc.machine),workers:doc.workers,expiry_blocks:'100'},BigInt((await this.limits()).publishDeposit))).tx;
  }
  async ensureWorkerKey():Promise<TxRef|undefined> {
    const who = await this.player(), key = this.key('worker');
    try { await this.workerPermission(); return; }
    catch(error) { if(!/UNKNOWN_ACCESS_KEY|access key .*does not exist/.test(String(error))) throw error; }
    const result = await who.signAndSendTransaction({receiverId:who.accountId,actions:[actions.addFunctionCallAccessKey(key.getPublicKey(),CONTRACT,['approve'],500_000_000_000_000_000_000_000n)],waitUntil:'FINAL'});
    await this.workerPermission(); this.workerKeyTx = txRef(result.transaction.hash); return this.workerKeyTx;
  }
  // UI can display this public RPC evidence without changing the shared interface.
  async workerPermission() {
    const who = await this.player();
    const publicKey = this.key('worker').getPublicKey().toString();
    const data = await rpc('query',{request_type:'view_access_key',finality:'final',account_id:who.accountId,public_key:publicKey});
    const permission = data.permission?.FunctionCall;
    if(!permission || permission.receiver_id !== CONTRACT || permission.method_names.length !== 1 || permission.method_names[0] !== 'approve') throw Error('Worker key does not have approve-only permission');
    return {publicKey,permission:data.permission,label:'This key can only approve'};
  }
  async getMachine(machineId:string) { checkLegacyId(machineId); const m = await view('get_machine',{machine_id:machineId}); return m ? {doc:{machine:m.machine,workers:m.workers},owner:m.owner,vaults:m.vaults} : null; }
  private remember<T extends OrderResult>(result:T):T {
    if(result.tx.hash) this.storage.setItem(`worldworks.testnet.order.${result.orderId}`,JSON.stringify(result.tx));
    for(const effect of result.effects) if(effect.kind === 'external') this.storage.setItem(`worldworks.testnet.payout.${effect.payoutId}`,JSON.stringify(result.tx));
    return result;
  }
  async order(machineId:string,recipient?:string,orderId:string=crypto.randomUUID()) { return this.remember(await placeOrder(await this.player(),machineId,recipient,orderId,tx=>this.storage.setItem(`worldworks.testnet.order.${orderId}`,JSON.stringify(tx)))); }
  async customerOrder(machineId:string,orderId:string=crypto.randomUUID(),recipient?:string) { return this.remember(await this.post('customer',{machineId,orderId,...(recipient?{recipient}:{})})); }
  async getOrder(machineId:string,orderId:string) {
    const saved=this.storage.getItem(`worldworks.testnet.order.${orderId}`);
    const found=await readOrder(machineId,orderId,saved?JSON.parse(saved):undefined);if(!found)return null;
    return this.remember({...found,tx:saved?JSON.parse(saved):found.tx});
  }
  async expiry(machineId:string, orderId:string) {
    checkLegacyId(machineId); checkLegacyId(orderId,64);
    const order = await view('get_order',{machine_id:machineId,order_id:orderId});
    if (!order) throw Error('Order not found');
    const block = await rpc('block',{finality:'final'});
    const expiresAt = String(order.expires_at), blockHeight = String(block.header.height);
    return {pending:!!order.pending, expiresAt, blockHeight, eligible:!!order.pending && BigInt(blockHeight) >= BigInt(expiresAt)};
  }
  async expire(machineId:string, orderId:string):Promise<ApproveResult> {
    if (!(await this.expiry(machineId,orderId)).eligible) throw Error('Order is not pending or has not expired');
    const {result,tx} = await send(await this.player(),'expire',{machine_id:machineId,order_id:orderId});
    const outcome = receiptResult(result,'expire');
    if (!outcome) return {tx,effects:[],pending:false,observation:'unknown'};
    this.remember({tx,orderId,...outcome});
    return {tx,effects:outcome.effects,pending:outcome.pending};
  }
  async balance() { return (await (await this.player()).getState()).balance.available.toString(); }
  async retrySignature(payoutId:string) { await send(await this.player(),'retry_signature',{payout_id:payoutId}); }
  async approve(machineId:string,orderId:string):Promise<ApproveResult> {
    checkLegacyId(machineId); checkLegacyId(orderId,64); await this.workerPermission();
    const {result,tx}=await send(await this.player(true),'approve',{machine_id:machineId,order_id:orderId});
    this.storage.setItem(`worldworks.testnet.order.${orderId}`,JSON.stringify(tx));
    const decoded=receiptResult(result,'approve');
    let observed=result;try {observed=await rpc('EXPERIMENTAL_tx_status',{tx_hash:tx.hash,sender_account_id:(await this.session()).accountId,wait_until:'FINAL'});}catch {}
    const outcome=decoded?withSettlement(observed,decoded):undefined;
    if(!outcome) return {tx,effects:[],pending:false,observation:'unknown'};
    this.remember({tx,orderId,...outcome});
    return {tx,effects:outcome.effects,pending:outcome.pending};
  }
  async getPayout(payoutId:string):Promise<PayoutView> {
    let payout = await this.post('payout',{payout_id:payoutId});
    const tx = this.storage.getItem(`worldworks.testnet.payout.${payoutId}`);
    return tx ? {...payout,nearTx:JSON.parse(tx)} : payout;
  }
  async relay(payoutId:string):Promise<PayoutView> { const result = await this.post('relay',{payout_id:payoutId}); if(result.status === 'waiting_for_earlier_nonce' || result.status === 'waiting_for_signature') return {...await this.getPayout(payoutId),status:result.status,waitingPayoutId:result.waitingPayoutId}; return this.getPayout(payoutId); }
  async getUnclaimed() { return view('get_unclaimed',{account:(await this.session()).accountId}); }
  limits() { return limits(); }
  async withdrawVault(machineId:string,vaultName:string,amount:string) { checkLegacyId(machineId); return (await send(await this.player(),'withdraw_vault',{machine_id:machineId,vault_name:vaultName,amount})).tx; }
  async withdrawUnclaimed() { return (await send(await this.player(),'withdraw_unclaimed',{})).tx; }
  async contractInfo() { return {contractId:CONTRACT,portalAddress:await view('get_portal_address',{}),explorer:`https://testnet.nearblocks.io/address/${CONTRACT}`}; }
}
export const liveApi:WorldworksApi = new LiveApi();
export const live = liveApi;
export default liveApi;
