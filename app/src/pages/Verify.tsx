// /verify: what is real, what is simulated, and commands to check it yourself. Wording follows docs/CLAIMS.md:
// no claims of immutability, audits or production safety.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { linkProps } from '../lib/router';
import { loadLimits, useLimits } from '../lib/limits';
import { ensureSession } from '../lib/store';
import { eth, near, shortAddr } from '../lib/units';
import { Logo, MockBadge } from '../components/bits';

// Real, confirmed earlier test payouts (docs/EVIDENCE-sepolia.md, 2026-11-12). Facts, not mock data.
const EVIDENCE = [
  '0xbf2a7ae14ef28044ce775f9c18ed0c6294ffe916aac1f84653253b51f9d0a3e6',
  '0xd3e3ebb392c064464a00fa17eb440f68b33fa9a4eeafc6a89ac421078b3efcdd',
  '0x69a0083e7352b83bba98a029cd204b3603581bfe9e2557a8e7000d36362e133f',
  '0xe96f4420ca8f84b65dd332b47d21e22a7502f02f76170c2267e058c0803bb90a',
  '0x10a30e352a7147fdb8bf7d0cfb855ee4c667cdb90dc26d7f1265f49c88ee3565',
];

const ROWS: Array<[string, 'real' | 'simulated' | 'labeled', string]> = [
  ['Machine rules', 'real', 'Published to the NEAR testnet contract and executed there on every order.'],
  ['Testnet balances', 'real', 'Orders move testnet NEAR between real testnet accounts. Testnet NEAR has no value.'],
  ['Your account', 'real', 'A testnet account created for this browser and funded by the app (sponsored). No wallet.'],
  ['Worker keys', 'real', 'A function-call key that can only call approve on this contract. The contract checks the caller.'],
  ['Cross-chain payout', 'real', 'The contract builds the Sepolia transfer and NEAR Chain Signatures (MPC) signs it. A relayer only broadcasts.'],
  ['Storage fee and deposit', 'real', 'Each order pays price + a storage fee the contract keeps; publishing attaches a storage deposit.'],
  ['The customer', 'labeled', 'A seeded customer: a script with its own testnet account. It is not an AI and not a real person.'],
  ['Story and characters', 'simulated', 'The broken lemonade stand, the faces on the parts and the sounds are the game.'],
  ['Money', 'labeled', 'All of it is testnet: NEAR testnet and Sepolia ETH. Nothing here is worth anything.'],
];

