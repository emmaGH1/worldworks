import { useEffect, useState } from 'react';
/** Delegated hover, keyboard focus and touch hold work on both render paths. */
export function ReasonTooltip({onDismissChange}:{onDismissChange?:(close:(()=>void)|null)=>void}) {
 const [tip,setTip]=useState<{text:string;x:number;y:number}|null>(null);
 useEffect(()=>{onDismissChange?.(tip?()=>setTip(null):null);return()=>onDismissChange?.(null);},[!!tip,onDismissChange]);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const show=(target:EventTarget|null)=>{const el=target instanceof Element?target.closest<HTMLElement>('[data-reason]'):null;if(!el){if(!(target instanceof Element&&target.closest('.j-reason-tooltip')))setTip(null);return;}const r=el.getBoundingClientRect();setTip({text:el.dataset.reason!,x:Math.max(12,Math.min(innerWidth-332,r.left)),y:Math.max(70,Math.min(innerHeight-170,r.bottom+8))});};
  const hover=(e:PointerEvent)=>{if(e.pointerType!=='touch')show(e.target);};
  const focus=(e:FocusEvent)=>show(e.target);
  const down=(e:PointerEvent)=>{if(e.pointerType!=='touch')return;const inside=e.target instanceof Element&&!!e.target.closest('[data-reason]');if(!inside){setTip(null);return;}timer=setTimeout(()=>show(e.target),450);};
  const clear=()=>{clearTimeout(timer);}; const hide=()=>{clear();setTip(null);};
  const action=(e:MouseEvent)=>{if(e.target instanceof Element&&e.target.closest('button,a')&&!e.target.closest('.j-reason-tooltip,.j-factory-hit,.j-belt-hit'))hide();};
  document.addEventListener('click',action,true);
  document.addEventListener('pointerover',hover);document.addEventListener('focusin',focus);document.addEventListener('pointerdown',down);document.addEventListener('pointerup',clear);document.addEventListener('pointermove',clear);document.addEventListener('scroll',hide,true);
  return ()=>{clear();document.removeEventListener('click',action,true);document.removeEventListener('pointerover',hover);document.removeEventListener('focusin',focus);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',clear);document.removeEventListener('pointermove',clear);document.removeEventListener('scroll',hide,true);};
 },[]);
 return tip?<aside role="tooltip" className="j-reason-tooltip" style={{left:tip.x,top:tip.y}}><button className="j-overlay-close" aria-label="Close tooltip" onClick={()=>setTip(null)}>×</button>{tip.text}</aside>:null;
}
