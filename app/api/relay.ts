import { relay } from './_portal.js';
// Structural Node request/response types work with Vercel without runtime imports.
export default async function handler(req: {method?: string; body?: unknown}, res: {
  status(code: number): {json(body: unknown): unknown}; setHeader(name: string, value: string): unknown;
}) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({error:'POST required'});
  }
  let body: unknown = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); }
  catch { return res.status(400).json({error:'Invalid JSON'}); }
  const id = (body as {payout_id?: unknown} | null)?.payout_id;
  if (typeof id !== 'string' || !/^(0|[1-9][0-9]*)$/.test(id) || id.length > 20)
    return res.status(400).json({error:'Invalid payout_id'});
  try { return res.status(200).json(await relay(id)); }
  catch (error) { return res.status(502).json({error:String(error)}); }
}
