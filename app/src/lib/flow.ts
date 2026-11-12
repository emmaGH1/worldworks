// Animation runtime: coins on pipes and part reactions. Purely visual; it replays effects the API returned.
import { useSyncExternalStore } from 'react';
import type { FlowSim } from './machine';
import { near } from './units';

export type Coin = { key: string; edge: string; start: number; duration: number; label: string; tone: 'gold' | 'lilac' };
export type NodeFx = { bump: number; flap: -1 | 1; pop?: { text: string; tone: 'gold' | 'lilac' | 'green'; key: number }; mood?: 'happy' | 'surprised'; armUp?: boolean; glint?: boolean };

type FlowState = { coins: Coin[]; nodes: Record<string, NodeFx> };
let st: FlowState = { coins: [], nodes: {} };
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());
const sub = (cb: () => void) => { subs.add(cb); return () => subs.delete(cb); };

export function useCoins(edge: string): Coin[] {
  const all = useSyncExternalStore(sub, () => st.coins);
  return all.filter(c => c.edge === edge);
}
export function useNodeFx(id: string): NodeFx | undefined {
  return useSyncExternalStore(sub, () => st.nodes[id]);
}

function patchNode(id: string, p: Partial<NodeFx>) {
  const prev = st.nodes[id] ?? { bump: 0, flap: -1 as const };
  st = { ...st, nodes: { ...st.nodes, [id]: { ...prev, ...p } } };
  emit();
}

// Path lengths are reported by the pipe components so coins travel at a constant speed.
const lengths = new Map<string, number>();
export function reportLength(edge: string, len: number) { lengths.set(edge, len); }

const SPEED = 180; // px/s, see --coin-speed
let seq = 0;

export type PlayHooks = {
  onArrive?: (node: string, at: number) => void;
  onSink?: (node: string, amount: bigint) => void;
  isPortal?: (node: string) => boolean;
  partType?: (node: string) => string | undefined;
};

/** Schedule coins along the simulated route; returns total duration in ms. */
export function play(sim: FlowSim, startNode: string, hooks: PlayHooks = {}): number {
  const now = performance.now();
  const arrival: Record<string, number> = { [startNode]: 0 };
  const coins: Coin[] = [];
  const timers: Array<[number, () => void]> = [];
  let end = 0;
  for (const s of sim.steps) {
    const t0 = arrival[s.from] ?? 0;
    const len = lengths.get(s.edge) ?? 220;
    const dur = Math.max(350, (len / SPEED) * 1000);
    const toPortal = hooks.isPortal?.(s.to) ?? false;
    coins.push({ key: `c${++seq}`, edge: s.edge, start: now + t0, duration: dur, label: near(s.amount), tone: toPortal ? 'lilac' : 'gold' });
    const t1 = t0 + dur;
    arrival[s.to] = Math.max(arrival[s.to] ?? 0, t1);
    end = Math.max(end, t1);
    // the source part flips its flap (Splitter) when each coin leaves
    timers.push([t0, () => {
      const fx = st.nodes[s.from];
      if (hooks.partType?.(s.from) === 'Splitter') patchNode(s.from, { flap: s.edge.endsWith('|o0') ? -1 : 1 });
      else if (hooks.partType?.(s.from) === 'Gate') patchNode(s.from, { armUp: s.edge.endsWith('|pass'), bump: (fx?.bump ?? 0) + 1 });
    }]);
    timers.push([t1, () => {
      const fx = st.nodes[s.to];
      patchNode(s.to, { bump: (fx?.bump ?? 0) + 1, mood: 'surprised' });
      hooks.onArrive?.(s.to, t1);
      setTimeout(() => patchNode(s.to, { mood: undefined }), 420);
    }]);
  }
  for (const sink of sim.sinks) {
    const t = arrival[sink.node] ?? 0;
    timers.push([t + 60, () => {
      const portal = hooks.isPortal?.(sink.node) ?? false;
      patchNode(sink.node, { pop: { text: `+${near(sink.amount)}`, tone: portal ? 'lilac' : hooks.partType?.(sink.node) === 'Payout' ? 'green' : 'gold', key: ++seq }, mood: 'happy' });
      hooks.onSink?.(sink.node, sink.amount);
      setTimeout(() => patchNode(sink.node, { mood: undefined }), 1600);
    }]);
  }
  st = { ...st, coins: [...st.coins, ...coins] };
  emit();
  for (const [t, f] of timers) setTimeout(f, t);
  setTimeout(() => {
    const keys = new Set(coins.map(c => c.key));
    st = { ...st, coins: st.coins.filter(c => !keys.has(c.key)) };
    for (const id of Object.keys(st.nodes)) if (st.nodes[id].armUp) st.nodes[id] = { ...st.nodes[id], armUp: false };
    emit();
  }, end + 900);
  return end;
}

export function bump(id: string, p: Partial<NodeFx> = {}) {
  patchNode(id, { bump: (st.nodes[id]?.bump ?? 0) + 1, ...p });
}
export function glint(id: string) {
  patchNode(id, { glint: true, mood: 'happy' });
  setTimeout(() => patchNode(id, { glint: false, mood: undefined }), 1200);
}
