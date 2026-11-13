// The deployed signer fixes transfer gas at 21,000. Do not spend another order on a
// recipient whose current Sepolia estimate exceeds what the contract can sign
// (a never-used Sepolia address currently estimates ~205k gas for a plain transfer).
export const SIGNED_TRANSFER_GAS = 21000n;
export async function checkPortalGas(from: string, to: string, wei: string, request: typeof fetch = fetch, who = 'Chi’s') {
  const unavailable = () => Error(`Cannot check ${who} Ethereum payment right now. No sale was sent. Try checking again later.`);
  const response = await request('https://rpc.sepolia.ethpandaops.io', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_estimateGas', params: [{ from, to, value: `0x${BigInt(wei).toString(16)}` }] }),
  }).catch(() => { throw unavailable(); });
  const result = await response.json().catch(() => { throw unavailable(); });
  if (!response.ok || result.error || !/^0x[0-9a-f]+$/i.test(result.result ?? '')) throw unavailable();
  if (BigInt(result.result) > SIGNED_TRANSFER_GAS) throw Error(`${who} Ethereum wallet needs more gas than this test contract allows (it looks never used). No sale was sent. Use an address that has received Sepolia ETH before.`);
}


export function portalAdmission(wei:string,fee:string,l:{rate:string;maxWeiPerPayout?:string;epochRemainingWei:string}) {
  const amount=BigInt(wei);
  if(amount>BigInt(l.maxWeiPerPayout ?? '0') || BigInt(fee)<BigInt(l.rate)*amount)throw Error('This Portal does not meet the contract limits.');
  if(BigInt(l.epochRemainingWei)<amount+SIGNED_TRANSFER_GAS*100_000_000_000n)throw Error('Ethereum payouts are busy right now (shared hourly budget used up). Try again later.');
}
/** Only the named Chi demo jobs have an implicit demo destination. */
export function checkoutRecipient(machineId:string,suggested:string|null,chi:string) {
  if(/^0x[0-9a-f]{40}$/i.test(suggested ?? ''))return suggested!;
  return /^(abroad|abroad3)-/.test(machineId)?chi:'';
}

/** Conservative admission over both approval/expiry paths, including Portals held behind a Gate. */
export function checkoutPortalRoutes(machine:{nodes:Record<string,any>}) {
  const routes:Array<{wei:string;fee:string}>=[];let visits=0;
  const walk=(id:string,amount:bigint,depth=0)=>{
    if(depth>40 || ++visits>4096)throw Error('Cannot verify all Portal routes. No order sent.');
    const p=machine.nodes[id];if(!p)throw Error('Machine has a missing route.');
    if(p.type==='CoinSlot')walk(p.output,amount,depth+1);
    if(p.type==='Splitter') {
      const shares=p.outputs.map((o:any)=>amount*BigInt(o.bps)/10000n);
      shares[0]+=amount-shares.reduce((a:bigint,b:bigint)=>a+b,0n);
      p.outputs.forEach((o:any,i:number)=>walk(o.target,shares[i],depth+1));
    }
    if(p.type==='Gate') {
      if(p.condition.type==='NeedsApproval'){walk(p.pass,amount,depth+1);walk(p.fail,amount,depth+1);}
      else walk(amount>=BigInt(p.condition.amount)?p.pass:p.fail,amount,depth+1);
    }
    if(p.type==='Portal' && amount>0n)routes.push({wei:p.wei,fee:String(amount)});
  };
  const slot=Object.entries(machine.nodes).find(([,p])=>p.type==='CoinSlot');
  if(!slot)throw Error('Machine has no price.');walk(slot[0],BigInt(slot[1].price));return routes;
}
