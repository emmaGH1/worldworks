import { useEffect, useRef, useState } from 'react';
import { Handle, NodeToolbar, Position, type Node, type NodeProps } from '@xyflow/react';
import { PartArt, type Mood } from './PartArt';
import { useWorkshop } from './workshopCtx';
import { useNodeFx } from '../lib/flow';
import { outPorts, ruleChip, title, PART_BLURB, type PartType } from '../lib/machine';
import { PartSettings } from './PartSettings';

export type PartNodeType = Node<{ partType: PartType }, 'part'>;

const ART = 112;

function outTops(n: number): number[] {
  if (n === 1) return [ART / 2];
  if (n === 2) return [36, 80];
  if (n === 3) return [26, 56, 86];
  return [20, 44, 68, 92];
}

export function PartNode({ id, selected }: NodeProps<PartNodeType>) {
  const ctx = useWorkshop();
  const part = ctx.machine.nodes[id];
  const fx = useNodeFx(id);
  const [squash, setSquash] = useState(false);
  const lastBump = useRef(fx?.bump ?? 0);
  useEffect(() => {
    if ((fx?.bump ?? 0) !== lastBump.current) {
      lastBump.current = fx?.bump ?? 0;
      setSquash(false);
      requestAnimationFrame(() => setSquash(true));
    }
  }, [fx?.bump]);
  if (!part) return null;

  const issues = ctx.issues[id] ?? [];
  let mood: Mood = 'idle';
  if (issues.length) mood = 'worried';
  if (part.type === 'Vault' && (ctx.vaultFill[id] ?? 0) <= 0.001) mood = 'worried';
  if (part.type === 'Vault' && (ctx.vaultFill[id] ?? 0) > 0.001) mood = 'happy';
  if (part.type === 'Portal' && ctx.portalBusy) mood = 'surprised';
  if (fx?.mood) mood = fx.mood;

  const ports = outPorts(part);
  const tops = outTops(ports.length);
  const isGate = part.type === 'Gate';
  const gateTops = [38, 82];

  return (
    <div className={`part-node t-${part.type} ${selected ? 'selected' : ''} ${issues.length ? 'has-issue' : ''}`} data-testid={`part-${id}`} data-part-type={part.type}>
      <div className={`art-wrap ${squash ? 'squash' : ''}`} onAnimationEnd={() => setSquash(false)}>
        <PartArt type={part.type} s={{
          mood,
          flap: fx?.flap ?? -1,
          split: part.type === 'Splitter' ? part.outputs[0]?.bps / 10000 : undefined,
          fill: ctx.vaultFill[id] ?? 0,
          armUp: fx?.armUp,
          glint: fx?.glint,
          spinning: part.type === 'Portal' && ctx.portalBusy,
          glow: part.type === 'Payout' ? mood === 'happy' && !!fx?.pop : undefined,
        }} />
        {part.type === 'Portal' && ctx.portalBusy && <div className="portal-orbit" aria-hidden><i /></div>}
        {issues.length > 0 && <div className="issue-dot" title={issues.join('\n')}>!</div>}
        {fx?.pop && <div key={fx.pop.key} className={`pop pop-${fx.pop.tone}`}>{fx.pop.text}</div>}
      </div>
      <div className="part-label">
        <b>{title(ctx.machine, id, ctx.session)}</b>
        <span className={`chip-rule ${part.type === 'Portal' ? 'lilac' : ''}`}>{ruleChip(ctx.machine, id, ctx.session)}</span>
      </div>
      {part.type === 'Portal' && (
        <div className="sepolia-pill" aria-hidden>
          <span className="globe" />
          <span><b>Sepolia</b><small>Ethereum testnet</small></span>
        </div>
      )}

      {part.type !== 'CoinSlot' && part.type !== 'Worker' && (
        <Handle type="target" position={Position.Left} id="in" className="port port-in" style={{ top: ART / 2 }} isConnectable={!ctx.readOnly} />
      )}
      {isGate && <Handle type="target" position={Position.Top} id="perm" className="port port-perm" style={{ left: ART / 2 }} isConnectable={!ctx.readOnly} />}
      {part.type === 'Worker' && <Handle type="source" position={Position.Bottom} id="key" className="port port-key" style={{ left: ART / 2, top: ART + 58 }} isConnectable={!ctx.readOnly} />}
      {ports.map((p, i) => {
        const top = isGate ? gateTops[i] : tops[i];
        return (
          <div key={p.port}>
            <Handle type="source" position={Position.Right} id={p.port} className="port port-out" style={{ top }} isConnectable={!ctx.readOnly} />
            {!p.target && (
              <div className={`stub ${ctx.hoverTarget === `socket:${id}|${p.port}` ? 'hot' : ''}`} style={{ top }} data-socket={`${id}|${p.port}`} title="Drop a part here, or drag from this port to a part">
                <span className="stub-pipe" />
                <span className="stub-socket" data-socket={`${id}|${p.port}`}>+</span>
                {p.label && <span className="stub-label">{p.label}</span>}
              </div>
            )}
          </div>
        );
      })}

      {!ctx.readOnly && (
        <NodeToolbar isVisible={selected} position={Position.Bottom} offset={14} className="nodrag nopan nowheel">
          <div className="popover" role="dialog" aria-label={`${title(ctx.machine, id)} settings`}>
            <header><b>{title(ctx.machine, id, ctx.session)}</b><span>{PART_BLURB[part.type]}</span>
              <button type="button" className="x" aria-label="Close" onClick={() => ctx.select(null)}>×</button></header>
            {issues.map(t => <p key={t} className="popover-issue">{t}</p>)}
            <PartSettings id={id} />
          </div>
        </NodeToolbar>
      )}
    </div>
  );
}
