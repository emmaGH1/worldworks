import { useEffect, useState } from 'react';
import { useWorkshop } from './workshopCtx';
import { setGateCondition, updatePart, title, type Part } from '../lib/machine';
import { eth, near, parseEth, parseNear, pct } from '../lib/units';

/** A text field that only commits valid values, and says why when it can't. */
function AmountField({ label, value, unit, parse, format, onCommit, hint }: { label: string; value: string; unit: string; parse: (s: string) => string | null; format: (v: string) => string; onCommit: (v: string) => void; hint?: string }) {
  const [text, setText] = useState(format(value));
  const [bad, setBad] = useState(false);
  useEffect(() => { setText(format(value)); setBad(false); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <label className="field">
      <span>{label}</span>
      <div className={`input-unit ${bad ? 'bad' : ''}`}>
        <input inputMode="decimal" value={text} onChange={e => {
          setText(e.target.value);
          const v = parse(e.target.value);
          setBad(v === null);
          if (v !== null) onCommit(v);
        }} />
        <em>{unit}</em>
      </div>
      {bad ? <small className="bad-text">Use a number like 1.5</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function PartSettings({ id }: { id: string }) {
  const ctx = useWorkshop();
  const m = ctx.machine;
  const part = m.nodes[id];
  if (!part) return null;
  const set = (p: Part) => ctx.setMachine(updatePart(m, id, p));
  const name = (t: string) => (t ? title(m, t, ctx.session) : 'nowhere yet');

  let body: React.ReactNode = null;
  switch (part.type) {
    case 'CoinSlot':
      body = <AmountField label="Price per buy" value={part.price} unit="NEAR" parse={parseNear} format={v => near(v)} onCommit={v => set({ ...part, price: v })} hint="testnet NEAR, paid by whoever buys" />;
      break;
    case 'Splitter': {
      const two = part.outputs.length === 2;
      const setBps = (i: number, bps: number) => {
        const outputs = part.outputs.map(o => ({ ...o }));
        outputs[i].bps = bps;
        if (two) outputs[1 - i].bps = 10000 - bps;
        set({ ...part, outputs });
      };
      const total = part.outputs.reduce((a, o) => a + o.bps, 0);
      body = (
        <div className="split-settings">
          <p className="rule-words">{[...part.outputs].map((o, i) => ({ o, i })).sort((a, b) => b.o.bps - a.o.bps).map(({ o }) => `${pct(o.bps)} → ${name(o.target)}`).join(' · ')}</p>
          {two ? (
            <div className="split-slider">
              <span>{name(part.outputs[0].target)}</span>
              <input aria-label="Share for the first way" type="range" min={500} max={9500} step={500} value={part.outputs[0].bps} onChange={e => setBps(0, Number(e.target.value))} />
              <span>{name(part.outputs[1].target)}</span>
            </div>
          ) : (
            part.outputs.map((o, i) => (
              <label key={i} className="field row">
                <span>{name(o.target)}</span>
                <div className="input-unit small"><input inputMode="numeric" value={o.bps / 100} onChange={e => { const v = Math.round(Number(e.target.value) * 100); if (Number.isFinite(v) && v >= 0 && v <= 10000) setBps(i, v); }} /><em>%</em></div>
              </label>
            ))
          )}
          {total !== 10000 && <p className="popover-issue">Shares add up to {pct(total)}; they must make 100%.</p>}
          <div className="btn-row">
            {part.outputs.length < 4 && <button type="button" className="mini" onClick={() => {
              const n = part.outputs.length + 1;
              const each = Math.floor(10000 / n);
              const outputs = [...part.outputs.map(o => ({ ...o })), { bps: 0, target: '' }].map(o => ({ ...o, bps: each }));
              outputs[0].bps += 10000 - each * n;
              set({ ...part, outputs });
            }}>+ another way</button>}
            {part.outputs.length > 2 && <button type="button" className="mini" onClick={() => {
              const outputs = part.outputs.slice(0, -1).map(o => ({ ...o }));
              outputs[0].bps += part.outputs[part.outputs.length - 1].bps;
              set({ ...part, outputs });
            }}>− one way</button>}
          </div>
          <small>Odd yocto left over by rounding goes to the first way.</small>
        </div>
      );
      break;
    }
    case 'Vault':
      body = (
        <label className="field"><span>Name</span>
          <input value={part.name} maxLength={32} onChange={e => set({ ...part, name: e.target.value })} />
          <small>Money that lands here stays in the machine on chain.</small>
        </label>
      );
      break;
    case 'Gate': {
      const workersOnBoard = Object.keys(m.nodes).filter(k => m.nodes[k].type === 'Worker');
      const approval = part.condition.type === 'NeedsApproval';
      body = (
        <div className="gate-settings">
          <div className="seg">
            <button type="button" className={!approval ? 'on' : ''} onClick={() => ctx.setMachine(setGateCondition(m, id, { type: 'MinAmount', amount: '0' }))}>Amount rule</button>
            <button type="button" className={approval ? 'on' : ''} onClick={() => {
              if (workersOnBoard.length) ctx.setMachine(setGateCondition(m, id, { type: 'NeedsApproval', worker: workersOnBoard[0] }));
              else ctx.addWorkerFor(id);
            }}>Needs a Worker</button>
          </div>
          {part.condition.type === 'MinAmount' ? (
            <AmountField label="Passes if at least" value={part.condition.amount} unit="NEAR" parse={parseNear} format={v => near(v)}
              onCommit={v => ctx.setMachine(setGateCondition(m, id, { type: 'MinAmount', amount: v }))}
              hint={`otherwise money goes to ${name(part.fail)}`} />
          ) : (
            <label className="field"><span>Waits for</span>
              <select value={part.condition.worker} onChange={e => ctx.setMachine(setGateCondition(m, id, { type: 'NeedsApproval', worker: e.target.value }))}>
                {workersOnBoard.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
              <small>Approved → {name(part.pass)} · refused or expired → {name(part.fail)}</small>
            </label>
          )}
        </div>
      );
      break;
    }
    case 'Worker':
      body = (
        <div>
          <label className="field"><span>Bound to NEAR account</span>
            <input value={ctx.workers[id] ?? ''} placeholder="alice.testnet" onChange={e => ctx.setWorker(id, e.target.value.trim())} />
            <small>Only this account can approve; the contract checks the caller. Its one job: approve {part.gates.length ? part.gates.map(g => title(m, g)).join(', ') : '(no gate yet: drag from its key to a Gate)'}.</small>
          </label>
          {ctx.session && ctx.workers[id] !== ctx.session && <button type="button" className="mini" onClick={() => ctx.setWorker(id, ctx.session!)}>Use my account</button>}
        </div>
      );
      break;
    case 'Payout': {
      const payer = part.account === '$payer';
      body = (
        <div>
          <div className="seg">
            <button type="button" className={!payer ? 'on' : ''} onClick={() => set({ ...part, account: ctx.session ?? 'you.testnet' })}>Pay an account</button>
            <button type="button" className={payer ? 'on' : ''} onClick={() => set({ ...part, account: '$payer' })}>Back to the buyer</button>
          </div>
          {!payer && (
            <label className="field"><span>NEAR account</span>
              <input value={part.account} onChange={e => set({ ...part, account: e.target.value.trim() })} placeholder="alice.testnet" />
              {ctx.session && part.account !== ctx.session && <button type="button" className="mini" onClick={() => set({ ...part, account: ctx.session! })}>Pay me ({ctx.session})</button>}
            </label>
          )}
        </div>
      );
      break;
    }
    case 'Portal':
      body = (
        <div>
          <AmountField label="Pays on Sepolia" value={part.wei} unit="ETH" parse={parseEth} format={v => eth(v)} onCommit={v => set({ ...part, wei: v })} hint="fixed amount per order, from the shared Portal treasury" />
          <p className="explain"><b>Recipient:</b> whoever buys, at the Ethereum address they give at checkout. The seeded customer uses its own demo address.</p>
          <p className="explain">The NEAR that reaches the Portal is its fee. The contract asks NEAR Chain Signatures to sign the Sepolia payment; a relayer only broadcasts it.</p>
        </div>
      );
      break;
  }

  return (
    <div className="settings">
      {body}
      <button type="button" className="remove" onClick={() => ctx.removePart(id)}>Remove part</button>
    </div>
  );
}
