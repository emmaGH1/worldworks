import { createContext, useContext } from 'react';
import type { Machine, PartType } from '../lib/machine';

export type WorkshopCtx = {
  machine: Machine;
  session?: string;
  workers: Record<string, string>;
  issues: Record<string, string[]>;
  readOnly: boolean;
  dragging: PartType | null;
  hoverTarget: string | null;
  hintEdge: string | null;
  highlightEdges: Set<string>;
  vaultFill: Record<string, number>;
  portalBusy: boolean;
  setMachine: (m: Machine) => void;
  setWorker: (name: string, account: string) => void;
  removePart: (id: string) => void;
  insertOnPipe: (edgeId: string, type: PartType) => void;
  addWorkerFor: (gate: string) => void;
  select: (id: string | null) => void;
};

export const Ctx = createContext<WorkshopCtx | null>(null);
export function useWorkshop(): WorkshopCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('Workshop context missing');
  return c;
}
