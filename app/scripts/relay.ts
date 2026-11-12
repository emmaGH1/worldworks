import { relay } from '../api/portal.js';
const id = process.argv[2];
if (!id) throw Error('Usage: npx tsx scripts/relay.ts <payout_id>');
console.log(JSON.stringify(await relay(id)));
