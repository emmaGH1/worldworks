import { relay } from '../api/_portal.js';
const id = process.argv[2];
if (!id || !/^(0|[1-9][0-9]{0,19})$/.test(id)) throw Error('Usage: npx tsx scripts/relay.ts <payout_id>');
console.log(JSON.stringify(await relay(id)));
