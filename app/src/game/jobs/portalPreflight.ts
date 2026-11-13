// The deployed signer fixes transfer gas at 21,000. Do not spend another order on a
// recipient whose current Sepolia estimate exceeds what the contract can sign.
export const SIGNED_TRANSFER_GAS = 21000n;
export async function checkPortalGas(from: string, to: string, wei: string, request: typeof fetch = fetch) {
  const unavailable = () => Error('Cannot check Chi’s Ethereum payment right now. No sale was sent. Try checking again later.');
  const response = await request('https://rpc.sepolia.ethpandaops.io', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_estimateGas', params: [{ from, to, value: `0x${BigInt(wei).toString(16)}` }] }),
  }).catch(() => { throw unavailable(); });
  const result = await response.json().catch(() => { throw unavailable(); });
  if (!response.ok || result.error || !/^0x[0-9a-f]+$/i.test(result.result ?? '')) throw Error('Cannot check Chi’s Ethereum payment right now. No sale was sent. Try checking again later.');
  if (BigInt(result.result) > SIGNED_TRANSFER_GAS) throw Error('Chi’s Ethereum wallet needs more gas than this test contract allows. No sale was sent. The demo needs an initialized wallet or a contract update.');
}
