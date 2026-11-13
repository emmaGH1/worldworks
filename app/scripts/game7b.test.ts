import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedPlots,type FactoryProgress} from '../src/game/jobs/factory.js';
import {PEOPLE} from '../src/game/jobs/jobs.js';
import type {LedgerRow} from '../src/lib/store.js';
const p:FactoryProgress={solved:{1:3,3:3},builds:{},shipped:{1:{machineId:'one'},3:{machineId:'three',payoutId:'9'}}};
const row=(patch:Partial<LedgerRow>):LedgerRow=>({id:'a',kind:'payout',title:`NEAR → ${PEOPLE.ada.account}`,amount:'0.06',status:'confirmed',statusText:'sent',mock:false,at:1,tx:{hash:'real',explorerUrl:''},orderId:'o',detail:['effect 0'],...patch});
const order=row({id:'order',kind:'order',detail:['machine one']});
test('gold flag: a plot counts as confirmed only with a settled, confirmed, non-mock receipt of its own machine',()=>{
  assert.deepEqual([...confirmedPlots([],p)],[]);
  assert.deepEqual([...confirmedPlots([order,row({})],p)],[1]);
  for(const bad of [{mock:true},{status:'unknown' as const},{status:'failed' as const},{statusText:'transfer requested'},{orderId:'other'}])assert.deepEqual([...confirmedPlots([order,row(bad)],p)],[],JSON.stringify(bad));
  assert.deepEqual([...confirmedPlots([row({payoutId:'9',unit:'ETH',orderId:undefined})],p)],[3]);
  assert.deepEqual([...confirmedPlots([row({payoutId:'9',unit:'ETH',orderId:undefined,status:'pending' as const})],p)],[]);
});
