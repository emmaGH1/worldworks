// Run: node --env-file=/opt/ww-secrets/live.env --import tsx scripts/dev-api.ts
import { createServer } from 'node:http';
import session from '../api/session.js';
import customer from '../api/customer.js';
import relay from '../api/relay.js';
import payout from '../api/payout.js';
const handlers = {'/api/session':session,'/api/customer':customer,'/api/relay':relay,'/api/payout':payout};
createServer(async(req,res)=>{
  const origin = req.headers.origin;
  if(origin && /^http:\/\/(localhost|127\.0\.0\.1):[0-9]+$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  }
  if(req.method === 'OPTIONS') {res.writeHead(204).end();return;}
  let text = '';
  try {
    for await(const chunk of req) { text+=chunk; if(text.length > 16384) { res.writeHead(413).end(); return; } }
    const handler = handlers[(req.url ?? '') as keyof typeof handlers];
    if(!handler) {res.writeHead(404).end();return;}
    const response = {setHeader:(name:string,value:string)=>res.setHeader(name,value),status:(code:number)=>({json:(body:unknown)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}})};
    await handler({...req,body:text},response);
  } catch { if(!res.headersSent) res.writeHead(500); res.end(); }
}).listen(Number(process.env.API_PORT ?? 3001),'127.0.0.1',()=>console.log('WORLDWORKS testnet API http://127.0.0.1:3001'));