export function Verify() {
  const [info, setInfo] = useState<{ contractId: string; portalAddress: string; explorer: string } | null>(null);
  const [infoErr, setInfoErr] = useState<string | null>(null);
  const { limits } = useLimits();
  useEffect(() => {
    api.contractInfo().then(setInfo, e => setInfoErr((e as Error).message));
    void ensureSession().then(() => loadLimits());
  }, []);
  const contract = info?.contractId ?? '<contract-id>';
  const portal = info?.portalAddress ?? '<portal-address>';
  const mock = api.mode === 'mock';

  return (
    <div className="verify-page" data-testid="verify-page">
      <header className="v-top">
        <a {...linkProps('/')} className="home"><Logo /></a>
        <div className="sp" />
        <MockBadge />
        <a className="pill link" {...linkProps('/')}>back to the workshop</a>
      </header>
      <main className="v-main">
        <p className="eyebrow">Verify</p>
        <h1>Don’t trust the cartoon. <span>Check the chain.</span></h1>
        <p className="lede">WORLDWORKS is a testnet prototype. The parts are toys; the transactions are not. Everything below can be checked without this website.</p>
        {mock && <p className="v-warn"><b>You are looking at mock data.</b> This build has no contract configured, so the addresses below come from the mock API and nothing on this page touches a chain. The evidence links further down are real.</p>}

        <section className="v-grid">
          <div className="v-card">
            <h6>Contract (NEAR testnet)</h6>
            <p className="mono big">{info ? info.contractId : infoErr ? 'unavailable' : '…'}</p>
            {info && !mock && <a href={`https://testnet.nearblocks.io/address/${info.contractId}`} target="_blank" rel="noreferrer">open on NearBlocks ↗</a>}
          </div>
          <div className="v-card lilac">
            <h6>Portal treasury (Sepolia)</h6>
            <p className="mono big" title={portal}>{info ? shortAddr(info.portalAddress) : '…'}</p>
            {info && <a href={`https://sepolia.etherscan.io/address/${info.portalAddress}`} target="_blank" rel="noreferrer">open on Etherscan ↗</a>}
            <small>Derived from the contract account by NEAR Chain Signatures. Every machine’s Portal pays from this one address, up to a per-order cap.</small>
          </div>
          <div className="v-card">
            <h6>Fees the contract charges</h6>
            {limits ? (
              <ul className="v-list">
                <li><span>order storage fee</span><b className="mono">{near(limits.orderFee)} NEAR</b></li>
                <li><span>publish storage deposit</span><b className="mono">{near(limits.publishDeposit)} NEAR</b></li>
                <li><span>minimum Portal fee</span><b className="mono">{near(BigInt(limits.rate) * 10n ** 15n)} NEAR per 0.001 ETH</b></li>
                <li><span>Portal budget left this epoch</span><b className="mono">{eth(limits.epochRemainingWei)} of {eth(limits.epochBudgetWei)} ETH</b></li>
              </ul>
            ) : <p className="muted">Reading limits…</p>}
          </div>
        </section>

        <h2>What is real, what is not</h2>
        <table className="v-table" data-testid="real-table">
          <thead><tr><th>Thing</th><th>Status</th><th>What that means</th></tr></thead>
          <tbody>
            {ROWS.map(([t, s, d]) => <tr key={t}><td>{t}</td><td><span className={`tag ${s}`}>{s}</span></td><td>{d}</td></tr>)}
          </tbody>
        </table>

        <h2>What we do not claim</h2>
        <ul className="v-not">
          <li>This is not audited and not production software. Use testnet money only.</li>
          <li>The contract is not locked: until its account has no full-access keys, whoever holds those keys could change it. Check the key list yourself (command below).</li>
          <li>A Portal cap bounds each order, not lifetime spending; the contract also has a per-epoch budget.</li>
          <li>A NEAR order or a signature is not proof that ETH moved. Only a Sepolia receipt with status success is.</li>
        </ul>

        <h2>Verify it yourself</h2>
        <div className="v-cmds">
          <Cmd title="Read a published machine" cmd={`near contract call-function as-read-only ${contract} get_machine json-args '{"machine_id":"<machine-id>"}' network-config testnet now`} />
          <Cmd title="Read the fees and Portal budget" cmd={`near contract call-function as-read-only ${contract} get_limits json-args '{}' network-config testnet now`} />
          <Cmd title="Read a Portal payout (status, nonce, recipient)" cmd={`near contract call-function as-read-only ${contract} get_payout json-args '{"payout_id":"<payout-id>"}' network-config testnet now`} />
          <Cmd title="See which keys can act for the contract" cmd={`near account list-keys ${contract} network-config testnet now`} />
          <Cmd title="Check a Sepolia receipt from an RPC you choose" cmd={`curl -s https://rpc.sepolia.ethpandaops.io -H 'content-type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getTransactionReceipt","params":["<sepolia-tx-hash>"]}'`} />
          <Cmd title="Check the Portal treasury’s balance" cmd={`curl -s https://rpc.sepolia.ethpandaops.io -H 'content-type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"eth_getBalance","params":["${portal}","latest"]}'`} />
        </div>

        <h2>Earlier confirmed payouts</h2>
        <p className="muted">Five test payouts the contract built and the MPC network signed, confirmed on Sepolia on 2026-11-12 (from the project’s evidence file). Each receipt was read from two independent Sepolia RPCs.</p>
        <ol className="v-evidence">
          {EVIDENCE.map((h, i) => <li key={h}><span className="mono">payout {i}</span><a className="mono" href={`https://sepolia.etherscan.io/tx/${h}`} target="_blank" rel="noreferrer">{h.slice(0, 10)}…{h.slice(-6)} ↗</a></li>)}
        </ol>
      </main>
    </div>
  );
}

function Cmd({ title, cmd }: { title: string; cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="cmd">
      <div className="cmd-head"><b>{title}</b><button type="button" className="mini" onClick={() => { void navigator.clipboard?.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }, () => {}); }}>{copied ? 'copied' : 'copy'}</button></div>
      <pre className="mono">{cmd}</pre>
    </div>
  );
}
