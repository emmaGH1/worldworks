import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const secrets=new Set<string>();
for(const name of readdirSync('/opt/ww-secrets')) {
 const path=`/opt/ww-secrets/${name}`;
 if(!statSync(path).isFile()) continue;
 const text=readFileSync(path,'utf8');
 for(const match of text.matchAll(/ed25519:[1-9A-HJ-NP-Za-km-z]{80,100}/g)) secrets.add(match[0]);
 if(name==='chi-sepolia.json') for(const match of text.matchAll(/0x[0-9a-fA-F]{64}/g)) { secrets.add(match[0]); secrets.add(match[0].slice(2)); }
 if(/\.json$/.test(name)) {
  try {const v=JSON.parse(text);if(v.master_seed_phrase) secrets.add(v.master_seed_phrase);}catch{}
 }
}
const files=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{cwd:root}).toString().split('\0').filter(Boolean);
let scanned=0;
for(const name of new Set(files)) {
 const path=new URL(name,root);if(!existsSync(path) || !statSync(path).isFile()) continue;
 const bytes=readFileSync(path);scanned++;
 for(const secret of secrets) assert(!bytes.includes(Buffer.from(secret)),`Secret found in ${name}`);
}
console.log(`PASS: ${scanned} repository files scanned against ${secrets.size} private keys/seed phrases; no matches. Secret values not printed.`);
