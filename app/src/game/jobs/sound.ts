// Sample-first effects and an original four-part score. All sources share a limited mix bus.
export type Settings = { music: boolean; effects: boolean; volume: number; musicVolume: number; effectsVolume: number };
export const DEFAULT_AUDIO: Settings = {music:true,effects:true,volume:.8,musicVolume:.7,effectsVolume:.85};
const low = new URLSearchParams(location.search).get('lowfx') === '1';
let settings = {...DEFAULT_AUDIO};
try { const saved=JSON.parse(localStorage.getItem('ww-audio6')??'null'); if(saved)settings={...settings,...saved}; } catch { /* blocked storage */ }
if(low)settings.music=settings.effects=false;
export function createMix(context: BaseAudioContext) {
  const master=context.createGain(), music=context.createGain(), effects=context.createGain(), limiter=context.createDynamicsCompressor();
  limiter.threshold.value=-3;limiter.knee.value=0;limiter.ratio.value=20;limiter.attack.value=.002;limiter.release.value=.12;
  music.connect(master);effects.connect(master);master.connect(limiter);limiter.connect(context.destination);
  return {master,music,effects,limiter};
}
type Kind='coin'|'place'|'pass'|'fail'|'gem'|'tap'|'pickup'|'dial'|'belt'|'tick'|'star'|'ship'|'beam'|'unlock';
const samples: Record<Kind,string>={coin:'glass_001',place:'drop_002',pass:'confirmation_002',fail:'error_004',gem:'confirmation_002',tap:'click_003',pickup:'select_002',dial:'scroll_002',belt:'tick_002',tick:'tick_002',star:'glass_001',ship:'maximize_003',beam:'open_002',unlock:'confirmation_002'};
let ctx: AudioContext|undefined, mix: ReturnType<typeof createMix>|undefined, timer:ReturnType<typeof setInterval>|undefined;
let beat=0, factory=false, testing=false, ducked=false, loading=false;
let buildLayer:GainNode|undefined,factoryLayer:GainNode|undefined;
const buffers=new Map<string,AudioBuffer>(), last=new Map<string,number>();
function apply() { if(!ctx||!mix)return;const at=ctx.currentTime;mix.master.gain.setTargetAtTime(settings.volume,at,.025);mix.music.gain.setTargetAtTime(settings.music?settings.musicVolume*(ducked?.22:1):0,at,.25);mix.effects.gain.setTargetAtTime(settings.effects?settings.effectsVolume:0,at,.025); }
function note(freq:number,duration:number,volume:number,type:OscillatorType='sine',delay=0,end=freq,music=true,layer?:GainNode) {
 if(!ctx||!mix||ctx.state!=='running'||document.hidden)return;
 const o=ctx.createOscillator(),g=ctx.createGain(),at=ctx.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,at);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
 g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume*(music?2:1),at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+duration);o.connect(g).connect(music?(layer??mix.music):mix.effects);o.start(at);o.stop(at+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};
}
function pulse(){
 if(!ctx||document.hidden)return;
 const roots=[130.81,110,174.61,196],root=roots[Math.floor(beat/8)%4];
 // Two synchronized arrangements; sustaining chords crossfade on scene changes.
 for(const bright of [false,true]) {
  const layer=bright?factoryLayer:buildLayer;
  const voice=(f:number,d:number,v:number,t:OscillatorType='sine',end=f)=>note(f,d,v,t,0,end,true,layer);
  if(beat%8===0)[1,1.25,1.5].forEach(m=>voice(root*m*(bright?2:1),2.9,bright?.055:.085,'triangle'));
  if(beat%2===0)voice(root/2,.32,.22,'triangle');
  const melody=bright?[2,3,2.5,3,4,3,2.5,2]:[2,2.5,3,2.5,2.25,2,1.5,2];
  if(beat%2===0||bright)voice(root*melody[beat%8]*(testing?1.25:1),.22,bright?.11:.08);
  if(beat%4===0)voice(135,.16,.46,'sine',42);
  if(beat%2===1)voice(5900,.035,.045,'square',3400);
 }
 beat++;
}
async function preload(){
 if(loading||!ctx)return;loading=true;const context=ctx;
 await Promise.all([...new Set(Object.values(samples))].map(async name=>{
  for(const ext of ['ogg','mp3'])try{const r=await fetch(`/sounds/${name}.${ext}`);if(!r.ok)continue;const b=await context.decodeAudioData(await r.arrayBuffer());if(ctx===context)buffers.set(name,b);return;}catch{/* codec/network fallback */}
 }));
}
export const sound={
 get settings(){return {...settings};},get muted(){return !settings.music&&!settings.effects;},
 configure(patch:Partial<Settings>){settings={...settings,...patch};for(const key of ['volume','musicVolume','effectsVolume'] as const)settings[key]=Math.max(0,Math.min(1,settings[key]));try{localStorage.setItem('ww-audio6',JSON.stringify(settings));}catch{/* unavailable */}apply();},
 mute(value:boolean){this.configure({music:!value,effects:!value});},
 unlock(){try{if(!ctx){ctx=new AudioContext();mix=createMix(ctx);buildLayer=ctx.createGain();factoryLayer=ctx.createGain();buildLayer.connect(mix.music);factoryLayer.connect(mix.music);buildLayer.gain.value=factory?0:1;factoryLayer.gain.value=factory?1:0;apply();const silent=ctx.createBufferSource();silent.buffer=ctx.createBuffer(1,1,ctx.sampleRate);silent.connect(mix.master);silent.start();void preload();}if(ctx.state==='suspended')void ctx.resume().catch(()=>{});if(!timer){pulse();timer=setInterval(pulse,375);}}catch{/* no audio */}},
 test(on:boolean){testing=on;},ambience(on:boolean){factory=on;if(ctx&&buildLayer&&factoryLayer){buildLayer.gain.setTargetAtTime(on?0:1,ctx.currentTime,.3);factoryLayer.gain.setTargetAtTime(on?1:0,ctx.currentTime,.3);}},
 portal(on:boolean){ducked=on;apply();},
 play(kind:Kind,amount=1){
  if(!ctx||!mix||ctx.state!=='running'||!settings.effects||document.hidden)return;
  const now=ctx.currentTime, gap=kind==='coin'?.17:kind==='dial'?.06:kind==='tap'?.045:.09;if(now-(last.get(kind)??-99)<gap)return;last.set(kind,now);
  const b=buffers.get(samples[kind]);if(b){const s=ctx.createBufferSource();s.buffer=b;s.playbackRate.value=1+(Math.random()-.5)*.08+(kind==='coin'?Math.min(amount,10)*.006:0);s.connect(mix.effects);s.start();s.onended=()=>s.disconnect();}
  else note(kind==='fail'?100:kind==='coin'?880:440,.16,.3,'triangle',0,kind==='fail'?60:660,false);
 },
 stop(){clearInterval(timer);timer=undefined;void ctx?.close().catch(()=>{});ctx=undefined;mix=undefined;buildLayer=factoryLayer=undefined;buffers.clear();last.clear();loading=false;ducked=factory=testing=false;beat=0;},
 // Read-only diagnostics for browser audio checks. No network or receipt state.
 inspect(){return {sampleCount:buffers.size,state:ctx?.state,master:mix?.master.gain.value,music:mix?.music.gain.value,effects:mix?.effects.gain.value,limiter:mix?.limiter.threshold.value};},
};
