import {useEffect, useRef} from 'react';
/** One history entry for the current overlay; changing panels never leaves stale entries. */
export function useDismiss(active: {id:string; selector:string; close:()=>void}|null) {
 const current=useRef(active);current.current=active;
 const owned=useRef(false), ignore=useRef(false);
 useEffect(()=>{
  const back=()=>{if(ignore.current){ignore.current=false;return;}if(owned.current){owned.current=false;current.current?.close();}};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&current.current){e.preventDefault();current.current.close();}};
  const outside=(e:PointerEvent)=>{const a=current.current,t=e.target;if(a&&t instanceof Element&&!t.closest(a.selector)&&!t.closest('.j-top button'))a.close();};
  addEventListener('popstate',back);addEventListener('keydown',key);document.addEventListener('pointerdown',outside);
  return()=>{removeEventListener('popstate',back);removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);if(owned.current){history.replaceState(null,'');owned.current=false;}};
 },[]);
 useEffect(()=>{
  if(active&&!owned.current){history.pushState({...history.state,wwOverlay:true},'');owned.current=true;}
  if(!active&&owned.current){owned.current=false;ignore.current=true;history.back();}
 },[active?.id]);
}
export function OverlayClose({onClose}:{onClose:()=>void}) {return <button type="button" className="j-overlay-close" aria-label="Dismiss overlay" onClick={onClose}>×</button>;}
