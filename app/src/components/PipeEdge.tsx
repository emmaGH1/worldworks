import { useEffect, useLayoutEffect, useRef } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps, type Edge } from '@xyflow/react';
import { reportLength, useCoins, type Coin } from '../lib/flow';
import { useWorkshop } from './workshopCtx';

export type PipeData = { kind: 'money' | 'key'; label?: string; insertable?: boolean; toPortal?: boolean };
export type PipeEdgeType = Edge<PipeData, 'pipe'>;

export function PipeEdge(props: EdgeProps<PipeEdgeType>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const ctx = useWorkshop();
  const [path, lx, ly] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 26, offset: 26 });
  const measure = useRef<SVGPathElement>(null);
  const coins = useCoins(id);
  useLayoutEffect(() => { if (measure.current) reportLength(id, measure.current.getTotalLength()); }, [path, id]);

  if (data?.kind === 'key') {
    return (
      <g className="pipe-key">
        <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth={3} strokeDasharray="2 9" strokeLinecap="round" opacity={0.7} />
        <EdgeLabelRenderer>
          <div className="key-tag nodrag nopan" style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}>
            <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="5" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M8.5 8h6M12.5 8v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
            can approve
          </div>
        </EdgeLabelRenderer>
      </g>
    );
  }

  const dragging = ctx.dragging;
  const showSocket = !ctx.readOnly && ((dragging && data?.insertable) || (!dragging && ctx.hintEdge === id));
  const hot = ctx.hoverTarget === `pipe:${id}`;
  const highlighted = ctx.highlightEdges.has(id);
  return (
    <g className={`pipe ${selected ? 'selected' : ''} ${highlighted ? 'route' : ''}`}>
      <path d={path} fill="none" stroke="var(--color-pipe-shadow)" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 6)" />
      {highlighted && <path d={path} fill="none" stroke="var(--color-coin)" strokeOpacity={0.45} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round" />}
      <path ref={measure} d={path} fill="none" stroke={data?.toPortal ? 'var(--color-pipe)' : 'var(--color-pipe)'} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
      <path d={path} fill="none" stroke="var(--color-pipe-stripe)" strokeWidth={3} strokeDasharray="2 12" strokeLinecap="round" />
      {selected && <path d={path} fill="none" stroke="var(--color-coin)" strokeWidth={4} strokeLinecap="round" strokeDasharray="10 8" />}
      <BaseEdge id={id} path={path} style={{ stroke: 'transparent', strokeWidth: 1 }} interactionWidth={36} />
      <path d={path} fill="none" stroke="transparent" strokeWidth={48} data-pipe={id} style={{ pointerEvents: 'stroke' }} />
      {coins.map(c => <RollingCoin key={c.key} coin={c} path={measure} />)}
      <EdgeLabelRenderer>
        {data?.label && (
          <div className="pipe-label nodrag nopan" style={{ transform: `translate(0,-50%) translate(${sourceX + 14}px,${sourceY - 22}px)` }}>{data.label}</div>
        )}
        {showSocket && (
          <button
            type="button"
            className={`socket nodrag nopan ${hot ? 'hot' : ''} ${ctx.hintEdge === id && !dragging ? 'hint' : ''}`}
            data-pipe={id}
            data-testid={`socket-${id}`}
            aria-label="Insert a Splitter here"
            style={{ transform: `translate(-50%,-50%) translate(${lx}px,${ly}px)` }}
            onClick={() => ctx.insertOnPipe(id, 'Splitter')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20"><path d="M4 10h12M10 4v12" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" /></svg>
          </button>
        )}
      </EdgeLabelRenderer>
    </g>
  );
}

function RollingCoin({ coin, path }: { coin: Coin; path: React.RefObject<SVGPathElement | null> }) {
  const g = useRef<SVGGElement>(null);
  useEffect(() => {
    let raf = 0;
    const step = () => {
      const el = path.current;
      const node = g.current;
      if (!el || !node) return;
      const t = (performance.now() - coin.start) / coin.duration;
      if (t < 0) { node.style.opacity = '0'; raf = requestAnimationFrame(step); return; }
      if (t > 1) { node.style.opacity = '0'; return; }
      const len = el.getTotalLength();
      const d = len * t; // linear: constant speed, never eased
      const p = el.getPointAtLength(d);
      node.style.opacity = '1';
      node.setAttribute('transform', `translate(${p.x} ${p.y})`);
      const spin = node.querySelector('.spin') as SVGGElement | null;
      spin?.setAttribute('transform', `rotate(${(d / 11) * (180 / Math.PI)})`);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [coin, path]);
  const lilac = coin.tone === 'lilac';
  return (
    <g ref={g} style={{ opacity: 0 }} className="coin">
      <g className="spin">
        <circle r={11.5} fill={lilac ? 'var(--color-portal-shade)' : 'var(--color-coin-rim)'} />
        <circle r={9} fill={lilac ? 'var(--color-portal-light)' : 'var(--color-coin)'} />
        <rect x={-1.6} y={-6.5} width={3.2} height={13} rx={1.6} fill={lilac ? '#fff' : 'var(--color-coin-light)'} />
      </g>
      <g transform="translate(0 -24)">
        <rect x={-21} y={-9} width={42} height={18} rx={9} fill="#fff" />
        <text textAnchor="middle" y={4} className="coin-label">{coin.label}</text>
      </g>
    </g>
  );
}
