import { DEMO_RECIPIENT, placeOrder, view, price, limits } from './near.js';
import { body, quota, withSpend, envAccount, failure, serialized, type Request, type Response } from './server-common.js';
export default async function handler(req:Request,res:Response) {
  try {
    const data = body(req,res,'customer');
    if(typeof data.machineId !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(data.machineId)) return res.status(400).json({error:'Invalid machineId'});
    if(data.recipient !== undefined && (typeof data.recipient !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(data.recipient))) return res.status(400).json({error:'Invalid Sepolia recipient'});
    return await serialized(async()=>{
      const customer = envAccount('CUSTOMER');
      const machine = await view('get_machine',{machine_id:data.machineId});
      if(!machine || BigInt(price(machine.machine)) > 1_000_000_000_000_000_000_000_000n) return res.status(400).json({error:'Seeded customer budget is at most 1 testnet NEAR per order'});
      quota(req,'customer');
      const reservation=BigInt(price(machine.machine))+BigInt((await limits()).orderFee)+100_000_000_000_000_000_000_000n;
      const result = await withSpend('CUSTOMER',customer,reservation,()=>placeOrder(customer,data.machineId,data.recipient ?? DEMO_RECIPIENT));
      return res.status(200).json({...result,customer:customer.accountId,label:'seeded customer'});
    });
  } catch(error) { return failure(res,error); }
}
