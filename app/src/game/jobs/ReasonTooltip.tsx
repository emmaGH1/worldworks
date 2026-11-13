import { useEffect, useState } from 'react';
/** Delegated hover, keyboard focus and touch hold work on both render paths. */
export function ReasonTooltip() {
 const [tip,setTip]=useState<{text:string;x:number;y:number}|null>(null);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const show=(target:EventTarget|null)=>{const el=target instanceof Element?target.closest<HTMLElement>('[data-reason]'):null;if(!el){setTip(null);return;}const r=el.getBoundingClientRect();setTip({text:el.dataset.reason!,x:Math.max(12,Math.min(innerWidth-332,r.left)),y:Math.max(70,Math.min(innerHeight-170,r.bottom+8))});};
  const hover=(e:PointerEvent)=>{if(e.pointerType!=='touch')show(e.target);};
  const focus=(e:FocusEvent)=>show(e.target);
  const down=(e:PointerEvent)=>{if(e.pointerType!=='touch')return;const inside=e.target instanceof Element&&!!e.target.closest('[data-reason]');if(!inside){setTip(null);return;}timer=setTimeout(()=>show(e.target),450);};
  const clear=()=>{clearTimeout(timer);}; const hide=()=>{clear();setTip(null);};
  document.addEventListener('pointerover',hover);document.addEventListener('focusin',focus);document.addEventListener('pointerdown',down);document.addEventListener('pointerup',clear);document.addEventListener('pointermove',clear);document.addEventListener('scroll',hide,true);
  return ()=>{clear();document.removeEventListener('pointerover',hover);document.removeEventListener('focusin',focus);document.removeEventListener('pointerdown',down);document.removeEventListener('pointerup',clear);document.removeEventListener('pointermove',clear);document.removeEventListener('scroll',hide,true);};
 },[]);
 return tip?<aside role="tooltip" className="j-reason-tooltip" style={{left:tip.x,top:tip.y}}>{tip.text}</aside>:null;
}
