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
