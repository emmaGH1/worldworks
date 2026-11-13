import { useEffect, useState } from 'react';
/** A real hole: four input shields surround the target; the target keeps its own handlers. */
export function Spotlight({ target, text, onSkip }: { target: string; text: string; onSkip: () => void }) {
  const [box, setBox] = useState<DOMRect | null>(null);
  useEffect(() => {
    const measure = () => { const el = document.querySelector<HTMLElement>(`[data-testid="${target}"]`); setBox(el?.getBoundingClientRect() ?? null); };
    const el=document.querySelector<HTMLElement>(`[data-testid="${target}"]`); const focus=el && (el.matches('button') || el.tabIndex>=0)?el:el?.querySelector<HTMLElement>('button'); focus?.focus({preventScroll:true});
    measure(); const timer = setInterval(measure, 120); return () => clearInterval(timer);
  }, [target]);
  useEffect(() => {
    const block = (e: KeyboardEvent) => { if (e.key === 'Escape') { onSkip(); return; } const el = e.target as HTMLElement; if (!el.closest(`[data-testid="${target}"]`) && !el.closest('[data-testid="tutorial-skip"]')) { e.preventDefault(); e.stopPropagation(); } };
    document.addEventListener('keydown', block, true); return () => document.removeEventListener('keydown', block, true);
  }, [target, onSkip]);
  if (!box || !box.width) return null;
  const x = Math.max(2, box.x - 6), y = Math.max(2, box.y - 6), right = Math.min(innerWidth - 2, box.right + 6), bottom = Math.min(innerHeight - 2, box.bottom + 6);
  const below = bottom + 115 < innerHeight;
  const left = Math.max(12, Math.min(innerWidth - 262, (x + right) / 2 - 125));
  return <div className="j-guide" data-testid="tutorial" data-guide-target={target}>
    <div className="j-guide-hole" style={{left:x,top:y,width:right-x,height:bottom-y}} />
    {[{left:0,top:0,width:'100%',height:y},{left:0,top:bottom,width:'100%',bottom:0},{left:0,top:y,width:x,height:bottom-y},{left:right,right:0,top:y,height:bottom-y}].map((style,i)=><div key={i} className="j-guide-shield" style={style} onPointerDown={e=>{e.preventDefault();e.stopPropagation();}} />)}
    <div className={`j-guide-bubble ${below ? 'below' : 'above'}`} style={{left,top:below?bottom+14:Math.max(62,y-100)}} role="status"><span aria-hidden="true">{below?'↑':'↓'}</span>{text}</div>
    <button type="button" className="j-guide-skip" data-testid="tutorial-skip" onClick={onSkip}>Skip tutorial</button>
  </div>;
}
