import { readFile, writeFile } from 'node:fs/promises';
import { rpc, view, assemble, derive } from './relay.js';
for(const id of ['run-1','run-2','run-3']) {
 const payout = await view('ww-chainsig-261112.testnet','get_payout',{payout_id:id});
 const address = await derive();
 const raw=assemble(payout);
 const { recoverTransactionAddress } = await import('viem');
 const recovered = await recoverTransactionAddress({serializedTransaction:raw});
 if(address !== recovered) throw Error('wrong recovered address');
 await writeFile(`../evidence/${id}-verified.json`,JSON.stringify({payout,address,recovered,raw},null,2));
 if(id==='run-1') {
 await writeFile('../evidence/run-1-tx.json',JSON.stringify(await rpc('tx',{tx_hash:'DoCLooJoix1v3N1DZnwe9x1RfDT2C6fy1Z8rv2kpFNdZ',sender_account_id:'ww-chainsig-261112.testnet',wait_until:'FINAL'}),null,2));
}
 if(id==='run-2') {
 const record=JSON.parse(await readFile('../evidence/run-2-summary.log','utf8'));
 await writeFile('../evidence/run-2-success.json',JSON.stringify(record,null,2));
 await writeFile('../evidence/run-2-success-tx.json',JSON.stringify(await rpc('tx',{tx_hash:record.hash,sender_account_id:'ww-chainsig-261112.testnet',wait_until:'FINAL'}),null,2));
 }
}
