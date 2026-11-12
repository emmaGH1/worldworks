import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { ACCOUNT, view, rpc, derive, assemble, relay } from './relay.js';

const id = process.argv[2] ?? 'run-2';
const amount = process.argv[3] ?? '1';
const label = process.env.EVIDENCE_LABEL ?? `${id}-${amount}`;
const args = {payout_id:id,recipient_evm_address:'0x000000000000000000000000000000000000dEaD',wei:amount};
const started = Date.now();
const child = spawn(`${process.env.HOME}/.cargo/bin/near`, ['contract','call-function','as-transaction',ACCOUNT,'pay','json-args',JSON.stringify(args),'prepaid-gas','300 Tgas','attached-deposit','0 NEAR','sign-as',ACCOUNT,'network-config','testnet','sign-with-legacy-keychain','send']);
let output=''; child.stdout.on('data', b=>output+=b); child.stderr.on('data',b=>output+=b);
const code = await new Promise(resolve=>child.on('close',resolve));
const returned = Date.now();
await writeFile(`../evidence/${label}.log`,output);
const hash = output.match(/Transaction ID: (\w+)/)?.[1];
let status:any;
if(hash) { status = await rpc('tx',{tx_hash:hash,sender_account_id:ACCOUNT,wait_until:'FINAL'}); await writeFile(`../evidence/${label}-tx.json`,JSON.stringify(status,null,2)); }
const result:any={id,amount,code,started_at:new Date(started).toISOString(),near_call_returned_at:new Date(returned).toISOString(),call_wall_ms:returned-started,hash};
if(status){
 result.total_tokens_burnt_yocto = ([status.transaction_outcome,...status.receipts_outcome].reduce((s:bigint,r:any)=>s+BigInt(r.outcome.tokens_burnt),0n)).toString();
 result.signer_receipts = status.receipts_outcome.filter((r:any)=>r.outcome.executor_id==='v1.signer-prod.testnet').map((r:any)=>r.id);
}
if(code===0) {
 const payout = await view(ACCOUNT,'get_payout',{payout_id:id});
 result.signature_observed_at = new Date().toISOString();
 result.submit_to_signature_observed_ms = Date.now()-started;
 result.payout = payout;
 if(payout.status==='signed') {result.raw_signed_tx = assemble(payout);result.derived_address = await derive();}
}
await writeFile(`../evidence/${label}.json`,JSON.stringify(result,null,2));
if(process.argv.includes('--relay') && code===0 && result.payout?.status==='signed') {
 try {
  result.evm = await relay(id);
  result.submit_to_receipt_ms = Date.now()-started;
  result.signature_to_receipt_ms = Date.now()-Date.parse(result.signature_observed_at);
 } catch(error) { result.evm_error = String(error); }
 await writeFile(`../evidence/${label}.json`,JSON.stringify(result,null,2));
}
console.log(JSON.stringify(result,null,2));
