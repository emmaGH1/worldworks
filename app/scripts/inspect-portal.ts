import { ACCOUNT, assemble, client, derive, view } from '../api/_portal.js';
import { recoverTransactionAddress, keccak256 } from 'viem';
const payout = await view(ACCOUNT,'get_payout',{payout_id:process.argv[2] ?? '0'});
const address = await derive();
const stored_address = await view(ACCOUNT,'get_portal_address',{});
const balance = (await client.getBalance({address})).toString();
const raw = payout?.status === 'signed' ? assemble(payout) : undefined;
console.log(JSON.stringify({account:ACCOUNT,address,stored_address,balance,chainId:await client.getChainId(),payout,raw_signed_tx:raw,recovered:raw ? await recoverTransactionAddress({serializedTransaction:raw}):undefined,evm_tx_hash:raw ? keccak256(raw):undefined},null,2));
