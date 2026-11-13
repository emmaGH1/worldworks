// Procedural sound only. Nothing starts until a user gesture; lowfx is a default, not a lock.
type Settings = { music: boolean; effects: boolean; volume: number };
const low = new URLSearchParams(location.search).get('lowfx') === '1';
let settings: Settings = { music: !low, effects: !low, volume: .45 };
try { const saved = JSON.parse(localStorage.getItem('ww-audio6') ?? 'null'); if (saved) settings = { ...settings, ...saved }; else if(localStorage.getItem('ww-sound-muted')==='1') settings.music=settings.effects=false; } catch { /* storage unavailable */ }
let ctx: AudioContext | undefined, timer: ReturnType<typeof setInterval> | undefined;
let portalOn = false, testing = false, factory = false, beat = 0;
function tone(freq: number, duration: number, delay = 0, volume = .04, music = false, type: OscillatorType = 'sine', end = freq * 1.12) {
  if (!ctx || ctx.state !== 'running' || document.hidden || !(music ? settings.music : settings.effects)) return;
  const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, at); o.frequency.exponentialRampToValueAtTime(Math.max(20,end),at+duration);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(volume * settings.volume, at + .02); g.gain.exponentialRampToValueAtTime(.00001, at + duration);
  o.connect(g).connect(ctx.destination); o.start(at); o.stop(at+duration+.03); o.onended=()=>{o.disconnect();g.disconnect();};
}
function pulse() {
  const notes = [261.63,293.66,329.63,392,440,392,329.63,293.66];
  tone(notes[beat%8]*(testing?1.5:1), .9, 0, .026, true);
  if(beat%4===0) tone(portalOn?103.83:130.81,2.8,0,.023,true,'triangle',portalOn?110:130.81);
  if(portalOn) tone(110, .9,0,.025,false,'triangle',116);
  if(factory) {tone(90,.9,0,.009,false,'triangle',91);if(beat%2===0)tone(880,.12,0,.012,false,'sine',1320);}
  beat++;
}
export const sound = {
  get settings() { return {...settings}; },
  get muted() { return !settings.effects && !settings.music; },
  configure(patch: Partial<Settings>) { settings={...settings,...patch}; settings.volume=Math.max(0,Math.min(1,settings.volume)); try {localStorage.setItem('ww-audio6',JSON.stringify(settings));} catch { /* storage unavailable */ } },
  mute(value: boolean) { this.configure({music:!value,effects:!value}); },
  unlock() { try {ctx ??= new AudioContext(); void ctx.resume().catch(()=>{}); timer ??= setInterval(pulse, 750); } catch { /* audio unavailable */ } },
  test(on: boolean) { testing=on; },
  ambience(on: boolean) {factory=on;},
  play(kind: 'coin'|'place'|'pass'|'fail'|'gem'|'tap'|'pickup'|'dial'|'belt'|'tick'|'star'|'ship'|'beam'|'unlock', amount=1) {
    if(kind==='pass'||kind==='gem') [523,659,784,...(kind==='gem'?[1047]:[])].forEach((f,i)=>tone(f,.24,i*.12));
    else if(kind==='beam') tone(160,.65,0,.055,false,'triangle',1600);
    else if(kind==='fail') tone(120,.25,0,.045,false,'sawtooth',65);
    else if(kind==='ship'||kind==='unlock') [392,523,784].forEach((f,i)=>tone(f,.3,i*.14));
    else tone(kind==='coin'?660+Math.min(900,amount*45):kind==='star'?1047:kind==='tick'?784:kind==='pickup'?440:kind==='belt'?180:kind==='dial'?500:kind==='tap'?300:330,.12);
  },
  portal(on: boolean) {portalOn=on;},
  stop() { clearInterval(timer); timer=undefined;portalOn=factory=testing=false; void ctx?.close().catch(()=>{}); ctx=undefined; },
};
